import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditPack } from './check-pack.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
execSync('npm run verify', { cwd: root, stdio: 'inherit' })
const output = join(root, 'release')
mkdirSync(output, { recursive: true })
// verify already ran the lifecycle checks; pack those exact files without rebuilding.
const [pack] = JSON.parse(execSync('npm pack --ignore-scripts --json --pack-destination release', { cwd: root, encoding: 'utf8' }))
auditPack(pack)
const bytes = readFileSync(join(output, pack.filename))
const sha256 = createHash('sha256').update(bytes).digest('hex')
const integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64')
if (integrity !== pack.integrity) throw new Error('Archive integrity does not match npm output')
writeFileSync(join(output, pack.filename + '.sha256'), `${sha256}  ${pack.filename}\n`)
writeFileSync(join(output, pack.filename.replace(/\.tgz$/, '.manifest.json')), JSON.stringify({ ...pack, sha256 }, null, 2) + '\n')
console.log(`Release ready: release/${pack.filename}\nSHA-256: ${sha256}\nNo package has been published.`)
