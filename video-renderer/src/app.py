from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import base64
import tempfile
from datetime import datetime
import uuid
import shutil
from PIL import Image
import io
import numpy as np
import random

# MoviePy 2 imports
from moviepy.video.VideoClip import VideoClip, ImageClip, ColorClip, TextClip
from moviepy.audio.io.AudioFileClip import AudioFileClip
from moviepy.video.compositing.CompositeVideoClip import CompositeVideoClip, clips_array, concatenate_videoclips
from moviepy.video.fx import Resize, Loop
from moviepy.video.io.VideoFileClip import VideoFileClip

app = Flask(__name__)
CORS(app)

VIDEO_WIDTH = 1280
VIDEO_HEIGHT = 720

def apply_camera_movement(clip, movement_type, duration, target_position='center'):
    """Apply camera movement based on the movement type from scene parser, supports English and Chinese"""
    if not movement_type or movement_type == "static" or movement_type == "静止":
        return clip

    # movement_type_lower = movement_type.lower()

    # # English and Chinese keywords mapping
    # pan_keywords = ["pan to", "平移", "推拉", "移动"]
    # closeup_keywords = ["close up", "zoom", "特写", "拉近", "放大"]
    # wide_keywords = ["wide shot", "establishing shot", "全景", "远景", "拉远", "缩小"]
    # focus_keywords = ["focus on", "聚焦", "对准", "聚集", "转向"]

    # if any(k in movement_type_lower for k in pan_keywords):
    #     # Pan movement - slide towards the target character
    #     # Adjusted for 1280x720 canvas and new character positions
        # if target_position == 'left':
    #         # Pan towards left character at 25% (320px from left)
    #         return clip.with_position(lambda t: (int(-100 * t/duration), 0))
    #     elif target_position == 'right':
    #         # Pan towards right character at 75% (960px from left)
    #         return clip.with_position(lambda t: (int(100 * t/duration), 0))
    #     else:  # center
    #         # Gentle pan towards center
    #         return clip.with_position(lambda t: (int(-30 * t/duration), 0))

    # elif any(k in movement_type_lower for k in closeup_keywords):
    #     # # Zoom in effect towards the target character
    #     zoom_factor = lambda t: min(1.6, 1 + 0.6 * t/duration)
        
    #     if target_position == 'left':
    #         # Zoom in and pan towards left character position
    #         return (clip.with_effects([Resize(zoom_factor)])
    #                .with_position(lambda t: (int(-120 * t/duration), int(-30 * t/duration))))
    #     elif target_position == 'right':
    #         # Zoom in and pan towards right character position
    #         return (clip.with_effects([Resize(zoom_factor)])
    #                .with_position(lambda t: (int(120 * t/duration), int(-30 * t/duration))))
    #     else:  # center
    #         # Zoom in towards center
    #         return clip.with_effects([Resize(zoom_factor)]).with_position(lambda t: (0, int(-20 * t/duration)))

    # elif any(k in movement_type_lower for k in wide_keywords):
    #     # Zoom out effect - start from slight zoom and go to full view
    #     def zoom_out_factor(t):
    #         # Start from 1.2x zoom and go to 1.0x (never below 1.0 to avoid black borders)
    #         return max(1.0, 1.2 - 0.2 * t/duration)
        
    #     # Start slightly off-center and move to center during zoom out
    #     return (clip.with_effects([Resize(zoom_out_factor)])
    #            .with_position(lambda t: (int(-15 * (1 - t/duration)), int(-10 * (1 - t/duration)))))

    # elif any(k in movement_type_lower for k in focus_keywords):
    #     # Focus movement - slight zoom towards target
    #     zoom_factor = lambda t: min(1.25, 1 + 0.25 * t/duration)
        
    #     if target_position == 'left':
    #         # Focus on left character
    #         return (clip.with_effects([Resize(zoom_factor)])
    #                .with_position(lambda t: (int(-60 * t/duration), int(-15 * t/duration))))
    #     elif target_position == 'right':
    #         # Focus on right character
    #         return (clip.with_effects([Resize(zoom_factor)])
    #                .with_position(lambda t: (int(60 * t/duration), int(-15 * t/duration))))
    #     else:  # center
    #         # Focus on center
    #         return (clip.with_effects([Resize(zoom_factor)])
    #                .with_position(lambda t: (0, int(-10 * t/duration))))

    # Default behavior for all other movements:
    # Zoom in towards the talking character
    zoom_factor = lambda t: min(1.2, 1 + 0.2 * t/duration)
    # zoom_factor = 1.
    
    if target_position == 'left':
        # Zoom in and pan towards left character position
        return (clip.with_effects([Resize(zoom_factor)])
                .with_position(lambda t: (int(30 * t/duration), int(-10 * t/duration))))
    elif target_position == 'right':
        # Zoom in and pan towards right character position
        return (clip.with_effects([Resize(zoom_factor)])
                .with_position(lambda t: (int(-200 * t/duration), int(-20 * t/duration))))
    else:  # center
        # Zoom in towards center
        return clip.with_effects([Resize(zoom_factor)]).with_position(lambda t: (0, int(-15 * t/duration)))

