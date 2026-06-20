const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const app = express();

const DATA_DIR = process.env.VERCEL ? '/tmp' : __dirname;
let db;
try {
  db = new Database(path.join(DATA_DIR, 'test.db'), { fileMustExist: false });
  db.exec('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT)');
} catch (e) {
  console.error('DB error:', e.message);
}

app.get('/api/health', (req, res) => {
  const dbOk = db ? 'ok' : 'fail';
  res.json({ ok: true, db: dbOk });
});
app.get('/api/jobs', (req, res) => res.json([]));
module.exports = app;
