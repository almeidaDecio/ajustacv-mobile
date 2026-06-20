const fs = require('fs');
const { execSync, spawn } = require('child_process');

try {
  execSync('node -c backend/test_safe_all.js', { stdio: 'pipe' });
  console.log('Syntax: OK');
} catch(e) {
  console.log('Syntax error:', e.stderr.toString().substring(0, 200));
  process.exit(1);
}

const child = spawn('node', ['backend/test_safe_all.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  timeout: 5000
});
let out = '';
child.stdout.on('data', d => out += d.toString());
child.stderr.on('data', d => out += d.toString());
setTimeout(() => {
  console.log('Output:', out.substring(0, 300));
  child.kill();
  process.exit(0);
}, 3000);