def create_subtitle_clip(text, duration, fontsize=40, color='white', bg_color='black'):
    """Create a subtitle clip with the given text"""
    try:
        # Use actual font file paths that are available in the Docker container
        font_options = [
            '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',      # WenQuanYi Zen Hei
            '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',    # WenQuanYi Micro Hei
            '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',  # Noto Sans CJK
            '/usr/share/fonts/truetype/arphic/ukai.ttc',         # AR PL UKai
            '/usr/share/fonts/truetype/arphic/uming.ttc',        # AR PL UMing
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',   # DejaVu Sans
        ]
        
        subtitle = None
        font_used = None
        
        # Try each font until one works
        for font_path in font_options:
            try:
                # Check if font file exists
                if os.path.exists(font_path):
                    subtitle = TextClip(
                        text=text,
                        font_size=fontsize,
                        color=color,
                        stroke_color=bg_color,
                        stroke_width=3,
                        font=font_path
                    ).with_duration(duration).with_position(('center', 0.82), relative=True)
                    font_used = font_path
                    print(f"Successfully created subtitle with font: {font_used}")
                    break
                else:
                    print(f"Font file not found: {font_path}")
            except Exception as font_error:
                print(f"Font {font_path} failed: {font_error}")
                continue
        
        # If no specific font works, try without specifying font
        if subtitle is None:
            try:
                subtitle = TextClip(
                    text=text,
                    font_size=fontsize,
                    color=color,
                    stroke_color=bg_color,
                    stroke_width=3
                ).with_duration(duration).with_position(('center', 0.82), relative=True)
                font_used = "default system font"
                print(f"Using default system font for subtitle")
            except Exception as e:
                print(f"Default font also failed: {e}")
                return None
        
        return subtitle
        
    except Exception as e:
        print(f"Error creating subtitle: {e}")
        return None

def get_scene_characters(scene):
    """Extract all unique characters from a scene (excluding narrator)"""
    characters = set()
    for sub_scene in scene.get('sub_scenes', []):
        for storyboard in sub_scene.get('storyboards', []):
            character = storyboard.get('character', '').strip()
            if character and character.lower() not in ['narrator', '旁白']:
                characters.add(character)
    return list(characters)

def get_character_position(character_index, total_characters):
    """Calculate character position based on index and total count - closer spacing"""
    if total_characters == 1:
        return 'center'
    elif total_characters == 2:
        return 'left' if character_index == 0 else 'right'
    else:
        # For 3+ characters, distribute across screen with closer spacing
        positions = ['left', 'center', 'right']
        if total_characters <= 3:
            return positions[character_index]
        else:
            # For more than 3 characters, use relative positioning with closer spacing
            spacing = 0.6 / (total_characters + 1)  # Reduced spacing
            x_position = 0.2 + spacing * (character_index + 1)  # Start from 0.2 instead of 0
            if x_position < 0.4:
                return 'left'
            elif x_position > 0.6:
                return 'right'
            else:
                return 'center'

def get_character_image_for_scene(character_name, scene):
    """Find the character image for a given character in the scene"""
    for sub_scene in scene.get('sub_scenes', []):
        for storyboard in sub_scene.get('storyboards', []):
            if storyboard.get('character', '').strip() == character_name:
                return storyboard.get('character_image', '')
    return ''

