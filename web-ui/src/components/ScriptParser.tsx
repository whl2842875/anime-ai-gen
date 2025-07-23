import { useState } from 'react'

interface ScriptParserProps {
  script: string
  setScript: (script: string) => void
  setParsed: (parsed: any) => void
  onComplete: () => void
}

export default function ScriptParser({ script, setScript, setParsed, onComplete }: ScriptParserProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleParse = async () => {
    setLoading(true)
    setError(null)
    setParsed(null)
    try {
      const res = await fetch('http://localhost:5001/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script })
      })
      const data = await res.json()
      setParsed(data)
      onComplete()
    } catch (e: any) {
      setError('Failed to parse script.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2>1. Script/Scene Parser</h2>
      <textarea
        placeholder="Enter your anime script or scene description..."
        rows={6}
        style={{ width: '100%' }}
        value={script}
        onChange={e => setScript(e.target.value)}
        disabled={loading}
      />
      <br />
      <button onClick={handleParse} disabled={loading || !script.trim()}>
        {loading ? 'Parsing...' : 'Parse Script'}
      </button>
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  )
}