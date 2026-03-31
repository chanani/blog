export default function handler(req, res) {
  res.setHeader('Set-Cookie', [
    'gb_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    'gb_user=; Path=/; SameSite=Lax; Max-Age=0',
  ]);
  res.redirect('/guestbook');
}
