const fs = require('fs');
const { execSync } = require('child_process');
const buf = execSync('git show 3c0fcd8:backend/server.js', { encoding: 'buffer' });
const code = buf.toString('utf8');
const requires = code.match(/require\(['"]([^'"]+)['"]\)/g);
console.log('Requires found:', requires?.length || 0);
const path = require('path');
const mods = [];
(requires || []).forEach(r => {
  const m = r.match(/require\(['"]([^'"]+)['"]\)/);
  const mod = m[1];
  if (mod.startsWith('.')) {
    const resolved = path.resolve('backend', mod);
    const exists = fs.existsSync(resolved) || fs.existsSync(resolved + '.js');
    console.log('  LOCAL ' + mod + ' -> ' + resolved + (exists ? ' (exists)' : ' (MISSING)'));
    mods.push({ mod, resolved, exists });
  } else {
    try {
      const r = require.resolve(mod);
      console.log('  NPM   ' + mod + ' (resolved to ' + r + ')');
      mods.push({ mod, resolved: r, exists: true });
    } catch(e) {
      console.log('  NPM   ' + mod + ' (NOT FOUND)');
      mods.push({ mod, resolved: null, exists: false });
    }
  }
});
console.log('\nSummary: ' + mods.filter(m => !m.exists).length + ' missing dependencies');
