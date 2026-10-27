const { setSession } = require('./_auth');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  setSession(res, '', 0);
  res.status(200).json({ ok: true });
};
