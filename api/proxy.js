const TARGET = 'https://rokubet301.com'
const SKIP = new Set([
  'content-security-policy','x-frame-options','content-encoding',
  'transfer-encoding','content-length','strict-transport-security'
])

module.exports = async function handler(req, res) {
  const rawPath = (req.query.path || '/').replace(/^\/+/, '')
  const extra = Object.entries(req.query)
    .filter(([k]) => k !== 'path')
    .map(([k,v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')

  const target = `${TARGET}/${rawPath}${extra ? '?' + extra : ''}`

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': req.headers['accept'] || 'text/html,*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Referer': TARGET + '/',
        'Origin': TARGET,
        'Cookie': req.headers['cookie'] || '',
      },
      redirect: 'follow'
    })

    const ct = upstream.headers.get('content-type') || ''

    // Forward safe headers
    for (const [k, v] of upstream.headers.entries()) {
      if (!SKIP.has(k.toLowerCase())) res.setHeader(k, v)
    }
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('X-Frame-Options', 'ALLOWALL')

    const proto = req.headers['x-forwarded-proto'] || 'https'
    const host  = req.headers['host'] || ''
    const proxyBase = `${proto}://${host}/api/proxy`

    if (ct.includes('text') || ct.includes('javascript') || ct.includes('json')) {
      let body = await upstream.text()
      body = body.replace(new RegExp(TARGET.replace(/\./g,'\\.'),'g'), proxyBase)
      body = body.replace(/(src|href|action)="\/(?!\/)/g,  `$1="${proxyBase}/`)
      body = body.replace(/(src|href|action)='\/(?!\/)/g,  `$1='${proxyBase}/`)
      body = body.replace(/url\(\/(?!\/)/g, `url(${proxyBase}/`)
      body = body.replace(/frame-ancestors[^;'"]+;?\s*/g, '')
      res.status(upstream.status).send(body)
    } else {
      const buf = Buffer.from(await upstream.arrayBuffer())
      res.status(upstream.status).send(buf)
    }
  } catch (e) {
    res.status(502).send('Proxy error: ' + e.message)
  }
}
