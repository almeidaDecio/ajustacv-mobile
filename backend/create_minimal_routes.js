const fs = require('fs');
const { execSync } = require('child_process');

// Read the working test_init.js which has the simplified schema
const testInit = fs.readFileSync('backend/test_init.js', 'utf8');

// Now I need to add ALL the route handlers from the full server.js
// But keep the simplified schema and DB init

// Read the full server to extract route handlers
const buf = execSync('git show 3c0fcd8:backend/server.js', { encoding: 'buffer' });
const fullCode = buf.toString('utf8');

// Find the route section: everything from the first app.get (after health) to the migration call
const lines = fullCode.split('\n');

// Find start (after health2 in test_init, or after the last route before migration in full)
let routeStart = -1;
let routeEnd = -1;

// In the full server, routes start after the static middleware and end before the migration block
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  // Routes start after app.use('/mobile', ...) and before function migrate
  if (l.includes("app.use('/mobile', express.static")) {
    routeStart = i + 1;
  }
  if (l.trim().startsWith('function migrate(')) {
    routeEnd = i;
    break;
  }
}

if (routeStart > 0 && routeEnd > routeStart) {
  console.log('Route section: lines ' + (routeStart + 1) + '-' + routeEnd);
  const routeSection = lines.slice(routeStart, routeEnd).join('\n');
  
  // Now combine: test_init (without its module.exports) + routeSection + module.exports
  const testLines = testInit.split('\n');
  const exportIdx = testLines.findIndex(l => l.includes('module.exports'));
  const testBody = testLines.slice(0, exportIdx).join('\n');
  
  const result = testBody + '\n' + routeSection + '\nmodule.exports = app;\n';
  
  fs.writeFileSync('backend/test_minimal_routes.js', result);
  console.log('Written:', result.length, 'bytes');
  
  // Verify syntax
  try {
    execSync('node -c backend/test_minimal_routes.js', { stdio: 'pipe' });
    console.log('Syntax: OK');
  } catch(e) {
    console.log('Syntax error:', e.stderr.toString().substring(0, 500));
  }
} else {
  console.log('Could not find route section: start=' + routeStart + ' end=' + routeEnd);
}
