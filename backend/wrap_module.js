const fs = require('fs');
const { execSync } = require('child_process');

const buf = execSync('git show 3c0fcd8:backend/server.js', { encoding: 'buffer' });
let code = buf.toString('utf8');

// Add console.log at the very beginning
code = "console.log('MODULE_START');\n" + code;

// Wrap DB init in try-catch
const oldInit = "const dbDesktop = new Database(path.join(DATA_DIR, 'career_agent.db'));\nconst dbMobile   = new Database(path.join(DATA_DIR, 'mobile.db'));";
const newInit = "let dbDesktop, dbMobile;\ntry {\n  dbDesktop = new Database(path.join(DATA_DIR, 'career_agent.db'), { fileMustExist: false });\n  dbMobile   = new Database(path.join(DATA_DIR, 'mobile.db'), { fileMustExist: false });\n} catch (e) {\n  console.error('Database init error:', e.message);\n}";
code = code.replace(oldInit, newInit);

// Add try-catch around EVERYTHING that runs at module load
const moduleAppExport = 'module.exports = app;\n';
const endIdx = code.lastIndexOf(moduleAppExport);

// Wrap the entire module in a try-catch and export app
const fullWrapper = `let app;
try {
  ${code.substring(0, endIdx)}
} catch (e) {
  console.error('MODULE_INIT_ERROR:', e.message);
  console.error(e.stack);
  const express = require('express');
  app = express();
  app.get('/api/health', (req, res) => res.json({ ok: false, error: e.message }));
}
${moduleAppExport}`;

fs.writeFileSync('backend/test_wrapped.js', fullWrapper);
console.log('Written:', fullWrapper.length, 'bytes');
try {
  execSync('node -c backend/test_wrapped.js', { stdio: 'pipe' });
  console.log('Syntax: OK');
} catch(e) {
  console.log('Syntax error:', e.stderr.toString().substring(0, 200));
}
