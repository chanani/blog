export default async function handler(req, res) {
  const { code, error } = req.query;
  if (error || !code) return res.redirect('/guestbook');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://chanhan.blog/api/oauth/google-callback';

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const { access_token } = await tokenRes.json();
    if (!access_token) return res.redirect('/guestbook?auth=fail');

    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const user = await userRes.json();

    const isProd = process.env.VERCEL_ENV === 'production';
    const secure = isProd ? '; Secure' : '';
    const userJson = encodeURIComponent(JSON.stringify({
      login: user.name || user.email,
      avatar: user.picture || '',
      provider: 'google',
    }));

    res.setHeader('Set-Cookie', [
      `gb_token=google; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure}`,
      `gb_user=${userJson}; Path=/; SameSite=Lax; Max-Age=86400${secure}`,
    ]);
    res.redirect('/guestbook');
  } catch {
    res.redirect('/guestbook?auth=fail');
  }
}
