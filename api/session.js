const { isLoggedIn } = require('./_auth');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ok: isLoggedIn(req) });
};
