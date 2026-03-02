export default async function handler(req, res) {
  const ghToken = process.env.VITE_GITHUB_TOKEN;
  const ghOwner = process.env.VITE_GITHUB_OWNER;
  const emptyRes = { comments: [], page: 1, totalPages: 0 };

  if (!ghToken) return res.json(emptyRes);

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = 10;

  const query = `{
    repository(owner: "${ghOwner}", name: "blog") {
      discussions(first: 10, categoryId: "DIC_kwDORI3Ks84C15da") {
        nodes {
          title
          comments(last: 100) {
            totalCount
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

  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ghToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) return res.json(emptyRes);

    const data = await response.json();
    const discussions = data?.data?.repository?.discussions?.nodes || [];
    const guestbook = discussions.find((d) => d.title === 'guestbook');

    if (!guestbook) return res.json(emptyRes);

    const allComments = (guestbook.comments?.nodes || [])
      .map((c) => ({
        author: c.author?.login || 'anonymous',
        avatar: c.author?.avatarUrl || '',
        body: c.body || '',
        createdAt: c.createdAt,
      }))
      .reverse();

    const totalPages = Math.ceil(allComments.length / pageSize);
    const safePage = Math.min(page, Math.max(1, totalPages));
    const start = (safePage - 1) * pageSize;
    const comments = allComments.slice(start, start + pageSize);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    res.json({ comments, page: safePage, totalPages });
  } catch {
    res.json(emptyRes);
  }
}
