const GH_GRAPHQL = 'https://api.github.com/graphql';
const CATEGORY_ID = 'DIC_kwDORI3Ks84C15da';

function gqlHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

const COLOR_NAMES = ['yellow', 'blue', 'green', 'pink', 'purple', 'orange'];

function parseEntry(node, index) {
  const body = node.body || '';
  // Format: **nickname** color=yellow\n\nmessage
  const match = body.match(/^\*\*(.+?)\*\*(?:\s+color=(\w+))?\n\n([\s\S]*)$/);
  const nickname = match ? match[1].trim() : (node.author?.login || '익명');
  const color = (match && match[2] && COLOR_NAMES.includes(match[2])) ? match[2] : COLOR_NAMES[index % COLOR_NAMES.length];
  const message = match ? match[3].trim() : body.trim();
  return {
    id: node.id,
    nickname,
    avatar: node.author?.avatarUrl || '',
    color,
    message,
    createdAt: node.createdAt,
  };
}

async function findDiscussion(owner, token) {
  const query = `{
    repository(owner: "${owner}", name: "blog") {
      discussions(first: 20, categoryId: "${CATEGORY_ID}") {
        nodes { id title }
      }
    }
  }`;
  const r = await fetch(GH_GRAPHQL, {
    method: 'POST',
    headers: gqlHeaders(token),
    body: JSON.stringify({ query }),
  });
  const data = await r.json();
  const nodes = data?.data?.repository?.discussions?.nodes || [];
  return nodes.find((d) => d.title.toLowerCase() === 'guestbook') || null;
}

async function fetchComments(owner, token) {
  const query = `{
    repository(owner: "${owner}", name: "blog") {
      discussions(first: 20, categoryId: "${CATEGORY_ID}") {
        nodes {
          id title
          comments(last: 100) {
            nodes {
              id
              author { login avatarUrl }
              body
              createdAt
            }
          }
        }
      }
    }
  }`;
  const r = await fetch(GH_GRAPHQL, {
    method: 'POST',
    headers: gqlHeaders(token),
    body: JSON.stringify({ query }),
  });
  const data = await r.json();
  const nodes = data?.data?.repository?.discussions?.nodes || [];
  const disc = nodes.find((d) => d.title.toLowerCase() === 'guestbook');
  return disc?.comments?.nodes || [];
}

async function addComment(discussionId, body, token) {
  const mutation = `
    mutation($discussionId: ID!, $body: String!) {
      addDiscussionComment(input: { discussionId: $discussionId, body: $body }) {
        comment {
          id
          author { login }
          body
          createdAt
        }
      }
    }
  `;
  const r = await fetch(GH_GRAPHQL, {
    method: 'POST',
    headers: gqlHeaders(token),
    body: JSON.stringify({ query: mutation, variables: { discussionId, body } }),
  });
  const data = await r.json();
  if (data.errors) throw new Error(data.errors[0]?.message || 'GraphQL error');
  return data?.data?.addDiscussionComment?.comment || null;
}

export default async function handler(req, res) {
  const ghToken = process.env.VITE_GITHUB_TOKEN;
  const ghOwner = process.env.VITE_GITHUB_OWNER;
  const emptyRes = { entries: [], totalPages: 0 };

  if (!ghToken || !ghOwner) {
    if (req.method === 'POST') return res.status(500).json({ error: 'Config error' });
    return res.json(emptyRes);
  }

  // ── GET ───────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const perPage = 20;
      const raw = await fetchComments(ghOwner, ghToken);
      const reversed = [...raw].reverse();
      const all = reversed.map((node, i) => parseEntry(node, i));
      const totalPages = Math.max(1, Math.ceil(all.length / perPage));
      const safePage = Math.min(page, totalPages);
      const entries = all.slice((safePage - 1) * perPage, safePage * perPage);

      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=15');
      return res.json({ entries, page: safePage, totalPages });
    } catch {
      return res.json(emptyRes);
    }
  }

  // ── POST ──────────────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const { nickname, message } = req.body || {};

      if (!nickname || typeof nickname !== 'string' || !nickname.trim())
        return res.status(400).json({ error: '닉네임을 입력해주세요.' });
      if (!message || typeof message !== 'string' || !message.trim())
        return res.status(400).json({ error: '내용을 입력해주세요.' });
      if (nickname.trim().length > 30)
        return res.status(400).json({ error: '닉네임은 30자 이하로 입력해주세요.' });
      if (message.trim().length > 500)
        return res.status(400).json({ error: '내용은 500자 이하로 입력해주세요.' });

      const disc = await findDiscussion(ghOwner, ghToken);
      if (!disc) return res.status(500).json({ error: '방명록을 찾을 수 없습니다.' });

      const { color } = req.body || {};
      const safeColor = (color && COLOR_NAMES.includes(color)) ? color : 'yellow';
      const body = `**${nickname.trim()}** color=${safeColor}\n\n${message.trim()}`;
      const comment = await addComment(disc.id, body, ghToken);
      if (!comment) return res.status(500).json({ error: '저장에 실패했습니다.' });

      return res.status(201).json(parseEntry(comment, 0));
    } catch (e) {
      return res.status(500).json({ error: e.message || '서버 오류가 발생했습니다.' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
