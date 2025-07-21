from flask import Flask, request, jsonify, send_file
import os
import uuid
from datetime import datetime
import asyncio
import edge_tts

app = Flask(__name__)

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
        } for voice in voices if 'en-' in voice['Locale']])
    finally:
        loop.close()

@app.route('/generate', methods=['POST'])
def generate_tts():
    try:
        data = request.json
        
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing text parameter'}), 400
        
        text = data['text']
        voice = data.get('voice', 'en-US-AriaNeural')
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"tts_{timestamp}_{uuid.uuid4().hex[:8]}.wav"
        output_file = f"/assets/audio/{filename}"
        
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        # Generate TTS audio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            success = loop.run_until_complete(generate_edge_tts(text, voice, output_file))
        finally:
            loop.close()
        
        if success:
            return jsonify({
                'status': 'success',
                'audio_file': output_file,
                'text': text,
                'voice': voice
            })
        else:
            return jsonify({'error': 'Failed to generate TTS audio'}), 500
            
    except Exception as e:
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)