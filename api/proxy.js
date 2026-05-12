export const config = { runtime: 'edge' }

const TARGET = 'https://rokubet301.com'
const SKIP = new Set(['content-security-policy','x-frame-options','content-encoding','transfer-encoding','content-length','strict-transport-security'])

export default async function handler(req) {
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/api\/proxy/, '') || '/'
  const target = `${TARGET}${path}${url.search}`

  let res
  try {
    res = await fetch(target, {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': req.headers.get('accept') || '*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Referer': TARGET + '/',
        'Origin': TARGET,
        'Cookie': req.headers.get('cookie') || '',
      },
      redirect: 'follow'
    })
  } catch (e) {
    return new Response('Proxy error: ' + e.message, { status: 502 })
  }

  const ct = res.headers.get('content-type') || ''
  const headers = new Headers()
  for (const [k, v] of res.headers.entries()) {
    if (!SKIP.has(k.toLowerCase())) headers.set(k, v)
  }
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('X-Frame-Options', 'ALLOWALL')

  const proxyBase = `${url.origin}/api/proxy`

  if (ct.includes('text') || ct.includes('javascript') || ct.includes('json')) {
    let body = await res.text()
    // Rewrite absolute URLs to go through proxy
    body = body.replace(new RegExp(TARGET.replace(/\./g,'\\.'),'g'), proxyBase)
    body = body.replace(/(src|href|action)="\/(?!\/)/g, `$1="${proxyBase}/`)
    body = body.replace(/(src|href|action)='\/(?!\/)/g, `$1='${proxyBase}/`)
    body = body.replace(/url\(\/(?!\/)/g, `url(${proxyBase}/`)
    // Remove frame-ancestors from inline CSP
    body = body.replace(/frame-ancestors[^;'"]+;?/g, '')
    return new Response(body, { status: res.status, headers })
  }

  return new Response(res.body, { status: res.status, headers })
}
