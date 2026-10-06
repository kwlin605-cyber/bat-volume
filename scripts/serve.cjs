const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const messages = require('./messages.json')
const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')
const identity = { application: 'bat-volume', root }
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }

if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error(messages.missingBuild)
const server = http.createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return }
  let pathname
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname) } catch { response.writeHead(400).end(); return }
  if (pathname === '/_app-health') {
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(identity))
    return
  }
  const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname))
  const relative = path.relative(dist, file)
  if (relative.startsWith('..') || path.isAbsolute(relative)) { response.writeHead(403).end(); return }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { response.writeHead(404).end(); return }
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' })
    if (request.method === 'HEAD') { response.end(); return }
    const stream = fs.createReadStream(file)
    stream.on('error', () => response.destroy())
    stream.pipe(response)
  })
})
let port = Number(process.env.BAT_VOLUME_PORT || 4173)
server.on('error', error => {
  if (error.code === 'EADDRINUSE' && port < 4193) { port++; server.listen(port, '127.0.0.1'); return }
  if (process.send) process.send({ error: messages.noPort })
  throw error
})
server.on('listening', () => {
  const url = `http://127.0.0.1:${server.address().port}`
  if (process.send) process.send({ url })
  console.log(url)
})
server.listen(port, '127.0.0.1')
