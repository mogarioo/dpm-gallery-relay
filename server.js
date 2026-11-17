// gallery 中继：GET /gallery?id=<32位hash>，出口独立于本机与 Cloudflare
const http = require('http');
const TARGET_HOST = 'digicol.dpm.org.cn';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PORT = parseInt(process.env.PORT || '80', 10);

function fetchGallery(id) {
  return new Promise((resolve) => {
    const options = {
      host: TARGET_HOST, port: 80, method: 'GET',
      path: '/cultural/listCulturalImage?id=' + id,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,*/*;q=0.8',
        'Referer': 'http://' + TARGET_HOST + '/cultural/detail?id=' + id + '&source=6',
        'Connection': 'close',
      },
      timeout: 30000,
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; if (body.length > 300000) req.destroy(); });
      res.on('end', () => resolve({ status: res.statusCode, body: body }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ status: 504, body: 'upstream timeout' }); });
    req.on('error', (e) => resolve({ status: 502, body: 'upstream error: ' + e.message }));
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('OK relayer');
  }
  if (u.pathname !== '/gallery') {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('not found');
  }
  const id = u.searchParams.get('id') || '';
  if (!/^[0-9a-f]{32}$/i.test(id)) {
    res.writeHead(400, { 'content-type': 'text/plain' });
    return res.end('bad id');
  }
  const r = await fetchGallery(id);
  // 403/429/503 原样透传：下载器据此弃用本出口，不写主封锁日志、不用本机 IP 重试
  res.writeHead(r.status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(r.body);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('gallery relay listening on 0.0.0.0:' + PORT);
});
