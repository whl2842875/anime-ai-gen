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
  const [isLoading, setIsLoading] = useState(true)

  // Initialize storage on app start
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await storageManager.init()
      } catch (error) {
        console.error('Failed to initialize app storage:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeApp()
  }, [])

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
            onComplete={() => handleStepComplete(1)}
          />
        )}
        {step === 1 && (
          <BackgroundCharacterPicker 
            onComplete={() => handleStepComplete(2)}
          />
        )}
        {step === 2 && (
          <VoiceBgmPicker 
            onComplete={() => handleStepComplete(3)}
          />
        )}
        {step === 3 && (
          <TtsGeneration 
            onComplete={() => handleStepComplete(4)}
          />
        )}
        {step === 4 && (
          <VideoPreviewExport />
        )}
      </div>
    </div>
  )
}

export default App