const fs = require('fs');
const { execSync } = require('child_process');

const buf = execSync('git show 3c0fcd8:backend/server.js', { encoding: 'buffer' });
let code = buf.toString('utf8');

// Wrap DB init
const oldInit = "const dbDesktop = new Database(path.join(DATA_DIR, 'career_agent.db'));\nconst dbMobile   = new Database(path.join(DATA_DIR, 'mobile.db'));";
const newInit = "let dbDesktop, dbMobile;\ntry {\n  dbDesktop = new Database(path.join(DATA_DIR, 'career_agent.db'), { fileMustExist: false });\n  dbMobile   = new Database(path.join(DATA_DIR, 'mobile.db'), { fileMustExist: false });\n} catch (e) {\n  console.error('Database init error:', e.message);\n}\n";
code = code.replace(oldInit, newInit);

// Wrap module exports in try-catch
const exportLine = 'module.exports = app;\n';
code = code.replace(
  exportLine,
  'if (typeof app !== "undefined") {\n  module.exports = app;\n} else {\n  const fallbackExpress = require("express");\n  const fallbackApp = fallbackExpress();\n  fallbackApp.get("/api/health", (req, res) => res.json({ ok: true, error: "app_undefined" }));\n  module.exports = fallbackApp;\n}\n'
);

fs.writeFileSync('backend/test_appcheck.js', code);
console.log('Written:', code.length, 'bytes');
try {
  execSync('node -c backend/test_appcheck.js', { stdio: 'pipe' });
  console.log('Syntax: OK');
} catch(e) {
  const stderr = e.stderr.toString();
  console.log('Syntax error:', stderr.substring(0, 300));
}
