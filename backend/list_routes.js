const { execSync } = require('child_process');
const fs = require('fs');
const buf = execSync('git show 3c0fcd8:backend/server.js', { encoding: 'buffer' });
const code = buf.toString('utf8');
const routeRegex = /app\.(get|post|put|delete)\(\s*['"]([^'"]+)['"]/g;
let match;
console.log('Routes:');
while ((match = routeRegex.exec(code)) !== null) {
  console.log('  ' + match[1].toUpperCase() + ' ' + match[2]);
}
