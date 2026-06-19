/* =========================================================
   AjustaCV Mobile — app.js
   Conecta ao backend Express do Career AI Agent
   ========================================================= */
const API = '';

function api(path, opts = {}) {
  return fetch(`${API}${path}`, {
    ...opts,
    headers: { ...opts.headers, 'X-Client': 'mobile' },
  });
}

const COLUMNS = [
  { id: 'triagem',   label: 'Triagem' },
  { id: 'aplicadas', label: 'Aplicadas' },
  { id: 'favoritas', label: 'Favoritas' },
];

let jobs = [];
let searchQuery = '';
let activeCol = 'triagem';
let pendingDeleteId = null;
let currentJobId = null;

// ─── DOM refs ─────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const board = $('#board');
const boardCards = $('#boardCards');
const tabs = $('#tabs');
const searchInput = $('#searchInput');
const btnClearSearch = $('#btnClearSearch');

// ─── Seed on demand ───────────────────────────────────
async function seedMobile() {
  try {
    await api('/api/seed', { method: 'POST' });
  } catch (_) { /* servidor sem seed = ok */ }
}

// ─── Load ─────────────────────────────────────────────
async function loadJobs() {
  boardCards.innerHTML = '<div class="board__loading"><div class="spinner"></div></div>';
  try {
    const r = await api('/api/jobs');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    jobs = await r.json();
  } catch (e) {
    boardCards.innerHTML = `
      <div class="board__error">
        <strong>Erro de conexão</strong>
        <span>Não foi possível carregar as vagas. Verifique se o servidor está rodando.</span>
        <button class="btn btn--filled" onclick="loadJobs()" style="margin-top:16px">Tentar novamente</button>
      </div>`;
    return;
  }
  renderAll();
}

// ─── Render ────────────────────────────────────────────
function renderAll() {
  renderStats();
  renderTabs();
  renderBoard();
}

function colJobs(colId) {
  let list = jobs.filter(j => (j.status || 'triagem') === colId);
  const q = searchQuery.toLowerCase().trim();
  if (q) {
    list = list.filter(j =>
      (j.job_title || '').toLowerCase().includes(q) ||
      (j.company || '').toLowerCase().includes(q) ||
      (j.platform || '').toLowerCase().includes(q) ||
      (j.location || '').toLowerCase().includes(q) ||
      (j.required_skills || []).some(s => typeof s === 'string' && s.toLowerCase().includes(q))
    );
  }
  return list;
}

function countByStatus(status) {
  return jobs.filter(j => (j.status || 'triagem') === status).length;
}

function countAplicadasThisMonth() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return jobs.filter(j => {
    if ((j.status || 'triagem') !== 'aplicadas') return false;
    if (!j.applied_date) return false;
    const d = new Date(j.applied_date);
    return !isNaN(d) && d.getMonth() === month && d.getFullYear() === year;
  }).length;
}

function renderStats() {
  const total = jobs.length;
  const aplicadas = countByStatus('aplicadas');
  const entrevistas = countByStatus('entrevista');
  const scores = jobs.map(j => j.matching_score || j.score).filter(s => s != null && s > 0);
  const matchMedio = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) + '%'
    : '—';

  $('#statTotal').textContent = total || '0';
  $('#statAplicadas').textContent = aplicadas || '0';
  $('#statEntrevistas').textContent = entrevistas || '0';
  $('#statMatch').textContent = matchMedio;
}

function renderTabs() {
  tabs.innerHTML = COLUMNS.map(col => {
    const count = countByStatus(col.id);
    return `
      <button class="tab tab--${col.id} ${col.id === activeCol ? 'is-active' : ''}"
              data-col="${col.id}">
        ${col.label}
        <span class="tab__badge">${count}</span>
      </button>`;
  }).join('');

  tabs.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCol = btn.dataset.col;
      renderTabs();
      renderBoard();
    });
  });
}

