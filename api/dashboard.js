const GC_BASE = 'https://chanani.goatcounter.com';
const GH_API = 'https://api.github.com';

function ghHeaders(token) {
  return { Accept: 'application/vnd.github.v3+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// Git quotes non-ASCII paths: "\NNN\NNN..." (octal escape in double quotes)
function decodeGitName(name) {
  if (!name.startsWith('"') || !name.endsWith('"')) return name;
  const inner = name.slice(1, -1);
  const bytes = [];
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '\\' && i + 3 < inner.length && /^[0-7]{3}$/.test(inner.substring(i + 1, i + 4))) {
      bytes.push(parseInt(inner.substring(i + 1, i + 4), 8));
      i += 3;
      continue;
    }
    bytes.push(inner.charCodeAt(i));
  }
  return Buffer.from(bytes).toString('utf-8');
}

async function gcFetch(path, token) {
  try {
    const res = await fetch(`${GC_BASE}${path}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      redirect: 'follow',
    });
    if (!res.ok) {
      console.error(`[gcFetch] ${path} → ${res.status} ${res.statusText}`);
      return null;
    }
    return res.json();
  } catch (err) {
    console.error(`[gcFetch] ${path} → ${err.message}`);
    return null;
  }
}

function findCoverUrl(files, basePath, headers) {
  if (!Array.isArray(files)) return '';
  for (const f of files) {
    const fname = decodeGitName(f.name);
    if (f.type === 'file' && /^cover\.(png|jpe?g|webp|gif|svg)$/i.test(fname)) {
      return f.download_url || '';
    }
  }
  return '';
}

async function resolvePostInfo(category, slug, owner, repo, token) {
  const headers = ghHeaders(token);
  const basePath = `${GH_API}/repos/${owner}/${repo}/contents/dev/${encodeURIComponent(category)}/${encodeURIComponent(slug)}`;
  try {
    const dirRes = await fetch(basePath, { headers });
    if (dirRes.ok) {
      const files = await dirRes.json();
      const cover = findCoverUrl(files);
      const md = Array.isArray(files) && files.find((f) => {
        const n = decodeGitName(f.name);
        return f.type === 'file' && n.endsWith('.md');
      });
      if (md) {
        const mdName = decodeGitName(md.name);
        const fileRes = await fetch(`${basePath}/${encodeURIComponent(mdName)}`, { headers });
        if (fileRes.ok) {
          const data = await fileRes.json();
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          const m = content.match(/title:\s*["']?(.+?)["']?\s*$/m);
          if (m) return { title: m[1], cover };
        }
      }
      return { title: slug.replace(/_/g, ' '), cover };
    }
    const flatRes = await fetch(`${basePath}.md`, { headers });
    if (flatRes.ok) {
      const data = await flatRes.json();
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      const m = content.match(/title:\s*["']?(.+?)["']?\s*$/m);
      if (m) return { title: m[1], cover: '' };
    }
  } catch {}
  return null;
}

async function resolveBookInfo(slug, owner, repo, booksPath, token) {
  const headers = ghHeaders(token);
  const basePath = `${GH_API}/repos/${owner}/${repo}/contents/${booksPath}/${encodeURIComponent(slug)}`;
  try {
    const dirRes = await fetch(basePath, { headers });
    if (!dirRes.ok) return { title: slug, cover: '' };
    const files = await dirRes.json();

    const cover = findCoverUrl(files);

    const infoFile = files.find((f) => decodeGitName(f.name) === 'info.json');
    if (infoFile) {
      const infoRes = await fetch(`${basePath}/info.json`, { headers });
      if (infoRes.ok) {
        const infoData = await infoRes.json();
        const info = JSON.parse(Buffer.from(infoData.content, 'base64').toString('utf-8'));
        return { title: info.title || slug, cover };
      }
    }
    return { title: slug, cover };
  } catch {
    return { title: slug, cover: '' };
  }
}

export default async function handler(req, res) {
  const gcToken = process.env.GOATCOUNTER_API_TOKEN;
  const ghToken = process.env.VITE_GITHUB_TOKEN;
  const ghOwner = process.env.VITE_GITHUB_OWNER;
  const ghRepo = process.env.VITE_GITHUB_REPO;
  const booksPath = process.env.VITE_GITHUB_PATH || 'books';
  const empty = { visitors: { today: 0, yesterday: 0, total: 0 }, topPosts: [], topBooks: [], recentComments: [], recentGuestbook: [] };

  if (!gcToken) return res.json(empty);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const weekAgo = new Date(todayStart);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);

  try {
    const guestbookQuery = `{
      repository(owner: "${ghOwner}", name: "books-blog") {
        discussions(first: 20, orderBy: {field: UPDATED_AT, direction: DESC}, categoryId: "DIC_kwDORI3Ks84C15da") {
          nodes {
            title
            comments(last: 20) {
              nodes {
                author { login avatarUrl }
                body
                createdAt
              }
            }
          }
        }
      }
    }`;

    const [recent, allTime, hits, guestbookRes] = await Promise.all([
      gcFetch(`/api/v0/stats/total/?start=${weekAgo.toISOString()}&end=${now.toISOString()}`, gcToken),
      gcFetch(`/api/v0/stats/total/?start=2020-01-01T00:00:00Z&end=${now.toISOString()}`, gcToken),
      gcFetch(`/api/v0/stats/hits/?start=${weekAgo.toISOString()}&end=${now.toISOString()}&limit=100&daily=true`, gcToken),
      ghToken
        ? fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: { Authorization: `Bearer ${ghToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: guestbookQuery }),
          }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
        : Promise.resolve(null),
    ]);

    let recentGuestbook = [];
    let recentComments = [];
    try {
      const discussions = guestbookRes?.data?.repository?.discussions?.nodes || [];
      const guestbook = discussions.find((d) => d.title === 'guestbook');
      if (guestbook) {
        recentGuestbook = (guestbook.comments?.nodes || [])
          .map((c) => ({
            author: c.author?.login || 'anonymous',
            avatar: c.author?.avatarUrl || '',
            body: c.body?.length > 50 ? c.body.slice(0, 50) + '…' : c.body || '',
            createdAt: c.createdAt,
          }))
          .reverse()
          .slice(0, 3);
      }

      const nonGuestbook = discussions.filter((d) => d.title !== 'guestbook');
      const headers = ghHeaders(ghToken);

      const validated = await Promise.all(
        nonGuestbook.map(async (d) => {
          const bookMatch = d.title.match(/^book\/([^/]+)\/read\/(.+)$/);
          if (!bookMatch) return d;
          const [, slug, chapterPath] = bookMatch;
          const encodedPath = `${booksPath}/${encodeURIComponent(slug)}/${chapterPath.split('/').map(encodeURIComponent).join('/')}.md`;
          try {
            const r = await fetch(`${GH_API}/repos/${ghOwner}/${ghRepo}/contents/${encodedPath}`, { method: 'HEAD', headers });
            return r.ok ? d : null;
          } catch {
            return null;
          }
        }),
      );

      const allComments = [];
      validated.filter(Boolean).forEach((d) => {
        const path = '/' + d.title;
        (d.comments?.nodes || []).forEach((c) => {
          allComments.push({
            author: c.author?.login || 'anonymous',
            avatar: c.author?.avatarUrl || '',
            body: c.body?.length > 50 ? c.body.slice(0, 50) + '…' : c.body || '',
            createdAt: c.createdAt,
            path,
            postTitle: d.title.split('/').pop().replace(/_/g, ' '),
          });
        });
      });
      recentComments = allComments
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 3);
    } catch {}


    const todayStr = todayStart.toISOString().split('T')[0];
    const yd = new Date(todayStart);
    yd.setUTCDate(yd.getUTCDate() - 1);
    const stats = recent?.stats || [];

    // Post paths from GoatCounter
    const rawPosts = (hits?.hits || [])
      .filter((h) => h.path && decodeURIComponent(h.path).startsWith('/post/'))
      .slice(0, 4);

    // Book slugs from GoatCounter
    const bookMap = {};
    (hits?.hits || [])
      .filter((h) => h.path && decodeURIComponent(h.path).match(/^\/book\/[^/]+/))
      .forEach((h) => {
        const decoded = decodeURIComponent(h.path);
        const slug = decoded.match(/^\/book\/([^/]+)/)[1];
        if (!bookMap[slug]) bookMap[slug] = { slug, count: 0 };
        bookMap[slug].count += h.count;
      });
    const rawBooks = Object.values(bookMap).sort((a, b) => b.count - a.count).slice(0, 3);

    // Resolve titles/covers from GitHub in parallel
    const [topPosts, topBooks] = await Promise.all([
      Promise.all(
        rawPosts.map(async (h) => {
          const decoded = decodeURIComponent(h.path);
          const m = decoded.match(/^\/post\/([^/]+)\/([^/]+)$/);
          if (!m) return null;
          const info = await resolvePostInfo(m[1], m[2], ghOwner, ghRepo, ghToken);
          if (!info) return null;
          return { path: decoded, title: info.title, cover: info.cover, count: h.count };
        }),
      ),
      Promise.all(
        rawBooks.map(async (b) => {
          const info = await resolveBookInfo(b.slug, ghOwner, ghRepo, booksPath, ghToken);
          return { slug: b.slug, title: info.title, cover: info.cover, count: b.count };
        }),
      ),
    ]);

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    res.json({
      visitors: {
        today: stats.find((s) => s.day === todayStr)?.daily || 0,
        yesterday: stats.find((s) => s.day === yd.toISOString().split('T')[0])?.daily || 0,
        total: allTime?.total || 0,
      },
      topPosts: topPosts.filter(Boolean),
      topBooks,
      recentComments,
      recentGuestbook,
    });
  } catch {
    res.json(empty);
  }
}
