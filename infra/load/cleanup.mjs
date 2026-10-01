// Load-test cleanup: removes infra/load/.tokens.json produced by seed.mjs.
// Logging rule: no secrets — only eventType + flags.
import fs from 'node:fs';

const path = new URL('./.tokens.json', import.meta.url);
if (!fs.existsSync(path)) {
  console.log(JSON.stringify({ eventType: 'load_cleanup_done', count: 0 }));
  process.exit(0);
}
fs.rmSync(path);
console.log(JSON.stringify({ eventType: 'load_cleanup_done', removedTokensFile: true }));
