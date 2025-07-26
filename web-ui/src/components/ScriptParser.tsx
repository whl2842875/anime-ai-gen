import { useState, useEffect } from 'react'
import { storageManager } from '../utils/storage'

interface ScriptParserProps {
  onComplete: () => void
}

export default function ScriptParser({ onComplete }: ScriptParserProps) {
  const [script, setScript] = useState('')
  const [parsed, setParsed] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load script and parsed data from storage on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [savedScript, savedParsed] = await Promise.all([
          storageManager.getData('script'),
          storageManager.getData('parsed')
        ])
        
        if (savedScript) setScript(savedScript)
        if (savedParsed) setParsed(savedParsed)
      } catch (error) {
        console.error('Failed to load data:', error)
      }
    }

    loadData()
  }, [])

  // Save script to storage whenever it changes
  useEffect(() => {
    if (script) {
      storageManager.saveData('script', script).catch(console.error)
    }
  }, [script])

  // Save parsed data to storage whenever it changes
  useEffect(() => {
    if (parsed) {
      storageManager.saveData('parsed', parsed).catch(console.error)
    }
  }, [parsed])

  const handleParse = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Clear existing parsed data and dependent data
      await Promise.all([
        storageManager.deleteData('parsed'),
        storageManager.deleteData('characterImages'),
        storageManager.deleteData('backgroundImages'),
        storageManager.deleteData('voiceSettings'),
        storageManager.deleteData('bgmSettings'),
        storageManager.deleteData('audioFiles'),
        storageManager.deleteData('videoFile')
      ])
      
      setParsed(null)

      const res = await fetch('http://localhost:5001/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script })
      })

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const data = await res.json()

      console.log('Parsed data received:', data) // Debug log

      setParsed(data) // This will trigger the useEffect to save to storage
    
      // Wait a moment to ensure storage save completes
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Verify data was saved
      const savedData = await storageManager.getData('parsed')
      console.log('Data saved to storage:', savedData) // Debug log
      
      onComplete()
    } catch (e: any) {
      console.error('Parse error:', e)
      setError(e.message || 'Failed to parse script. Please check if the server is running.')
    } finally {
      setLoading(false)
    }
  }

  const clearScript = async () => {
    if (window.confirm('Are you sure you want to clear the script and all generated data?')) {
      try {
        await storageManager.clearAllData()
        setScript('')
        setParsed(null)
        setError(null)
      } catch (error) {
        console.error('Failed to clear data:', error)
        setError('Failed to clear data from storage')
      }
    }
  }

  return (
    <div>
      <h2>1. Script/Scene Parser</h2>
      <textarea
        placeholder="Enter your anime script or scene description..."
        rows={20}
        style={{ width: '100%' }}
        value={script}
        onChange={e => setScript(e.target.value)}
        disabled={loading}
      />
      <br />
      <button onClick={handleParse} disabled={loading || !script.trim()}>
        {loading ? 'Parsing...' : 'Parse Script'}
      </button>
      <button onClick={clearScript} disabled={loading}>
        Clear Script
      </button>
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  )
}