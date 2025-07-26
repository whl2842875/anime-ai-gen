import React, { useState, useEffect, useRef } from 'react'
import { storageManager } from '../utils/storage'

interface VoiceBgmPickerProps {
  onComplete: () => void
}

// Edge TTS voices filtered for English and Chinese only
const edgeTTSVoices = [  
  // Chinese voices
  { shortName: 'zh-HK-HiuGaaiNeural', name: 'HiuGaai (Hong Kong)', gender: 'Female', locale: 'zh-HK' },
  { shortName: 'zh-HK-HiuMaanNeural', name: 'HiuMaan (Hong Kong)', gender: 'Female', locale: 'zh-HK' },
  { shortName: 'zh-HK-WanLungNeural', name: 'WanLung (Hong Kong)', gender: 'Male', locale: 'zh-HK' },
  { shortName: 'zh-CN-XiaoxiaoNeural', name: 'Xiaoxiao (China)', gender: 'Female', locale: 'zh-CN' },
  { shortName: 'zh-CN-XiaoyiNeural', name: 'Xiaoyi (China)', gender: 'Female', locale: 'zh-CN' },
  { shortName: 'zh-CN-YunjianNeural', name: 'Yunjian (China)', gender: 'Male', locale: 'zh-CN' },
  { shortName: 'zh-CN-YunxiNeural', name: 'Yunxi (China)', gender: 'Male', locale: 'zh-CN' },
  { shortName: 'zh-CN-YunxiaNeural', name: 'Yunxia (China)', gender: 'Male', locale: 'zh-CN' },
  { shortName: 'zh-CN-YunyangNeural', name: 'Yunyang (China)', gender: 'Male', locale: 'zh-CN' },
  { shortName: 'zh-CN-liaoning-XiaobeiNeural', name: 'Xiaobei (Liaoning)', gender: 'Female', locale: 'zh-CN-liaoning' },
  { shortName: 'zh-TW-HsiaoChenNeural', name: 'HsiaoChen (Taiwan)', gender: 'Female', locale: 'zh-TW' },
  { shortName: 'zh-TW-YunJheNeural', name: 'YunJhe (Taiwan)', gender: 'Male', locale: 'zh-TW' },
  { shortName: 'zh-TW-HsiaoYuNeural', name: 'HsiaoYu (Taiwan)', gender: 'Female', locale: 'zh-TW' },
  { shortName: 'zh-CN-shaanxi-XiaoniNeural', name: 'Xiaoni (Shaanxi)', gender: 'Female', locale: 'zh-CN-shaanxi' },
  
  // English voices
  { shortName: 'en-AU-NatashaNeural', name: 'Natasha (Australia)', gender: 'Female', locale: 'en-AU' },
  { shortName: 'en-AU-WilliamNeural', name: 'William (Australia)', gender: 'Male', locale: 'en-AU' },
  { shortName: 'en-CA-ClaraNeural', name: 'Clara (Canada)', gender: 'Female', locale: 'en-CA' },
  { shortName: 'en-CA-LiamNeural', name: 'Liam (Canada)', gender: 'Male', locale: 'en-CA' },
  { shortName: 'en-HK-SamNeural', name: 'Sam (Hong Kong)', gender: 'Male', locale: 'en-HK' },
  { shortName: 'en-HK-YanNeural', name: 'Yan (Hong Kong)', gender: 'Female', locale: 'en-HK' },
  { shortName: 'en-IN-NeerjaNeural', name: 'Neerja (India)', gender: 'Female', locale: 'en-IN' },
  { shortName: 'en-IN-PrabhatNeural', name: 'Prabhat (India)', gender: 'Male', locale: 'en-IN' },
  { shortName: 'en-IE-ConnorNeural', name: 'Connor (Ireland)', gender: 'Male', locale: 'en-IE' },
  { shortName: 'en-IE-EmilyNeural', name: 'Emily (Ireland)', gender: 'Female', locale: 'en-IE' },
  { shortName: 'en-KE-AsiliaNeural', name: 'Asilia (Kenya)', gender: 'Female', locale: 'en-KE' },
  { shortName: 'en-KE-ChilembaNeural', name: 'Chilemba (Kenya)', gender: 'Male', locale: 'en-KE' },
  { shortName: 'en-NZ-MitchellNeural', name: 'Mitchell (New Zealand)', gender: 'Male', locale: 'en-NZ' },
  { shortName: 'en-NZ-MollyNeural', name: 'Molly (New Zealand)', gender: 'Female', locale: 'en-NZ' },
  { shortName: 'en-NG-AbeoNeural', name: 'Abeo (Nigeria)', gender: 'Male', locale: 'en-NG' },
  { shortName: 'en-NG-EzinneNeural', name: 'Ezinne (Nigeria)', gender: 'Female', locale: 'en-NG' },
  { shortName: 'en-PH-JamesNeural', name: 'James (Philippines)', gender: 'Male', locale: 'en-PH' },
  { shortName: 'en-PH-RosaNeural', name: 'Rosa (Philippines)', gender: 'Female', locale: 'en-PH' },
  { shortName: 'en-SG-LunaNeural', name: 'Luna (Singapore)', gender: 'Female', locale: 'en-SG' },
  { shortName: 'en-SG-WayneNeural', name: 'Wayne (Singapore)', gender: 'Male', locale: 'en-SG' },
  { shortName: 'en-ZA-LeahNeural', name: 'Leah (South Africa)', gender: 'Female', locale: 'en-ZA' },
  { shortName: 'en-ZA-LukeNeural', name: 'Luke (South Africa)', gender: 'Male', locale: 'en-ZA' },
  { shortName: 'en-TZ-ElimuNeural', name: 'Elimu (Tanzania)', gender: 'Male', locale: 'en-TZ' },
  { shortName: 'en-TZ-ImaniNeural', name: 'Imani (Tanzania)', gender: 'Female', locale: 'en-TZ' },
  { shortName: 'en-GB-LibbyNeural', name: 'Libby (UK)', gender: 'Female', locale: 'en-GB' },
  { shortName: 'en-GB-MaisieNeural', name: 'Maisie (UK)', gender: 'Female', locale: 'en-GB' },
  { shortName: 'en-GB-RyanNeural', name: 'Ryan (UK)', gender: 'Male', locale: 'en-GB' },
  { shortName: 'en-GB-SoniaNeural', name: 'Sonia (UK)', gender: 'Female', locale: 'en-GB' },
  { shortName: 'en-GB-ThomasNeural', name: 'Thomas (UK)', gender: 'Male', locale: 'en-GB' },
  { shortName: 'en-US-AriaNeural', name: 'Aria (US)', gender: 'Female', locale: 'en-US' },
  { shortName: 'en-US-AnaNeural', name: 'Ana (US)', gender: 'Female', locale: 'en-US' },
  { shortName: 'en-US-ChristopherNeural', name: 'Christopher (US)', gender: 'Male', locale: 'en-US' },
  { shortName: 'en-US-EricNeural', name: 'Eric (US)', gender: 'Male', locale: 'en-US' },
  { shortName: 'en-US-GuyNeural', name: 'Guy (US)', gender: 'Male', locale: 'en-US' },
  { shortName: 'en-US-JennyNeural', name: 'Jenny (US)', gender: 'Female', locale: 'en-US' },
  { shortName: 'en-US-MichelleNeural', name: 'Michelle (US)', gender: 'Female', locale: 'en-US' },
  { shortName: 'en-US-RogerNeural', name: 'Roger (US)', gender: 'Male', locale: 'en-US' },
  { shortName: 'en-US-SteffanNeural', name: 'Steffan (US)', gender: 'Male', locale: 'en-US' },
]

