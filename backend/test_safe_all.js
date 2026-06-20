const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const http = require('http');
const matcher = require('./matcher');
const cvGenerator = require('./cv_generator');
const multer = require('multer');
// seed removido — desktop fica limpo; mobile chama /api/seed

const app = express();
const PORT = 3002;
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
const CV_PATH = path.join(__dirname, '..', 'sample_cv.json');

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use((req, res, next) => {
  if (req.path === '/api/health') return next();
  req.db = req.headers['x-client'] === 'mobile' ? dbMobile : dbDesktop;
  if (!req.db) return res.status(500).json({ error: 'Database not initialized' });
  next();
});

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/mobile', express.static(path.join(__dirname, '..', 'frontend', 'mobile')));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Seed ──────────────────────────────────────────────────────
function seedDatabase(db) {
  const insert = db.prepare(`INSERT INTO vagas
    (job_title, company, seniority, experience_years_min, location, status, matching_score, platform, applied_date,
     required_skills, nice_to_have_skills, tools, ats_keywords, responsibilities)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const jobs = [
    ['Product Designer B2B',        'TOTVS',      'Pleno',     5,  'São Paulo', 'aplicadas', 70, 'LinkedIn',  '2026-06-07',
     JSON.stringify(['Product Design', 'Figma', 'UX Research', 'Prototipação', 'Design Systems']),
     JSON.stringify(['Service Design', 'Workshops', 'Mentoria']),
     JSON.stringify(['Figma', 'Miro', 'Notion']),
     JSON.stringify(['product design', 'B2B', 'UX', 'design system', 'SaaS']),
     JSON.stringify(['Projetar funcionalidades B2B', 'Conduzir discovery com clientes', 'Criar e manter design system'])],

    ['Designer Pleno',              'More',       'Pleno',     4,  'São Paulo', 'aplicadas', 62, 'Própria',   '2026-06-05',
     JSON.stringify(['Figma', 'UX Design', 'UI Design', 'Prototipação', 'Design Thinking']),
     JSON.stringify(['Motion', 'Ilustração', 'After Effects']),
     JSON.stringify(['Figma', 'Illustrator', 'Photoshop']),
     JSON.stringify(['design', 'UX', 'UI', 'Figma', 'criatividade']),
     JSON.stringify(['Criar interfaces para web e mobile', 'Colaborar com equipe ágil', 'Apresentar soluções para stakeholders'])],

    ['Pessoa Product Designer Pleno','FCamara',   'Pleno',     4,  'Remoto',    'aplicadas', 52, 'Gupy',      '2026-06-05',
     JSON.stringify(['Product Design', 'Figma', 'Pesquisa', 'Prototipação', 'Design Systems']),
     JSON.stringify(['Service Design', 'Workshops', 'Mentoria']),
     JSON.stringify(['Figma', 'Miro', 'Notion']),
     JSON.stringify(['Product Design', 'UX Research', 'Figma', 'metodologias ágeis']),
     JSON.stringify(['Atuar em squad de produto', 'Conduzir pesquisas com usuários', 'Criar protótipos navegáveis'])],

    ['Analista de Dados Sênior',    'Ifood',      'Sênior',   5,  'São Paulo', 'triagem',   85, 'LinkedIn',  null,
     '[]','[]','[]','[]','[]'],
    ['UX Designer Pleno',           'Nubank',     'Pleno',    3,  'Remoto',    'triagem',   72, 'Gupy',      null,
     '[]','[]','[]','[]','[]'],
    ['Desenvolvedor Front-end',     'VTEX',       'Pleno',    3,  'São Paulo', 'triagem',   91, 'LinkedIn',  null,
     '[]','[]','[]','[]','[]'],
    ['Product Manager',             'QuintoAndar','Sênior',   5,  'São Paulo', 'aplicadas', 68, 'LinkedIn',  '2026-06-10',
     '[]','[]','[]','[]','[]'],
    ['Engenheiro de Dados',         'Americanas', 'Pleno',    4,  'São Paulo', 'triagem',   55, 'InfoJobs',  null,
     '[]','[]','[]','[]','[]'],
    ['Tech Lead',                   'Stone',      'Sênior',   6,  'São Paulo', 'favoritas', 78, 'LinkedIn',  null,
     '[]','[]','[]','[]','[]'],
    ['Desenvolvedor Back-end',      'PicPay',     'Pleno',    3,  'Remoto',    'triagem',   88, 'Gupy',      null,
     '[]','[]','[]','[]','[]'],
    ['Data Scientist',              'B3',         'Sênior',   5,  'São Paulo', 'aplicadas', 63, 'LinkedIn',  '2026-06-12',
     '[]','[]','[]','[]','[]'],
    ['Front-end Sênior',            'iFood',      'Sênior',   5,  'São Paulo', 'triagem',   95, 'LinkedIn',  null,
     '[]','[]','[]','[]','[]'],
    ['Analista de QA',              'Loggi',      'Pleno',    3,  'São Paulo', 'triagem',   45, 'InfoJobs',  null,
     '[]','[]','[]','[]','[]'],
    ['DevOps Engineer',             'Mercado Livre','Sênior', 5,  'São Paulo', 'favoritas', 74, 'LinkedIn',  null,
     '[]','[]','[]','[]','[]'],
    ['Cientista de Dados Jr',       'Banco Inter','Júnior',   1,  'Remoto',    'triagem',   60, 'Gupy',      null,
     '[]','[]','[]','[]','[]'],
    ['Arquiteto de Software',       'AWS Brasil', 'Sênior',   8,  'São Paulo', 'triagem',   70, 'LinkedIn',  null,
     '[]','[]','[]','[]','[]'],
    ['Estagiário TI',               'Accenture',  'Estágio',  0,  'São Paulo', 'triagem',   35, 'InfoJobs',  null,
     '[]','[]','[]','[]','[]'],
  ];

  const tx = db.transaction(() => {
    for (const j of jobs) insert.run(...j);
  });
  tx();
  return jobs.length;
}

// Seed on demand (mobile chama esse endpoint)
app.post('/api/seed', (req, res) => {
  const db = dbMobile;
  const force = req.query.force === 'true' || req.body?.force === true;
  const count = db.prepare('SELECT COUNT(*) as c FROM vagas').get();
  if (count.c > 0 && !force) return res.json({ seeded: false, reason: 'ja_existem_dados' });

  if (force && count.c > 0) {
    db.prepare('DELETE FROM vagas').run();
  }

  const seeded = seedDatabase(db);
  res.json({ seeded: true, count: seeded });
});

// Listar todas as vagas
app.get('/api/jobs', (req, res) => {
  const rows = req.db.prepare('SELECT * FROM vagas ORDER BY id DESC').all();
  res.json(rows.map(r => ({
    ...r,
    required_skills: safeJson(r.required_skills),
    nice_to_have_skills: safeJson(r.nice_to_have_skills),
    responsibilities: safeJson(r.responsibilities),
    tools: safeJson(r.tools),
    ats_keywords: safeJson(r.ats_keywords)
  })));
});

// Pegar uma vaga por ID
app.get('/api/jobs/:id', (req, res) => {
  const row = req.db.prepare('SELECT * FROM vagas WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Vaga não encontrada' });
  res.json({
    ...row,
    required_skills: safeJson(row.required_skills),
    nice_to_have_skills: safeJson(row.nice_to_have_skills),
    responsibilities: safeJson(row.responsibilities),
    tools: safeJson(row.tools),
    ats_keywords: safeJson(row.ats_keywords)
  });
});

// Criar vaga
app.post('/api/jobs', (req, res) => {
  const v = req.body;
  const result = req.db.prepare(`INSERT INTO vagas
    (job_title, company, seniority, experience_years_min, location,
     required_skills, nice_to_have_skills, responsibilities, tools, ats_keywords,
     applied_date, platform)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    v.job_title || null,
    v.company || null,
    v.seniority || null,
    v.experience_years_min || null,
    v.location || null,
    JSON.stringify(v.required_skills || []),
    JSON.stringify(v.nice_to_have_skills || []),
    JSON.stringify(v.responsibilities || []),
    JSON.stringify(v.tools || []),
    JSON.stringify(v.ats_keywords || []),
    v.applied_date || null,
    v.platform || null
  );
  res.json({ success: true, id: result.lastInsertRowid });
});

