const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const http = require('http');
const matcher = require('./matcher');
const cvGenerator = require('./cv_generator');
const multer = require('multer');
const app = express();

const DATA_DIR = process.env.VERCEL ? '/tmp' : __dirname;
let dbDesktop, dbMobile;
try {
  dbDesktop = new Database(path.join(DATA_DIR, 'career_agent.db'), { fileMustExist: false });
  dbMobile   = new Database(path.join(DATA_DIR, 'mobile.db'), { fileMustExist: false });
} catch (e) {
  console.error('Database init error:', e.message);
}

const CV_PATH = path.join(__dirname, '..', 'sample_cv.json');
if (!fs.existsSync(CV_PATH)) {
  console.error('CV_PATH not found:', CV_PATH);
}

const uploadDir = process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.get('/api/health', (req, res) => {
  const dbOk = dbMobile ? 'ok' : 'fail';
  res.json({ ok: true, db: dbOk });
});
app.get('/api/jobs', (req, res) => res.json([]));
module.exports = app;
