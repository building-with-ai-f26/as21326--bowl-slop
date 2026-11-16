// Local server for Mount Neverest.
//  - serves the game from docs/ (so the browser can reach /api/coach on the same origin)
//  - POST /api/coach: takes {character, floor, score, best}, asks Claude Haiku via the Anthropic API
//    for a one-line parody taunt, and returns {line}.
// The Anthropic key lives only in .env on the server; it never reaches the browser.
// Run: node server.js   (Node 20.12+, no dependencies)

const fs = require('fs');
const path = require('path');
const http = require('http');

try { process.loadEnvFile(path.join(__dirname, '.env')); } catch (e) { /* no .env yet */ }

const PORT = Number(process.env.PORT) || 8123;
const MODEL = process.env.COACH_MODEL || 'claude-haiku-5-5';
const DOCS = path.join(__dirname, 'docs');
const TYPES = { '.html': 'text/html', '.png': 'image/png', '.js': 'text/javascript', '.css': 'text/css' };

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 2000) { reject(new Error('too big')); req.destroy(); } });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function coach(req, res) {
  // Require JSON content type (forces a CORS preflight for other sites) and a local Host header.
  if (!(req.headers['content-type'] || '').startsWith('application/json') || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) {
    res.writeHead(400); return res.end('bad request');
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.includes('replace-with')) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in .env' }));
  }
  let input;
  try { input = JSON.parse(await readBody(req)); } catch (e) {
    res.writeHead(400); return res.end('bad json');
  }
  // Only trust numbers and a short name; never forward arbitrary text to the model.
  const name = String(input.character || 'the climber').slice(0, 40).replace(/[^\w \-']/g, '');
  const floor = Math.max(0, Math.floor(Number(input.floor) || 0));
  const score = Math.max(0, Math.floor(Number(input.score) || 0));
  const best = Math.max(0, Math.floor(Number(input.best) || 0));

  const prompt =
    `A student just lost a 60-second icy tower-climbing game playing ${name}. ` +
    `They reached floor ${floor}, scored ${score}; their best score is ${best}. ` +
    `Reply with exactly ONE short sentence (under 20 words): a playful taunt plus one concrete tip ` +
    `(e.g. jump right after a wall bounce for a wall kick). No emojis, no quotes, no preamble.`;

  const started = Date.now();
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 150, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json();
    const line = j?.content?.find((b) => b.type === 'text' && b.text?.trim())?.text.trim();   // skip any non-text blocks
    if (!r.ok || !line) throw new Error(j?.error?.message || `status ${r.status}`);
    const u = j.usage || {};
    console.log(`coach ok ${Date.now() - started}ms tokens in=${u.input_tokens} out=${u.output_tokens} model=${MODEL}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ line, ms: Date.now() - started, usage: u }));
  } catch (e) {
    console.error('coach failed:', e.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'coach unavailable' }));
  }
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/coach') return coach(req, res);
  const urlPath = req.url.split('?')[0];
  const rel = urlPath === '/' ? 'game.html' : urlPath.slice(1);
  const file = path.join(DOCS, rel);
  if (!file.startsWith(DOCS + path.sep)) { res.writeHead(403); return res.end(); }   // block ../ escapes
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`Mount Neverest on http://localhost:${PORT}  (coach model: ${MODEL})`));