// Atualizar vaga (status)
app.put('/api/jobs/:id', (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'Campo status é obrigatório' });
  try {
    req.db.prepare('UPDATE vagas SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Salvar data de aplicação e plataforma (via POST form/JSON)
app.post('/api/jobs/:id/details', (req, res) => {
  try {
    const applied_date = req.body.applied_date || null;
    const platform = req.body.platform || null;
    const interview_type = req.body.interview_type || null;
    const location = req.body.location || null;
    req.db.prepare('UPDATE vagas SET applied_date = ?, platform = ?, interview_type = ?, location = ? WHERE id = ?')
      .run(applied_date, platform, interview_type, location, req.params.id);

    // Recalcular matching
    const row = req.db.prepare('SELECT * FROM vagas WHERE id = ?').get(req.params.id);
    if (row) {
      const job = {
        required_skills: safeJson(row.required_skills),
        nice_to_have_skills: safeJson(row.nice_to_have_skills),
        tools: safeJson(row.tools),
        ats_keywords: safeJson(row.ats_keywords)
      };
      const match = matcher.run(job);
      if (match.score !== null) {
        req.db.prepare('UPDATE vagas SET matching_score = ? WHERE id = ?').run(match.score, req.params.id);
      }
    }
    res.json({ success: true });
  } catch (e) {
    console.error('details error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Recalcular matching score
app.post('/api/jobs/:id/recalculate', (req, res) => {
  try {
    const row = req.db.prepare('SELECT * FROM vagas WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Vaga não encontrada' });
    const job = {
      required_skills: safeJson(row.required_skills),
      nice_to_have_skills: safeJson(row.nice_to_have_skills),
      tools: safeJson(row.tools),
      ats_keywords: safeJson(row.ats_keywords)
    };
    const match = matcher.run(job);
    if (match.score !== null) {
      req.db.prepare('UPDATE vagas SET matching_score = ? WHERE id = ?').run(match.score, req.params.id);
    }
    res.json({ success: true, matching_score: match.score });
  } catch (e) {
    console.error('Recalculate error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Atualizar CV base (sample_cv.json)
app.post('/api/cv/base', (req, res) => {
  try {
    const { cv_json } = req.body;
    if (!cv_json) return res.status(400).json({ error: 'Campo cv_json é obrigatório' });
    const parsed = typeof cv_json === 'string' ? JSON.parse(cv_json) : cv_json;
    fs.writeFileSync(CV_PATH, JSON.stringify(parsed, null, 2), 'utf8');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ler CV base atual
app.get('/api/cv/base', (req, res) => {
  try {
    const raw = fs.readFileSync(CV_PATH, 'utf8');
    res.json({ success: true, cv: JSON.parse(raw) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Parse CV texto puro para JSON estruturado via Ollama
app.post('/api/cv/parse', async (req, res) => {
  try {
    const { cv_text } = req.body;
    if (!cv_text) return res.status(400).json({ error: 'Campo cv_text é obrigatório' });
    const prompt = `Você é um extrator de dados de currículos. Analise o texto do CV abaixo e extraia as informações no formato JSON exato especificado.

Texto do CV:
${cv_text}

Retorno APENAS um JSON válido (sem markdown, sem explicações) com esta estrutura exata:
{
  "name": "Nome completo",
  "current_title": "Cargo atual",
  "total_experience_years": número,
  "summary": "Resumo profissional de 2-3 parágrafos",
  "categories": {
    "research": { "skills": ["skill1", "skill2"], "evidence": "..." },
    "interaction_design": { "skills": ["skill1", "skill2"], "evidence": "..." },
    "visual_design": { "skills": ["skill1", "skill2"], "evidence": "..." },
    "tools": { "skills": ["skill1", "skill2"], "evidence": "..." },
    "soft_skills": { "skills": ["skill1", "skill2"], "evidence": "..." },
    "business": { "skills": ["skill1", "skill2"], "evidence": "..." }
  },
  "experience": [
    { "company": "Empresa", "role": "Cargo", "years": número, "domain": "Domínio", "highlights": ["...", "..."], "skills": ["...", "..."] }
  ],
  "languages": [ { "language": "Idioma", "level": "Nível" } ],
  "education": [ { "degree": "Curso", "institution": "Instituição", "year": "ano" } ]
}

Preencha todas as categorias com base no texto. Se uma categoria não tiver skills no texto, coloque array vazio. Use evidence baseado nas realizações descritas.`;
    const raw = await callOllama(prompt);
    const cv = extractJson(raw);
    res.json({ success: true, cv });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Gerar CV otimizado para a vaga
app.post('/api/jobs/:id/generate-cv', async (req, res) => {
  try {
    const row = req.db.prepare('SELECT * FROM vagas WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Vaga não encontrada' });
    const job = {
      required_skills: safeJson(row.required_skills),
      nice_to_have_skills: safeJson(row.nice_to_have_skills),
      tools: safeJson(row.tools),
      ats_keywords: safeJson(row.ats_keywords)
    };
    let cv;
    if (req.body && req.body.cv_json) {
      const cvData = typeof req.body.cv_json === 'string' ? JSON.parse(req.body.cv_json) : req.body.cv_json;
      cv = cvGenerator.generateFromData(cvData, job);
    } else {
      cv = await cvGenerator.generateForJob(job);
    }

    // Cache the Ollama-enhanced CV result
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, `cv_cache_${req.params.id}.json`), JSON.stringify(cv, null, 2), 'utf8');

    // Generate HTML for PDF export
    const sfExp = cv.experience.find(e => e.company.toLowerCase().includes('softfocus'));
    const ollamaResult = {
      resumo_ajustado: cv.summary,
      softfocus_cargo: sfExp ? sfExp.role : 'Product Designer',
      softfocus_periodo: sfExp && sfExp.period ? sfExp.period : 'jul/2021 – fev/2026',
      softfocus_resultados: sfExp && sfExp.resultados ? sfExp.resultados : '',
      softfocus_entregas_ajustadas: sfExp && sfExp.highlights ? sfExp.highlights : []
    };
    cvGenerator.generateHTML(cv, ollamaResult);

    res.json({ success: true, cv });
  } catch (e) {
    console.error('generate-cv error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Gerar e salvar CV como .txt em Downloads
app.post('/api/jobs/:id/save-cv-file', async (req, res) => {
  try {
    const row = req.db.prepare('SELECT * FROM vagas WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Vaga não encontrada' });
    const job = {
      required_skills: safeJson(row.required_skills),
      nice_to_have_skills: safeJson(row.nice_to_have_skills),
      tools: safeJson(row.tools),
      ats_keywords: safeJson(row.ats_keywords)
    };
    let cv;
    if (req.body && req.body.cv_json) {
      const cvData = typeof req.body.cv_json === 'string' ? JSON.parse(req.body.cv_json) : req.body.cv_json;
      cv = cvGenerator.generateFromData(cvData, job);
    } else {
      cv = await cvGenerator.generateForJob(job);
    }

    const summary = `${cv.summary}`;

    let output = `${cv.name}\n${cv.current_title}\n\ndecio.almeida.1969@gmail.com | +55 11 99376-3161\nlinkedin.com/in/décio-d-almeida-74186621\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nRESUMO PROFISSIONAL\n\n${summary}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nCOMPETÊNCIAS\n\n${cv.skills_ordered.join(' · ')}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nEXPERIÊNCIA PROFISSIONAL\n\n`;

    (cv.experience || []).forEach((exp, i) => {
      output += `${exp.company} — ${exp.role}${exp.period ? ' | ' + exp.period : ''}\n\n`;
      if (exp.resultados) {
        output += `${exp.resultados}\n\n`;
      }
      if (exp.highlights && exp.highlights.length) {
        output += exp.highlights.map(h => '• ' + h).join('\n') + '\n\n';
      }
      if (exp.skills && exp.skills.length) {
        output += `Skills: ${exp.skills.join(' · ')}\n`;
      }
      if (i < cv.experience.length - 1) {
        output += `\n─────────────────────────────────────────────────\n\n`;
      }
    });

    output += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nFORMAÇÃO\n\n`;
    (cv.education || []).forEach(edu => {
      output += `${edu.degree}\n${edu.institution || ''}${edu.year ? ' | ' + edu.year : ''}\n\n`;
    });
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nIDIOMAS\n\n`;
    (cv.languages || []).forEach(lang => {
      output += `${lang.language} — ${lang.level}\n`;
    });

    const downloadsPath = path.join(require('os').homedir(), 'Downloads');
    const companySlug = (row.company || 'vaga').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
    const filename = `CV_otimizado_${companySlug}.txt`;
    const filePath = path.join(downloadsPath, filename);
    fs.writeFileSync(filePath, output, 'utf8');

    res.json({ success: true, filename });
  } catch (e) {
    console.error('save-cv-file error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Salvar texto puro do CV como .txt em Downloads (rápido, sem Ollama)
app.post('/api/jobs/:id/save-cv-text', (req, res) => {
  try {
    const { cv_text } = req.body;
    if (!cv_text) return res.status(400).json({ error: 'Campo cv_text é obrigatório' });

    const row = req.db.prepare('SELECT * FROM vagas WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Vaga não encontrada' });

    const atsKeywords = safeJson(row.ats_keywords);
    const atsLine = atsKeywords.length ? `ATS Keywords: ${atsKeywords.slice(0, 5).join(', ')}` : '';

    const output = `CV OTIMIZADO — ${row.job_title || 'Vaga'}${row.company && row.company !== 'null' ? ` @ ${row.company}` : ''}
${atsLine ? '\n' + atsLine : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${cv_text.trim()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CV otimizado para a vaga: ${row.job_title || '—'}
${row.company && row.company !== 'null' ? `Empresa: ${row.company}\n` : ''}
Gerado por Career AI Agent em ${new Date().toLocaleDateString('pt-BR')}
`;

    const downloadsPath = path.join(require('os').homedir(), 'Downloads');
    const companySlug = (row.company || 'vaga').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
    const filename = `CV_otimizado_${companySlug}.txt`;
    const filePath = path.join(downloadsPath, filename);
    fs.writeFileSync(filePath, output, 'utf8');

    res.json({ success: true, filename });
  } catch (e) {
    console.error('save-cv-text error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Gerar HTML do CV otimizado para visualização/impressão (usa cache do generate-cv)
app.post('/api/jobs/:id/export-pdf', async (req, res) => {
  try {
    const row = req.db.prepare('SELECT * FROM vagas WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Vaga não encontrada' });

    const cachePath = path.join(__dirname, '..', 'data', `cv_cache_${req.params.id}.json`);
    if (!fs.existsSync(cachePath)) {
      return res.status(400).json({ error: 'Gere o CV otimizado primeiro (botão "Gerar CV Otimizado")' });
    }

    const cv = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const sfExp = cv.experience.find(e => e.company.toLowerCase().includes('softfocus'));
    const ollamaResult = {
      resumo_ajustado: cv.summary,
      softfocus_cargo: sfExp ? sfExp.role : 'Product Designer',
      softfocus_periodo: sfExp && sfExp.period ? sfExp.period : 'jul/2021 – fev/2026',
      softfocus_resultados: sfExp && sfExp.resultados ? sfExp.resultados : '',
      softfocus_entregas_ajustadas: sfExp && sfExp.highlights ? sfExp.highlights : []
    };
    cvGenerator.generateHTML(cv, ollamaResult);
    res.json({ success: true, url: '/cv_otimizado.html?print=true' });
  } catch (e) {
    console.error('export-pdf error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Deletar vaga
app.delete('/api/jobs/:id', (req, res) => {
  req.db.prepare('DELETE FROM vagas WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

function safeJson(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return []; }
}

// Chamar Ollama local
function callOllama(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, options: { temperature: 0 } });
    const req = http.request(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body).response); }
        catch (e) { reject(new Error('Falha ao ler resposta do Ollama')); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function extractJson(raw) {
  let cleaned = raw.trim();
  try { return JSON.parse(cleaned); } catch {}
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
  if (s !== -1 && e > s) { try { return JSON.parse(cleaned.slice(s, e + 1)); } catch {} }
  throw new Error('Não foi possível extrair JSON');
}

// Extrair vaga com Ollama e salvar
app.post('/api/extract', async (req, res) => {
  try {
    const { job_text } = req.body;
    if (!job_text) return res.status(400).json({ error: 'Campo job_text é obrigatório' });
    const raw = await callOllama(job_text);
    const v = extractJson(raw);

    const match = matcher.run(v);
    const matchingScore = match.score;

    const result = req.db.prepare(`INSERT INTO vagas
      (job_title, company, seniority, experience_years_min, location,
       required_skills, nice_to_have_skills, responsibilities, tools, ats_keywords,
       job_text, matching_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      v.job_title || null, v.company || null, v.seniority || null,
      v.experience_years_min || null, v.location || null,
      JSON.stringify(v.required_skills || []), JSON.stringify(v.nice_to_have_skills || []),
      JSON.stringify(v.responsibilities || []), JSON.stringify(v.tools || []),
      JSON.stringify(v.ats_keywords || []),
      job_text,
      matchingScore
    );

    res.json({ success: true, id: result.lastInsertRowid, data: v, matching_score: matchingScore });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Error handler global — sempre retorna JSON
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Erro interno' });
});

// Migrations — roda nos dois bancos
function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vagas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_title TEXT,
      company TEXT,
      seniority TEXT,
      experience_years_min INTEGER,
      location TEXT,
      required_skills TEXT,
      nice_to_have_skills TEXT,
      responsibilities TEXT,
      tools TEXT,
      ats_keywords TEXT,
      job_description TEXT,
      status TEXT DEFAULT 'triagem',
      applied_date TEXT,
      platform TEXT,
      job_text TEXT,
      matching_score INTEGER,
      interview_type TEXT,
      interview_date TEXT,
      created_at TEXT
    )
  `);
  db.exec(`CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mimetype TEXT,
    size INTEGER,
    created_at TEXT
  )`);
}
try { migrate(dbDesktop); } catch (e) { console.error('migrate desktop:', e.message); }
try { migrate(dbMobile); } catch (e) { console.error('migrate mobile:', e.message); }

// Auto-seed on cold start (Vercel)
if (dbMobile) {
  try {
    const count = dbMobile.prepare('SELECT COUNT(*) as c FROM vagas').get();
    if (count.c === 0) {
      seedDatabase(dbMobile);
      console.log('Auto-seed: mobile.db seeded');
    }
  } catch (e) { console.error('auto-seed:', e.message); }
}

// Listar anexos de uma vaga
app.get('/api/jobs/:id/attachments', (req, res) => {
  try {
    const rows = req.db.prepare(
      'SELECT id, original_name, mimetype, size, created_at FROM attachments WHERE job_id = ? ORDER BY created_at DESC'
    ).all(req.params.id);
    res.json({ success: true, attachments: rows });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Upload de anexo
app.post('/api/jobs/:id/attachments', upload.single('file'), (req, res) => {
  if (!req.file) return res.json({ success: false, error: 'Nenhum arquivo enviado' });
  try {
    req.db.prepare(
      'INSERT INTO attachments (job_id, filename, original_name, mimetype, size) VALUES (?, ?, ?, ?, ?)'
    ).run(
      req.params.id,
      req.file.filename,
      req.file.originalname,
      req.file.mimetype,
      req.file.size
    );
    res.json({ success: true, filename: req.file.filename, original_name: req.file.originalname });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Download/visualização de anexo
app.get('/api/attachments/:filename', (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Arquivo não encontrado' });
  res.sendFile(filePath);
});

// Excluir anexo
app.delete('/api/attachments/:id', (req, res) => {
  try {
    const row = req.db.prepare('SELECT filename FROM attachments WHERE id = ?').get(req.params.id);
    if (!row) return res.json({ success: false, error: 'Não encontrado' });
    const filePath = path.join(uploadDir, row.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    req.db.prepare('DELETE FROM attachments WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Upload de arquivo para nova vaga
app.post('/api/jobs/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.json({ success: false, error: 'Nenhum arquivo enviado' });
  res.json({ success: true, filename: req.file.filename, path: req.file.path });
});

if (!process.env.VERCEL) {
  try {
    const backupSrc = path.join(__dirname, '..', 'career_agent.db');
    if (fs.existsSync(backupSrc)) {
      const ts = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      fs.copyFileSync(backupSrc, path.join(__dirname, '..', `backup_${ts}.db`));
      console.log(`Backup: backup_${ts}.db`);
    }
  } catch (_) {}
}

if (!process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`API rodando em http://127.0.0.1:${PORT}`);
  });

  process.on('SIGTERM', () => {
    console.log('Encerrando servidor...');
    server.close(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    console.log('Encerrando servidor...');
    server.close(() => process.exit(0));
  });
}

module.exports = app;
