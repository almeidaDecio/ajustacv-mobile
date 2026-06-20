const fs = require('fs');
const { execSync } = require('child_process');

const buf = execSync('git show 3c0fcd8:backend/server.js', { encoding: 'buffer' });
let code = buf.toString('utf8');

// Add console.log at module start
code = "console.log('MODULE_START');\n" + code;

// Add console.log after each require
code = code.replace(
  "const express = require('express');",
  "console.log('REQ_EXPRESS');\nconst express = require('express');"
);
code = code.replace(
  "const Database = require('better-sqlite3');",
  "console.log('REQ_BETTER_SQLITE3');\nconst Database = require('better-sqlite3');"
);
code = code.replace(
  "const path = require('path');",
  "console.log('REQ_PATH');\nconst path = require('path');"
);
code = code.replace(
  "const multer = require('multer');",
  "console.log('REQ_MULTER');\nconst multer = require('multer');"
);
code = code.replace(
  "const matcher = require('./matcher');",
  "console.log('REQ_MATCHER');\nconst matcher = require('./matcher');"
);
code = code.replace(
  "const cvGenerator = require('./cv_generator');",
  "console.log('REQ_CV_GENERATOR');\nconst cvGenerator = require('./cv_generator');"
);

// Wrap DB init
const oldInit = "const dbDesktop = new Database(path.join(DATA_DIR, 'career_agent.db'));\nconst dbMobile   = new Database(path.join(DATA_DIR, 'mobile.db'));";
const newInit = "console.log('DB_INIT_START');\nlet dbDesktop, dbMobile;\ntry {\n  dbDesktop = new Database(path.join(DATA_DIR, 'career_agent.db'), { fileMustExist: false });\n  dbMobile   = new Database(path.join(DATA_DIR, 'mobile.db'), { fileMustExist: false });\n  console.log('DB_INIT_OK');\n} catch (e) {\n  console.error('DB_INIT_ERROR:', e.message);\n}";
code = code.replace(oldInit, newInit);

// Add log after migration
code = code.replace(
  "try { migrate(dbDesktop); } catch (e) { console.error('migrate desktop:', e.message); }\ntry { migrate(dbMobile); } catch (e) { console.error('migrate mobile:', e.message); }",
  "console.log('MIGRATE_START');\ntry { migrate(dbDesktop); } catch (e) { console.error('migrate desktop:', e.message); }\ntry { migrate(dbMobile); } catch (e) { console.error('migrate mobile:', e.message); }\nconsole.log('MIGRATE_OK');"
);

// Wrap auto-seed
code = code.replace(
  "if (dbMobile) {\n  try {\n    const count = dbMobile.prepare('SELECT COUNT(*) as c FROM vagas').get();",
  "console.log('AUTOSEED_CHECK');\nif (dbMobile) {\n  try {\n    const count = dbMobile.prepare('SELECT COUNT(*) as c FROM vagas').get();"
);

// Add log before module.exports
code = code.replace(
  "module.exports = app;",
  "console.log('MODULE_EXPORT');\nmodule.exports = app;"
);

fs.writeFileSync('backend/test_debug.js', code);
console.log('Written:', code.length, 'bytes');
try {
  execSync('node -c backend/test_debug.js', { stdio: 'pipe' });
  console.log('Syntax: OK');
} catch(e) {
  console.log('Syntax error:', e.stderr.toString().substring(0, 200));
}
