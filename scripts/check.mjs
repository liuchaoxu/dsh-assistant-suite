import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (file) => readFileSync(join(root, file), 'utf8')
const pkg = JSON.parse(read('package.json')), patch = read('cordis.patch.yml')
const client = read('lib/client.js'), host = read('lib/index.js')
assert.equal(pkg.name, 'dsh-helper')
assert.notEqual(pkg.private, true, 'the package must allow npm publication')
assert.match(pkg.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)
assert.equal(pkg.license, 'MIT')
assert.match(read('LICENSE'), /^MIT License\s+Copyright \(c\) 2026 liuchaoxu/)
assert.equal(pkg.repository?.type, 'git')
assert.equal(pkg.repository?.url, 'git+https://github.com/liuchaoxu/dsh-assistant-suite.git')
assert.equal(pkg.homepage, 'https://github.com/liuchaoxu/dsh-assistant-suite#readme')
assert.equal(pkg.bugs?.url, 'https://github.com/liuchaoxu/dsh-assistant-suite/issues')
assert.equal(pkg.publishConfig?.access, 'public')
assert.equal(pkg.publishConfig?.registry, 'https://registry.npmjs.org/')
assert.ok(pkg.description.length >= 40 && pkg.description.length <= 250)
assert.ok(pkg.keywords.length >= 5)
assert.equal(new Set(pkg.keywords).size, pkg.keywords.length)
assert.ok(pkg.keywords.every((word) => /^[a-z0-9-]+$/.test(word)))
assert.equal(pkg.engines.node, '>=18')
assert.equal(pkg.engines.dsh, '>=0.2.1-rc.2')
for (const script of ['verify', 'pack:check', 'prepack', 'prepublishOnly']) {
  assert.equal(typeof pkg.scripts[script], 'string', `missing npm script: ${script}`)
}
assert.equal(pkg.scripts.prepublishOnly, 'npm test')
// Match the explicit file names, directory entries and single-level globs used
// by this package's publish whitelist.
const shipped = (file) => pkg.files.some((pattern) => {
  if (pattern.endsWith('/')) return file.startsWith(pattern)
  const expression = pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')
  return new RegExp(`^${expression}$`).test(file)
})
const requiredFiles = [
  ...readdirSync(join(root, 'lib')).filter((file) => file.endsWith('.js')).map((file) => `lib/${file}`),
  ...readdirSync(join(root, 'scripts')).filter((file) => file.endsWith('.mjs')).map((file) => `scripts/${file}`),
  'cordis.patch.yml', 'locale/zh.json', 'locale/en.json', 'icon.svg', 'README.md', 'CHANGELOG.md', 'LICENSE',
]
for (const file of requiredFiles) {
  read(file)
  assert.ok(shipped(file), `files[] must include ${file}`)
}
for (const file of ['.env', '.git/config', 'lib/dsh-reminding-debug.log', 'node_modules/example/index.js']) {
  assert.equal(shipped(file), false, `local file must not be shipped: ${file}`)
}
for (const key of ['.', './client', './cordis.patch.yml', './locale/*.json', './icon', './package.json']) {
  assert.equal(typeof pkg.exports[key], 'string', `missing export: ${key}`)
  if (key !== './package.json') assert.ok(shipped(pkg.exports[key].slice(2)), `export must be shipped: ${key}`)
}
const readme = read('README.md')
const referencedImages = new Set()
for (const [, alt, src] of readme.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)) {
  assert.ok(alt.trim(), `image needs alt text: ${src}`)
  if (/^https:\/\//.test(src)) continue
  const bytes = readFileSync(join(root, src))
  assert.ok(shipped(src), `README screenshot must be included in npm package: ${src}`)
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `invalid PNG: ${src}`)
  assert.ok(bytes.length <= 2 * 1024 * 1024, `screenshot exceeds 2 MiB: ${src}`)
  referencedImages.add(src)
}
for (const file of readdirSync(join(root, 'docs/screenshots'))) {
  assert.match(file, /^[a-z0-9]+(?:-[a-z0-9]+)*\.png$/)
  assert.ok(referencedImages.has(`docs/screenshots/${file}`), `screenshot missing from README: ${file}`)
}
assert.equal(pkg.dsh?.manifestVersion, 1)
assert.equal(pkg.dsh?.client?.platform, 'web')
assert.equal(pkg.dsh?.client?.immediately, true)
assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-connection'))
assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-conversation'))
assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-settings'))
assert.match(patch, /id:\s*dsh-helper/)
assert.match(patch, /name:\s*['"]dsh-helper['"]?/)
assert.match(client, /id:\s*["']dsh-helper["']/)
assert.match(client, /const modelUsage =/)
assert.match(client, /const reminding =/)
assert.match(host, /applyModelUsage\(ctx\)/)
assert.match(host, /applyReminding\(ctx\)/)
for (const file of ['lib/model-usage.js','lib/reminding.js','lib/model-usage.client.js','lib/reminding.client.js','lib/client.js','locale/zh.json','locale/en.json','icon.svg']) read(file)
assert.equal(JSON.parse(read('locale/zh.json')).meta.title, 'DSH 助手')
assert.equal(JSON.parse(read('locale/en.json')).meta.title, 'DSH Helper')
console.log(`Package check passed: npm metadata, MIT license, both features and ${referencedImages.size} README screenshots.`)
