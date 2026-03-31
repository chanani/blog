export default function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'OAuth not configured' });

  const redirectUri = process.env.GITHUB_REDIRECT_URI || 'https://chanhan.blog/api/oauth/callback';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'public_repo',
  });

  res.redirect(302, `https://github.com/login/oauth/authorize?${params}`);
}