def create_scene_clip(scene, scene_characters, scene_background, audio_files, audio_start_index):
    """Create a complete clip for a scene with all characters present"""
    scene_clips = []
    current_audio_index = audio_start_index
    
    print(f"Creating scene with characters: {scene_characters}")
    
    for sub_scene_idx, sub_scene in enumerate(scene.get('sub_scenes', [])):
        camera_movement = sub_scene.get('camera_movement', 'static')
        print(f"  Processing sub-scene {sub_scene_idx}, camera: {camera_movement}")
        
        for storyboard_idx, storyboard in enumerate(sub_scene.get('storyboards', [])):
            print(f"      Processing storyboard {storyboard_idx}, audio_index: {current_audio_index}")
            
            if current_audio_index >= len(audio_files):
                print(f"Warning: No more audio files available")
                break
            
            audio_file = audio_files[current_audio_index]
            if not os.path.exists(audio_file):
                print(f"Audio file not found: {audio_file}")
                current_audio_index += 1
                continue
            
            # Get the speaking character for this storyboard to determine camera target
            speaking_character = storyboard.get('character', '').strip()
            camera_target_position = 'center'
            
            if speaking_character and speaking_character.lower() not in ['narrator', '旁白']:
                if speaking_character in scene_characters:
                    char_index = scene_characters.index(speaking_character)
                    camera_target_position = get_character_position(char_index, len(scene_characters))
                    print(f"      Speaking character: {speaking_character}, camera target: {camera_target_position}")
                else:
                    camera_movement = 'static'
                    camera_target_position = 'center'
            else:
                camera_movement = 'static'
                camera_target_position = 'center'
                print(f"      Narrator speaking, camera static")
            
            # Load audio to get duration
            try:
                audio_clip = AudioFileClip(audio_file)
                duration = max(0.5, audio_clip.duration)
                print(f"      Audio duration: {duration}s")
            except Exception as e:
                print(f"Error loading audio file {audio_file}: {e}")
                duration = 3.0
                audio_clip = None
            
            # Create background clip
            background = None
            if scene_background and os.path.exists(scene_background):
                try:
                    print(f"      Loading background: {scene_background}")
                    background = ImageClip(scene_background).with_duration(duration)
                    background = background.with_effects([Resize((VIDEO_WIDTH, VIDEO_HEIGHT))])
                    print(f"      Background loaded successfully")
                except Exception as e:
                    print(f"Error loading background {scene_background}: {e}")
                    background = None
            
            if background is None:
                print(f"      Using default background")
                background = ColorClip(size=(VIDEO_WIDTH, VIDEO_HEIGHT), color=(50, 50, 50)).with_duration(duration)
            
            # Create character clips for all scene characters - closer positioning
            character_clips = []
            
            for char_index, character_name in enumerate(scene_characters):
                character_image_path = get_character_image_for_scene(character_name, scene)
                
                if character_image_path and os.path.exists(character_image_path):
                    try:
                        print(f"        Loading character {character_name}: {character_image_path}")
                        
                        # Load base character image
                        character = ImageClip(character_image_path).with_duration(duration)
                        
                        # Resize character with closer spacing
                        char_width = 250 if len(scene_characters) > 2 else 350
                        character = character.with_effects([Resize(width=char_width)])
                        
                        # Get expression for the speaking character in this storyboard
                        expression_name = "嘲笑"  # Default expression
                        speaking_character = storyboard.get('character', '').strip()
                        
                        expression_name = storyboard.get('expression', '嘲笑')
                        expression_gif_path = f"/app/src/expressions/{expression_name}.gif"
                        if not os.path.exists(expression_gif_path):
                            # Fallback: randomly select from available expressions
                            fallback_expressions = ["嘲笑.gif", "嚣张.gif", "大笑.gif"]
                            random_expr = random.choice(fallback_expressions)
                            expression_gif_path = f"/app/src/expressions/{random_expr}"
                        
                        if os.path.exists(expression_gif_path):
                            try:
                                print(f"        Loading expression: {expression_gif_path}")                                
                        
                                # This character is speaking, anime their expression
                                if speaking_character == character_name:
                                    # Load expression GIF and loop it for the duration
                                    expression_clip = VideoFileClip(expression_gif_path, fps_source='tbr', has_mask = True)
                                else:
                                    expression_clip = VideoFileClip(expression_gif_path, has_mask = True)

                                # Get the original GIF duration
                                gif_duration = expression_clip.duration
                                # Loop the GIF to match the audio duration
                                if duration > gif_duration:
                                    # Calculate how many loops we need
                                    loops_needed = int(duration / gif_duration) + 1
                                    expression_clip = expression_clip.with_effects([Loop(n=loops_needed)]).with_duration(duration)
                                
                                # Resize expression to fit on character's face area
                                # Assuming face area is roughly the top 40% and center 60% of character
                                face_width = int(char_width * 0.25)
                                expression_clip = expression_clip.with_effects([Resize(width=face_width)])
                                
                                # Position expression on character's face area
                                # Adjust these offsets based on your character image layout
                                face_offset_x = char_width * 0.4  # 20% from left edge
                                face_offset_y = char_width * 0.25  # 10% from top
                                expression_clip = expression_clip.with_position((face_offset_x, face_offset_y))
                                
                                # Composite character base with expression
                                character = CompositeVideoClip([character, expression_clip])
                                print(f"        Expression applied successfully")
                                
                            except Exception as e:
                                print(f"        Error loading expression {expression_gif_path}: {e}")
                        else:
                            print(f"        Default expression file not found: {expression_gif_path}")
                        
                        # Position characters closer together
                        position = get_character_position(char_index, len(scene_characters))
                        if position == 'left':
                            # Closer to center
                            character = character.with_position((VIDEO_WIDTH * 0.25, 'bottom'))
                        elif position == 'right':
                            # Closer to center
                            character = character.with_position((VIDEO_WIDTH * 0.5, 'bottom'))
                        else:  # center
                            character = character.with_position(('center', 'bottom'))
                        
                        character_clips.append(character)
                        print(f"        Character {character_name} loaded successfully at position {position}")
                        
                    except Exception as e:
                        print(f"Error loading character {character_name}: {e}")
            
            # Composite background and characters into a static scene
            static_scene_clips = [background] + character_clips
            static_scene = CompositeVideoClip(static_scene_clips)
            
            # Apply camera movement to the entire static scene
            video_with_camera = apply_camera_movement(static_scene, camera_movement, duration, camera_target_position)
            
            # Add subtitle
            dialogue_line = storyboard.get('line', '')
            character_name = storyboard.get('character', '')
            subtitle_text = f"{character_name}: {dialogue_line}" if character_name.lower() not in ['narrator', '旁白'] else dialogue_line
            
            if subtitle_text.strip():
                print(f"        Adding subtitle: {subtitle_text[:50]}...")
                # Use larger font size for better readability
                subtitle = create_subtitle_clip(subtitle_text, duration, fontsize=40)
                if subtitle:
                    video_with_camera = CompositeVideoClip([video_with_camera, subtitle])
            
            # Attach audio
            if audio_clip:
                video_with_camera = video_with_camera.with_audio(audio_clip)
                print(f"        Audio attached")
            
            scene_clips.append(video_with_camera)
            current_audio_index += 1
            print(f"        Clip created successfully")
    
    return scene_clips, current_audio_index

