const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;
const DATA_FILE = path.join(__dirname, 'reservations.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'secret';

app.use(cors());
app.use(express.json());

// Serve static site files
app.use(express.static(path.join(__dirname)));

// API: get reservations
app.get('/api/reservations', async (req, res) => {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    res.type('json').send(raw);
  } catch (err) {
    res.status(500).json({error: 'データの読み込みに失敗しました', detail: err.message});
  }
});

// Admin update (protected by header x-admin-password)
app.post('/api/admin/update', async (req, res) => {
  const pw = req.get('x-admin-password') || '';
  if (pw !== ADMIN_PASSWORD) return res.status(401).json({error: 'Unauthorized'});

  const payload = req.body;
  if (!payload || typeof payload !== 'object') return res.status(400).json({error: 'Invalid payload'});

  try {
    // Basic validation: ensure `days` exists
    if (!payload.days) return res.status(400).json({error: 'payload must include days'});
    await fs.writeFile(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
    res.json({ok: true});
  } catch (err) {
    res.status(500).json({error: '保存に失敗しました', detail: err.message});
  }
});

// Webhook receiver: Google Apps Script or other webhook can POST here with secret
app.post('/api/webhook', async (req, res) => {
  const secret = req.get('x-webhook-secret') || req.query.secret || '';
  if (secret !== WEBHOOK_SECRET) return res.status(401).json({error: 'Unauthorized'});

  const body = req.body;
  // Expected format: {date: '2025-11-01', time: '19:00', seats: 2}
  if (!body || !body.date || !body.time) return res.status(400).json({error: 'Invalid body'});

  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    let updated = false;
    (data.days || []).forEach(day => {
      if (day.date === body.date) {
        (day.slots || []).forEach(slot => {
          if (slot.time === body.time) {
            slot.reserved = (slot.reserved || 0) + (Number(body.seats) || 1);
            if (slot.reserved > slot.capacity) slot.reserved = slot.capacity;
            updated = true;
          }
        });
      }
    });

    if (!updated) {
      // If day/time not found, append a slot to matching day or create new day
      let day = (data.days || []).find(d => d.date === body.date);
      if (!day) {
        day = {date: body.date, label: body.date, slots: []};
        data.days = data.days || [];
        data.days.push(day);
      }
      day.slots.push({time: body.time, capacity: Number(body.capacity) || 999, reserved: Number(body.seats) || 1});
    }

    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    res.json({ok: true});
  } catch (err) {
    res.status(500).json({error: '更新に失敗しました', detail: err.message});
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
