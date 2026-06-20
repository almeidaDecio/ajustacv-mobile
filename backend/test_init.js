const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const http = require('http');
const matcher = require('./matcher');
const cvGenerator = require('./cv_generator');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3002;
const OLLAMA_HOST = 'http://127.0.0.1:11434';
const OLLAMA_MODEL = 'job-analyzer';
const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, '..');

let dbDesktop, dbMobile;
try {
  dbDesktop = new Database(path.join(DATA_DIR, 'career_agent.db'), { fileMustExist: false });
  dbMobile   = new Database(path.join(DATA_DIR, 'mobile.db'), { fileMustExist: false });
} catch (e) {
  console.error('Database init error:', e.message);
}

app.use((req, res, next) => {
  req.db = req.headers['x-client'] === 'mobile' ? dbMobile : dbDesktop;
  if (!req.db) {
    return res.status(500).json({ error: 'Database not available' });
  }
  next();
});

const uploadDir = process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, env: process.env.VERCEL ? 'vercel' : 'local', node: process.version });
});

app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/mobile', express.static(path.join(__dirname, '..', 'frontend')));

// ── Migration ──
function migrate() {
  try {
    for (const db of [dbDesktop, dbMobile]) {
      if (!db) continue;
      db.exec(`CREATE TABLE IF NOT EXISTS vagas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa TEXT,
        cargo TEXT,
        senioridade TEXT,
        modalidade TEXT,
        local TEXT,
        salario TEXT,
        link TEXT,
        data_publicacao TEXT,
        status TEXT DEFAULT 'pendente',
        match_score REAL,
        stacks TEXT,
        tags TEXT,
        responsabilidades TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`);
      db.exec(`CREATE TABLE IF NOT EXISTS candidaturas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vaga_id INTEGER,
        data TEXT,
        status TEXT,
        observacao TEXT,
        FOREIGN KEY (vaga_id) REFERENCES vagas(id)
      )`);
    }
  } catch (e) {
    console.error('Migration error:', e.message);
  }
}
migrate();

// ── Auto-seed ──
function seedDatabase() {
  try {
    const tables = dbDesktop.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='vagas'").all();
    if (tables.length === 0) return;
    const count = dbDesktop.prepare('SELECT COUNT(*) as c FROM vagas').get();
    if (count.c > 0) return;

    const CV = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'sample_cv.json'), 'utf8'));
    const fullStack = CV.stacks || ['React', 'Node.js', 'TypeScript'];

    const jobsData = [
      ['Nubank', 'Staff Product Designer', 'Pleno', 'Remoto', 'São Paulo - SP', 'R$ 12.000 - R$ 16.000', null, null, null, null, JSON.stringify(['Product Design', 'UX Research', 'Figma', 'metodologias ágeis', 'cliente']), JSON.stringify(['Figma', 'Miro', 'Notion']), JSON.stringify(['Atuar em squad de produto', 'Conduzir pesquisas com usuários', 'Criar entregáveis de design'])],
      ['PicPay', 'UX Designer Senior', 'Senior', 'Remoto', 'São Paulo - SP', 'R$ 10.000 - R$ 14.000', null, null, null, null, JSON.stringify(['Product Design', 'UX Research'], ['Figma', 'Miro', 'Notion'])],
      ['iFood', 'Product Designer Senior', 'Senior', 'Remoto', 'São Paulo - SP', 'R$ 11.000 - R$ 15.000', null, null, null, null, JSON.stringify(['Product Design', 'UX Research'], ['Figma', 'Miro', 'Notion'])]
    ];

    const insert = dbDesktop.prepare(`INSERT INTO vagas
      (empresa, cargo, senioridade, modalidade, local, salario, link, data_publicacao, status, match_score, tags, stacks, responsabilidades)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);

    const tx = dbDesktop.transaction(() => {
      for (const j of jobsData) insert.run(...j);
    });
    tx();

    const insert2 = dbDesktop.prepare(`INSERT INTO vagas
      (empresa, cargo, senioridade, modalidade, local, salario, link, data_publicacao, status, match_score, tags, stacks, responsabilidades)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);

    const tx2 = dbDesktop.transaction(() => {
      for (const j of jobsData) insert2.run(...j);
    });
    tx2();
  } catch (_) {}
}
seedDatabase();

app.get('/api/health2', (req, res) => {
  const db = req.db;
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const count = db.prepare('SELECT COUNT(*) as c FROM vagas').get();
  res.json({ ok: true, tables: tables.map(t => t.name), vagas: count.c });
});

module.exports = app;