function renderBoard() {
  const list = colJobs(activeCol);

  if (list.length === 0) {
    const label = COLUMNS.find(c => c.id === activeCol)?.label || activeCol;
    boardCards.innerHTML = `
      <div class="board__empty">
        <strong>Nenhuma vaga aqui ainda</strong>
        <span>As vagas movidas para "${label}" aparecem nesta lista.</span>
      </div>`;
    return;
  }

  boardCards.innerHTML = list.map(j => cardHTML(j, activeCol)).join('');
}

function cardHTML(j, colId) {
  const score = j.matching_score || j.score || null;
  const company = j.company && j.company !== 'null' ? j.company : '';
  const title = j.job_title || 'Sem título';

  let dateStr = '';
  if (colId === 'aplicadas' && j.applied_date) {
    dateStr = formatDate(j.applied_date);
  } else if (j.created_at) {
    dateStr = formatDate(j.created_at);
  }

  return `<article class="vaga-card" data-id="${j.id}" onclick="openDetail(${j.id})">
  <button class="vaga-card__delete" onclick="event.stopPropagation();confirmDelete(${j.id})" title="Excluir">&times;</button>
  <div class="vaga-card__top">
    <div class="vaga-card__info">
      <div class="vaga-card__empresa">${company || title}</div>
      ${company ? `<div class="vaga-card__cargo">${title}</div>` : ''}
    </div>
    ${score !== null ? `<div class="vaga-card__match"><div class="vaga-card__match-label">MATCH</div><div class="vaga-card__match-value">${score}%</div></div>` : ''}
  </div>
  ${dateStr ? `<div class="vaga-card__footer"><span class="vaga-card__data">${dateStr}</span></div>` : ''}
</article>`;
}

// ─── Status change (from modal) ────────────────────────
function confirmDelete(id) {
  pendingDeleteId = id;
  $('#modalConfirm').classList.remove('hidden');
}

async function deleteJob(id) {
  try {
    await api(`/api/jobs/${id}`, { method: 'DELETE' });
  } catch {}
  pendingDeleteId = null;
  $('#modalConfirm').classList.add('hidden');
  loadJobs();
}

// ─── Detail (slide page) ──────────────────────────────
async function openDetail(id) {
  currentJobId = id;
  $('#detailBody').innerHTML = '<div class="board__loading"><div class="spinner"></div></div>';
  $('#detailTitle').textContent = 'Vaga';
  $('#detailPage').classList.add('is-open');

  try {
    const r = await api(`/api/jobs/${id}`);
    const job = await r.json();
    renderDetail(job);
  } catch {
    $('#detailBody').innerHTML = '<p class="confirm-text" style="color:var(--red)">Erro ao carregar detalhes.</p>';
  }
}