interface BGMSettings {
  fileName: string
  fileData: string
  volume: number
}

export default function VoiceBgmPicker({ onComplete }: VoiceBgmPickerProps) {
  const [parsed, setParsed] = useState<any>(null)
  const [characterImages, setCharacterImages] = useState<Record<string, string>>({})
  const [characterVoices, setCharacterVoices] = useState<Record<string, string>>({})
  const [bgmSettings, setBgmSettings] = useState<BGMSettings | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Load all required data from storage on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [savedParsed, savedCharacterImages, savedVoices, savedBgm] = await Promise.all([
          storageManager.getData('parsed'),
          storageManager.getData('characterImages'),
          storageManager.getData('voiceSettings'),
          storageManager.getData('bgmSettings')
        ])
        
        if (savedParsed) setParsed(savedParsed)
        if (savedCharacterImages) setCharacterImages(savedCharacterImages)
        if (savedVoices) setCharacterVoices(savedVoices)
        if (savedBgm) setBgmSettings(savedBgm)
      } catch (error) {
        console.error('Failed to load data:', error)
      }
    }

    loadData()
  }, [])

  // Save voice settings to storage whenever they change
  useEffect(() => {
    if (Object.keys(characterVoices).length > 0) {
      storageManager.saveData('voiceSettings', characterVoices).catch(error => {
        console.error('Failed to save voice settings:', error)
      })
    }
  }, [characterVoices])

  // Save BGM settings to storage whenever they change
  useEffect(() => {
    if (bgmSettings) {
      storageManager.saveData('bgmSettings', bgmSettings).catch(error => {
        console.error('Failed to save BGM settings:', error)
      })
    }
  }, [bgmSettings])

  // Save updated parsed data to storage whenever it changes
  useEffect(() => {
    if (parsed) {
      storageManager.saveData('parsed', parsed).catch(console.error)
    }
  }, [parsed])

  // Apply voice selections to parsed data when voices change
  useEffect(() => {
    if (!parsed?.scenes || Object.keys(characterVoices).length === 0) return

    let hasChanges = false
    const updatedScenes = parsed.scenes.map((scene: any) => ({
      ...scene,
      sub_scenes: scene.sub_scenes?.map((sub: any) => ({
        ...sub,
        storyboards: sub.storyboards?.map((sb: any) => {
          const newVoice = characterVoices[sb.character]
          if (newVoice && sb.voice !== newVoice) {
            hasChanges = true
            return {
              ...sb,
              voice: newVoice
            }
          }
          return sb
        }) || []
      })) || []
    }))

    if (hasChanges) {
      setParsed({
        ...parsed,
        scenes: updatedScenes,
        bgm: bgmSettings
      })
    }
  }, [characterVoices, bgmSettings, parsed])

  // Extract unique characters from parsed data
  const uniqueCharacters = React.useMemo(() => {
    if (!parsed?.scenes) return []
    
    const characters = new Set<string>()
    parsed.scenes.forEach((scene: any) => {
      scene.sub_scenes?.forEach((sub: any) => {
        sub.storyboards?.forEach((sb: any) => {
          if (sb.character) {
            characters.add(sb.character)
          }
        })
      })
    })
    
    return Array.from(characters)
  }, [parsed])

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)
    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [bgmSettings])

  const handleVoiceChange = (character: string, voiceShortName: string) => {
    console.log(`Setting voice for ${character}: ${voiceShortName}`)
    setCharacterVoices(prev => {
      const updated = {
        ...prev,
        [character]: voiceShortName
      }
      console.log('Updated character voices:', updated)
      return updated
    })
  }

  const handleBgmSelect = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'audio/*'
    input.multiple = false

    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (file) {
        // Check file size (limit to 10MB for audio files)
        if (file.size > 10 * 1024 * 1024) {
          alert('Audio file size too large. Please select a file under 10MB.')
          return
        }

        const reader = new FileReader()
        reader.onload = (e) => {
          const fileData = e.target?.result as string
          setBgmSettings({
            fileName: file.name,
            fileData: fileData,
            volume: 0.5
          })
        }
        reader.readAsDataURL(file)
      }
    }

    input.click()
  }

  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio || !bgmSettings) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play()
      setIsPlaying(true)
    }
  }

  const handleVolumeChange = (volume: number) => {
    if (!bgmSettings) return
    
    setBgmSettings({
      ...bgmSettings,
      volume: volume
    })

    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const removeBgm = async () => {
    setIsPlaying(false)
    setBgmSettings(null)
    try {
      await storageManager.deleteData('bgmSettings')
    } catch (error) {
      console.error('Failed to remove BGM from storage:', error)
    }
  }

  const clearVoiceSettings = async () => {
    if (window.confirm('Are you sure you want to clear all voice selections?')) {
      try {
        await storageManager.deleteData('voiceSettings')
        setCharacterVoices({})
      } catch (error) {
        console.error('Failed to clear voice settings:', error)
      }
    }
  }

  // Count selected voices
  const selectedVoicesCount = Object.keys(characterVoices).length
  const totalCharacters = uniqueCharacters.length

  if (!parsed) {
    return (
      <div>
        <h2>3. Voice & BGM Picker</h2>
        <div style={{ color: '#888', padding: 20, textAlign: 'center' }}>
          <p>No parsed script data found.</p>
          <p>Please go back to the Script Parser and parse your script first.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2>3. Voice & BGM Picker</h2>
      <p style={{ color: '#888', marginBottom: 12, fontSize: 14 }}>
        Select voices for each character and choose background music for your video.
      </p>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ fontSize: 14, color: '#888' }}>
          Voices selected: {selectedVoicesCount}/{totalCharacters} characters
        </div>
        
        {selectedVoicesCount > 0 && (
          <button
            onClick={clearVoiceSettings}
            style={{
              padding: '8px 16px',
              background: '#ff6b6b',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              marginLeft: 'auto'
            }}
          >
            🗑️ Clear All Voices
          </button>
        )}
      </div>
      
      {uniqueCharacters.length > 0 ? (
        <div>
          <h3>Character Voice Selection</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: 16,
            marginBottom: 24 
          }}>
            {uniqueCharacters.map((character) => (
              <div key={character} style={{
                border: '1px solid #444',
                borderRadius: 8,
                padding: 16,
                background: '#1a1a1a'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                  {/* Character thumbnail */}
                  <div 
                    style={{
                      width: 48, 
                      height: 48, 
                      background: characterImages[character] ? '#ccc' : '#666',
                      backgroundImage: characterImages[character] ? `url("${characterImages[character]}")` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                      borderRadius: '50%',
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      marginRight: 12,
                      flexShrink: 0
                    }}
                  >
                    {!characterImages[character] && (
                      <span role="img" aria-label="character" style={{ fontSize: 20 }}>🎭</span>
                    )}
                  </div>
                  
                  {/* Character name */}
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>
                      {character}
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      {characterVoices[character] 
                        ? edgeTTSVoices.find(v => v.shortName === characterVoices[character])?.name || 'Unknown Voice'
                        : 'No voice selected'
                      }
                    </div>
                  </div>
                </div>
                
                {/* Voice selection dropdown */}
                <select
                  value={characterVoices[character] || ''}
                  onChange={(e) => handleVoiceChange(character, e.target.value)}
                  style={{
                    width: '100%',
                    padding: 8,
                    borderRadius: 4,
                    border: '1px solid #555',
                    background: '#2a2a2a',
                    color: 'white',
                    fontSize: 14
                  }}
                >
                  <option value="">Select a voice...</option>
                  
                  <optgroup label="Chinese Voices">
                    {edgeTTSVoices
                      .filter(voice => voice.locale.startsWith('zh-'))
                      .map((voice) => (
                        <option key={voice.shortName} value={voice.shortName}>
                          {voice.name} ({voice.gender})
                        </option>
                      ))
                    }
                  </optgroup>                  
                  
                  <optgroup label="English Voices">
                    {edgeTTSVoices
                      .filter(voice => voice.locale.startsWith('en-'))
                      .map((voice) => (
                        <option key={voice.shortName} value={voice.shortName}>
                          {voice.name} ({voice.gender})
                        </option>
                      ))
                    }
                  </optgroup>
                </select>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p>No characters found in the parsed data.</p>
      )}
      
      <div style={{ marginTop: 24 }}>
        <h3>Background Music</h3>
        
        {!bgmSettings ? (
          <div>
            <p style={{ color: '#888', marginBottom: 16 }}>
              Select a background music file for your video.
            </p>
            <button
              onClick={handleBgmSelect}
              style={{
                padding: '12px 24px',
                background: '#646cff',
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
              <span role="img" aria-label="music">🎵</span>
              Select BGM File
            </button>
          </div>
        ) : (
          <div style={{ 
            border: '1px solid #444',
            borderRadius: 8,
            padding: 16,
            background: '#1a1a1a',
            maxWidth: 500
          }}>
            {/* Audio element */}
            <audio
              ref={audioRef}
              src={bgmSettings.fileData}
              preload="metadata"
            />
            
            {/* File info */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                🎵 {bgmSettings.fileName}
              </div>
              <div style={{ fontSize: 12, color: '#888' }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
            
            {/* Playback controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <button
                onClick={togglePlayPause}
                style={{
                  padding: '8px 16px',
                  background: isPlaying ? '#ff6b6b' : '#646cff',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >
                {isPlaying ? '⏸️ Pause' : '▶️ Play'}
              </button>
              
              <button
                onClick={removeBgm}
                style={{
                  padding: '8px 16px',
                  background: '#888',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >
                🗑️ Remove
              </button>
            </div>
            
            {/* Progress bar */}
            <div style={{ marginBottom: 12 }}>
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={(e) => handleSeek(Number(e.target.value))}
                style={{
                  width: '100%',
                  height: 4,
                  background: '#333',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
            </div>
            
            {/* Volume control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#888', minWidth: 50 }}>Volume:</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={bgmSettings.volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                style={{
                  flex: 1,
                  height: 4,
                  background: '#333',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
              <span style={{ fontSize: 12, color: '#888', minWidth: 30 }}>
                {Math.round(bgmSettings.volume * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>
      
      <button 
        onClick={onComplete}
        style={{
          marginTop: 24,
          padding: '12px 24px',
          background: '#646cff',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 16
        }}
      >
        Continue to TTS Generation
      </button>
    </div>
  )
}