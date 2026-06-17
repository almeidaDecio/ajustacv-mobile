const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'career_agent.db'));

const count = db.prepare('SELECT COUNT(*) as c FROM vagas').get();
if (count.c > 0) {
  db.close();
  return;
}

const insert = db.prepare(`INSERT INTO vagas
  (job_title, company, status, matching_score, platform, applied_date, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)`);

const jobs = [
  ['Analista de Dados Sênior',    'Ifood',      'triagem',   85, 'LinkedIn',  null],
  ['UX Designer Pleno',           'Nubank',     'triagem',   72, 'Gupy',      null],
  ['Desenvolvedor Front-end',     'VTEX',       'triagem',   91, 'LinkedIn',  null],
  ['Product Manager',             'QuintoAndar','aplicadas', 68, 'LinkedIn',  '2026-06-10'],
  ['Engenheiro de Dados',         'Americanas', 'triagem',   55, 'InfoJobs',  null],
  ['Tech Lead',                   'Stone',      'favoritas', 78, 'LinkedIn',  null],
  ['Desenvolvedor Back-end',      'PicPay',     'triagem',   88, 'Gupy',      null],
  ['Data Scientist',              'B3',         'aplicadas', 63, 'LinkedIn',  '2026-06-12'],
  ['Front-end Sênior',            'iFood',      'triagem',   95, 'LinkedIn',  null],
  ['Analista de QA',              'Loggi',      'triagem',   45, 'InfoJobs',  null],
  ['Designer de Produto',         'Creditas',   'triagem',   81, 'Gupy',      null],
  ['DevOps Engineer',             'Mercado Livre','favoritas',74, 'LinkedIn',  null],
  ['Cientista de Dados Jr',       'Banco Inter','triagem',   60, 'Gupy',      null],
  ['Arquiteto de Software',       'AWS Brasil', 'triagem',   70, 'LinkedIn',  null],
  ['Estagiário TI',               'Accenture',  'triagem',   35, 'InfoJobs',  null],
  ['Product Designer B2B',        'TOTVS',      'aplicadas', 70, 'LinkedIn',  '2026-06-07'],
  ['Designer Pleno',              'More',       'aplicadas', 62, 'Própria',   '2026-06-05'],
  ['Pessoa Product Designer Pleno','FCamara',   'aplicadas', 52, 'Gupy',      '2026-06-05'],
];

const tx = db.transaction(() => {
  for (const j of jobs) {
    insert.run(...j);
  }
});
tx();

db.close();
