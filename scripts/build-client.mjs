import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const NL = String.fromCharCode(10)
const read = (file) => readFileSync(join(root, file), 'utf8').split(String.fromCharCode(13)).join('')
function extract(source, marker, endMarker, file) {
  const start = source.indexOf(marker), end = source.lastIndexOf(endMarker)
  if (start < 0 || end < start + marker.length) throw new Error('Could not locate module factory in ' + file)
  return source.slice(start + marker.length, end)
}
const usage = extract(read('lib/model-usage.client.js'), 'factory: (require) => {', NL + '  },' + NL + '});', 'model-usage.client.js')
const reminders = extract(read('lib/reminding.client.js'), 'factory(require) {', NL + '  },' + NL + '})', 'reminding.client.js')
const output = [
  '// Generated from both preserved feature client factories. Run npm run build:client after changing either source.',
  'window.__ModuleLoader__.load({', '  id: "dsh-helper",', '  factory: (require) => {',
  '    const module = { exports: {} };', '    const exports = module.exports;',
  '    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
  '    const modelUsage = ((require) => {' + usage + NL + '    })(require);',
  '    const reminding = ((require) => {' + reminders + NL + '    })(require);',
  '    exports.apply = (ctx) => { modelUsage.apply(ctx); reminding.apply(ctx); };',
  '    exports.inject = [...new Set([...modelUsage.inject, ...reminding.inject])];',
  '    exports.__test = modelUsage.__test;',
  '    return module.exports;', '  },', '});', '',
].join(NL)
writeFileSync(join(root, 'lib/client.js'), output)
console.log('Built combined browser module.')