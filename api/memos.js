const OWNER = process.env.VITE_GITHUB_OWNER;
const REPO = process.env.VITE_GITHUB_REPO;
const TOKEN = process.env.VITE_GITHUB_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const GH = 'https://api.github.com';
const headers = (extra = {}) => ({
  Accept: 'application/vnd.github.v3+json',
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
  ...extra,
});

function issueTitle(bookSlug, chapterPath) {
  const raw = `memo/${bookSlug}/${chapterPath}`;
  if (raw.length <= 200) return raw;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (Math.imul(31, hash) + raw.charCodeAt(i)) | 0;
  }
  return `memo/${bookSlug}/${Math.abs(hash).toString(16)}`;
}

function parseMemoComment(comment) {
  const match = comment.body.match(/<!--\s*memo-data\s*([\s\S]*?)-->/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1].trim());
    return {
      id: String(comment.id),
      selectedText: data.selectedText || '',
      note: data.note || '',
      occurrence: data.occurrence ?? 0,
      createdAt: comment.created_at,
    };
  } catch {
    return null;
  }
}

function buildCommentBody(selectedText, note, occurrence) {
  const json = JSON.stringify({ selectedText, note, occurrence }, null, 2);
  return `<!-- memo-data\n${json}\n-->\n${note}`;
}

async function findOrCreateIssue(bookSlug, chapterPath) {
  const title = issueTitle(bookSlug, chapterPath);
  const searchRes = await ghFetch(
    `${GH}/repos/${OWNER}/${REPO}/issues?state=open&per_page=100`
  );
  const issues = await searchRes.json();
  const found = issues.find((i) => i.title === title);
  if (found) return found.number;

  const createRes = await ghFetch(`${GH}/repos/${OWNER}/${REPO}/issues`, {
    method: 'POST',
    body: JSON.stringify({ title, body: `Memos for ${bookSlug}/${chapterPath}` }),
  });
  const issue = await createRes.json();
  return issue.number;
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    return req.body;
  }
  if (typeof req.body === 'string' && req.body.length > 0) {
    return JSON.parse(req.body);
  }
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      if (!raw) { resolve({}); return; }
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

async function ghFetch(url, options = {}) {
  const res = await fetch(url, { ...options, headers: headers(options.headers) });
  if (!res.ok) {
    let detail = '';
    try { const d = await res.json(); detail = d.message || JSON.stringify(d); } catch {}
    throw new Error(`GitHub API ${res.status}: ${detail || res.statusText} [${url}]`);
  }
  return res;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-admin-password');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }

  if (!TOKEN || !OWNER || !REPO) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Server misconfiguration: GitHub env vars missing' }));
    return;
  }

  try {
    // ── GET ──────────────────────────────────────────────
    if (req.method === 'GET') {
      const { book, chapter } = req.query;
      if (!book || !chapter) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'book and chapter required' }));
        return;
      }

      const title = issueTitle(book, chapter);
      const searchRes = await ghFetch(
        `${GH}/repos/${OWNER}/${REPO}/issues?state=open&per_page=100`
      );
      const issues = await searchRes.json();
      const issue = issues.find((i) => i.title === title);

      if (!issue) {
        res.setHeader('Cache-Control', 'no-store');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return;
      }

      const commentsRes = await ghFetch(
        `${GH}/repos/${OWNER}/${REPO}/issues/${issue.number}/comments?per_page=100`
      );
      const comments = await commentsRes.json();
      const memos = comments.map(parseMemoComment).filter(Boolean);

      res.setHeader('Cache-Control', 'no-store');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(memos));
      return;
    }

    // ── POST ─────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = await parseBody(req);
      const { bookSlug, chapterPath, selectedText, note, occurrence, adminPassword } = body;
      if (adminPassword !== ADMIN_PASSWORD) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const issueNumber = await findOrCreateIssue(bookSlug, chapterPath);
      const commentBody = buildCommentBody(selectedText, note, occurrence ?? 0);

      const commentRes = await ghFetch(
        `${GH}/repos/${OWNER}/${REPO}/issues/${issueNumber}/comments`,
        { method: 'POST', body: JSON.stringify({ body: commentBody }) }
      );
      const comment = await commentRes.json();
      const memo = parseMemoComment(comment);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(memo));
      return;
    }

    // ── PATCH ─────────────────────────────────────────────
    if (req.method === 'PATCH') {
      const body = await parseBody(req);
      const { commentId, note, adminPassword } = body;
      if (adminPassword !== ADMIN_PASSWORD) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const getRes = await ghFetch(
        `${GH}/repos/${OWNER}/${REPO}/issues/comments/${commentId}`
      );
      const existing = await getRes.json();
      const parsed = parseMemoComment(existing);
      if (!parsed) throw new Error('Invalid memo comment format');

      const newBody = buildCommentBody(parsed.selectedText, note, parsed.occurrence);
      const patchRes = await ghFetch(
        `${GH}/repos/${OWNER}/${REPO}/issues/comments/${commentId}`,
        { method: 'PATCH', body: JSON.stringify({ body: newBody }) }
      );
      const updated = await patchRes.json();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(parseMemoComment(updated)));
      return;
    }

    // ── DELETE ────────────────────────────────────────────
    // commentId는 URL query param으로, adminPassword는 x-admin-password 헤더로 수신
    if (req.method === 'DELETE') {
      const commentId = req.query.commentId;
      const adminPassword = req.headers['x-admin-password'];
      if (adminPassword !== ADMIN_PASSWORD) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      if (!commentId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'commentId required' }));
        return;
      }

      await ghFetch(
        `${GH}/repos/${OWNER}/${REPO}/issues/comments/${commentId}`,
        { method: 'DELETE' }
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  } catch (err) {
    console.error('[memos] error:', err?.message || err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err?.message || 'Internal error' }));
  }
}