function renderDetail(job) {
  const score = job.matching_score || job.score || null;
  const scoreAdj = job.matching_score_ajustado || null;
  const skills = safeArray(job.required_skills);
  const nice = safeArray(job.nice_to_have_skills);
  const tools = safeArray(job.tools);
  const ats = safeArray(job.ats_keywords);
  const resp = safeArray(job.responsibilities);
  const jobDescription = job.job_description || '';
  const empresa = job.company && job.company !== 'null' ? job.company : '';
  const senioridade = job.seniority && job.seniority !== 'not_specified' ? job.seniority : '';
  const location = job.location && job.location !== 'null' ? job.location : '';
  const platform = job.platform || '';
  const applied = job.applied_date || '';
  const interviewType = job.interview_type || '';

  $('#detailTitle').textContent = job.job_title || 'Vaga';

  $('#detailBody').innerHTML = `
    <div class="detail-matches">
      <div class="detail-match ${scoreClass(score)}">
        <div class="detail-match__label">Match CV Base</div>
        <div class="detail-match__value ${score === null ? 'detail-match__value--empty' : ''}">${score !== null ? score + '%' : '—'}</div>
      </div>
      <div class="detail-match ${scoreClass(scoreAdj)}">
        <div class="detail-match__label">Match CV Ajustado</div>
        <div class="detail-match__value ${scoreAdj === null ? 'detail-match__value--empty' : ''}">${scoreAdj !== null ? scoreAdj + '%' : '—'}</div>
      </div>
    </div>

    <div class="job-fields-grid">
      <button class="field-select" data-field="empresa" type="button">
        <span class="field-select__label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> Empresa</span>
        <span class="field-select__value">
          <span class="field-select__text" data-empty="— Selecione —">${escHtml(empresa)}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>
      <button class="field-select" data-field="senioridade" type="button">
        <span class="field-select__label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Senioridade</span>
        <span class="field-select__value">
          <span class="field-select__text" data-empty="— Selecione —">${escHtml(senioridade)}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>
      <button class="field-select" data-field="local" type="button">
        <span class="field-select__label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Local</span>
        <span class="field-select__value">
          <span class="field-select__text" data-empty="— Selecione —">${escHtml(location)}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>
      <button class="field-select" data-field="plataforma" type="button">
        <span class="field-select__label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-17.88 5.85m19.5 5.17c-6.2-1.28-10.47-1.97-17.73-1.97"/></svg> Plataforma</span>
        <span class="field-select__value">
          <span class="field-select__text" data-empty="— Selecione —">${escHtml(platform)}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>
      <button class="field-select" data-field="data" type="button">
        <span class="field-select__label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Data</span>
        <span class="field-select__value">
          <span class="field-select__text" data-empty="— Selecione —">${formatDate(applied) || ''}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>
      <button class="field-select" data-field="tipo_entrevista" type="button">
        <span class="field-select__label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> Tipo de Entrevista</span>
        <span class="field-select__value">
          <span class="field-select__text" data-empty="— Selecione —">${escHtml(interviewType)}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>
    </div>

    <div class="cards-stack">
      <div class="card card--expandable" data-card="skills">
        <button class="card__header" type="button">
          <span class="card__header-label">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            SKILLS REQUERIDAS
            <span class="card__count">${skills.length}</span>
          </span>
          <svg class="card__chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <div class="card__body">
          <div class="card__body-inner">
            ${skills.length ? '<div class="pill-list">' + skills.map(s => `<span class="pill">${escHtml(s)}</span>`).join('') + '</div>' : '<p class="card__empty-state">Nenhuma skill adicionada ainda.</p>'}
          </div>
        </div>
      </div>

      <div class="card card--expandable" data-card="diferenciais">
        <button class="card__header" type="button">
          <span class="card__header-label">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            DIFERENCIAIS
            <span class="card__count">${nice.length}</span>
          </span>
          <svg class="card__chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <div class="card__body">
          <div class="card__body-inner">
            ${nice.length ? '<div class="pill-list">' + nice.map(s => `<span class="pill">${escHtml(s)}</span>`).join('') + '</div>' : '<p class="card__empty-state">Nenhum diferencial adicionado ainda.</p>'}
          </div>
        </div>
      </div>

      <div class="card card--expandable" data-card="ferramentas">
        <button class="card__header" type="button">
          <span class="card__header-label">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            FERRAMENTAS EXIGIDAS
            <span class="card__count">${tools.length}</span>
          </span>
          <svg class="card__chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <div class="card__body">
          <div class="card__body-inner">
            ${tools.length ? '<div class="pill-list">' + tools.map(s => `<span class="pill">${escHtml(s)}</span>`).join('') + '</div>' : '<p class="card__empty-state">Nenhuma ferramenta adicionada ainda.</p>'}
          </div>
        </div>
      </div>

      <div class="card card--expandable" data-card="responsabilidades">
        <button class="card__header" type="button">
          <span class="card__header-label">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>
            RESPONSABILIDADES
            <span class="card__count">${resp.length}</span>
          </span>
          <svg class="card__chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <div class="card__body">
          <div class="card__body-inner">
            ${resp.length ? `<div class="detail-text">${resp.map(r => '• ' + escHtml(r)).join('<br>')}</div>` : '<p class="card__empty-state">Nenhuma responsabilidade listada.</p>'}
          </div>
        </div>
      </div>

      <div class="card card--expandable" data-card="ats">
        <button class="card__header" type="button">
          <span class="card__header-label">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-17.88 5.85m19.5 5.17c-6.2-1.28-10.47-1.97-17.73-1.97"/></svg>
            ATS KEYWORDS
            <span class="card__count">${ats.length}</span>
          </span>
          <svg class="card__chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <div class="card__body">
          <div class="card__body-inner">
            ${ats.length ? '<div class="detail-tags">' + ats.map(s => `<span class="detail-tag detail-tag--purple">${escHtml(s)}</span>`).join('') + '</div>' : '<p class="card__empty-state">Nenhuma keyword ATS encontrada.</p>'}
          </div>
        </div>
      </div>

      <div class="card card--expandable" data-card="texto-vaga">
        <button class="card__header" type="button">
          <span class="card__header-label">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            TEXTO DA VAGA
          </span>
          <svg class="card__chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <div class="card__body">
          <div class="card__body-inner">
            ${jobDescription ? '<p class="detail-text">' + escHtml(jobDescription).replace(/\n/g, '<br>') + '</p>' : '<p class="card__empty-state">Texto da vaga não disponível.</p>'}
          </div>
        </div>
      </div>
    </div>
  `;

  initExpandableCards();
  initEditableSelect({
    fieldSelector: '[data-field="empresa"]',
    sheetId: 'sheet-empresa',
    options: [],
    currentValue: empresa || null,
    onChange: (valor) => {
      if (currentJobId) {
        api(`/api/jobs/${currentJobId}/details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company: valor })
        }).catch(() => {});
      }
    },
  });
  initEditableSelect({
    fieldSelector: '[data-field="senioridade"]',
    sheetId: 'sheet-senioridade',
    options: ['Estágio', 'Júnior', 'Pleno', 'Sênior', 'Especialista', 'Lead', 'Coordenador', 'Gerente', 'Diretor'],
    currentValue: senioridade || null,
    onChange: (valor) => {
      if (currentJobId) {
        api(`/api/jobs/${currentJobId}/details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seniority: valor })
        }).catch(() => {});
      }
    },
  });
  initEditableSelect({
    fieldSelector: '[data-field="local"]',
    sheetId: 'sheet-local',
    options: ['Remoto', 'Presencial', 'Híbrido', 'São Paulo', 'Rio de Janeiro', 'Belo Horizonte'],
    currentValue: location || null,
    onChange: (valor) => {
      if (currentJobId) {
        api(`/api/jobs/${currentJobId}/details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location: valor })
        }).catch(() => {});
      }
    },
  });
  initEditableSelect({
    fieldSelector: '[data-field="plataforma"]',
    sheetId: 'sheet-plataforma',
    options: ['LinkedIn', 'Gupy', 'InfoJobs', 'Própria', 'Indeed', 'GeekHunter', 'Programathor', 'Catho'],
    currentValue: platform || null,
    onChange: (valor) => {
      if (currentJobId) {
        api(`/api/jobs/${currentJobId}/details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: valor })
        }).catch(() => {});
      }
    },
  });
  initEditableSelect({
    fieldSelector: '[data-field="tipo_entrevista"]',
    sheetId: 'sheet-tipo-entrevista',
    options: ['Presencial', 'Remoto (vídeo)', 'Telefone', 'Técnica (live coding/case)'],
    currentValue: interviewType || null,
    onChange: (valor) => {
      if (currentJobId) {
        api(`/api/jobs/${currentJobId}/details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interview_type: valor })
        }).catch(() => {});
      }
    },
  });
  initDateSelect({
    fieldSelector: '[data-field="data"]',
    sheetId: 'sheet-data',
    currentValue: applied || null,
    onChange: (valor) => {
      if (currentJobId) {
        api(`/api/jobs/${currentJobId}/details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ applied_date: valor })
        }).catch(() => {});
      }
    },
  });
}

