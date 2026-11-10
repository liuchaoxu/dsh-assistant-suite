import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const source = readFileSync(join(root, 'lib/client.js'), 'utf8')
let definition
const window = { __ModuleLoader__: { load(value) { definition = value } } }
const keyListeners = []
let restoredFocus = 0
const document = {
  body: {},
  activeElement: { focus() { restoredFocus += 1 } },
  addEventListener(name, listener) { if (name === 'keydown') keyListeners.push(listener) },
  removeEventListener(name, listener) {
    if (name === 'keydown') keyListeners.splice(keyListeners.indexOf(listener), 1)
  },
}
window.setTimeout = () => 1
window.clearTimeout = () => {}
const localStorage = { getItem() { return null }, setItem() {}, removeItem() {}, key() { return null }, length: 0 }
const React = {
  Fragment: Symbol('Fragment'),
  createElement(type, props, ...children) { return { type, props: props ?? {}, children } },
  useState(initial) { return [typeof initial === 'function' ? initial() : initial, () => {}] },
  useRef(value) { return { current: value } },
  useCallback(callback) { return callback },
  useEffect() {},
}
runInNewContext(source, { window, localStorage, document })
assert.equal(definition.id, 'dsh-helper')
const plugin = definition.factory((name) => {
  if (name === 'react') return React
  if (name === 'react-dom') return { createPortal: (children, container) => ({ type: 'portal', props: { container }, children: [children] }) }
  throw new Error('Unexpected module request: ' + name)
})
assert.equal(typeof plugin.apply, 'function')
assert.deepEqual(Array.from(plugin.inject), ['slots'])

// A cc-switch object literal (function extractor, computed URL) converts to the
// stored JSON shape, while plain JSON stays untouched.
const ccSwitchSample = String.raw`({
  request: {
    url: "{{baseUrl}}".replace(/\/+$/, "").replace(/\/v1$/, "") + "/v1/usage",
    method: "GET",
    headers: { Authorization: "Bearer {{apiKey}}" }
  },
  extractor: function(response) {
    const remaining = response?.remaining ?? response?.balance;
    return { isValid: response?.is_active ?? true, remaining, unit: "USD" };
  }
})`
const converted = plugin.__test.convertCcSwitchTemplate(ccSwitchSample)
assert.equal(converted.request.url, '{{baseUrlRoot}}/v1/usage')
assert.equal(converted.request.method, 'GET')
assert.equal(converted.request.headers.Authorization, 'Bearer {{apiKey}}')
assert.equal(typeof converted.extractor, 'string')
assert.match(converted.extractor, /remaining/)
assert.equal(plugin.__test.parseTemplateDraft(ccSwitchSample).converted, true)
assert.equal(plugin.__test.parseTemplateDraft('{"request":{"url":"{{baseUrl}}/usage"}}').converted, false)
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
  'assistant-suite.usage-settings', 'conversation.session.header.utilities', 'sidebar.footer.action', 'settings.section',
])
assert.equal(registrations[0].options.locale, 'dsh-model-usage')
assert.equal(typeof registrations[0].component, 'function')
const fetchProvidersStub = () => Promise.resolve({ ok: true, value: [] })
const testTemplateStub = () => Promise.resolve({ ok: true, value: { data: { rows: [] } } })
const displayTree = registrations[0].component({
  t: (key) => key,
  fetchProviders: fetchProvidersStub,
  testTemplate: testTemplateStub,
})
const visit = (node) => Array.isArray(node) ? node.flatMap(visit)
  : node && typeof node === 'object' ? [node, ...visit(node.children ?? [])] : []
const checkboxes = visit(displayTree).filter((node) => node.type === 'input' && node.props.type === 'checkbox')
assert.equal(checkboxes.length, 11)
const tickerToggle = checkboxes.find((node) => node.props['aria-label'] === 'display.ticker')
assert.equal(tickerToggle.props.checked, false, 'the sidebar ticker defaults to off')
assert.ok(checkboxes.filter((node) => node !== tickerToggle).every((node) => node.props.checked === true))
const headlineToggle = checkboxes.find((node) => node.props['aria-label'] === 'display.headline')
assert.equal(headlineToggle.props.checked, true, 'the header balance defaults to on')
const balanceToggle = checkboxes.find((node) => node.props['aria-label'] === 'display.balance')
assert.equal(balanceToggle.props.disabled, true)
assert.match(source, /value === undefined \? DEFAULT_DISPLAY\[key\] : value !== false/)
const tickerRegistration = registrations.find((entry) => entry.options.name === 'sidebar.footer.action')
assert.equal(tickerRegistration.options.id, 'usage-ticker')
assert.equal(typeof tickerRegistration.options.inject().fetchBalance, 'function')
assert.equal(tickerRegistration.options.inject().fetchProviders, undefined, 'the ticker follows one route, not a provider sweep')
const tickerProps = {
  t: (key) => key,
  fetchBalance: () => Promise.resolve({ ok: true, value: { data: { rows: [] } } }),
}
assert.equal(tickerRegistration.component({ ...tickerProps, wide: false }), null, 'the collapsed rail hides the ticker')
assert.equal(tickerRegistration.component({ ...tickerProps, wide: true }), null, 'no conversation route yet, so nothing to show')
assert.equal(registrations[3].options.id, 'assistant-suite')
assert.equal(registrations[3].options.order, 30)
assert.equal(registrations[3].options.label(), 'DSH 助手')
assert.equal(registrations[3].options.children['assistant-suite.usage-settings'].kind, 'single')
assert.equal(typeof registrations[3].component, 'function')

