export default async function handler(req, res) {
  const { code, error } = req.query;
  if (error || !code) return res.redirect('/guestbook');

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_REDIRECT_URI || 'https://chanhan.blog/api/oauth/callback';

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
    });
    const { access_token } = await tokenRes.json();
    if (!access_token) return res.redirect('/guestbook?auth=fail');

    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/vnd.github+json' },
    });
    const user = await userRes.json();

    const isProd = process.env.VERCEL_ENV === 'production';
    const secure = isProd ? '; Secure' : '';
    const userJson = encodeURIComponent(JSON.stringify({ login: user.login, avatar: user.avatar_url }));

    res.setHeader('Set-Cookie', [
      `gb_token=${access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure}`,
      `gb_user=${userJson}; Path=/; SameSite=Lax; Max-Age=86400${secure}`,
    ]);
    res.redirect('/guestbook');
  } catch {
    res.redirect('/guestbook?auth=fail');
  }
}
