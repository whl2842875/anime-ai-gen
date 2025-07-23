import React, { useState, useEffect } from 'react'
import { storageManager } from '../utils/storage'

interface TtsGenerationProps {
  parsed: any
  onComplete: () => void
}

interface AudioData {
  id: string
  audioUrl: string  // This will be the blob URL for playback
  audioData?: string // This will store the base64 data for persistence
  isGenerating: boolean
  error?: string
}

export default function TtsGeneration({ parsed, onComplete }: TtsGenerationProps) {
  const [characterImages, setCharacterImages] = useState<Record<string, string>>({})
  const [backgroundImages, setBackgroundImages] = useState<Record<string, string>>({})
  const [voiceSettings, setVoiceSettings] = useState<Record<string, string>>({})
  const [audioData, setAudioData] = useState<Record<string, AudioData>>({})
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)

  // Load all required data from storage
  useEffect(() => {
    const loadData = async () => {
      try {
        const [images, backgrounds, voices, savedAudio] = await Promise.all([
          storageManager.getData('characterImages'),
          storageManager.getData('backgroundImages'),
          storageManager.getData('voiceSettings'),
          storageManager.getData('audioFiles')
        ])

        if (images) setCharacterImages(images)
        if (backgrounds) setBackgroundImages(backgrounds)
        if (voices) setVoiceSettings(voices)
        
        // Restore audio data and recreate blob URLs
        if (savedAudio) {
          const restoredAudio: Record<string, AudioData> = {}
          
          Object.entries(savedAudio).forEach(([id, audio]: [string, any]) => {
            if (audio.audioData) {
              // Recreate blob URL from stored base64 data
              try {
                const binaryString = atob(audio.audioData.split(',')[1])
                const bytes = new Uint8Array(binaryString.length)
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i)
                }
                const blob = new Blob([bytes], { type: 'audio/mpeg' })
                const audioUrl = URL.createObjectURL(blob)
                
                restoredAudio[id] = {
                  ...audio,
                  audioUrl: audioUrl
                }
              } catch (error) {
                console.error(`Failed to restore audio for ${id}:`, error)
                // Keep the audio data but mark as error for regeneration
                restoredAudio[id] = {
                  ...audio,
                  audioUrl: '',
                  error: 'Failed to restore audio, please regenerate'
                }
              }
            } else {
              restoredAudio[id] = audio
            }
          })
          
          setAudioData(restoredAudio)
        }
      } catch (error) {
        console.error('Failed to load data:', error)
      }
    }

    loadData()
  }, [])

  // Save audio data whenever it changes
  useEffect(() => {
    if (Object.keys(audioData).length > 0) {
      // Prepare data for storage (without blob URLs, but with base64 data)
      const dataToSave: Record<string, AudioData> = {}
      Object.entries(audioData).forEach(([id, audio]) => {
        dataToSave[id] = {
          id: audio.id,
          audioUrl: '', // Don't store blob URLs
          audioData: audio.audioData, // Store base64 data
          isGenerating: audio.isGenerating,
          error: audio.error
        }
      })
      
      storageManager.saveData('audioFiles', dataToSave).catch(console.error)
    }
  }, [audioData])

  // Generate unique ID for each storyboard line
  const getStoryboardId = (sceneIdx: number, subIdx: number, sbIdx: number) => {
    return `${sceneIdx}-${subIdx}-${sbIdx}`
  }

  // Generate TTS audio for a specific line
  const generateTTS = async (text: string, voice: string, id: string) => {
    setAudioData(prev => ({
      ...prev,
      [id]: { id, audioUrl: '', isGenerating: true }
    }))

    try {
      console.log(`Generating TTS for: "${text}" with voice: ${voice}`)
      
      const response = await fetch('http://localhost:5002/generate_tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: voice
        })
      })

      console.log(`Response status: ${response.status}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || 'Unknown error'}`)
      }

      // Check if response is actually audio
      const contentType = response.headers.get('content-type')
      console.log(`Content-Type: ${contentType}`)
      
      if (!contentType || !contentType.includes('audio')) {
        throw new Error('Response is not audio data')
      }

      const audioBlob = await response.blob()
      console.log(`Audio blob size: ${audioBlob.size} bytes, type: ${audioBlob.type}`)
      
      if (audioBlob.size === 0) {
        throw new Error('Received empty audio file')
      }

      // Create blob URL for immediate playback
      const audioUrl = URL.createObjectURL(audioBlob)
      console.log(`Created audio URL: ${audioUrl}`)

      // Convert blob to base64 for storage
      const reader = new FileReader()
      reader.onload = function() {
        const base64Data = reader.result as string
        
        setAudioData(prev => ({
          ...prev,
          [id]: { 
            id, 
            audioUrl, 
            audioData: base64Data, // Store base64 for persistence
            isGenerating: false 
          }
        }))
      }
      reader.readAsDataURL(audioBlob)

    } catch (error) {
      console.error('TTS generation failed:', error)
      setAudioData(prev => ({
        ...prev,
        [id]: { 
          id, 
          audioUrl: '', 
          isGenerating: false, 
          error: error instanceof Error ? error.message : 'Failed to generate audio'
        }
      }))
    }
  }

  // Generate all TTS audio
  const generateAllTTS = async () => {
    if (!parsed?.scenes) return

    setIsGeneratingAll(true)
    
    try {
      // Collect all the lines that need TTS generation
      const generationTasks: Array<{
        text: string
        voice: string
        id: string
      }> = []

      parsed.scenes.forEach((scene: any, sceneIdx: number) => {
        scene.sub_scenes?.forEach((sub: any, subIdx: number) => {
          sub.storyboards?.forEach((sb: any, sbIdx: number) => {
            if (sb.line && sb.character && voiceSettings[sb.character]) {
              const id = getStoryboardId(sceneIdx, subIdx, sbIdx)
              // Only generate if not already generated or if there's an error
              if (!audioData[id] || audioData[id].error || !audioData[id].audioData) {
                generationTasks.push({
                  text: sb.line,
                  voice: voiceSettings[sb.character],
                  id: id
                })
              }
            }
          })
        })
      })

      console.log(`Starting generation of ${generationTasks.length} audio files`)

      // Process in batches to avoid overwhelming the server
      const batchSize = 3 // Process 3 at a time
      for (let i = 0; i < generationTasks.length; i += batchSize) {
        const batch = generationTasks.slice(i, i + batchSize)
        
        // Process current batch in parallel
        await Promise.all(
          batch.map(task => generateTTS(task.text, task.voice, task.id))
        )
        
        // Small delay between batches to be nice to the server
        if (i + batchSize < generationTasks.length) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      console.log('All TTS generation completed')
    } catch (error) {
      console.error('Error in generateAllTTS:', error)
    } finally {
      setIsGeneratingAll(false)
    }
  }

  // Delete specific audio
  const deleteAudio = (id: string) => {
    if (playingAudio === id) {
      stopAudio()
    }

    setAudioData(prev => {
      const updated = { ...prev }
      
      // Revoke the blob URL to free memory
      if (updated[id]?.audioUrl) {
        URL.revokeObjectURL(updated[id].audioUrl)
      }
      
      delete updated[id]
      return updated
    })
  }

  // Delete all generated audio
  const deleteAllAudio = () => {
    if (window.confirm('Are you sure you want to delete all generated audio files?')) {
      // Stop any playing audio
      if (playingAudio) {
        stopAudio()
      }

      // Revoke all blob URLs to free memory
      Object.values(audioData).forEach(audio => {
        if (audio.audioUrl) {
          URL.revokeObjectURL(audio.audioUrl)
        }
      })

      setAudioData({})
      
      // Clear from storage
      storageManager.deleteData('audioFiles').catch(console.error)
    }
  }

  // Enhanced play audio function with better error handling
  const playAudio = async (id: string) => {
    try {
      // Stop currently playing audio
      if (playingAudio) {
        const currentAudio = document.getElementById(`audio-${playingAudio}`) as HTMLAudioElement
        if (currentAudio) {
          currentAudio.pause()
          currentAudio.currentTime = 0
        }
      }

      // Play new audio
      const audio = document.getElementById(`audio-${id}`) as HTMLAudioElement
      if (audio) {
        console.log(`Attempting to play audio: ${audio.src}`)
        
        // Check if audio source is valid
        if (!audio.src || audio.src.startsWith('blob:')) {
          // If blob URL is invalid, try to recreate it from stored data
          const audioInfo = audioData[id]
          if (audioInfo?.audioData) {
            try {
              const binaryString = atob(audioInfo.audioData.split(',')[1])
              const bytes = new Uint8Array(binaryString.length)
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i)
              }
              const blob = new Blob([bytes], { type: 'audio/mpeg' })
              const newAudioUrl = URL.createObjectURL(blob)
              
              // Update the audio source and state
              audio.src = newAudioUrl
              setAudioData(prev => ({
                ...prev,
                [id]: { ...prev[id], audioUrl: newAudioUrl }
              }))
            } catch (error) {
              console.error('Failed to recreate audio blob:', error)
              throw new Error('Audio data corrupted, please regenerate')
            }
          } else {
            throw new Error('No audio data available, please regenerate')
          }
        }
        
        // Wait for audio to be ready
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Audio loading timeout'))
          }, 5000)

          audio.oncanplaythrough = () => {
            clearTimeout(timeoutId)
            resolve(undefined)
          }
          
          audio.onerror = (e) => {
            clearTimeout(timeoutId)
            console.error('Audio error:', e)
            reject(new Error('Audio loading error'))
          }

          // If already ready, resolve immediately
          if (audio.readyState >= 3) {
            clearTimeout(timeoutId)
            resolve(undefined)
          }

          // Force load if needed
          audio.load()
        })

        setPlayingAudio(id)
        await audio.play()
        
        audio.onended = () => setPlayingAudio(null)
        audio.onerror = (e) => {
          console.error('Audio playback error:', e)
          setPlayingAudio(null)
        }
      }
    } catch (error) {
      console.error('Error playing audio:', error)
      setPlayingAudio(null)
      alert(`Failed to play audio: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Stop audio
  const stopAudio = () => {
    if (playingAudio) {
      const audio = document.getElementById(`audio-${playingAudio}`) as HTMLAudioElement
      if (audio) {
        audio.pause()
        audio.currentTime = 0
      }
      setPlayingAudio(null)
    }
  }

  // Count generated audio files
  const generatedAudioCount = Object.values(audioData).filter(audio => 
    (audio.audioUrl || audio.audioData) && !audio.isGenerating && !audio.error
  ).length

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(audioData).forEach(audio => {
        if (audio.audioUrl) {
          URL.revokeObjectURL(audio.audioUrl)
        }
      })
    }
  }, [])

  return (
    <div>
      <h2>4. TTS Generation</h2>
      
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={generateAllTTS}
          disabled={isGeneratingAll}
          style={{
            padding: '12px 24px',
            background: isGeneratingAll ? '#666' : '#646cff',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: isGeneratingAll ? 'not-allowed' : 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          {isGeneratingAll ? (
            <>
              <span>⏳</span>
              Generating All Audio...
            </>
          ) : (
            <>
              <span>🎙️</span>
              Generate All TTS
            </>
          )}
        </button>
        
        {generatedAudioCount > 0 && (
          <button
            onClick={deleteAllAudio}
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
            Delete All Audio ({generatedAudioCount})
          </button>
        )}
        
        {playingAudio && (
          <button
            onClick={stopAudio}
            style={{
              padding: '8px 16px',
              background: '#ff6b6b',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            ⏹️ Stop
          </button>
        )}
      </div>

      {parsed && parsed.scenes && parsed.scenes.length > 0 ? (
        <div style={{ 
          maxHeight: 400, 
          overflow: 'auto', 
          background: '#0f0e0eff', 
          padding: 12, 
          borderRadius: 6 
        }}>
          {parsed.scenes.map((scene: any, sceneIdx: number) => (
            <div key={scene.scene_id ?? sceneIdx} style={{ marginBottom: 24 }}>
              {/* Scene header with background thumbnail and scene name */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                {/* Background thumbnail - display only */}
                <div 
                  style={{
                    width: 48, 
                    height: 32, 
                    background: backgroundImages[scene.scene_id ?? sceneIdx] ? '#666' : '#666',
                    backgroundImage: backgroundImages[scene.scene_id ?? sceneIdx] 
                      ? `url("${backgroundImages[scene.scene_id ?? sceneIdx]}")` 
                      : 'none',
                    backgroundSize: 'contain',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    borderRadius: 4,
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    marginRight: 12,
                  }}
                >
                  {!backgroundImages[scene.scene_id ?? sceneIdx] && (
                    <span role="img" aria-label="background" style={{ fontSize: 14 }}>🖼️</span>
                  )}
                </div>
                <div style={{
                  fontWeight: 'bold',
                  fontSize: 18,
                  marginRight: 8,
                }}>
                  {scene.scene_desc || `Scene: ${scene.scene_id ?? sceneIdx + 1}`}
                </div>
              </div>
              
              {/* Sub-scenes */}
              {scene.sub_scenes && scene.sub_scenes.map((sub: any, subIdx: number) => (
                <div key={sub.sub_scene_id ?? subIdx} style={{ marginLeft: 16, marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    Sub scene: {sub.sub_scene_id ?? subIdx + 1}{' '}
                    <span style={{ fontWeight: 400, fontSize: 13, color: '#888' }}>
                      ({sub.camera_movement})
                    </span>
                  </div>
                  
                  {sub.storyboards && sub.storyboards.map((sb: any, sbIdx: number) => {
                    const id = getStoryboardId(sceneIdx, subIdx, sbIdx)
                    const audio = audioData[id]
                    const hasVoice = voiceSettings[sb.character]
                    const hasAudioData = audio && (audio.audioUrl || audio.audioData)
                    
                    return (
                      <div key={sbIdx} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        marginBottom: 4,
                        gap: 8
                      }}>
                        {/* Character image - display only */}
                        <div 
                          style={{
                            width: 32, 
                            height: 32, 
                            background: characterImages[sb.character] ? '#ccc' : '#ccc',
                            backgroundImage: characterImages[sb.character] 
                              ? `url("${characterImages[sb.character]}")` 
                              : 'none',
                            backgroundSize: 'contain',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat',
                            borderRadius: '50%',
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          {!characterImages[sb.character] && (
                            <span role="img" aria-label="character">🎭</span>
                          )}
                        </div>
                        
                        {/* Character line */}
                        <div style={{ flex: 1 }}>
                          <span>
                            <b>{sb.character}</b> ({sb.expression}): {sb.line}
                          </span>
                          {!hasVoice && (
                            <div style={{ fontSize: 12, color: '#ff6b6b', marginTop: 2 }}>
                              No voice selected for this character
                            </div>
                          )}
                        </div>
                        
                        {/* Audio controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 150 }}>
                          {hasVoice && sb.line && (
                            <>
                              {audio?.isGenerating ? (
                                <div style={{ 
                                  fontSize: 12, 
                                  color: '#888',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}>
                                  <span>⏳</span>
                                  Generating...
                                </div>
                              ) : audio?.error ? (
                                <>
                                  <button
                                    onClick={() => generateTTS(sb.line, voiceSettings[sb.character], id)}
                                    style={{
                                      padding: '4px 8px',
                                      background: '#ff6b6b',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: 4,
                                      cursor: 'pointer',
                                      fontSize: 12
                                    }}
                                    title={audio.error}
                                  >
                                    ❌ Retry
                                  </button>
                                  <button
                                    onClick={() => deleteAudio(id)}
                                    style={{
                                      padding: '4px 6px',
                                      background: '#888',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: 4,
                                      cursor: 'pointer',
                                      fontSize: 10
                                    }}
                                    title="Delete audio"
                                  >
                                    🗑️
                                  </button>
                                </>
                              ) : hasAudioData ? (
                                <>
                                  <audio 
                                    id={`audio-${id}`} 
                                    src={audio.audioUrl} 
                                    preload="metadata" 
                                  />
                                  <button
                                    onClick={() => playAudio(id)}
                                    disabled={playingAudio === id}
                                    style={{
                                      padding: '4px 8px',
                                      background: playingAudio === id ? '#666' : '#646cff',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: 4,
                                      cursor: playingAudio === id ? 'not-allowed' : 'pointer',
                                      fontSize: 12
                                    }}
                                  >
                                    {playingAudio === id ? '🔊' : '▶️'} Play
                                  </button>
                                  <button
                                    onClick={() => deleteAudio(id)}
                                    style={{
                                      padding: '4px 6px',
                                      background: '#888',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: 4,
                                      cursor: 'pointer',
                                      fontSize: 10
                                    }}
                                    title="Delete audio"
                                  >
                                    🗑️
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => generateTTS(sb.line, voiceSettings[sb.character], id)}
                                  style={{
                                    padding: '4px 8px',
                                    background: '#646cff',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    fontSize: 12
                                  }}
                                >
                                  🎙️ Generate
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : parsed && parsed.error ? (
        <div style={{ color: 'red' }}>Error: {parsed.error}</div>
      ) : (
        <p>No scenes found in parsed data.</p>
      )}

      <button 
        onClick={onComplete}
        style={{
          marginTop: 16,
          padding: '12px 24px',
          background: '#646cff',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 16
        }}
      >
        Continue to Video Preview
      </button>
    </div>
  )
}