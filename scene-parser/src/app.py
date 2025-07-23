from flask import Flask, request, jsonify
import json
import os
import re
import torch
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Import llama-cpp-python for GGUF model inference
from llama_cpp import Llama

# Path to your GGUF model
# MODEL_PATH = os.path.join(os.path.dirname(__file__), "../model/qwen2-1_5b-instruct-q4_k_m.gguf")  # 940M
# MODEL_PATH = os.path.join(os.path.dirname(__file__), "../model/Qwen3-1.7B-Q8_0.gguf")  # 1.7G
MODEL_PATH = os.path.join(os.path.dirname(__file__), "../model/Qwen3-4B-Q4_K_M.gguf")  # 2.32G

# GPU selection logic
def get_n_gpu_layers():
    try:
        # torch.cuda.is_available() returns True if CUDA GPU is present
        if torch.cuda.is_available():
            return 99  # Use all layers on GPU if possible
    except Exception:
        pass
    return 0  # CPU fallback

# Load the model once at startup, offloading to GPU if available
llm = Llama(
    model_path=MODEL_PATH,
    enable_thinking=False,  # Disable thinking mode for faster inference
    n_ctx=2560,
    n_threads=4,
    n_gpu_layers=get_n_gpu_layers()  # <- This enables GPU acceleration!
)

def build_prompt(user_text):
    return f"""
You are an expert scriptwriter AI.  
Given a brief story, dialogue, or summary, your job is to **expand it into a well-structured JSON script** suitable for animation or video generation.  
**Follow the required format, rules, and sample exactly.**

Generate a JSON script with this exact structure:
{{
  "scenes": [
    {{
      "scene_id": 1,
      "scene_desc": "location description",
      "sub_scenes": [
        {{
          "sub_scene_id": 1,
          "camera_movement": "camera description",
          "storyboards": [
            {{
              "character": "character name or Narrator",
              "expression": "emotion",
              "line": "dialogue or narration"
            }}
          ]
        }}
      ]
    }}
  ]
}}

### Rules:
1. **Output ONLY valid JSON**—no extra text, no code fences, no comments.
2. **No repetition.** Only output the JSON object *once*.
3. **Do not add blank lines before or after the JSON.**
4. Be *logically consistent* and make sure the output matches the input context.
5. Expand creatively, but keep it believable and faithful to the input.
6. Scene/character/action details should make sense and match the input's intent.
7. Use "Narrator" for narration; always spell it correctly.
8. Every scene and sub-scene must have at least one item in "storyboards".
9. Do not invent settings or characters not implied or requested by the input.
10. Never include markdown/code block syntax.

### Example Input:
Two person catching up.

### Example Output:
{{
  "scenes": [
    {{
      "scene_id": 1,
      "scene_desc": "indoor, office, daytime",
      "sub_scenes": [
        {{
          "sub_scene_id": 1,
          "camera_movement": "static",
          "storyboards": [
            {{
              "character": "Alex",
              "expression": "happy",
              "line": "Hi, Sam! How are you today?"
            }}
          ]
        }},
        {{
          "sub_scene_id": 2,
          "camera_movement": "pan to Sam",
          "storyboards": [
            {{
              "character": "Sam",
              "expression": "neutral",
              "line": "Hey Alex, I’m good, thanks. How about you?"
            }}
          ]
        }},
        {{
          "sub_scene_id": 3,
          "camera_movement": "wide shot",
          "storyboards": [
            {{
              "character": "Alex",
              "expression": "excited",
              "line": "I’m doing well! Are you working on anything interesting?"
            }}
          ]
        }},
        {{
          "sub_scene_id": 4,
          "camera_movement": "pan to Sam",
          "storyboards": [
            {{
              "character": "Sam",
              "expression": "confident",
              "line": "Yeah, I just started a new project."
            }}
          ]
        }},
        {{
          "sub_scene_id": 5,
          "camera_movement": "close up on Alex",
          "storyboards": [
            {{
              "character": "Alex",
              "expression": "happy",
              "line": "That’s awesome! Good luck with it!"
            }}
          ]
        }},
        {{
          "sub_scene_id": 6,
          "camera_movement": "pan to Sam",
          "storyboards": [
            {{
              "character": "Sam",
              "expression": "grateful",
              "line": "Thanks! Let’s catch up later."
            }}
          ]
        }}
      ]
    }},
    {{
      "scene_id": 2,
      "scene_desc": "outdoor, park, evening",
      "sub_scenes": [
        {{
          "sub_scene_id": 1,
          "camera_movement": "establishing shot",
          "storyboards": [
            {{
              "character": "Narrator",
              "expression": "neutral",
              "line": "Later in the coffee room."
            }}
          ]
        }},
        {{
          "sub_scene_id": 2,
          "camera_movement": "focus on Alex",
          "storyboards": [
            {{
              "character": "Alex",
              "expression": "confident",
              "line": "Hi, Sam! How is your project going?"
            }}
          ]
        }},
        {{
          "sub_scene_id": 3,
          "camera_movement": "pan to Sam",
          "storyboards": [
            {{
              "character": "Sam",
              "expression": "confident",
              "line": "Hey Alex. It's almost done!"
            }}
          ]
        }},
        {{
          "sub_scene_id": 4,
          "camera_movement": "close up on Sam",
          "storyboards": [
            {{
              "character": "Sam",
              "expression": "happy",
              "line": "Good to hear that!"
            }}
          ]
        }}
      ]
    }}
  ]
}}

### Now, generate the formatted JSON for the following input, please note not to include any markdown formatting or code blocks, and ensure the JSON is valid without trailing commas. And no extra explaination or comments, just the JSON output:
{user_text}
"""

