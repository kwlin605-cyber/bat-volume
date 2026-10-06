const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const messages = require('./messages.json')
const root = path.resolve(__dirname, '..')

function open(url) {
  if (process.env.BAT_VOLUME_NO_BROWSER === '1') { console.log(url); return }
  const browser = spawn('explorer.exe', [url], { detached: true, windowsHide: true, stdio: 'ignore' })
  browser.on('error', () => console.log(messages.browserFailed, url))
  browser.unref()
}
async function findRunning() {
  for (let port = 4173; port <= 4193; port++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/_app-health`, { signal: AbortSignal.timeout(120) })
      const state = await response.json()
      if (state.application === 'bat-volume' && state.root === root) return `http://127.0.0.1:${port}`
    } catch {}
  }
}
async function main() {
  if (!fs.existsSync(path.join(root, 'dist/index.html'))) throw new Error(messages.missingBuild)
  const running = await findRunning()
  if (running) { open(running); return }
  const log = fs.openSync(path.join(__dirname, 'server.log'), 'a')
  const child = spawn(process.execPath, [path.join(__dirname, 'serve.cjs')], { cwd: root, detached: true, windowsHide: true, stdio: ['ignore', log, log, 'ipc'] })
  fs.closeSync(log)
  const timer = setTimeout(() => { child.disconnect(); console.error(messages.startFailed); process.exitCode = 1 }, 10000)
  child.once('message', message => {
    clearTimeout(timer)
    if (message.url) open(message.url)
    else { console.error(message.error || messages.startFailed); process.exitCode = 1 }
    child.disconnect()
    child.unref()
  })
  child.once('error', error => { clearTimeout(timer); console.error(error.message); process.exitCode = 1 })
  child.once('exit', code => { clearTimeout(timer); if (code) { console.error(messages.startFailed); process.exitCode = 1 } })
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
