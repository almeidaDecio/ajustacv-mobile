const fs = require('fs');
const { execSync } = require('child_process');

// Read the exact original server from 3c0fcd8
const buf = execSync('git show 3c0fcd8:backend/server.js', { encoding: 'buffer' });
let code = buf.toString('utf8');

// Only change: wrap DB init in try-catch
const oldInit = "const dbDesktop = new Database(path.join(DATA_DIR, 'career_agent.db'));\nconst dbMobile   = new Database(path.join(DATA_DIR, 'mobile.db'));";
const newInit = "let dbDesktop, dbMobile;\ntry {\n  dbDesktop = new Database(path.join(DATA_DIR, 'career_agent.db'), { fileMustExist: false });\n  dbMobile   = new Database(path.join(DATA_DIR, 'mobile.db'), { fileMustExist: false });\n} catch (e) {\n  console.error('Database init error:', e.message);\n}";
code = code.replace(oldInit, newInit);

// Add error handler middleware for async route handlers
// Express v5 requires explicit error handling for async routes
// Add an error handler AFTER the last route but BEFORE module.exports
const lastRouteIdx = code.lastIndexOf("app.get('/api/health'");
// Actually, add error handling middleware right before module.exports
const exportIdx = code.indexOf("module.exports = app;");
const errorHandler = `
// Global error handler for Express v5
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message, err.stack);
  res.status(500).json({ error: err.message || 'Internal error', stack: err.stack });
});
`;
code = code.slice(0, exportIdx) + errorHandler + code.slice(exportIdx);

fs.writeFileSync('backend/test_final.js', code);
console.log('Written:', code.length, 'bytes');
try {
  execSync('node -c backend/test_final.js', { stdio: 'pipe' });
  console.log('Syntax: OK');
} catch(e) {
  console.log('Syntax error:', e.stderr.toString().substring(0, 200));
}

// Test locally
const { spawn } = require('child_process');
const child = spawn('node', ['backend/test_final.js'], { stdio: ['pipe','pipe','pipe'], timeout: 5000 });
let out = '';
child.stdout.on('data', d => out += d.toString());
child.stderr.on('data', d => out += d.toString());
setTimeout(() => {
  console.log('Local test output:', out.substring(0, 200));
  child.kill();
  process.exit(0);
}, 3000);
