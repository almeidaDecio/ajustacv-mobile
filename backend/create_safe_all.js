const fs = require('fs');
const { execSync } = require('child_process');

const buf = execSync('git show 3c0fcd8:backend/server.js', { encoding: 'buffer' });
let code = buf.toString('utf8');

const oldInit = "const dbDesktop = new Database(path.join(DATA_DIR, 'career_agent.db'));\nconst dbMobile   = new Database(path.join(DATA_DIR, 'mobile.db'));";
const newInit = "let dbDesktop, dbMobile;\ntry {\n  dbDesktop = new Database(path.join(DATA_DIR, 'career_agent.db'), { fileMustExist: false });\n  dbMobile   = new Database(path.join(DATA_DIR, 'mobile.db'), { fileMustExist: false });\n} catch (e) {\n  console.error('Database init error:', e.message);\n}";
code = code.replace(oldInit, newInit);

fs.writeFileSync('backend/test_safe_all.js', code);
console.log('Written:', code.length, 'bytes');
execSync('node -c backend/test_safe_all.js', { stdio: 'inherit' });
console.log('Syntax: OK');
