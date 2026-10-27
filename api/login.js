const { MAX_AGE, safeEqual, makeToken, setSession } = require('./_auth');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const { APP_USER, APP_PASSWORD, SESSION_SECRET } = process.env;
  if (!APP_USER || !APP_PASSWORD || !SESSION_SECRET) {
    return res.status(500).json({ ok: false, error: 'missing env' });
  }

  const { username = '', password = '' } = req.body || {};
  // เทียบทั้งสองค่าเสมอ เพื่อไม่ให้เดาได้ว่าผิดที่ชื่อหรือรหัส
  const okUser = safeEqual(username, APP_USER);
  const okPass = safeEqual(password, APP_PASSWORD);

  if (okUser && okPass) {
    setSession(res, makeToken(), MAX_AGE);
    return res.status(200).json({ ok: true });
  }
  await new Promise(r => setTimeout(r, 800)); // หน่วงเล็กน้อย ชะลอการเดาสุ่มรหัส
  return res.status(401).json({ ok: false });
};
