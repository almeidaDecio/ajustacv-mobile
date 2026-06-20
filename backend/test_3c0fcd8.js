const { execSync } = require('child_process');
const fs = require('fs');

const buf = execSync('git show 3c0fcd8:backend/server.js', { encoding: 'buffer' });
fs.writeFileSync('backend/server_3c0fcd8.js', buf);

const r = execSync('node -c backend/server_3c0fcd8.js 2>&1', { encoding: 'utf8' });
console.log('Syntax:', r.trim() || 'OK');

const child = require('child_process').spawn('node', ['backend/server_3c0fcd8.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  timeout: 3000
});
let out = '';
child.stdout.on('data', d => out += d);
child.stderr.on('data', d => out += d);
child.on('exit', (code) => {
  console.log('Exit:', code, 'Output:', out.substring(0, 500));
  process.exit(0);
});
setTimeout(() => { console.log('Timeout'); process.exit(0); }, 4000);
