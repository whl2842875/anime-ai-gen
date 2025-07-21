from flask import Flask, request, jsonify
import os
import uuid
from datetime import datetime
from render import render_video

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'video-renderer'})

@app.route('/render', methods=['POST'])
def render_video_endpoint():
    try:
        data = request.json
        
        # Validate input
        if not data or 'scenes' not in data or 'audio_files' not in data:
            return jsonify({'error': 'Missing scenes or audio_files parameters'}), 400
        
        scenes = data['scenes']
        audio_files = data['audio_files']
        
        # Generate unique filename if not provided
        if 'output_file' in data:
            output_file = data['output_file']
        else:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"video_{timestamp}_{uuid.uuid4().hex[:8]}.mp4"
            output_file = f"/assets/videos/{filename}"
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        # Validate that all required files exist
        for scene in scenes:
            if not os.path.exists(scene.get('background', '')):
                return jsonify({'error': f"Background file not found: {scene.get('background')}"}), 400
            if not os.path.exists(scene.get('character', '')):
                return jsonify({'error': f"Character file not found: {scene.get('character')}"}), 400
        
        for audio_file in audio_files:
            if not os.path.exists(audio_file):
                return jsonify({'error': f"Audio file not found: {audio_file}"}), 400
        
        # Render the video
        render_video(scenes, audio_files, output_file)
        
        return jsonify({
            'status': 'success',
            'video_file': output_file,
            'scenes_count': len(scenes)
        })
        
    except Exception as e:
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)