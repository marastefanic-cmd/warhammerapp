// Shared helpers for the verify/ checks.
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const key = s => sha(s).slice(0, 16);

function loadData(file){
  const f = path.resolve(file || path.join(ROOT, 'data.js'));
  global.window = {};
  delete require.cache[f];
  require(f);
  return global.window.WH_DATA;
}

// whitespace, quotes and dashes alike; the app's **bold** and ~~strike~~ markers dropped
const normText = s => String(s == null ? '' : s)
  .replace(/\*\*|~~/g, '').replace(/[‘’´`]/g, '\'').replace(/[“”]/g, '"').replace(/[‐‑‒–—]/g, '-')
  .replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

// a static file server for the built app (no service worker on 127.0.0.1 matters: ON_SITE is false)
function serve(root){
  const types = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.png':'image/png', '.webmanifest':'application/manifest+json' };
  const server = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if(!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type':types[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok({ url:'http://127.0.0.1:' + server.address().port + '/', close:() => server.close() })));
}

const readJSON = (f, dflt) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch(e){ return dflt; } };
const writeJSON = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive:true }); fs.writeFileSync(f, JSON.stringify(v, null, 1) + '\n'); };

// verify/columns.json in short, { table: { what, cols:'column:source …' } }: verified.js carries it for the app's "How the app works"
// screen (each table's columns and where each comes from), so the screen shows what the gate that wrote it checked
const columnSources = () => Object.fromEntries(Object.entries(readJSON(path.join(ROOT, 'verify/columns.json'), {}).tables || {})
  .map(([t, v]) => [t, { what:v.what || '', cols:Object.entries(v.columns || {}).map(([n, x]) => n + ':' + x.source).join(' ') }]));

module.exports = { ROOT, sha, key, loadData, normText, serve, readJSON, writeJSON, columnSources };
