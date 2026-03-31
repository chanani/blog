const GH_GRAPHQL = 'https://api.github.com/graphql';
const CATEGORY_ID = 'DIC_kwDORI3Ks84C15da';
const COLOR_NAMES = ['white', 'yellow', 'blue', 'green', 'pink', 'purple', 'orange'];

function gqlHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function parseCookies(cookieStr = '') {
  return Object.fromEntries(
    cookieStr.split(';').map((s) => s.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k.trim(), v.join('=')]),
  );
}

function parseEntry(node, index) {
  const body = node.body || '';
  const match = body.match(/^\*\*(.+?)\*\*(?:\s+color=(\w+))?(?:\s+emoji=(\S+))?\n(?:avatar=([^\n]+)\n)?\n([\s\S]*)$/);
  const nickname = match ? match[1].trim() : (node.author?.login || '익명');
  const color = (match?.[2] && COLOR_NAMES.includes(match[2])) ? match[2] : COLOR_NAMES[index % COLOR_NAMES.length];
  const emoji = match?.[3]?.trim() || '';
  const storedAvatar = match?.[4]?.trim() || '';
  const message = match ? match[5].trim() : body.trim();
  return {
    id: node.id,
    nickname,
    avatar: storedAvatar || node.author?.avatarUrl || '',
    emoji,
    color,
    message,
    createdAt: node.createdAt,
  };
}

async function findDiscussion(owner, token) {
  const query = `{ repository(owner: "${owner}", name: "blog") { discussions(first: 20, categoryId: "${CATEGORY_ID}") { nodes { id title } } } }`;
  const r = await fetch(GH_GRAPHQL, { method: 'POST', headers: gqlHeaders(token), body: JSON.stringify({ query }) });
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
            nodes { id author { login avatarUrl } body createdAt }
          }
        }
      }
    }
  }`;
  const r = await fetch(GH_GRAPHQL, { method: 'POST', headers: gqlHeaders(token), body: JSON.stringify({ query }) });
  const data = await r.json();
  const nodes = data?.data?.repository?.discussions?.nodes || [];
  const disc = nodes.find((d) => d.title.toLowerCase() === 'guestbook');
  return disc?.comments?.nodes || [];
}

async function deleteComment(commentId, token) {
  const mutation = `
    mutation($id: ID!) {
      deleteDiscussionComment(input: { id: $id }) {
        comment { id }
      }
    }
  `;
  const r = await fetch(GH_GRAPHQL, {
    method: 'POST',
    headers: gqlHeaders(token),
    body: JSON.stringify({ query: mutation, variables: { id: commentId } }),
  });
  const data = await r.json();
  if (data.errors) throw new Error(data.errors[0]?.message || 'GraphQL error');
}

async function addComment(discussionId, body, token) {
  const mutation = `
    mutation($discussionId: ID!, $body: String!) {
      addDiscussionComment(input: { discussionId: $discussionId, body: $body }) {
        comment { id author { login avatarUrl } body createdAt }
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
    if (req.method === 'POST' || req.method === 'DELETE') return res.status(500).json({ error: 'Config error' });
    return res.json(emptyRes);
  }

  // ── GET ─────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const perPage = 20;
      const raw = await fetchComments(ghOwner, ghToken);
      const all = [...raw].reverse().map((node, i) => parseEntry(node, i));
      const totalPages = Math.max(1, Math.ceil(all.length / perPage));
      const safePage = Math.min(page, totalPages);
      const entries = all.slice((safePage - 1) * perPage, safePage * perPage);
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ entries, page: safePage, totalPages });
    } catch {
      return res.json(emptyRes);
    }
  }

  // ── POST ─────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      // Read user token from cookie
      const cookies = parseCookies(req.headers.cookie);
      const userToken = cookies.gb_token;
      if (!userToken) return res.status(401).json({ error: '로그인이 필요합니다.' });
      // Google users post via admin token (Google OAuth doesn't grant GitHub access)
      const postToken = userToken === 'google' ? ghToken : userToken;

      // Get user info from cookie
      let userLogin = '익명';
      let userAvatar = '';
      try {
        const info = JSON.parse(decodeURIComponent(cookies.gb_user || '{}'));
        userLogin = info.login || '익명';
        userAvatar = info.avatar || '';
      } catch { /* ignore */ }

      const { message, color, emoji, nickname: customNickname } = req.body || {};
      if (!message || typeof message !== 'string' || !message.trim())
        return res.status(400).json({ error: '내용을 입력해주세요.' });
      if (message.trim().length > 500)
        return res.status(400).json({ error: '내용은 500자 이하로 입력해주세요.' });

      const safeColor = (color && COLOR_NAMES.includes(color)) ? color : 'green';
      const safeEmoji = (emoji && typeof emoji === 'string' && emoji.length <= 10) ? emoji.trim() : '';
      const displayNickname = (customNickname && customNickname.trim()) ? customNickname.trim().slice(0, 30) : userLogin;

      const disc = await findDiscussion(ghOwner, ghToken);
      if (!disc) return res.status(500).json({ error: '방명록을 찾을 수 없습니다.' });

      const avatarLine = userAvatar ? `avatar=${userAvatar}\n` : '';
      const emojiPart = safeEmoji ? ` emoji=${safeEmoji}` : '';
      const body = `**${displayNickname}** color=${safeColor}${emojiPart}\n${avatarLine}\n${message.trim()}`;
      const comment = await addComment(disc.id, body, postToken);
      if (!comment) return res.status(500).json({ error: '저장에 실패했습니다.' });

      return res.status(201).json({ ...parseEntry(comment, 0), avatar: userAvatar, emoji: safeEmoji, nickname: displayNickname });
    } catch (e) {
      return res.status(500).json({ error: e.message || '서버 오류가 발생했습니다.' });
    }
  }

  // ── DELETE ───────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const userToken = cookies.gb_token;
      if (!userToken) return res.status(401).json({ error: '로그인이 필요합니다.' });

      const commentId = req.query.id;
      if (!commentId) return res.status(400).json({ error: 'id가 필요합니다.' });

      // Google users use admin token, GitHub users use their own token
      const deleteToken = userToken === 'google' ? ghToken : userToken;
      await deleteComment(commentId, deleteToken);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message || '삭제에 실패했습니다.' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