// Cold settings entry owns every shared control style without a header mount.
const cssOf = (tree) => visit(tree).filter(node => node.type === 'style').map(node => node.props.dangerouslySetInnerHTML?.__html ?? '').join('\n')
const coldCss = cssOf(displayTree)
for (const selector of ['.dsh-usage-action {', '.dsh-usage-action-primary {', '.dsh-usage-chip {', '.dsh-usage-provider-meta {', '.dsh-usage-display-toggles > label']) assert.ok(coldCss.includes(selector),selector)
assert.equal(coldCss.includes('.dsh-usage-display-settings label'),false,'template labels must not inherit switch-row layout')
assert.equal(coldCss.includes('.dsh-usage-display-settings input {'),false)
assert.ok(checkboxes.every(node=>node.props.role==='switch'))
for (let i=0;i<3;i++) assert.equal(cssOf(registrations[0].component({t:key=>key,fetchProviders:fetchProvidersStub,testTemplate:testTemplateStub})),coldCss,'remounts own identical styles')
const reminderTree = registrations[3].component({t:key=>key})
assert.ok(coldCss.includes('input[type=checkbox]:checked::after { background: var(--dsw-alias-bg-base)'))
assert.ok(cssOf(reminderTree).includes('.dsh-reminding-page .dsh-reminding-test'))
assert.ok(cssOf(reminderTree).includes('body[data-ds-dark-theme] .dsh-reminding-page .dsh-reminding-switch.is-on .dsh-reminding-knob { background: var(--dsw-alias-bg-base)'))
assert.ok(cssOf(reminderTree).includes('body[data-ds-dark-theme] .dsh-reminding-page .dsh-reminding-switch.is-on { background: var(--dsw-alias-label-primary)' ))
assert.ok(cssOf(reminderTree).includes('.dsh-reminding-page .dsh-reminding-switch.is-on .dsh-reminding-knob { background: var(--dsw-alias-switch-thumb'))
assert.ok(visit(reminderTree).some(node=>node.type==='button' && node.props.className==='dsh-reminding-test' && node.props.disabled===false))

// The manual refresh action belongs beside the timestamp and retains its
// accessible name when rendered without visible text.
const usageTree = registrations[1].component({ t: (key) => key })
const statusEntry = visit(usageTree).find((node) => node.type.name === 'RefreshStatus')
assert.equal(statusEntry.props.showRefresh, true)
let refreshCalls = 0
const statusProps = { ...statusEntry.props, onRefresh() { refreshCalls += 1 } }
const statusTree = statusEntry.type(statusProps)
const statusLine = visit(statusTree).find((node) => node.props.className === 'dsh-usage-status')
const refreshEntry = statusLine.children.find((node) => node?.props?.className === 'dsh-usage-status-refresh')
const refreshButton = refreshEntry.type({ ...refreshEntry.props, children: refreshEntry.children })
assert.equal(refreshButton.type, 'button')
assert.equal(refreshButton.props['aria-label'], 'action.refresh')
assert.equal(refreshButton.props.title, 'action.refresh')
assert.equal(refreshButton.props.disabled, false)
assert.equal(refreshEntry.children[0].type, 'svg')
refreshButton.props.onClick()
assert.equal(refreshCalls, 1)
const pendingStatus = statusEntry.type({ ...statusProps, view: { ...statusProps.view, refreshing: true } })
const pendingRefresh = visit(pendingStatus).find((node) => node.props.className === 'dsh-usage-status-refresh')
assert.equal(pendingRefresh.props.disabled, true)
const hiddenRefresh = statusEntry.type({ ...statusProps, showRefresh: false })
assert.equal(visit(hiddenRefresh).some((node) => node.props.className === 'dsh-usage-status-refresh'), false)

