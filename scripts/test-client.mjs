import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const source = readFileSync(join(root, 'lib/client.js'), 'utf8')
let definition
const window = { __ModuleLoader__: { load(value) { definition = value } } }
const localStorage = { getItem() { return null }, setItem() {}, removeItem() {}, key() { return null }, length: 0 }
const React = {
  Fragment: Symbol('Fragment'),
  createElement(type, props, ...children) { return { type, props: props ?? {}, children } },
  useState(initial) { return [typeof initial === 'function' ? initial() : initial, () => {}] },
}
runInNewContext(source, { window, localStorage })
assert.equal(definition.id, 'dsh-assistant-suite')
const plugin = definition.factory((name) => {
  if (name === 'react') return React
  throw new Error('Unexpected module request: ' + name)
})
assert.equal(typeof plugin.apply, 'function')
assert.deepEqual(Array.from(plugin.inject), ['slots'])
const registrations = []
const ctx = {
  get() { return undefined },
  effect() { return () => {} },
  slots: {
    inject(slot, create) { registrations.push(create()) },
    register(options, component) { return { options, component } },
  },
}
plugin.apply(ctx)
assert.deepEqual(registrations.map((entry) => entry.options.name), [
  'assistant-suite.usage-settings', 'conversation.session.header.utilities', 'settings.section',
])
assert.equal(registrations[0].options.locale, 'dsh-model-usage')
assert.equal(typeof registrations[0].component, 'function')
const displayTree = registrations[0].component({ t: (key) => key })
const visit = (node) => Array.isArray(node) ? node.flatMap(visit)
  : node && typeof node === 'object' ? [node, ...visit(node.children ?? [])] : []
const checkboxes = visit(displayTree).filter((node) => node.type === 'input' && node.props.type === 'checkbox')
assert.equal(checkboxes.length, 8)
assert.ok(checkboxes.every((node) => node.props.checked === true))
const balanceToggle = checkboxes.find((node) => node.props['aria-label'] === 'display.balance')
assert.equal(balanceToggle.props.disabled, true)
assert.match(source, /key === "balance" \|\| parsed\[key\] !== false/)
assert.equal(registrations[2].options.id, 'assistant-suite')
assert.equal(registrations[2].options.order, 30)
assert.equal(registrations[2].options.label(), '助手套件')
assert.equal(registrations[2].options.children['assistant-suite.usage-settings'].kind, 'single')
assert.equal(typeof registrations[2].component, 'function')
assert.match(source, /dsh-model-usage/)
assert.match(source, /dsh-reminding/)
console.log('Client test passed: usage control and reminder settings mount together.')
