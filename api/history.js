const { isLoggedIn } = require('./_auth');

const RANGES = {
  '1h':  { start: '-1h',  every: '1m'  },
  '24h': { start: '-24h', every: '10m' },
  '7d':  { start: '-7d',  every: '1h'  },
};

// แปลง CSV ที่ InfluxDB ตอบกลับเป็น { ph: [[เวลา, ค่า], ...], ec: [...] }
function parseCsv(csv) {
  const out = { ph: [], ec: [] };
  let idx = null;
  for (const raw of csv.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line) { idx = null; continue; }
    if (line[0] === '#') continue;
    const c = line.split(',');
    if (c.includes('_time') && c.includes('_value')) {
      idx = { t: c.indexOf('_time'), v: c.indexOf('_value'), f: c.indexOf('_field') };
      continue;
    }
    if (!idx) continue;
    const v = parseFloat(c[idx.v]);
    const f = c[idx.f];
    if (out[f] && Number.isFinite(v)) out[f].push([c[idx.t], v]);
  }
  out.ph.sort((a, b) => a[0] < b[0] ? -1 : 1);
  out.ec.sort((a, b) => a[0] < b[0] ? -1 : 1);
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!isLoggedIn(req)) return res.status(401).json({ ok: false });

  const { INFLUX_URL, INFLUX_ORG, INFLUX_BUCKET, INFLUX_TOKEN } = process.env;
  if (!INFLUX_URL || !INFLUX_ORG || !INFLUX_BUCKET || !INFLUX_TOKEN) {
    return res.status(500).json({ ok: false, error: 'missing env' });
  }

  const r = RANGES[req.query && req.query.range] || RANGES['24h'];
  const flux = `
from(bucket: "${INFLUX_BUCKET}")
  |> range(start: ${r.start})
  |> filter(fn: (x) => x._measurement == "water_quality")
  |> filter(fn: (x) => x._field == "ph" or x._field == "ec")
  |> group(columns: ["_field"])
  |> aggregateWindow(every: ${r.every}, fn: mean, createEmpty: false)
  |> keep(columns: ["_time", "_value", "_field"])`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const resp = await fetch(
      `${INFLUX_URL.replace(/\/+$/, '')}/api/v2/query?org=${encodeURIComponent(INFLUX_ORG)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${INFLUX_TOKEN}`,
          'Content-Type': 'application/vnd.flux',
          Accept: 'application/csv',
        },
        body: flux,
        signal: ctrl.signal,
      }
    );
    if (!resp.ok) return res.status(502).json({ ok: false, error: 'influx ' + resp.status });
    const points = parseCsv(await resp.text());
    return res.status(200).json({ ok: true, range: req.query.range || '24h', points });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'influx unreachable' });
  } finally {
    clearTimeout(timer);
  }
};

module.exports.parseCsv = parseCsv;