function closeDetail() {
  $('#detailPage').classList.remove('is-open');
}

function scoreClass(score) {
  if (score == null) return '';
  if (score < 50) return 'detail-match--red';
  if (score < 80) return 'detail-match--amber';
  return 'detail-match--green';
}

function safeArray(arr) {
  if (!arr) return [];
  if (Array.isArray(arr)) return arr;
  try { const p = JSON.parse(arr); return Array.isArray(p) ? p : []; } catch { return []; }
}

function escHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function initEditableSelect({ fieldSelector, sheetId, options, onChange, currentValue }) {
  const fieldBtn = document.querySelector(fieldSelector);
  const overlay = document.getElementById(sheetId);
  if (!fieldBtn || !overlay) return;

  const textEl = fieldBtn.querySelector('.field-select__text');
  const optionsContainer = overlay.querySelector('.sheet-options');
  const customInput = overlay.querySelector('.sheet-custom-input');
  const confirmBtn = overlay.querySelector('.sheet-custom-confirm');

  optionsContainer.innerHTML = options
    .map(opt => `<button type="button" class="sheet-option" data-value="${escHtml(opt)}">${escHtml(opt)}</button>`)
    .join('');

  if (currentValue) textEl.textContent = currentValue;

  function openSheet() { overlay.classList.add('is-open'); customInput.value = ''; confirmBtn.disabled = true; }
  function closeSheet() { overlay.classList.remove('is-open'); }
  function selectValue(value) {
    if (!value || !value.trim()) return;
    textEl.textContent = value.trim();
    closeSheet();
    if (typeof onChange === 'function') onChange(value.trim());
  }

  fieldBtn.addEventListener('click', openSheet);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSheet(); });
  optionsContainer.addEventListener('click', e => {
    const btn = e.target.closest('.sheet-option');
    if (btn) selectValue(btn.dataset.value);
  });
  customInput.addEventListener('input', () => { confirmBtn.disabled = !customInput.value.trim(); });
  confirmBtn.addEventListener('click', () => selectValue(customInput.value));
  customInput.addEventListener('keydown', e => { if (e.key === 'Enter' && customInput.value.trim()) selectValue(customInput.value); });
}

