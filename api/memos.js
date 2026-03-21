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
  const searchRes = await fetch(
    `${GH}/repos/${OWNER}/${REPO}/issues?state=open&per_page=100`,
    { headers: headers() }
  );
  if (!searchRes.ok) throw new Error('GitHub issue search failed');
  const issues = await searchRes.json();
  const found = issues.find((i) => i.title === title);
  if (found) return found.number;

  const createRes = await fetch(`${GH}/repos/${OWNER}/${REPO}/issues`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ title, body: `Memos for ${bookSlug}/${chapterPath}` }),
  });
  if (!createRes.ok) throw new Error('GitHub issue create failed');
  const issue = await createRes.json();
  return issue.number;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
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
      const searchRes = await fetch(
        `${GH}/repos/${OWNER}/${REPO}/issues?state=open&per_page=100`,
        { headers: headers() }
      );
      if (!searchRes.ok) throw new Error('GitHub search failed');
      const issues = await searchRes.json();
      const issue = issues.find((i) => i.title === title);

      if (!issue) {
        res.setHeader('Cache-Control', 'public, s-maxage=60');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return;
      }

      const commentsRes = await fetch(
        `${GH}/repos/${OWNER}/${REPO}/issues/${issue.number}/comments?per_page=100`,
        { headers: headers() }
      );
      if (!commentsRes.ok) throw new Error('GitHub comments fetch failed');
      const comments = await commentsRes.json();
      const memos = comments.map(parseMemoComment).filter(Boolean);

      res.setHeader('Cache-Control', 'public, s-maxage=60');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(memos));
      return;
    }

    // ── Parse body ───────────────────────────────────────
    let body = {};
    if (req.method !== 'GET') {
      await new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', () => { try { body = JSON.parse(raw); resolve(); } catch { reject(new Error('Invalid JSON')); } });
      });
    }

    // ── POST ─────────────────────────────────────────────
    if (req.method === 'POST') {
      const { bookSlug, chapterPath, selectedText, note, occurrence, adminPassword } = body;
      if (adminPassword !== ADMIN_PASSWORD) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const issueNumber = await findOrCreateIssue(bookSlug, chapterPath);
      const commentBody = buildCommentBody(selectedText, note, occurrence ?? 0);

      const commentRes = await fetch(
        `${GH}/repos/${OWNER}/${REPO}/issues/${issueNumber}/comments`,
        { method: 'POST', headers: headers(), body: JSON.stringify({ body: commentBody }) }
      );
      if (!commentRes.ok) throw new Error('GitHub comment create failed');
      const comment = await commentRes.json();
      const memo = parseMemoComment(comment);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(memo));
      return;
    }

    // ── PATCH ─────────────────────────────────────────────
    if (req.method === 'PATCH') {
      const { commentId, note, adminPassword } = body;
      if (adminPassword !== ADMIN_PASSWORD) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const getRes = await fetch(
        `${GH}/repos/${OWNER}/${REPO}/issues/comments/${commentId}`,
        { headers: headers() }
      );
      if (!getRes.ok) throw new Error('Comment not found');
      const existing = await getRes.json();
      const parsed = parseMemoComment(existing);
      if (!parsed) throw new Error('Invalid memo comment format');

      const newBody = buildCommentBody(parsed.selectedText, note, parsed.occurrence);
      const patchRes = await fetch(
        `${GH}/repos/${OWNER}/${REPO}/issues/comments/${commentId}`,
        { method: 'PATCH', headers: headers(), body: JSON.stringify({ body: newBody }) }
      );
      if (!patchRes.ok) throw new Error('GitHub comment update failed');
      const updated = await patchRes.json();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(parseMemoComment(updated)));
      return;
    }

    // ── DELETE ────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { commentId, adminPassword } = body;
      if (adminPassword !== ADMIN_PASSWORD) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const delRes = await fetch(
        `${GH}/repos/${OWNER}/${REPO}/issues/comments/${commentId}`,
        { method: 'DELETE', headers: headers() }
      );
      if (!delRes.ok) throw new Error('GitHub comment delete failed');

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
