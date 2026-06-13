import http from 'node:http';
import aiHandler from '../api/ai/recommend.js';
import commentsHandler from '../api/comments.js';
import resolveLinkHandler from '../api/resolve-link.js';
import searchHandler from '../api/search.js';

const port = Number(process.env.PORT || 5173);
const dist = new URL('../dist/', import.meta.url);

function createReq(req, body) {
  const url = new URL(req.url || '/', `http://localhost:${port}`);
  return {
    method: req.method,
    query: Object.fromEntries(url.searchParams.entries()),
    body,
    url: req.url,
    headers: req.headers
  };
}

function createRes(res) {
  return {
    status(code) {
      res.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      res.setHeader(name, value);
      return this;
    },
    end(payload) {
      res.end(payload);
    }
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    const body = req.method === 'POST' || req.method === 'PUT' ? await readBody(req) : {};
    const apiReq = createReq(req, body);
    const apiRes = createRes(res);

    if (url.pathname === '/api/search') return searchHandler(apiReq, apiRes);
    if (url.pathname === '/api/comments') return commentsHandler(apiReq, apiRes);
    if (url.pathname === '/api/resolve-link') return resolveLinkHandler(apiReq, apiRes);
    if (url.pathname === '/api/ai/recommend') return aiHandler(apiReq, apiRes);

    const fs = await import('node:fs/promises');
    const path = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const file = new URL(path, dist);
    try {
      const data = await fs.readFile(file);
      if (path.endsWith('.js')) res.setHeader('Content-Type', 'text/javascript');
      if (path.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
      if (path.endsWith('.svg')) res.setHeader('Content-Type', 'image/svg+xml');
      res.end(data);
    } catch {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(await fs.readFile(new URL('index.html', dist)));
    }
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(port, () => {
  console.log(`Local API server listening on http://localhost:${port}`);
});
