/* =========================================================
   AjustaCV Mobile — app.js
   Conecta ao backend Express do Career AI Agent
   ========================================================= */
const API = '';

const COLUMNS = [
  { id: 'triagem',   label: 'Triagem' },
  { id: 'aplicadas', label: 'Aplicadas' },
  { id: 'favoritas', label: 'Favoritas' },
];

let jobs = [];
let searchQuery = '';
let activeCol = 'triagem';
let pendingDeleteId = null;

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
    await fetch(`${API}/api/seed`, { method: 'POST' });
  } catch (_) { /* servidor sem seed = ok */ }
}

// ─── Load ─────────────────────────────────────────────
async function loadJobs() {
  boardCards.innerHTML = '<div class="board__loading"><div class="spinner"></div></div>';
  try {
    const r = await fetch(`${API}/api/jobs`);
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
    await fetch(`${API}/api/jobs/${id}`, { method: 'DELETE' });
  } catch {}
  pendingDeleteId = null;
  $('#modalConfirm').classList.add('hidden');
  loadJobs();
}

// ─── Detail ──────────────────────────────────────────
async function openDetail(id) {
  $('#detailBody').innerHTML = '<div class="board__loading"><div class="spinner"></div></div>';
  $('#modalDetalhes').classList.remove('hidden');

  try {
    const r = await fetch(`${API}/api/jobs/${id}`);
    const job = await r.json();
    renderDetail(job);
  } catch {
    $('#detailBody').innerHTML = '<p class="confirm-text" style="color:var(--red)">Erro ao carregar detalhes.</p>';
  }
}

function renderDetail(job) {
  const score = job.matching_score || job.score || null;
  const skills = job.required_skills || [];
  const nice = job.nice_to_have_skills || [];
  const tools = job.tools || [];
  const ats = job.ats_keywords || [];
  const resp = job.responsibilities || [];

  let scoreClass = 'detail-match--green';
  if (score !== null) {
    if (score < 50) scoreClass = 'detail-match--red';
    else if (score < 80) scoreClass = 'detail-match--amber';
  }

  $('#detailTitle').textContent = job.job_title || 'Vaga';
  $('#detailBody').innerHTML = `
    ${score !== null ? `
    <div class="detail-match ${scoreClass}">
      <div class="detail-match__value">${score}%</div>
      <div>
        <div class="detail-match__label">Match com seu CV</div>
        <div style="font-size:13px;color:var(--text2);margin-top:2px">
          ${job.company && job.company !== 'null' ? job.company : ''}
          ${job.seniority && job.seniority !== 'not_specified' ? ' · ' + job.seniority : ''}
        </div>
      </div>
    </div>` : ''}

    <div class="detail-section">
      <h4>Skills Requeridas</h4>
      <div class="detail-tags">
        ${skills.map(s => `<span class="detail-tag detail-tag--teal">${s}</span>`).join('') || '<span class="detail-text">—</span>'}
      </div>
    </div>

    ${nice.length ? `
    <div class="detail-section">
      <h4>Diferenciais</h4>
      <div class="detail-tags">
        ${nice.map(s => `<span class="detail-tag detail-tag--amber">${s}</span>`).join('')}
      </div>
    </div>` : ''}

    ${tools.length ? `
    <div class="detail-section">
      <h4>Ferramentas</h4>
      <div class="detail-tags">
        ${tools.map(s => `<span class="detail-tag">${s}</span>`).join('')}
      </div>
    </div>` : ''}

    ${ats.length ? `
    <div class="detail-section">
      <h4>ATS Keywords</h4>
      <div class="detail-tags">
        ${ats.map(s => `<span class="detail-tag detail-tag--purple">${s}</span>`).join('')}
      </div>
    </div>` : ''}

    ${resp.length ? `
    <div class="detail-section">
      <h4>Responsabilidades</h4>
      <p class="detail-text">${resp.map(r => '• ' + r).join('<br>')}</p>
    </div>` : ''}

    ${job.location && job.location !== 'null' ? `
    <div class="detail-section">
      <h4>Local</h4>
      <p class="detail-text">${job.location}</p>
    </div>` : ''}

    ${job.platform ? `
    <div class="detail-section">
      <h4>Plataforma</h4>
      <p class="detail-text">${job.platform}</p>
    </div>` : ''}

    ${job.applied_date ? `
    <div class="detail-section">
      <h4>Data de aplicação</h4>
      <p class="detail-text">${formatDate(job.applied_date)}</p>
    </div>` : ''}
  `;
}

function closeDetail() {
  $('#modalDetalhes').classList.add('hidden');
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
    const r = await fetch(`${API}/api/extract`, {
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
$('#btnCloseDetail').addEventListener('click', closeDetail);
$('#modalDetalhes').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeDetail();
});

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
