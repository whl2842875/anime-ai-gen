import { useState, useEffect } from 'react'
import { storageManager } from '../utils/storage'

interface AudioData {
  id: string
  audioUrl: string
  audioData?: string
  isGenerating: boolean
  error?: string
}

export default function VideoPreviewExport() {
  const [parsed, setParsed] = useState<any>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [audioData, setAudioData] = useState<Record<string, AudioData>>({})
  const [characterImages, setCharacterImages] = useState<Record<string, string>>({})
  const [backgroundImages, setBackgroundImages] = useState<Record<string, string>>({})
  const [bgmSettings, setBgmSettings] = useState<any>(null)

  // Load all required data from storage on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [savedParsed, savedAudio, images, backgrounds, bgm, savedVideo] = await Promise.all([
          storageManager.getData('parsed'),
          storageManager.getData('audioFiles'),
          storageManager.getData('characterImages'),
          storageManager.getData('backgroundImages'),
          storageManager.getData('bgmSettings'),
          storageManager.getData('videoFile')
        ])

        if (savedParsed) setParsed(savedParsed)
        if (savedAudio) setAudioData(savedAudio)
        if (images) setCharacterImages(images)
        if (backgrounds) setBackgroundImages(backgrounds)
        if (bgm) setBgmSettings(bgm)
        if (savedVideo) setVideoUrl(savedVideo)
      } catch (error) {
        console.error('Failed to load data:', error)
        setError('Failed to load application data')
      }
    }

    loadData()
  }, [])

  // Save video URL to storage when it changes
  useEffect(() => {
    if (videoUrl) {
      storageManager.saveData('videoFile', videoUrl).catch(console.error)
    }
  }, [videoUrl])

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
      scenes: enhancedScenes,
      audio_files: audioFiles,
      bgm: bgmSettings
    }
  }

  const handleGenerateVideo = async () => {
    if (!parsed || !parsed.scenes) {
      setError('No parsed scenes available. Please go back to Script Parser and parse your script first.')
      return
    }

    const videoData = prepareVideoData()
    if (!videoData) {
      setError('Failed to prepare video data')
      return
    }

    if (videoData.audio_files.length === 0) {
      setError('No audio files available. Please go back to TTS Generation and generate audio files first.')
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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log('Video render response:', result)

      if (result.video_file) {
        setVideoUrl(result.video_file)
        // Save to storage for persistence
        await storageManager.saveData('videoFile', result.video_file)
      } else {
        setError(result.error || 'Failed to generate video')
      }
    } catch (err: any) {
      console.error('Video generation error:', err)
      if (err.message.includes('Failed to fetch')) {
        setError('Network error: Could not connect to video renderer. Please make sure the video renderer server is running on port 5003.')
      } else {
        setError(err.message || 'Failed to generate video')
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const clearVideo = async () => {
    if (window.confirm('Are you sure you want to clear the generated video?')) {
      try {
        await storageManager.deleteData('videoFile')
        setVideoUrl(null)
        setError(null)
      } catch (error) {
        console.error('Failed to clear video:', error)
        setError('Failed to clear video from storage')
      }
    }
  }

  // Count available audio files
  const availableAudioCount = Object.values(audioData).filter(
    audio => audio.audioData && !audio.error && !audio.isGenerating
  ).length

  // Count total expected audio files
  const totalExpectedAudio = parsed?.scenes?.reduce((total: number, scene: any) => {
    return total + (scene.sub_scenes?.reduce((subTotal: number, sub: any) => {
      return subTotal + (sub.storyboards?.filter((sb: any) => sb.line && sb.character).length || 0)
    }, 0) || 0)
  }, 0) || 0

  // Check if all required data is available
  const hasCharacterImages = Object.keys(characterImages).length > 0
  const hasBackgroundImages = Object.keys(backgroundImages).length > 0
  const canGenerateVideo = parsed && availableAudioCount > 0 && hasCharacterImages && hasBackgroundImages

  if (!parsed) {
    return (
      <div>
        <h2>5. Video Preview & Export</h2>
        <div style={{ color: '#888', padding: 20, textAlign: 'center' }}>
          <p>No parsed script data found.</p>
          <p>Please go back to the Script Parser and parse your script first.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2>5. Video Preview & Export</h2>
      <p style={{ color: '#888', marginBottom: 12, fontSize: 14 }}>
        Generate and preview your final anime video with all scenes, characters, and audio.
      </p>
      
      <div style={{ marginBottom: 16 }}>
        <h3>Project Summary:</h3>
        <div style={{ 
          background: '#1a1a1a', 
          padding: 12, 
          borderRadius: 6, 
          border: '1px solid #444',
          marginBottom: 16 
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <strong>📝 Scenes:</strong> {parsed.scenes?.length || 0}
            </div>
            <div style={{ color: availableAudioCount === totalExpectedAudio ? '#4caf50' : '#ff9800' }}>
              <strong>🎙️ Audio:</strong> {availableAudioCount}/{totalExpectedAudio}
            </div>
            <div style={{ color: hasCharacterImages ? '#4caf50' : '#ff6b6b' }}>
              <strong>👥 Characters:</strong> {Object.keys(characterImages).length}
            </div>
            <div style={{ color: hasBackgroundImages ? '#4caf50' : '#ff6b6b' }}>
              <strong>🖼️ Backgrounds:</strong> {Object.keys(backgroundImages).length}
            </div>
            {bgmSettings && (
              <div style={{ color: '#4caf50' }}>
                <strong>🎵 BGM:</strong> {bgmSettings.fileName}
              </div>
            )}
          </div>
        </div>

        {/* Validation Messages */}
        {!hasCharacterImages && (
          <div style={{ 
            color: '#ff6b6b', 
            marginBottom: 8,
            padding: 8,
            background: '#2a1a1a',
            border: '1px solid #ff6b6b',
            borderRadius: 4,
            fontSize: 14
          }}>
            ⚠️ No character images found. Please go back to step 2 and add character images.
          </div>
        )}

        {!hasBackgroundImages && (
          <div style={{ 
            color: '#ff6b6b', 
            marginBottom: 8,
            padding: 8,
            background: '#2a1a1a',
            border: '1px solid #ff6b6b',
            borderRadius: 4,
            fontSize: 14
          }}>
            ⚠️ No background images found. Please go back to step 2 and add background images.
          </div>
        )}

        {availableAudioCount < totalExpectedAudio && (
          <div style={{ 
            color: '#ff9800', 
            marginBottom: 8,
            padding: 8,
            background: '#2a1a1a',
            border: '1px solid #ff9800',
            borderRadius: 4,
            fontSize: 14
          }}>
            ⚠️ {totalExpectedAudio - availableAudioCount} audio files are missing. 
            Please go back to step 4 and generate all TTS audio files.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <button 
          onClick={handleGenerateVideo}
          disabled={isGenerating || !canGenerateVideo}
          style={{
            padding: '12px 24px',
            background: isGenerating ? '#666' : !canGenerateVideo ? '#444' : '#646cff',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: isGenerating || !canGenerateVideo ? 'not-allowed' : 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          {isGenerating ? (
            <>
              <span>⏳</span>
              Generating Video...
            </>
          ) : (
            <>
              <span>🎬</span>
              Generate Video
            </>
          )}
        </button>

        {videoUrl && (
          <button 
            onClick={clearVideo}
            style={{
              padding: '12px 24px',
              background: '#ff6b6b',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <span>🗑️</span>
            Clear Video
          </button>
        )}
      </div>

      {error && (
        <div style={{ 
          color: '#ff6b6b', 
          marginBottom: 16,
          padding: 12,
          background: '#2a1a1a',
          border: '1px solid #ff6b6b',
          borderRadius: 6
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {isGenerating && (
        <div style={{ 
          color: '#888', 
          background: '#1a1a1a', 
          padding: 12, 
          borderRadius: 6, 
          marginBottom: 16,
          border: '1px solid #444'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⏳</span>
            Generating your anime video... This may take several minutes depending on the length and complexity.
          </div>
        </div>
      )}

      {videoUrl && (
        <div style={{ 
          marginTop: 20,
          padding: 16,
          background: '#1a1a1a',
          border: '1px solid #4caf50',
          borderRadius: 6
        }}>
          <h3 style={{ color: '#4caf50', marginBottom: 12 }}>
            ✅ Video Generated Successfully!
          </h3>
          
          <video 
            controls 
            width="800" 
            style={{ 
              maxWidth: '100%', 
              borderRadius: 6,
              marginBottom: 12
            }}
            src={`http://localhost:5003${videoUrl}`}
          >
            Your browser does not support the video tag.
          </video>
          
          <div style={{ display: 'flex', gap: 12 }}>
            <a 
              href={`http://localhost:5003${videoUrl}`} 
              download
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                background: '#4caf50',
                color: 'white',
                textDecoration: 'none',
                borderRadius: 4,
                fontSize: 14
              }}
            >
              <span>📥</span>
              Download Video
            </a>
            
            <button
              onClick={() => navigator.clipboard.writeText(`http://localhost:5003${videoUrl}`)}
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                background: '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              <span>📋</span>
              Copy Link
            </button>
          </div>
        </div>
      )}
    </div>
  )
}