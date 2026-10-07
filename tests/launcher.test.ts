import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'

const windows = process.platform === 'win32'
const runtimeDirectory = process.execPath.slice(0, process.execPath.lastIndexOf('\\'))
function launcherFixture() {
  const root = mkdtempSync(join(tmpdir(), 'bat-launch-'))
  const project = join(root, '測試 球棒')
  mkdirSync(join(project, 'scripts'), { recursive: true })
  copyFileSync(new URL('../啟動.cmd', import.meta.url), join(project, 'start.cmd'))
  copyFileSync(new URL('../scripts/messages.json', import.meta.url), join(project, 'scripts/messages.json'))
  return { root, project }
}
function run(project: string, env: NodeJS.ProcessEnv) {
  return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'start.cmd'], {
    cwd: project, env, encoding: 'utf8', input: '\r\n', timeout: 10000, windowsHide: true,
  })
}
function cleanup(root: string) {
  if (dirname(root) !== tmpdir() || !basename(root).startsWith('bat-launch-')) throw new Error('Unexpected test directory')
  rmSync(root, { recursive: true, force: true, maxRetries: 4, retryDelay: 50 })
}
describe.skipIf(!windows)('Windows launcher', () => {
  it('returns after a cold start while its server remains available, and reuses the same server', async () => {
    const fixture = launcherFixture()
    const pidFile = join(fixture.project, 'scripts/test-server.pid')
    try {
      mkdirSync(join(fixture.project, 'dist'))
      writeFileSync(join(fixture.project, 'dist/index.html'), '<!doctype html><title>Launcher test</title>')
      copyFileSync(new URL('../scripts/launch.cjs', import.meta.url), join(fixture.project, 'scripts/launch.cjs'))
      const server = readFileSync(new URL('../scripts/serve.cjs', import.meta.url), 'utf8')
      writeFileSync(join(fixture.project, 'scripts/serve.cjs'), `require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setTimeout(() => process.exit(0), 8000).unref();\n${server}`)
      const env = { ...process.env, PATH: runtimeDirectory, BAT_VOLUME_NO_BROWSER: '1' }
      const first = run(fixture.project, env)
      expect(first.error).toBeUndefined()
      expect(first.status).toBe(0)
      const url = first.stdout.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]
      expect(url).toBeDefined()
      expect(await (await fetch(url! + '/_app-health')).json()).toMatchObject({ application: 'bat-volume', root: fixture.project })
      expect(await (await fetch(url!)).text()).toContain('Launcher test')
      const second = run(fixture.project, env)
      expect(second.status).toBe(0)
      expect(second.stdout.trim()).toBe(url)
    } finally {
      try { process.kill(Number(readFileSync(pidFile, 'utf8'))) } catch {}
      cleanup(fixture.root)
    }
  }, 20000)
  it('starts from a Chinese path with spaces using Node found in PATH', () => {
    const fixture = launcherFixture()
    try {
      writeFileSync(join(fixture.project, 'scripts/launch.cjs'), "console.log('BOOT_OK'); process.exitCode = 0\n")
      const result = run(fixture.project, { ...process.env, PATH: runtimeDirectory })
      expect(result.error).toBeUndefined()
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('BOOT_OK')
    } finally { cleanup(fixture.root) }
  })
  it('finds the per-user tool runtime even if Node is absent from PATH', () => {
    const fixture = launcherFixture()
    try {
      const tools = join(fixture.root, 'MumioBuildTools/node-v-test')
      mkdirSync(tools, { recursive: true })
      copyFileSync(process.execPath, join(tools, 'node.exe'))
      writeFileSync(join(fixture.project, 'scripts/launch.cjs'), "console.log('FALLBACK_OK'); process.exitCode = 0\n")
      const result = run(fixture.project, { ...process.env, PATH: join(process.env.SystemRoot!, 'System32'), LOCALAPPDATA: fixture.root })
      expect(result.error).toBeUndefined()
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('FALLBACK_OK')
    } finally { cleanup(fixture.root) }
  })
  it('reads UTF-8 messages correctly with Windows PowerShell 5 when no runtime is available', () => {
    const fixture = launcherFixture()
    try {
      const result = run(fixture.project, { ...process.env, PATH: join(process.env.SystemRoot!, 'System32'), LOCALAPPDATA: fixture.root, USERPROFILE: fixture.root, ProgramFiles: fixture.root })
      expect(result.error).toBeUndefined()
      expect(result.status).toBe(1)
      expect(result.stdout).toContain('Node.js 24 LTS')
      expect(result.stderr).not.toContain('ConvertFrom-Json')
      expect(result.stderr.trim()).toBe('')
    } finally { cleanup(fixture.root) }
  })
})