def render_video(scenes_data, audio_files, output_file):
    """Render video with talking head animations, camera moves, and subtitles"""
    all_clips = []
    audio_index = 0
    
    print(f"Starting video render with {len(scenes_data.get('scenes', []))} scenes")
    
    for scene_idx, scene in enumerate(scenes_data.get('scenes', [])):
        scene_background = scene.get('background', '')
        print(f"Processing scene {scene_idx}, background: {scene_background}")
        
        # Get all characters in this scene
        scene_characters = get_scene_characters(scene)
        print(f"Scene characters: {scene_characters}")
        
        # Create clips for this scene
        scene_clips, audio_index = create_scene_clip(
            scene, scene_characters, scene_background, audio_files, audio_index
        )
        
        all_clips.extend(scene_clips)
        print(f"Scene {scene_idx} completed with {len(scene_clips)} clips")
    
    if not all_clips:
        raise Exception("No valid clips were created")
    
    print(f"Created {len(all_clips)} video clips, concatenating...")
    
    # Concatenate all clips
    final_video = concatenate_videoclips(all_clips, method="compose")
    
    print(f"Writing video to: {output_file}")
    
    # Write the final video
    final_video.write_videofile(
        output_file, 
        fps=24,
        codec='libx264',
        audio_codec='aac',
        temp_audiofile='temp-audio.m4a',
        remove_temp=True,
        logger=None
    )
    
    print(f"Video saved to: {output_file}")
    
    # Clean up
    for clip in all_clips:
        try:
            clip.close()
        except:
            pass
    
    try:
        final_video.close()
    except:
        pass

