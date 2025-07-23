import { useState, useEffect } from 'react'
import './App.css'
import ScriptParser from './components/ScriptParser.tsx'
import BackgroundCharacterPicker from './components/BackgroundCharacterPicker.tsx'
import VoiceBgmPicker from './components/VoiceBgmPicker.tsx'
import TtsGeneration from './components/TtsGeneration.tsx'
import VideoPreviewExport from './components/VideoPreviewExport.tsx'
import { storageManager } from './utils/storage.tsx'

function App() {
  const [step, setStep] = useState(0)
  const [script, setScript] = useState('')
  const [parsed, setParsed] = useState<any>(null)
  const [characterImages, setCharacterImages] = useState<Record<string, string>>({})
  const [backgroundImages, setBackgroundImages] = useState<Record<string, string>>({})
  const [voiceSettings, setVoiceSettings] = useState<Record<string, any>>({})
  const [audioFiles, setAudioFiles] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)

  // Initialize storage and load data on app start
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await storageManager.init()
        
        // Load all data
        const [
          savedScript,
          savedParsed,
          savedCharacterImages,
          savedBackgroundImages,
          savedVoiceSettings,
          savedAudioFiles
        ] = await Promise.all([
          storageManager.getData('script'),
          storageManager.getData('parsed'),
          storageManager.getData('characterImages'),
          storageManager.getData('backgroundImages'),
          storageManager.getData('voiceSettings'),
          storageManager.getData('audioFiles')
        ])

        if (savedScript) setScript(savedScript)
        if (savedParsed) setParsed(savedParsed)
        if (savedCharacterImages) setCharacterImages(savedCharacterImages)
        if (savedBackgroundImages) setBackgroundImages(savedBackgroundImages)
        if (savedVoiceSettings) setVoiceSettings(savedVoiceSettings)
        if (savedAudioFiles) setAudioFiles(savedAudioFiles)
        
      } catch (error) {
        console.error('Failed to initialize app storage:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeApp()
  }, [])

  // Save script when it changes
  useEffect(() => {
    if (!isLoading) {
      storageManager.saveData('script', script).catch(console.error)
    }
  }, [script, isLoading])

  // Save parsed data when it changes
  useEffect(() => {
    if (!isLoading && parsed) {
      storageManager.saveData('parsed', parsed).catch(console.error)
    }
  }, [parsed, isLoading])

  // Save character images when they change
  useEffect(() => {
    if (!isLoading && Object.keys(characterImages).length > 0) {
      storageManager.saveData('characterImages', characterImages).catch(console.error)
    }
  }, [characterImages, isLoading])

  // Save background images when they change
  useEffect(() => {
    if (!isLoading && Object.keys(backgroundImages).length > 0) {
      storageManager.saveData('backgroundImages', backgroundImages).catch(console.error)
    }
  }, [backgroundImages, isLoading])

  // Save voice settings when they change
  useEffect(() => {
    if (!isLoading && Object.keys(voiceSettings).length > 0) {
      storageManager.saveData('voiceSettings', voiceSettings).catch(console.error)
    }
  }, [voiceSettings, isLoading])

  // Save audio files when they change
  useEffect(() => {
    if (!isLoading && Object.keys(audioFiles).length > 0) {
      storageManager.saveData('audioFiles', audioFiles).catch(console.error)
    }
  }, [audioFiles, isLoading])

  const steps = [
    'Script/Scene Parser',
    'Background & Character Picker',
    'Voice & BGM Picker',
    'TTS Generation',
    'Video Preview & Export'
  ]

  const handleStepComplete = (nextStep: number) => {
    setStep(nextStep)
  }

  const handleScriptChange = async (newScript: string) => {
    // If script changed significantly, clear all dependent data
    if (newScript !== script) {
      setScript(newScript)
      
      // Clear dependent data when script changes
      setParsed(null)
      setCharacterImages({})
      setBackgroundImages({})
      setVoiceSettings({})
      setAudioFiles({})
      
      // Clear from storage
      try {
        await Promise.all([
          storageManager.deleteData('parsed'),
          storageManager.deleteData('characterImages'),
          storageManager.deleteData('backgroundImages'),
          storageManager.deleteData('voiceSettings'),
          storageManager.deleteData('bgmSettings'),
          storageManager.deleteData('audioFiles'),
          storageManager.deleteData('videoFile')
        ])
      } catch (error) {
        console.error('Failed to clear dependent data:', error)
      }
    }
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="container">
      <h1>Anime Generation Tool MVP</h1>
      <div className="steps">
        {steps.map((label, idx) => (
          <button
            key={label}
            className={step === idx ? 'active' : ''}
            onClick={() => setStep(idx)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="step-content">
        {step === 0 && (
          <ScriptParser 
            script={script}
            setScript={handleScriptChange}
            setParsed={setParsed}
            onComplete={() => handleStepComplete(1)}
          />
        )}
        {step === 1 && (
          <BackgroundCharacterPicker 
            parsed={parsed}
            setParsed={setParsed}
            characterImages={characterImages}
            setCharacterImages={setCharacterImages}
            backgroundImages={backgroundImages}
            setBackgroundImages={setBackgroundImages}
            onComplete={() => handleStepComplete(2)}
          />
        )}
        {step === 2 && (
          <VoiceBgmPicker 
            parsed={parsed}
            setParsed={setParsed}
            characterImages={characterImages}
            // voiceSettings={voiceSettings}
            // setVoiceSettings={setVoiceSettings}
            onComplete={() => handleStepComplete(3)}
          />
        )}
        {step === 3 && (
          <TtsGeneration 
            parsed={parsed}
            // voiceSettings={voiceSettings}
            // audioFiles={audioFiles}
            // setAudioFiles={setAudioFiles}
            onComplete={() => handleStepComplete(4)}
          />
        )}
        {step === 4 && (
          <VideoPreviewExport 
            parsed={parsed}
            // characterImages={characterImages}
            // backgroundImages={backgroundImages}
            // audioFiles={audioFiles}
          />
        )}
      </div>
    </div>
  )
}

export default App