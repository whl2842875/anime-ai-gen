import moviepy as mp
from PIL import Image
import os

def render_video(scenes, audio_files, output_file):
    """
    Render video with talking head animations and camera moves
    """
    clips = []
    
    for i, (scene, audio_file) in enumerate(zip(scenes, audio_files)):
        # Load audio to get duration
        audio_clip = mp.AudioFileClip(audio_file)
        duration = audio_clip.duration
        
        # Load background
        background = mp.ImageClip(scene['background']).set_duration(duration)
        
        # Load character sprites/GIFs
        if scene['character'].endswith('.gif'):
            character = mp.VideoFileClip(scene['character']).loop(duration=duration)
        else:
            character = mp.ImageClip(scene['character']).set_duration(duration)
        
        # Apply simple camera moves (zoom/pan)
        if i % 2 == 0:  # Zoom in on even scenes
            background = background.resize(lambda t: 1 + 0.1 * t/duration)
        else:  # Pan on odd scenes
            background = background.set_position(lambda t: (-50 * t/duration, 0))
        
        # Composite video
        video = mp.CompositeVideoClip([background, character.set_position('center')])
        video = video.set_audio(audio_clip)
        clips.append(video)
    
    # Concatenate all clips
    final_video = mp.concatenate_videoclips(clips)
    final_video.write_videofile(output_file, fps=24)
    
    # Clean up
    for clip in clips:
        clip.close()
    final_video.close()

if __name__ == "__main__":
    # Example usage
    scenes = [
        {'background': 'assets/backgrounds/background1.jpg', 'character': 'assets/characters/character1.png', 'duration': 5},
        {'background': 'assets/backgrounds/background2.jpg', 'character': 'assets/characters/character2.png', 'duration': 5}
    ]
    audio_files = ['audio1.mp3', 'audio2.mp3']
    output_file = 'output/final_video.mp4'
    
    render_video(scenes, audio_files, output_file)