def save_base64_to_temp_file(base64_data, file_extension='.png'):
    """Convert base64 data to temporary file and return file path"""
    try:
        if not base64_data:
            return None
            
        print(f"Processing base64 data: {base64_data[:50]}...")
        
        # Handle data URL format
        if base64_data.startswith('data:image'):
            # Extract the actual base64 part
            if ',' in base64_data:
                header, base64_data = base64_data.split(',', 1)
                print(f"Data URL header: {header}")
            else:
                print("Warning: Data URL missing comma separator")
                return None
        
        # Decode base64 data
        try:
            file_data = base64.b64decode(base64_data)
            print(f"Decoded {len(file_data)} bytes of image data")
        except Exception as e:
            print(f"Failed to decode base64 data: {e}")
            return None
        
        # Validate it's actually image data by trying to open with PIL
        try:
            img = Image.open(io.BytesIO(file_data))
            print(f"Image validation successful: {img.format} {img.size} {img.mode}")
            
            # Keep transparency for PNG images - don't convert to RGB
            if img.format == 'PNG' and img.mode in ('RGBA', 'LA'):
                print(f"Preserving transparency for PNG image")
                # Save as PNG to preserve transparency
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
                img.save(temp_file.name, 'PNG')
                temp_file.close()
                print(f"PNG with transparency saved to: {temp_file.name}")
                return temp_file.name
            else:
                # Convert to RGB for other formats
                if img.mode in ('RGBA', 'LA', 'P'):
                    print(f"Converting image from {img.mode} to RGB")
                    # Create white background
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                    img = background
                
                # Save the processed image
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_extension)
                img.save(temp_file.name, 'PNG', quality=95)
                temp_file.close()
                
                print(f"Image saved to: {temp_file.name}")
                return temp_file.name
            
        except Exception as e:
            print(f"Invalid image data: {e}")
            return None
            
    except Exception as e:
        print(f"Error converting base64 to temp file: {e}")
        return None

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'video-renderer'})

