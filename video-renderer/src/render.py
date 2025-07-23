import moviepy as mp
from PIL import Image
import os
import numpy as np

def apply_camera_movement(clip, movement_type, duration):
    """Apply camera movement based on the movement type from scene parser"""
    if not movement_type or movement_type == "static":
        return clip
    
    # Get clip dimensions
    w, h = clip.size
    
    if "pan to" in movement_type.lower():
        # Pan movement - slide horizontally
        return clip.set_position(lambda t: (max(-50, int(-50 * t/duration)), 0))
    
    elif "close up" in movement_type.lower() or "zoom" in movement_type.lower():
        # Zoom in effect
        return clip.resize(lambda t: min(2.0, 1 + 0.3 * t/duration))
    
    elif "wide shot" in movement_type.lower() or "establishing shot" in movement_type.lower():
        # Zoom out effect or static wide view
        return clip.resize(lambda t: max(0.8, 1 - 0.2 * t/duration))
    
    elif "focus on" in movement_type.lower():
        # Slight zoom with position adjustment
        zoom_factor = lambda t: min(1.3, 1 + 0.15 * t/duration)
        return clip.resize(zoom_factor).set_position('center')
    
    else:
        # Default: gentle zoom
        return clip.resize(lambda t: min(1.2, 1 + 0.1 * t/duration))

def create_subtitle_clip(text, duration, fontsize=24, color='white', bg_color='black'):
    """Create a subtitle clip with the given text"""
    try:
        subtitle = mp.TextClip(
            text,
            fontsize=fontsize,
            color=color,
            font='Arial-Bold',
            stroke_color=bg_color,
            stroke_width=2
        ).set_duration(duration).set_position(('center', 'bottom')).set_margin(20)
        return subtitle
    except Exception as e:
        print(f"Error creating subtitle: {e}")
        return None

def render_video(scenes_data, audio_files, output_file):
    """Render video with talking head animations, camera moves, and subtitles"""
    clips = []
    audio_index = 0
    
    print(f"Starting video render with {len(scenes_data.get('scenes', []))} scenes")
    
    for scene_idx, scene in enumerate(scenes_data.get('scenes', [])):
        scene_background = scene.get('background', '')
        print(f"Processing scene {scene_idx}, background: {scene_background}")
        
        for sub_scene_idx, sub_scene in enumerate(scene.get('sub_scenes', [])):
            camera_movement = sub_scene.get('camera_movement', 'static')
            print(f"  Sub-scene {sub_scene_idx}, camera: {camera_movement}")
            
            for storyboard_idx, storyboard in enumerate(sub_scene.get('storyboards', [])):
                print(f"    Storyboard {storyboard_idx}, audio_index: {audio_index}")
                
                if audio_index >= len(audio_files):
                    print(f"Warning: No more audio files available for storyboard {audio_index}")
                    break
                
                audio_file = audio_files[audio_index]
                if not os.path.exists(audio_file):
                    print(f"Audio file not found: {audio_file}")
                    audio_index += 1
                    continue
                
                # Load audio to get duration
                try:
                    audio_clip = mp.AudioFileClip(audio_file)
                    duration = max(0.5, audio_clip.duration)  # Minimum 0.5 seconds
                    print(f"    Audio duration: {duration}s")
                except Exception as e:
                    print(f"Error loading audio file {audio_file}: {e}")
                    duration = 3.0  # Default duration
                    audio_clip = None
                
                # Load background image
                background = None
                if scene_background and os.path.exists(scene_background):
                    try:
                        print(f"    Loading background: {scene_background}")
                        background = mp.ImageClip(scene_background).set_duration(duration)
                        # Resize to standard video size
                        background = background.resize((1920, 1080))
                        # Apply camera movement to background
                        background = apply_camera_movement(background, camera_movement, duration)
                        print(f"    Background loaded successfully")
                    except Exception as e:
                        print(f"Error loading background {scene_background}: {e}")
                        background = None
                
                if background is None:
                    # Create a default colored background
                    print(f"    Using default background")
                    background = mp.ColorClip(size=(1920, 1080), color=(50, 50, 50)).set_duration(duration)
                
                # Load character image if available
                character_image_path = storyboard.get('character_image', '')
                video = background  # Start with background
                
                if character_image_path and os.path.exists(character_image_path):
                    try:
                        print(f"    Loading character: {character_image_path}")
                        if character_image_path.lower().endswith('.gif'):
                            character = mp.VideoFileClip(character_image_path).loop(duration=duration)
                        else:
                            character = mp.ImageClip(character_image_path).set_duration(duration)
                        
                        # Resize character to fit properly
                        char_width = 400  # Fixed width for consistency
                        character = character.resize(width=char_width)
                        
                        # Position character based on camera movement
                        if "pan to" in camera_movement.lower():
                            character = character.set_position(('right', 'bottom'))
                        else:
                            character = character.set_position(('center', 'bottom'))
                        
                        # Composite background and character
                        video = mp.CompositeVideoClip([background, character])
                        print(f"    Character loaded successfully")
                    except Exception as e:
                        print(f"Error loading character image {character_image_path}: {e}")
                        video = background
                else:
                    print(f"    No character image")
                
                # Create subtitle from the dialogue line
                dialogue_line = storyboard.get('line', '')
                character_name = storyboard.get('character', '')
                subtitle_text = f"{character_name}: {dialogue_line}" if character_name != 'Narrator' else dialogue_line
                
                if subtitle_text.strip():
                    print(f"    Adding subtitle: {subtitle_text[:50]}...")
                    subtitle = create_subtitle_clip(subtitle_text, duration)
                    if subtitle:
                        video = mp.CompositeVideoClip([video, subtitle])
                
                # Set audio if available
                if audio_clip:
                    video = video.set_audio(audio_clip)
                    print(f"    Audio attached")
                
                clips.append(video)
                audio_index += 1
                print(f"    Clip {len(clips)} created successfully")
    
    if not clips:
        raise Exception("No valid clips were created")
    
    print(f"Created {len(clips)} video clips, concatenating...")
    
    # Concatenate all clips
    final_video = mp.concatenate_videoclips(clips, method='compose')
    
    print(f"Writing video to: {output_file}")
    
    # Write the final video
    final_video.write_videofile(
        output_file, 
        fps=24,
        codec='libx264',
        audio_codec='aac',
        temp_audiofile='temp-audio.m4a',
        remove_temp=True,
        verbose=False,
        logger=None
    )
    
    print(f"Video saved to: {output_file}")
    
    # Clean up
    for clip in clips:
        try:
            clip.close()
        except:
            pass
    
    try:
        final_video.close()
    except:
        pass