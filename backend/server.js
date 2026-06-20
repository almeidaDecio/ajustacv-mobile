const express = require('express');
const app = express();
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/jobs', (req, res) => res.json([]));
app.get('/mobile/', (req, res) => res.send('mobile ok'));
app.get('/', (req, res) => res.send('ok'));
module.exports = app;