function initDateSelect({ fieldSelector, sheetId, currentValue, onChange }) {
  const fieldBtn = document.querySelector(fieldSelector);
  const overlay = document.getElementById(sheetId);
  if (!fieldBtn || !overlay) return;

  const textEl = fieldBtn.querySelector('.field-select__text');
  const optionsContainer = overlay.querySelector('#sheetDataOptions');
  const dateInput = overlay.querySelector('#sheetDataInput');
  const confirmBtn = overlay.querySelector('#sheetDataConfirm');

  if (currentValue) textEl.textContent = formatDate(currentValue);

  function openSheet() {
    overlay.classList.add('is-open');
    dateInput.style.display = 'none';
    confirmBtn.style.display = 'none';
    dateInput.value = '';
    confirmBtn.disabled = true;
  }
  function closeSheet() { overlay.classList.remove('is-open'); }
  function setDate(val) {
    textEl.textContent = formatDate(val);
    closeSheet();
    if (typeof onChange === 'function') onChange(val);
  }

  fieldBtn.addEventListener('click', openSheet);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSheet(); });

  optionsContainer.addEventListener('click', e => {
    const btn = e.target.closest('.sheet-option');
    if (!btn) return;
    const val = btn.dataset.value;
    if (val === 'hoje') {
      setDate(new Date().toISOString().slice(0, 10));
    } else if (val === 'ontem') {
      setDate(new Date(Date.now() - 86400000).toISOString().slice(0, 10));
    } else if (val === 'custom') {
      dateInput.style.display = 'block';
      confirmBtn.style.display = 'block';
      dateInput.focus();
      if (typeof dateInput.showPicker === 'function') dateInput.showPicker();
    }
  });

  dateInput.addEventListener('input', () => { confirmBtn.disabled = !dateInput.value; });
  confirmBtn.addEventListener('click', () => { if (dateInput.value) setDate(dateInput.value); });
}

function initExpandableCards() {
  document.querySelectorAll('.card--expandable').forEach(card => {
    const header = card.querySelector('.card__header');
    const body = card.querySelector('.card__body');
    const inner = card.querySelector('.card__body-inner');
    header.addEventListener('click', () => {
      const isOpen = card.classList.contains('is-open');
      if (isOpen) {
        card.classList.remove('is-open');
        body.style.height = '0px';
      } else {
        card.classList.add('is-open');
        body.style.height = inner.scrollHeight + 'px';
      }
    });
  });
}

