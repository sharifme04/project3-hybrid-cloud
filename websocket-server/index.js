// WebSocket Server — Project 3 (Hybrid Cloud)
// In production: runs on EC2, receives SNS POST notifications from Lambda
// Locally: exposes a POST /test-notify endpoint you can call to simulate SNS events

const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const bodyParser = require('body-parser');
const cors = require('cors');

const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
app.use(cors());
// json() for all routes except /sns-notify (which SNS sends as text)
app.use((req, res, next) => {
  if (req.path === '/sns-notify') return bodyParser.text({ type: '*/*' })(req, res, next);
  return express.json({ limit: '50mb' })(req, res, next);
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set();

wss.on('connection', (ws, req) => {
  clients.add(ws);
  console.log(`Admin connected via WebSocket. Total clients: ${clients.size}`);
  ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected to admin server' }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Admin disconnected. Total clients: ${clients.size}`);
  });
});

function broadcast(payload) {
  clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(JSON.stringify(payload));
    }
  });
}

// In production: SNS POSTs to this endpoint
app.post('/sns-notify', (req, res) => {
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).send('Bad Request');
  }

  // SNS subscription confirmation (happens once when you subscribe)
  if (body.Type === 'SubscriptionConfirmation') {
    const https = require('https');
    https.get(body.SubscribeURL, () => console.log('SNS subscription confirmed'));
    return res.status(200).send('OK');
  }

  if (body.Type === 'Notification') {
    const message = JSON.parse(body.Message);
    broadcast({ type: 'new-image', data: message });
    console.log('SNS notification received and broadcast:', message.originalName);
  }

  res.status(200).send('OK');
});

// LOCAL ONLY: simulate a file upload + SNS notification for testing
app.post('/local-upload', (req, res) => {
  const body = req.body;
  if (!body.file || !body.fileName) {
    return res.status(400).json({ error: 'file and fileName required' });
  }
  const fileContent = Buffer.from(body.file, 'base64');
  const imageId = randomUUID();
  const fileName = `${imageId}-${body.fileName}`;
  const filePath = path.join(UPLOADS_DIR, fileName);
  fs.writeFileSync(filePath, fileContent);

  const metadata = { imageId, fileName, originalName: body.fileName, uploadedAt: new Date().toISOString(), size: fileContent.length };
  const metaFile = path.join(UPLOADS_DIR, 'metadata.json');
  const existing = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile)) : [];
  existing.push(metadata);
  fs.writeFileSync(metaFile, JSON.stringify(existing, null, 2));

  // Simulate SNS notification → WebSocket broadcast
  broadcast({ type: 'new-image', data: metadata });
  console.log('Local upload + broadcast:', body.fileName);

  res.status(201).json({ imageId, fileName });
});

app.get('/images', (req, res) => {
  const metaFile = path.join(UPLOADS_DIR, 'metadata.json');
  const images = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile)) : [];
  res.json(images);
});

app.get('/images/:id', (req, res) => {
  const metaFile = path.join(UPLOADS_DIR, 'metadata.json');
  const images = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile)) : [];
  const image = images.find(img => img.imageId === req.params.id);
  if (!image) return res.status(404).json({ error: 'Not found' });
  const url = `http://localhost:3003/files/${image.fileName}`;
  res.json({ url, metadata: image });
});

app.use('/files', express.static(UPLOADS_DIR));

const PORT = 3003;
server.listen(PORT, () => {
  console.log(`[Project 3] Hybrid Cloud Server running on http://localhost:${PORT}`);
  console.log(`  WebSocket: ws://localhost:${PORT}  (admin dashboard connects here)`);
  console.log('  POST /local-upload    — simulate a file upload (local dev only)');
  console.log('  POST /sns-notify      — production SNS endpoint');
  console.log('  GET  /images          — list all uploads');
  console.log('  GET  /images/:id      — get image URL');
  console.log('\n  In production on EC2:');
  console.log('  - Lambda uploads → SNS → POST /sns-notify → WebSocket broadcast to admin');
});
