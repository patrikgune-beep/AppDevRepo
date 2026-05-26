const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const DATA_FILE = path.join(__dirname, 'data.json');
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return { profiles: [], history: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data));
}

// GET /api/profiles
app.get('/api/profiles', function(req, res) {
  var data = loadData();
  res.json(data.profiles || []);
});

// POST /api/profiles
app.post('/api/profiles', function(req, res) {
  var body = req.body;
  if (!body || !body.id || !body.name) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  var data = loadData();
  data.profiles = data.profiles || [];
  var existing = data.profiles.find(function(p) {
    return p.name.toLowerCase() === body.name.toLowerCase();
  });
  if (existing) {
    return res.status(409).json({ error: 'profile_exists', profile: existing });
  }
  data.profiles.push({ id: body.id, name: body.name, createdAt: body.createdAt });
  saveData(data);
  res.json({ ok: true });
});

// DELETE /api/profiles/:id
app.delete('/api/profiles/:id', function(req, res) {
  var id = req.params.id;
  var data = loadData();
  data.profiles = (data.profiles || []).filter(function(p) { return p.id !== id; });
  data.history  = (data.history  || []).filter(function(w) { return w.profileId !== id; });
  saveData(data);
  res.json({ ok: true });
});

// GET /api/history/:profileId
app.get('/api/history/:profileId', function(req, res) {
  var data = loadData();
  var history = (data.history || []).filter(function(w) {
    return w.profileId === req.params.profileId;
  });
  res.json(history);
});

// POST /api/history/:profileId  (upsert by workout id)
app.post('/api/history/:profileId', function(req, res) {
  var workout = req.body;
  if (!workout || !workout.id) {
    return res.status(400).json({ error: 'missing_id' });
  }
  var data = loadData();
  data.history = data.history || [];
  var idx = data.history.findIndex(function(w) { return w.id === workout.id; });
  if (idx >= 0) {
    data.history[idx] = workout;
  } else {
    data.history.unshift(workout);
    if (data.history.length > 5000) data.history.splice(5000);
  }
  saveData(data);
  res.json({ ok: true });
});

app.listen(PORT, function() {
  console.log('Traningsgenerator server running on port ' + PORT);
});
