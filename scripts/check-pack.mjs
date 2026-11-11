import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

export function auditPack(pack) {
  assert.equal(pack.name, pkg.name)
  assert.equal(pack.version, pkg.version)
  const paths = new Set(pack.files.map(file => file.path))
  for (const file of ['package.json', 'README.md', 'README.en.md', 'CHANGELOG.md', 'LICENSE', 'icon.svg', 'cordis.patch.yml', 'locale/zh.json', 'locale/en.json', 'docs/BRAND.md', 'docs/PUBLISHING.md', 'lib/index.js', 'lib/client.js']) {
    assert.ok(paths.has(file), `Missing package file: ${file}`)
  }
  for (const file of pack.files) {
    assert.ok(!/(^|\/)(?:\.[^/]+|node_modules|release|coverage)(\/|$)|\.(?:tgz|log|pem|key)$|diagnostics/i.test(file.path), `Unexpected package file: ${file.path}`)
    const allowed = pkg.files.some(pattern => pattern.endsWith('/')
      ? file.path.startsWith(pattern)
      : pattern.includes('*')
        ? new RegExp('^' + pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$').test(file.path)
        : file.path === pattern)
    assert.ok(file.path === 'package.json' || allowed, `File outside allowlist: ${file.path}`)
  }
  assert.ok(pack.size < 3 * 1024 * 1024, 'Compressed package exceeds 3 MiB; review new assets')
  assert.ok(pack.integrity?.startsWith('sha512-'), 'Missing npm integrity')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  // Lifecycle checks are run by pack:check before this audit; avoid recursion.
  const [pack] = JSON.parse(execSync('npm pack --dry-run --json --ignore-scripts', { cwd: root, encoding: 'utf8' }))
  auditPack(pack)
  console.log(`Package audit passed: ${pack.files.length} files, ${(pack.size / 1024).toFixed(1)} KiB packed, ${(pack.unpackedSize / 1024).toFixed(1)} KiB unpacked.`)
}
