import { useState, useEffect } from 'react'
import { storageManager } from '../utils/storage'

interface BackgroundCharacterPickerProps {
  onComplete: () => void
}

export default function BackgroundCharacterPicker({ onComplete }: BackgroundCharacterPickerProps) {
  const [parsed, setParsed] = useState<any>(null)
  const [characterImages, setCharacterImages] = useState<Record<string, string>>({})
  const [backgroundImages, setBackgroundImages] = useState<Record<string, string>>({})

  // Load all required data from storage on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [savedParsed, savedCharacterImages, savedBackgroundImages] = await Promise.all([
          storageManager.getData('parsed'),
          storageManager.getData('characterImages'),
          storageManager.getData('backgroundImages')
        ])
        
        if (savedParsed) setParsed(savedParsed)
        if (savedCharacterImages) setCharacterImages(savedCharacterImages)
        if (savedBackgroundImages) setBackgroundImages(savedBackgroundImages)
      } catch (error) {
        console.error('Failed to load data:', error)
      }
    }

    loadData()
  }, [])

  // Save character images to storage whenever they change
  useEffect(() => {
    if (Object.keys(characterImages).length > 0) {
      storageManager.saveData('characterImages', characterImages).catch(console.error)
    }
  }, [characterImages])

  // Save background images to storage whenever they change
  useEffect(() => {
    if (Object.keys(backgroundImages).length > 0) {
      storageManager.saveData('backgroundImages', backgroundImages).catch(console.error)
    }
  }, [backgroundImages])

  // Save updated parsed data to storage whenever it changes
  useEffect(() => {
    if (parsed) {
      storageManager.saveData('parsed', parsed).catch(console.error)
    }
  }, [parsed])

  const handleCharacterImageSelect = async (characterName: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpg,image/jpeg'
    input.multiple = false

    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (file) {
        // Check file size (limit to 5MB per image)
        if (file.size > 5 * 1024 * 1024) {
          alert('File size too large. Please select an image under 5MB.')
          return
        }

        const reader = new FileReader()
        reader.onload = async (e) => {
          const imageUrl = e.target?.result as string
          setCharacterImages(prev => ({
            ...prev,
            [characterName]: imageUrl
          }))
        }
        reader.readAsDataURL(file)
      }
    }

    input.click()
  }

  const handleBackgroundImageSelect = async (sceneId: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpg,image/jpeg'
    input.multiple = false

    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (file) {
        // Check file size (limit to 5MB per image)
        if (file.size > 5 * 1024 * 1024) {
          alert('File size too large. Please select an image under 5MB.')
          return
        }

        const reader = new FileReader()
        reader.onload = async (e) => {
          const imageUrl = e.target?.result as string
          setBackgroundImages(prev => ({
            ...prev,
            [sceneId]: imageUrl
          }))
        }
        reader.readAsDataURL(file)
      }
    }

    input.click()
  }

  const handleSceneDescriptionChange = (sceneIdx: number, newDescription: string) => {
    if (!parsed?.scenes) return

    const updatedScenes = parsed.scenes.map((scene: any, idx: number) => {
      if (idx === sceneIdx) {
        return {
          ...scene,
          scene_desc: newDescription
        }
      }
      return scene
    })

    setParsed({
      ...parsed,
      scenes: updatedScenes
    })
  }

  const clearImages = async () => {
    if (window.confirm('Are you sure you want to clear all selected images?')) {
      try {
        await Promise.all([
          storageManager.deleteData('characterImages'),
          storageManager.deleteData('backgroundImages')
        ])
        
        setCharacterImages({})
        setBackgroundImages({})
      } catch (error) {
        console.error('Failed to clear images:', error)
      }
    }
  }

  // Apply stored images to parsed data when images change
  useEffect(() => {
    if (!parsed || !parsed.scenes) return

    let hasChanges = false
    const updatedScenes = parsed.scenes.map((scene: any, sceneIdx: number) => {
      const sceneId = scene.scene_id ?? sceneIdx
      let updatedScene = { ...scene }

      // Apply background image if exists
      if (backgroundImages[sceneId] && scene.background !== backgroundImages[sceneId]) {
        updatedScene.background = backgroundImages[sceneId]
        hasChanges = true
      }

      // Apply character images if exists
      if (scene.sub_scenes) {
        updatedScene.sub_scenes = scene.sub_scenes.map((sub: any) => ({
          ...sub,
          storyboards: sub.storyboards?.map((sb: any) => {
            const newImage = characterImages[sb.character]
            if (newImage && sb.character_image !== newImage) {
              hasChanges = true
              return {
                ...sb,
                character_image: newImage
              }
            }
            return sb
          }) || []
        }))
      }

      return updatedScene
    })

    // Only update if there are actual changes
    if (hasChanges) {
      setParsed({
        ...parsed,
        scenes: updatedScenes
      })
    }
  }, [characterImages, backgroundImages, parsed])

  // Count selected images
  const characterImageCount = Object.keys(characterImages).length
  const backgroundImageCount = Object.keys(backgroundImages).length
  const totalImages = characterImageCount + backgroundImageCount

  if (!parsed) {
    return (
      <div>
        <h2>2. Background & Character Picker</h2>
        <div style={{ color: '#888', padding: 20, textAlign: 'center' }}>
          <p>No parsed script data found.</p>
          <p>Please go back to the Script Parser and parse your script first.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2>2. Background & Character Picker</h2>
      <p style={{ color: '#888', marginBottom: 12, fontSize: 14 }}>
        Click on character avatars and background thumbnails to select images for your scenes.
      </p>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ fontSize: 14, color: '#888' }}>
          Selected: {characterImageCount} characters, {backgroundImageCount} backgrounds
        </div>
        
        {totalImages > 0 && (
          <button
            onClick={clearImages}
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
            🗑️ Clear All Images
          </button>
        )}
      </div>

      {parsed.scenes && parsed.scenes.length > 0 ? (
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
                {/* Background thumbnail - clickable */}
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
                    cursor: 'pointer',
                    border: '2px solid transparent',
                    transition: 'border-color 0.2s'
                  }}                  
                  onClick={() => handleBackgroundImageSelect(scene.scene_id ?? sceneIdx)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#646cff'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'transparent'
                  }}
                  title={`Click to select background for scene`}
                >
                  {!backgroundImages[scene.scene_id ?? sceneIdx] && (
                    <span role="img" aria-label="background" style={{ fontSize: 14 }}>🖼️</span>
                  )}
                </div>
                <input
                  type="text"
                  defaultValue={scene.scene_desc || `scene: ${scene.scene_id ?? sceneIdx + 1}`}
                  style={{
                    fontWeight: 'bold',
                    fontSize: 18,
                    border: 'none',
                    background: 'transparent',
                    color: 'white',
                    marginRight: 8,
                    width: 280,
                    outline: 'none'
                  }}
                  onBlur={(e) => {
                    handleSceneDescriptionChange(sceneIdx, e.target.value)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur()
                    }
                  }}
                />
              </div>
              
              {/* Sub-scenes */}
              {scene.sub_scenes && scene.sub_scenes.map((sub: any, subIdx: number) => (
                <div key={sub.sub_scene_id ?? subIdx} style={{ marginLeft: 16, marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    分镜: {sub.sub_scene_id ?? subIdx + 1}{' '}
                    <span style={{ fontWeight: 400, fontSize: 13, color: '#888' }}>
                      ({sub.camera_movement})
                    </span>
                  </div>
                  {sub.storyboards && sub.storyboards.map((sb: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                      {/* Character image - clickable */}
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
                          marginRight: 8,
                          cursor: 'pointer',
                          border: '2px solid transparent',
                          transition: 'border-color 0.2s'
                        }}
                        onClick={() => handleCharacterImageSelect(sb.character)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#646cff'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'transparent'
                        }}
                        title={`Click to select image for ${sb.character}`}
                      >
                        {!characterImages[sb.character] && (
                          <span role="img" aria-label="character">🎭</span>
                        )}
                      </div>
                      <span>
                        <b>{sb.character}</b> ({sb.expression}): {sb.line}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : parsed.error ? (
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
        Continue to Voice & BGM
      </button>
    </div>
  )
}