@app.route('/render', methods=['POST'])
def render_video_endpoint():
    temp_files_to_cleanup = []
    temp_dirs_to_cleanup = []
    
    try:
        data = request.json
        
        # Validate input
        if not data or 'scenes' not in data or 'audio_files' not in data:
            return jsonify({'error': 'Missing scenes or audio_files parameters'}), 400
        
        scenes = data['scenes']
        audio_files_base64 = data['audio_files']
        bgm = data.get('bgm')
        
        print(f"Received {len(scenes)} scenes and {len(audio_files_base64)} audio files")
        
        # Debug: Print first scene data
        if scenes:
            first_scene = scenes[0]
            print(f"First scene keys: {list(first_scene.keys())}")
            print(f"First scene background type: {type(first_scene.get('background'))}")
            if first_scene.get('background'):
                bg_data = first_scene['background']
                print(f"Background data preview: {bg_data[:100]}...")
        
        # Create temporary directory for audio files
        temp_audio_dir = tempfile.mkdtemp(prefix='audio_')
        temp_dirs_to_cleanup.append(temp_audio_dir)
        
        # Convert base64 audio data to temporary files
        temp_audio_files = []
        for i, audio_base64 in enumerate(audio_files_base64):
            try:
                if not audio_base64:
                    continue
                    
                # Remove data URL prefix if present
                if ',' in audio_base64:
                    audio_base64 = audio_base64.split(',')[1]
                
                # Decode base64 audio data
                audio_data = base64.b64decode(audio_base64)
                
                # Create temporary audio file
                temp_audio_file = os.path.join(temp_audio_dir, f'audio_{i:03d}.mp3')
                with open(temp_audio_file, 'wb') as f:
                    f.write(audio_data)
                
                temp_audio_files.append(temp_audio_file)
                print(f"Created temp audio file: {temp_audio_file} ({len(audio_data)} bytes)")
                
            except Exception as e:
                print(f"Error processing audio file {i}: {e}")
                continue
        
        # Process scenes to convert base64 images to temporary files
        processed_scenes = []
        for scene_idx, scene in enumerate(scenes):
            processed_scene = scene.copy()
            
            # Handle background image
            bg_data = processed_scene.get('background', '')
            if bg_data:
                print(f"Processing background image for scene {scene_idx}")
                temp_bg_file = save_base64_to_temp_file(bg_data, '.png')
                if temp_bg_file:
                    processed_scene['background'] = temp_bg_file
                    temp_files_to_cleanup.append(temp_bg_file)
                    print(f"Background image saved to: {temp_bg_file}")
                else:
                    processed_scene['background'] = ''
                    print(f"Failed to process background image for scene {scene_idx}")
            else:
                print(f"No background data for scene {scene_idx}")
                processed_scene['background'] = ''
            
            # Handle character images in storyboards
            if 'sub_scenes' in processed_scene:
                for sub_idx, sub_scene in enumerate(processed_scene['sub_scenes']):
                    if 'storyboards' in sub_scene:
                        for sb_idx, storyboard in enumerate(sub_scene['storyboards']):
                            char_data = storyboard.get('character_image', '')
                            if char_data:
                                print(f"Processing character image for scene {scene_idx}, sub {sub_idx}, sb {sb_idx}")
                                temp_char_file = save_base64_to_temp_file(char_data, '.png')
                                if temp_char_file:
                                    storyboard['character_image'] = temp_char_file
                                    temp_files_to_cleanup.append(temp_char_file)
                                    print(f"Character image saved to: {temp_char_file}")
                                else:
                                    storyboard['character_image'] = ''
                                    print(f"Failed to process character image for scene {scene_idx}, sub {sub_idx}, sb {sb_idx}")
                            else:
                                print(f"No character data for scene {scene_idx}, sub {sub_idx}, sb {sb_idx}")
                                storyboard['character_image'] = ''
            
            processed_scenes.append(processed_scene)
        
        # Debug: Print processed data
        if processed_scenes:
            first_processed = processed_scenes[0]
            print(f"First processed scene background: {first_processed.get('background')}")
            if first_processed.get('sub_scenes'):
                first_sub = first_processed['sub_scenes'][0]
                if first_sub.get('storyboards'):
                    first_sb = first_sub['storyboards'][0]
                    print(f"First processed storyboard character: {first_sb.get('character_image')}")
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"video_{timestamp}_{uuid.uuid4().hex[:8]}.mp4"
        
        # Ensure output directory exists
        output_dir = "/app/src/outputs"
        os.makedirs(output_dir, exist_ok=True)
        output_file = os.path.join(output_dir, filename)
        
        # Prepare scenes data for the renderer
        scenes_data = {'scenes': processed_scenes}
        
        print(f"Rendering video with {len(processed_scenes)} scenes and {len(temp_audio_files)} audio files")
        print(f"Output file: {output_file}")
        
        # Render the video
        render_video(scenes_data, temp_audio_files, output_file)
        
        return jsonify({
            'status': 'success',
            'video_file': f"/outputs/{filename}",
            'scenes_count': len(processed_scenes),
            'audio_files_processed': len(temp_audio_files)
        })
        
    except Exception as e:
        print(f"Error in render endpoint: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500
    
    finally:
        # Clean up temporary files
        print("Cleaning up temporary files...")
        for temp_file in temp_files_to_cleanup:
            try:
                if os.path.isfile(temp_file):
                    os.unlink(temp_file)
                    print(f"Cleaned up temp file: {temp_file}")
            except Exception as e:
                print(f"Error cleaning up temp file {temp_file}: {e}")
        
        # Clean up temporary directories
        for temp_dir in temp_dirs_to_cleanup:
            try:
                if os.path.isdir(temp_dir):
                    shutil.rmtree(temp_dir)
                    print(f"Cleaned up temp directory: {temp_dir}")
            except Exception as e:
                print(f"Error cleaning up temp directory {temp_dir}: {e}")

@app.route('/outputs/<filename>')
def serve_video(filename):
    """Serve generated video files"""
    try:
        video_path = os.path.join("/app/src/outputs", filename)
        if os.path.exists(video_path):
            return send_file(video_path, mimetype='video/mp4')
        else:
            return jsonify({'error': 'Video file not found'}), 404
    except Exception as e:
        return jsonify({'error': f'Error serving video: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)  # Make sure port is 5000