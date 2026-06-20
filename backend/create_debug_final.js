const fs = require('fs');
const { execSync } = require('child_process');

// Create a version that logs to a file on Vercel
// This way we can see where it fails
const buf = execSync('git show 3c0fcd8:backend/server.js', { encoding: 'buffer' });
let code = buf.toString('utf8');

// Add file logging at every step
const logPath = '/tmp/debug_log.txt';
const logFn = `msg => require('fs').appendFileSync('${logPath}', msg + '\\n')`;

code = code.replace("const express = require('express');",
  `const __log = ${logFn};\n__log('MODULE_START');\nconst express = require('express');`);
code = code.replace("const Database = require('better-sqlite3');",
  "__log('REQ_BETTER_SQLITE3_START');\nconst Database = require('better-sqlite3');\n__log('REQ_BETTER_SQLITE3_OK');");

code = code.replace("const multer = require('multer');",
  "__log('REQ_MULTER');\nconst multer = require('multer');");

code = code.replace("const matcher = require('./matcher');",
  "__log('REQ_MATCHER');\nconst matcher = require('./matcher');");

const oldInit = "const dbDesktop = new Database(path.join(DATA_DIR, 'career_agent.db'));\nconst dbMobile   = new Database(path.join(DATA_DIR, 'mobile.db'));";
const newInit = "__log('DB_INIT_START');\nlet dbDesktop, dbMobile;\ntry {\n  dbDesktop = new Database(path.join(DATA_DIR, 'career_agent.db'), { fileMustExist: false });\n  dbMobile   = new Database(path.join(DATA_DIR, 'mobile.db'), { fileMustExist: false });\n  __log('DB_INIT_OK');\n} catch (e) {\n  __log('DB_INIT_ERROR: ' + e.message);\n}";
code = code.replace(oldInit, newInit);

code = code.replace(
  "try { migrate(dbDesktop); } catch (e) { console.error('migrate desktop:', e.message); }\ntry { migrate(dbMobile); } catch (e) { console.error('migrate mobile:', e.message); }",
  "__log('MIGRATE_START');\ntry { migrate(dbDesktop); __log('MIGRATE_DESKTOP_OK'); } catch (e) { __log('MIGRATE_DESKTOP_ERROR: ' + e.message); }\ntry { migrate(dbMobile); __log('MIGRATE_MOBILE_OK'); } catch (e) { __log('MIGRATE_MOBILE_ERROR: ' + e.message); }\n__log('MIGRATE_DONE');"
);

code = code.replace(
  "if (dbMobile) {\n  try {\n    const count = dbMobile.prepare('SELECT COUNT(*) as c FROM vagas').get();",
  "__log('AUTOSEED_START');\nif (dbMobile) {\n  try {\n    __log('AUTOSEED_CHECKING_COUNT');\n    const count = dbMobile.prepare('SELECT COUNT(*) as c FROM vagas').get();"
);

const exportIdx = code.lastIndexOf("module.exports = app;");
code = code.slice(0, exportIdx) + "__log('MODULE_EXPORT_OK');\n" + code.slice(exportIdx);

// Wrap entire module in try-catch
// Actually, let me just add a global try-catch
code = `try {
${code}
} catch(e) {
  const fs = require('fs');
  fs.appendFileSync('/tmp/debug_log.txt', 'FATAL: ' + e.message + '\\n' + (e.stack || '') + '\\n');
  throw e;
}
`;

fs.writeFileSync('backend/test_final_debug.js', code);
console.log('Written:', code.length, 'bytes');
try {
  execSync('node -c backend/test_final_debug.js', { stdio: 'pipe' });
  console.log('Syntax: OK');
} catch(e) {
  console.log('Syntax error:', e.stderr.toString().substring(0, 300));
}
