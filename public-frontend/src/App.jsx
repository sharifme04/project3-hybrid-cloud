import { useState } from 'react'

// In production: VITE_API_URL points to API Gateway URL
// Locally: points to the websocket-server which has /local-upload
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003'

export default function App() {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    setMessage('Uploading...')

    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1]

      // In production: POST to API Gateway -> Lambda -> S3 + DynamoDB + SNS
      // Locally: POST to /local-upload on websocket-server (simulates full flow)
      const endpoint = import.meta.env.VITE_API_URL ? `${API_URL}/upload` : `${API_URL}/local-upload`

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: base64, fileName: file.name, contentType: file.type }),
      })
      const data = await res.json()
      setMessage(res.ok
        ? `Uploaded successfully! The admin dashboard will update in real-time.`
        : `Error: ${data.error}`)
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 20px', textAlign: 'center' }}>
      <h1>Upload an Image</h1>
      <p style={{ color: '#888' }}>
        Public upload page — hosted on S3 in production<br />
        Your upload triggers: Lambda → S3 → DynamoDB → SNS → Admin Dashboard (real-time)
      </p>

      <div style={{ padding: 40, border: '2px dashed #ccc', borderRadius: 12, marginBottom: 24 }}>
        <p style={{ fontSize: 18, marginBottom: 16 }}>Select an image to upload</p>
        <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading}
          style={{ fontSize: 16 }} />
      </div>

      {message && (
        <div style={{ padding: '14px 20px', borderRadius: 8,
          background: message.startsWith('Error') ? '#fee2e2' : '#dcfce7',
          color: message.startsWith('Error') ? '#dc2626' : '#16a34a',
          fontSize: 16 }}>
          {message}
        </div>
      )}

      <p style={{ marginTop: 24, color: '#aaa', fontSize: 13 }}>
        After uploading, check the Admin Dashboard — it will update without a page refresh
      </p>
    </div>
  )
}