// Opening history over usage must escape the parent's clipping and only close
// the top dialog on Escape; closing it restores focus in the underlying view.
const modalEntry = visit(usageTree).find((node) => node.type.name === 'UsageModal')
const modalCleanups = []
React.useEffect = (effect) => { const cleanup = effect(); if (cleanup) modalCleanups.push(cleanup) }
let usageCloses = 0, historyCloses = 0
const usageModal = modalEntry.type({ open: true, title: 'usage', onClose() { usageCloses += 1 } })
const historyModal = modalEntry.type({ open: true, title: 'history', onClose() { historyCloses += 1 } })
assert.equal(usageModal.type, 'portal')
assert.equal(historyModal.type, 'portal')
assert.equal(historyModal.props.container, document.body)
const escapeKey = { key: 'Escape', preventDefault() {}, stopPropagation() {} }
keyListeners.slice().forEach(listener => listener(escapeKey))
assert.equal(historyCloses, 1)
assert.equal(usageCloses, 0)
modalCleanups.pop()()
assert.equal(restoredFocus, 1)
keyListeners.slice().forEach(listener => listener(escapeKey))
assert.equal(usageCloses, 1)
modalCleanups.pop()()
assert.equal(keyListeners.length, 0)
React.useEffect = () => {}
assert.match(source, /dsh-model-usage/)
assert.match(source, /dsh-reminding/)

// Header button carries a headline value seat and a hover card portal; the
// template editor ships provider presets.
assert.match(source, /dsh-usage-btn-value/)
assert.match(source, /dsh-usage-hover/)
assert.match(source, /TEMPLATE_PRESETS/)
assert.match(source, /function builtinTemplate/)
assert.match(source, /templates\.builtinHint/)
assert.match(source, /model-usage\/ledger/)
assert.match(source, /ledger\.title/)
assert.match(source, /ledger\.priceTitle/)
assert.match(source, /DEEPSEEK_REFERENCE_PRICE/)
assert.match(source, /function priceEntry/)
assert.match(source, /function pickBalanceInfos/)
assert.match(source, /data\.mode === "deepseek"\) card = React\.createElement\(DeepSeekCard/)
for (const preset of ['commandcode', 'newapi', 'openrouter', 'moonshot', 'siliconflow', 'deepseek', 'generic']) {
  assert.match(source, new RegExp(`preset\\.${preset}`))
}

// The suite settings page also hosts the per-provider template editor, which is
// fed the same provider directory the usage panel uses.
assert.match(source, /dsh-assistant-suite:usage-templates/)
const injectProps = registrations[0].options.inject()
assert.equal(typeof injectProps.fetchProviders, 'function')
assert.equal(typeof injectProps.testTemplate, 'function')
const templateEntry = visit(displayTree).find((node) => node.type && node.type.name === 'UsageTemplatesSettings')
assert.ok(templateEntry, 'settings page mounts the template editor')
// Regression: the display panel must forward the injected test function, or the
// editor's "Test template" button has nothing to call.
assert.equal(templateEntry.props.testTemplate, testTemplateStub)
const templatesTree = templateEntry.type(templateEntry.props)
assert.ok(visit(templatesTree).some((node) => Array.isArray(node.children) && node.children.includes('templates.section')))
assert.equal(visit(templatesTree).some((node) => node.type === 'textarea'), false)
// Trend and ledger share calendar boundaries, and cache-write prices affect cost.
const noon = new Date(2026, 10, 10, 12).getTime()
const today = plugin.__test.historyWindow('today', {}, noon)
assert.equal(today.start, new Date(2026, 10, 10).getTime())
assert.equal(today.end, new Date(2026, 10, 11).getTime())
const custom = plugin.__test.ledgerScope('alpha', 'custom', {start:'2026-11-01',end:'2026-11-05'}, noon)
assert.equal(custom.provider,'alpha');assert.equal(custom.start,'2026-11-01');assert.equal(custom.end,'2026-11-06')
assert.equal(plugin.__test.ledgerScope('alpha','week',{},noon).start,'2026-11-04')
assert.equal(plugin.__test.ledgerScope('alpha','month',{},noon).start,'2026-10-12')
const price=plugin.__test.priceEntry({'alpha/model':{input:1,output:2,cacheRead:3,cacheWrite:4}},'alpha','model')
assert.ok(Math.abs(plugin.__test.tokenCost({input:100,output:20,cacheRead:30,cacheWrite:40},price)-0.00039)<1e-12)

console.log('Client test passed: usage control and reminder settings mount together.')
