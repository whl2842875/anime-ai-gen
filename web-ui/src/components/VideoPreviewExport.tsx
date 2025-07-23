import { useState, useEffect } from 'react'
import { storageManager } from '../utils/storage'

interface VideoPreviewExportProps {
  parsed: any
}

interface AudioData {
  id: string
  audioUrl: string
  audioData?: string
  isGenerating: boolean
  error?: string
}

export default function VideoPreviewExport({ parsed }: VideoPreviewExportProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [audioData, setAudioData] = useState<Record<string, AudioData>>({})
  const [characterImages, setCharacterImages] = useState<Record<string, string>>({})
  const [backgroundImages, setBackgroundImages] = useState<Record<string, string>>({})
  const [bgmSettings, setBgmSettings] = useState<any>(null)

  // Load all required data from storage
  useEffect(() => {
    const loadData = async () => {
      try {
        const [savedAudio, images, backgrounds, bgm] = await Promise.all([
          storageManager.getData('audioFiles'),
          storageManager.getData('characterImages'),
          storageManager.getData('backgroundImages'),
          storageManager.getData('bgmSettings')
        ])

        if (savedAudio) setAudioData(savedAudio)
        if (images) setCharacterImages(images)
        if (backgrounds) setBackgroundImages(backgrounds)
        if (bgm) setBgmSettings(bgm)
      } catch (error) {
        console.error('Failed to load data:', error)
      }
    }

    loadData()
  }, [])

  // Generate unique ID for each storyboard line (same as TtsGeneration)
  const getStoryboardId = (sceneIdx: number, subIdx: number, sbIdx: number) => {
    return `${sceneIdx}-${subIdx}-${sbIdx}`
  }

  // Prepare video data with all required information
  const prepareVideoData = () => {
    if (!parsed?.scenes) return null

    const audioFiles: string[] = []
    const enhancedScenes = parsed.scenes.map((scene: any, sceneIdx: number) => ({
      ...scene,
      background: backgroundImages[scene.scene_id ?? sceneIdx] || '',
      sub_scenes: scene.sub_scenes?.map((sub: any, subIdx: number) => ({
        ...sub,
        storyboards: sub.storyboards?.map((sb: any, sbIdx: number) => {
          const id = getStoryboardId(sceneIdx, subIdx, sbIdx)
          const audio = audioData[id]
          
          // Add audio data if available
          if (audio?.audioData && !audio.error) {
            audioFiles.push(audio.audioData) // Use base64 data
          }
          
          return {
            ...sb,
            character_image: characterImages[sb.character] || '',
            audio_id: id,
            has_audio: !!(audio?.audioData && !audio.error)
          }
        }) || []
      })) || []
    }))

    return {
      scenes: enhancedScenes, // Changed from scenes_data to scenes
      audio_files: audioFiles,
      bgm: bgmSettings
    }
  }

  const handleGenerateVideo = async () => {
    if (!parsed || !parsed.scenes) {
      setError('No parsed scenes available')
      return
    }

    const videoData = prepareVideoData()
    if (!videoData) {
      setError('Failed to prepare video data')
      return
    }

    if (videoData.audio_files.length === 0) {
      setError('No audio files available. Please generate TTS first.')
      return
    }

    console.log('Sending video data:', {
      scenes_count: videoData.scenes.length,
      audio_files_count: videoData.audio_files.length,
      has_bgm: !!videoData.bgm
    })

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch('http://localhost:5003/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(videoData)
      })

      const result = await response.json()
      console.log('Video render response:', result)

      if (response.ok) {
        setVideoUrl(result.video_file)
      } else {
        setError(result.error || 'Failed to generate video')
      }
    } catch (err) {
      console.error('Video generation error:', err)
      setError('Network error: Could not connect to video renderer')
    } finally {
      setIsGenerating(false)
    }
  }

  // Count available audio files
  const availableAudioCount = Object.values(audioData).filter(
    audio => audio.audioData && !audio.error && !audio.isGenerating
  ).length

  // Count total expected audio files
  const totalExpectedAudio = parsed?.scenes?.reduce((total: number, scene: any) => {
    return total + (scene.sub_scenes?.reduce((subTotal: number, sub: any) => {
      return subTotal + (sub.storyboards?.length || 0)
    }, 0) || 0)
  }, 0) || 0

  return (
    <div>
      <h2>5. Video Preview & Export</h2>
      
      {parsed && parsed.scenes ? (
        <div>
          <p>Ready to generate video with:</p>
          <ul>
            <li>{parsed.scenes.length} scenes</li>
            <li>{availableAudioCount} of {totalExpectedAudio} audio files available</li>
            <li>{Object.keys(characterImages).length} character images</li>
            <li>{Object.keys(backgroundImages).length} background images</li>
            {bgmSettings && <li>Background music: {bgmSettings.fileName}</li>}
          </ul>
          
          {availableAudioCount < totalExpectedAudio && (
            <div style={{ 
              color: '#ff9800', 
              marginBottom: '10px',
              padding: '10px',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '4px'
            }}>
              Warning: {totalExpectedAudio - availableAudioCount} audio files are missing. 
              Please go back to TTS Generation and generate all audio files first.
            </div>
          )}
          
          <button 
            onClick={handleGenerateVideo}
            disabled={isGenerating || availableAudioCount === 0}
            style={{
              backgroundColor: isGenerating ? '#666' : availableAudioCount === 0 ? '#ccc' : '#646cff',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: isGenerating || availableAudioCount === 0 ? 'not-allowed' : 'pointer',
              marginBottom: '10px'
            }}
          >
            {isGenerating ? 'Generating Video...' : 'Generate Video'}
          </button>

          {error && (
            <div style={{ 
              color: '#d32f2f', 
              marginTop: '10px',
              padding: '10px',
              backgroundColor: '#ffebee',
              border: '1px solid #ffcdd2',
              borderRadius: '4px'
            }}>
              Error: {error}
            </div>
          )}

          {videoUrl && (
            <div style={{ marginTop: '20px' }}>
              <h3>Video Generated Successfully!</h3>
              <video 
                controls 
                width="800" 
                style={{ maxWidth: '100%' }}
                src={`http://localhost:5003${videoUrl}`}
              >
                Your browser does not support the video tag.
              </video>
              <br />
              <a 
                href={`http://localhost:5003${videoUrl}`} 
                download
                style={{ 
                  display: 'inline-block', 
                  marginTop: '10px',
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px'
                }}
              >
                Download Video
              </a>
            </div>
          )}
        </div>
      ) : (
        <p>No scenes available for video generation.</p>
      )}
    </div>
  )
}