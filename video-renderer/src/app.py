from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import base64
import tempfile
from datetime import datetime
import uuid
from render import render_video
import shutil

app = Flask(__name__)
CORS(app)

def save_base64_to_temp_file(base64_data, file_extension='.png'):
    """Convert base64 data to temporary file and return file path"""
    try:
        if not base64_data or not base64_data.startswith('data:image'):
            return None
            
        # Remove data URL prefix if present
        if ',' in base64_data:
            base64_data = base64_data.split(',')[1]
        
        # Decode base64 data
        file_data = base64.b64decode(base64_data)
        
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_extension)
        temp_file.write(file_data)
        temp_file.close()
        
        print(f"Created temp file: {temp_file.name} ({len(file_data)} bytes)")
        return temp_file.name
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
            if processed_scene.get('background'):
                bg_data = processed_scene['background']
                if bg_data.startswith('data:image'):
                    print(f"Processing background image for scene {scene_idx}")
                    temp_bg_file = save_base64_to_temp_file(bg_data, '.png')
                    if temp_bg_file:
                        processed_scene['background'] = temp_bg_file
                        temp_files_to_cleanup.append(temp_bg_file)
                        print(f"Background image saved to: {temp_bg_file}")
                    else:
                        processed_scene['background'] = ''
                        print(f"Failed to process background image for scene {scene_idx}")
                elif bg_data and not os.path.exists(bg_data):
                    # If it's not base64 and file doesn't exist, clear it
                    processed_scene['background'] = ''
            
            # Handle character images in storyboards
            if 'sub_scenes' in processed_scene:
                for sub_idx, sub_scene in enumerate(processed_scene['sub_scenes']):
                    if 'storyboards' in sub_scene:
                        for sb_idx, storyboard in enumerate(sub_scene['storyboards']):
                            if storyboard.get('character_image'):
                                char_data = storyboard['character_image']
                                if char_data.startswith('data:image'):
                                    print(f"Processing character image for scene {scene_idx}, sub {sub_idx}, sb {sb_idx}")
                                    temp_char_file = save_base64_to_temp_file(char_data, '.png')
                                    if temp_char_file:
                                        storyboard['character_image'] = temp_char_file
                                        temp_files_to_cleanup.append(temp_char_file)
                                        print(f"Character image saved to: {temp_char_file}")
                                    else:
                                        storyboard['character_image'] = ''
                                        print(f"Failed to process character image for scene {scene_idx}, sub {sub_idx}, sb {sb_idx}")
                                elif char_data and not os.path.exists(char_data):
                                    # If it's not base64 and file doesn't exist, clear it
                                    storyboard['character_image'] = ''
            
            processed_scenes.append(processed_scene)
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"video_{timestamp}_{uuid.uuid4().hex[:8]}.mp4"
        
        # Ensure output directory exists
        output_dir = "/assets/videos"
        os.makedirs(output_dir, exist_ok=True)
        output_file = os.path.join(output_dir, filename)
        
        # Prepare scenes data for the renderer
        scenes_data = {'scenes': processed_scenes}
        
        print(f"Rendering video with {len(processed_scenes)} scenes and {len(temp_audio_files)} audio files")
        print(f"Output file: {output_file}")
        
        # Debug: Print first scene data
        if processed_scenes:
            first_scene = processed_scenes[0]
            print(f"First scene background: {first_scene.get('background', 'None')}")
            if first_scene.get('sub_scenes'):
                first_sub = first_scene['sub_scenes'][0]
                if first_sub.get('storyboards'):
                    first_sb = first_sub['storyboards'][0]
                    print(f"First storyboard character_image: {first_sb.get('character_image', 'None')}")
        
        # Render the video
        render_video(scenes_data, temp_audio_files, output_file)
        
        return jsonify({
            'status': 'success',
            'video_file': f"/assets/videos/{filename}",
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

@app.route('/assets/videos/<filename>')
def serve_video(filename):
    """Serve generated video files"""
    try:
        video_path = os.path.join("/assets/videos", filename)
        if os.path.exists(video_path):
            return send_file(video_path, mimetype='video/mp4')
        else:
            return jsonify({'error': 'Video file not found'}), 404
    except Exception as e:
        return jsonify({'error': f'Error serving video: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5003, debug=True)