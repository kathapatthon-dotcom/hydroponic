const crypto = require('crypto');

const COOKIE = 'hydro_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 วัน

function sign(payload) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url');
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function makeToken() {
  const exp = String(Date.now() + MAX_AGE * 1000);
  return exp + '.' + sign(exp);
}

function verifyToken(token) {
  if (!token || !process.env.SESSION_SECRET) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Date.now();
}

function getCookie(req, name) {
  const m = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}

function setSession(res, token, maxAge) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`);
}

function isLoggedIn(req) {
  return verifyToken(getCookie(req, COOKIE));
}

module.exports = { MAX_AGE, safeEqual, makeToken, setSession, isLoggedIn };
