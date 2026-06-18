const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'career_agent.db');
const ts = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
const dst = path.join(__dirname, '..', `backup_${ts}.db`);

if (fs.existsSync(src)) {
  fs.copyFileSync(src, dst);
  console.log(`Backup salvo: backup_${ts}.db`);
} else {
  console.log('Nenhum banco encontrado');
}
