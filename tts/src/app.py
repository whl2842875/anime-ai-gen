from flask import Flask, request, jsonify, send_file
import os
import uuid
from datetime import datetime
import asyncio
import edge_tts
from flask_cors import CORS
import tempfile
import atexit
import threading
import time

app = Flask(__name__)
CORS(app)

# Store temporary files for cleanup
temp_files = []
cleanup_lock = threading.Lock()

def cleanup_temp_files():
    """Clean up temporary files"""
    with cleanup_lock:
        for file_path in temp_files[:]:
            try:
                if os.path.exists(file_path):
                    os.unlink(file_path)
                temp_files.remove(file_path)
            except Exception as e:
                print(f"Error cleaning up {file_path}: {e}")

def schedule_cleanup(file_path, delay=300):  # Clean up after 5 minutes
    """Schedule file cleanup after delay"""
    def cleanup():
        time.sleep(delay)
        with cleanup_lock:
            try:
                if os.path.exists(file_path):
                    os.unlink(file_path)
                if file_path in temp_files:
                    temp_files.remove(file_path)
            except Exception as e:
                print(f"Error in scheduled cleanup of {file_path}: {e}")
    
    threading.Thread(target=cleanup, daemon=True).start()

# Register cleanup on exit
atexit.register(cleanup_temp_files)

async def generate_edge_tts(text, voice, output_file):
    """Generate TTS using Edge TTS"""
    try:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_file)
        return True
    except Exception as e:
        print(f"Error generating TTS: {e}")
        return False

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'tts'})

@app.route('/voices', methods=['GET'])
def get_voices():
    """Get available Edge TTS voices"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        voices = loop.run_until_complete(edge_tts.list_voices())
        return jsonify([{
            'name': voice['Name'],
            'display_name': voice['DisplayName'],
            'locale': voice['Locale']
        } for voice in voices if 'en-' in voice['Locale'] or 'zh-' in voice['Locale']])
    finally:
        loop.close()

@app.route('/generate_tts', methods=['POST'])  # Changed endpoint name to match frontend
def generate_tts():
    try:
        data = request.json
        
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing text parameter'}), 400
        
        text = data['text']
        voice = data.get('voice', 'en-US-AriaNeural')
        
        print(f"Generating TTS for: '{text}' with voice: {voice}")
        
        # Create temporary file for audio - use .mp3 extension as Edge TTS outputs MP3
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
        output_file = temp_file.name
        temp_file.close()
        
        # Add to cleanup list
        with cleanup_lock:
            temp_files.append(output_file)
        
        # Generate TTS audio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            success = loop.run_until_complete(generate_edge_tts(text, voice, output_file))
        finally:
            loop.close()
        
        if success and os.path.exists(output_file):
            print(f"TTS generation successful, file size: {os.path.getsize(output_file)} bytes")
            
            # Schedule cleanup after 5 minutes
            schedule_cleanup(output_file)
            
            # Return the audio file directly
            return send_file(
                output_file,
                mimetype='audio/mpeg',  # Changed to MP3 MIME type
                as_attachment=False,
                download_name=f'tts_audio.mp3'
            )
        else:
            print("TTS generation failed")
            # Clean up temp file if generation failed
            with cleanup_lock:
                if output_file in temp_files:
                    temp_files.remove(output_file)
            if os.path.exists(output_file):
                os.unlink(output_file)
            return jsonify({'error': 'Failed to generate TTS audio'}), 500
            
    except Exception as e:
        print(f"Exception in generate_tts: {e}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)