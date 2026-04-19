import { useState, useEffect, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003'
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3003'

export default function App() {
  const [images, setImages] = useState([])
  const [notifications, setNotifications] = useState([])
  const [wsStatus, setWsStatus] = useState('Connecting...')

  const loadImages = () =>
    fetch(`${API_URL}/images`).then(r => r.json()).then(setImages).catch(console.error)

  useEffect(() => { loadImages() }, [])

  useEffect(() => {
    const ws = new WebSocket(WS_URL)

    ws.onopen = () => setWsStatus('Connected (real-time active)')

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'new-image') {
        setNotifications(prev => [`New upload: ${msg.data.originalName}`, ...prev.slice(0, 4)])
        setImages(prev => [msg.data, ...prev])
      }
    }

    ws.onclose = () => setWsStatus('Disconnected')
    ws.onerror = () => setWsStatus('Connection error')

    return () => ws.close()
  }, [])

  const viewImage = async (id) => {
    const res = await fetch(`${API_URL}/images/${id}`)
    const data = await res.json()
    window.open(data.url, '_blank')
  }

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 20px' }}>
      <h1>Admin Dashboard — Project 3 (Hybrid Cloud)</h1>
      <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
        <div style={{ padding: '8px 16px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #86efac', fontSize: 14 }}>
          WebSocket: <strong style={{ color: wsStatus.includes('Connected') ? '#16a34a' : '#dc2626' }}>{wsStatus}</strong>
        </div>
        <div style={{ padding: '8px 16px', borderRadius: 6, background: '#eff6ff', border: '1px solid #93c5fd', fontSize: 14 }}>
          Architecture: EC2 (this) ← SNS ← Lambda ← Public Upload
        </div>
      </div>

      {notifications.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 8 }}>Live Notifications</h3>
          {notifications.map((n, i) => (
            <div key={i} style={{ padding: '8px 14px', marginBottom: 6, borderRadius: 6,
              background: '#fef9c3', border: '1px solid #fde047', fontSize: 14 }}>
              {n}
            </div>
          ))}
        </div>
      )}

      <h2>All Uploads images ({images.length})</h2>
      <p style={{ color: '#888', fontSize: 13 }}>New uploads appear in real-time via WebSocket (no page refresh needed)</p>
      {images.length === 0 && <p style={{ color: '#aaa' }}>No uploads yet. Use the public upload page to upload an image.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {images.map(img => (
          <li key={img.imageId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 0', borderBottom: '1px solid #eee' }}>
            <div>
              <strong>{img.originalName}</strong>
              <span style={{ color: '#888', fontSize: 13, marginLeft: 12 }}>
                {(img.size / 1024).toFixed(1)} KB — {new Date(img.uploadedAt).toLocaleString()}
              </span>
            </div>
            <button onClick={() => viewImage(img.imageId)}
              style={{ padding: '4px 12px', borderRadius: 4, background: '#ede9fe', color: '#7c3aed', border: 'none', cursor: 'pointer' }}>
              View
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
