const { isLoggedIn } = require('./_auth');

const RANGES = {
  '1h':  '-1h',
  '24h': '-24h',
  '7d':  '-7d',
};

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!isLoggedIn(req)) return res.status(401).json({ ok: false });

  const { INFLUX_URL, INFLUX_ORG, INFLUX_BUCKET, INFLUX_TOKEN } = process.env;
  if (!INFLUX_URL || !INFLUX_ORG || !INFLUX_BUCKET || !INFLUX_TOKEN) {
    return res.status(500).json({ ok: false, error: 'missing env' });
  }

  const range = (req.query && req.query.range) || '24h';
  const start = RANGES[range] || '-24h';

  // SQL query สำหรับ InfluxDB Cloud Serverless
  const sql = `
    SELECT time, ph, ec
    FROM water_quality
    WHERE time >= now() + interval '${start.replace('-','') + (start.includes('h') ? ' hours' : ' days')}'
      AND device = 'tank1'
    ORDER BY time ASC
  `;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);

  try {
    const resp = await fetch(
      `${INFLUX_URL.replace(/\/+$/, '')}/api/v3/query_sql`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${INFLUX_TOKEN}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          db: INFLUX_BUCKET,
          q: sql,
        }),
        signal: ctrl.signal,
      }
    );

    if (!resp.ok) {
      const txt = await resp.text();
      console.error('InfluxDB error', resp.status, txt);
      return res.status(502).json({ ok: false, error: 'influx ' + resp.status });
    }

    const rows = await resp.json();

    // แปลงเป็น { ph: [[time, val], ...], ec: [[time, val], ...] }
    const points = { ph: [], ec: [] };
    for (const row of (Array.isArray(rows) ? rows : [])) {
      const t = row.time || row._time;
      if (row.ph  != null) points.ph.push([t, parseFloat(row.ph)]);
      if (row.ec  != null) points.ec.push([t, parseFloat(row.ec)]);
    }

    return res.status(200).json({ ok: true, range, points });
  } catch (e) {
    console.error('fetch error', e.message);
    return res.status(502).json({ ok: false, error: 'influx unreachable' });
  } finally {
    clearTimeout(timer);
  }
};