// ─── Nova Vaga ────────────────────────────────────────
function openNovaVaga() {
  $('#jobCompany').value = '';
  $('#jobContext').value = '';
  $('#jobRequirements').value = '';
  $('#extractStatus').textContent = '';
  $('#extractStatus').className = 'modal__status';
  $('#btnProcessar').disabled = true;
  $('#modalNovaVaga').classList.remove('hidden');
}

function closeNovaVaga() {
  $('#modalNovaVaga').classList.add('hidden');
}

async function processarVaga() {
  const company = $('#jobCompany').value.trim();
  const context = $('#jobContext').value.trim();
  const reqs = $('#jobRequirements').value.trim();
  const statusEl = $('#extractStatus');
  const btn = $('#btnProcessar');
  btn.disabled = true;
  statusEl.className = 'modal__status modal__status--loading';
  statusEl.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Processando com IA...';

  let fullText = '';
  if (company) fullText += `Empresa: ${company}\n\n`;
  if (context) fullText += `Contexto:\n${context}\n\n`;
  if (reqs) fullText += `Requisitos:\n${reqs}\n\n`;

  try {
    const r = await api('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_text: fullText })
    });
    const result = await r.json();
    if (result.success) {
      statusEl.className = 'modal__status modal__status--success';
      statusEl.textContent = `${result.data.job_title || 'Vaga'} salva!`;
      setTimeout(() => { closeNovaVaga(); loadJobs(); }, 800);
    } else {
      statusEl.className = 'modal__status modal__status--error';
      statusEl.textContent = result.error || 'Erro ao processar';
    }
  } catch (e) {
    statusEl.className = 'modal__status modal__status--error';
    statusEl.textContent = 'Erro de conexão com o servidor';
  }
  btn.disabled = false;
}

// ─── Helpers ──────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ─── Search ────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  const q = searchInput.value;
  searchQuery = q;
  btnClearSearch.classList.toggle('hidden', q.length === 0);
  renderBoard();
});

btnClearSearch.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  btnClearSearch.classList.add('hidden');
  searchInput.focus();
  renderBoard();
});

// ─── Buttons ──────────────────────────────────────────
$('#statsToggle').addEventListener('click', () => {
  $('#statsToggle').closest('.stats-dropdown').classList.toggle('is-open');
});
$('#btnNovaVaga').addEventListener('click', openNovaVaga);
$('#btnCloseNova').addEventListener('click', closeNovaVaga);
$('#btnCancelNova').addEventListener('click', closeNovaVaga);

function checkProcessar() {
  const hasCompany = $('#jobCompany').value.trim().length > 0;
  const hasContext = $('#jobContext').value.trim().length > 0;
  const hasReqs = $('#jobRequirements').value.trim().length > 0;
  $('#btnProcessar').disabled = !(hasCompany || hasContext || hasReqs);
}

['jobCompany','jobContext','jobRequirements'].forEach(id => {
  $(`#${id}`).addEventListener('input', checkProcessar);
});
$('#btnProcessar').addEventListener('click', processarVaga);

$('#btnImportar').addEventListener('click', () => {
  alert('Funcionalidade de importar CV será implementada em breve.');
});

// Detail
$('#btnBackDetail').addEventListener('click', closeDetail);

// Confirm
$('#btnConfirmDelete').addEventListener('click', () => {
  if (pendingDeleteId !== null) deleteJob(pendingDeleteId);
});
$('#btnCancelConfirm').addEventListener('click', () => {
  pendingDeleteId = null; $('#modalConfirm').classList.add('hidden');
});
$('#btnCloseConfirm').addEventListener('click', () => {
  pendingDeleteId = null; $('#modalConfirm').classList.add('hidden');
});
$('#modalConfirm').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    pendingDeleteId = null; $('#modalConfirm').classList.add('hidden');
  }
});

// Fechar modal ao clicar overlay
$('#modalNovaVaga').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeNovaVaga();
});

// ─── Init ──────────────────────────────────────────────
seedMobile().then(() => loadJobs());