def extract_first_valid_json(text):
    # Clean the text
    text = text.strip()
    
    # Remove any markdown code blocks more aggressively
    text = re.sub(r"```(?:json)?\s*\n?", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\n?```\s*", "", text, flags=re.MULTILINE)
    
    # Remove extra explanatory text before JSON (like "Here is the JSON output:" or "The JSON script for...")
    text = re.sub(r'^.*?(?=\{)', '', text, flags=re.DOTALL)
    
    # Find the first complete JSON object by counting braces
    brace_count = 0
    json_start = -1
    json_end = -1
    
    for i, char in enumerate(text):
        if char == '{':
            if json_start == -1:
                json_start = i
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0 and json_start != -1:
                json_end = i + 1
                break
    
    if json_start != -1 and json_end != -1:
        json_text = text[json_start:json_end]
        
        # Fix common JSON syntax errors
        # Remove trailing commas before closing brackets/braces
        json_text = re.sub(r',(\s*[}\]])', r'\1', json_text)
        
        try:
            parsed_json = json.loads(json_text)
            
            # Validate and fix the structure
            if "scenes" in parsed_json:
                # Remove scenes with empty sub_scenes
                parsed_json["scenes"] = [scene for scene in parsed_json["scenes"] 
                                       if scene.get("sub_scenes") and len(scene["sub_scenes"]) > 0]
                
                for scene in parsed_json["scenes"]:
                    # Ensure scene_desc is not empty
                    if not scene.get("scene_desc", "").strip():
                        scene["scene_desc"] = "indoor scene"
            
            return parsed_json
            
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            print(f"Attempted to parse: {json_text[:500]}...")
            return None
    
    return None

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'scene-parser'})

@app.route('/parse', methods=['POST'])
def parse_scene():
    data = request.json
    user_text = data.get('text', '')

    prompt = build_prompt(user_text)
    # Call the model
    output = llm(
      prompt,
      max_tokens=2048,  # Increased from 4096 for adequate output length
      stop=["</s>", "```\n\n", "\n\nThe answer"],
      temperature=0.7,   # Increased from 0.2 for better diversity
      top_p=0.8,         # Decreased from 0.95 for more focused sampling
      top_k=20,          # Added for better control
      min_p=0,           # Added as recommended
      presence_penalty=1.5,  # Added to suppress repetitive outputs
      repeat_penalty=1.1  # Added to reduce repetition
    )
        
    # Try to extract JSON from the model's output
    response_text = output["choices"][0]["text"]

    print("============================== LLM RESPONSE START ==============================")
    print(response_text)
    print("============================== LLM RESPONSE END ==============================")

    scenes = extract_first_valid_json(response_text)
    if not scenes:
        scenes = {"error": "Failed to parse model output", "raw_output": response_text}

    print("============================== SCENES START ==============================")
    print(scenes)
    print("============================== SCENES END ==============================")

    return jsonify(scenes)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)