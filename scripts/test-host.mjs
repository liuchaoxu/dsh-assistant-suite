import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { apply, inject } from '../lib/index.js'
const routes = [], listeners = new Map()
const services = new Map()
const ctx = {
  on(event, listener) { listeners.set(event, listener); return () => listeners.delete(event) },
  get(name) { return services.get(name) ?? (name === 'connection' ? { requestRejection: () => undefined } : undefined) },
  effect(setup) { return setup() },
  webServer: { register(route) { routes.push(route); return () => {} } },
}
apply(ctx)
assert.deepEqual(inject, ['webServer'])
assert.deepEqual(new Set(routes.map((route) => route.path)), new Set([
  '/model-usage/balance','/model-usage/providers','/model-usage/models','/reminding/poll','/reminding/focus'
]))
assert.equal(routes.length, 5)
assert.equal(typeof listeners.get('session/event'), 'function')

const balanceRoute = routes.find((entry) => entry.path === '/model-usage/balance')
async function invokeBalance(provider, extra = {}) {
  const req = {
    method: 'POST',
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(JSON.stringify({ provider, model: 'chat-model', ...extra }))
    },
  }
  const res = new EventEmitter()
  res.writeHead = () => {}
  res.end = (body) => { res.body = body }
  await balanceRoute.handler(req, res)
  return JSON.parse(res.body)
}

services.set('llm', { listConfigurableProviders: () => [{ provider: 'new-api', settingsNs: 'new-api' }] })
services.set('settings', { describe: () => [{
  ns: 'new-api',
  value: { baseURL: 'https://usage.example.test/gateway/v1', apiKeyEnv: 'NEW_API_TOKEN' },
}] })
services.set('credentials', { resolve: async (ref) => ({ value: 'test-token', source: ref }) })
const originalFetch = globalThis.fetch
let requestedUrl
try {
  globalThis.fetch = async (url, options) => {
    requestedUrl = String(url)
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    return {
      ok: true,
      json: async () => ({ success: true, data: {
        quota: 1500000,
        used_quota: 500000,
        group: 'Pro',
        username: 'alice',
        request_count: 42,
      } }),
    }
  }
  const route = routes.find((entry) => entry.path === '/model-usage/balance')
  const req = {
    method: 'POST',
    async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify({ provider: 'new-api', model: 'chat-model' })) },
  }
  const response = new EventEmitter()
  response.writeHead = () => {}
  response.end = (body) => { response.body = body }
  await route.handler(req, response)

  assert.equal(requestedUrl, 'https://usage.example.test/gateway/api/user/self')
  const result = JSON.parse(response.body)
  assert.equal(result.ok, true)
  assert.equal(result.value.mode, 'newapi')
  assert.equal(result.value.data.remaining, 3)
  assert.equal(result.value.data.used, 1)
  assert.equal(result.value.data.total, 4)
  assert.equal(result.value.data.account, 'alice')
  assert.equal(result.value.data.totalCount, 42)

  // cc-switch style template: `request` plus a JS `extractor`, run by the host.
  const extractor = `function (response) {
    if (typeof process !== 'undefined') throw new Error('extractor reached host globals')
    const remaining = response?.remaining ?? response?.quota?.remaining ?? response?.balance
    return {
      isValid: response?.is_active ?? true,
      remaining,
      unit: response?.unit ?? 'USD',
    }
  }`
  const templateProfile = (usageTemplate) => [{
    ns: 'custom-usage',
    value: {
      baseURL: 'https://usage.example.test/gateway/v1',
      apiKeyEnv: 'CUSTOM_TOKEN',
      usageTemplate,
    },
  }]
  services.set('llm', { listConfigurableProviders: () => [{ provider: 'custom-usage', settingsNs: 'custom-usage' }] })
  services.set('settings', { describe: () => templateProfile({
    request: {
      url: '{{baseUrlRoot}}/v1/usage',
      method: 'GET',
      headers: { 'X-Api-Key': '{{apiKey}}' },
    },
    extractor,
  }) })
  let templateUrl
  globalThis.fetch = async (url, options) => {
    templateUrl = String(url)
    assert.equal(options.headers['X-Api-Key'], 'test-token')
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    return { ok: true, json: async () => ({ is_active: true, remaining: 12.5, unit: 'USD' }) }
  }
  const custom = await invokeBalance('custom-usage')
  assert.equal(templateUrl, 'https://usage.example.test/gateway/v1/usage')
  assert.equal(custom.ok, true)
  assert.equal(custom.value.mode, 'template')
  assert.deepEqual(custom.value.data.rows.map((entry) => entry.label), ['套餐', '剩余'])
  assert.equal(custom.value.data.rows[1].value, 'USD12.50')

  // isValid = false with no figures reads as a rejected key, not an empty card.
  services.set('settings', { describe: () => templateProfile({
    request: { url: '{{baseUrlRoot}}/v1/usage' },
    extractor: 'function () { return { isValid: false } }',
  }) })
  globalThis.fetch = async () => ({ ok: true, json: async () => ({}) })
  const rejected = await invokeBalance('custom-usage')
  assert.equal(rejected.ok, false)
  assert.match(rejected.error.message, /无效/)

  // The declarative `extract` shape keeps working alongside the extractor one.
  services.set('settings', { describe: () => templateProfile({
    url: '{{baseUrlRoot}}/v1/usage',
    extract: { remaining: 'quota.remaining', used: 'quota.used', unit: 'quota.unit' },
  }) })
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ quota: { remaining: 7, used: 3, unit: 'USD' } }) })
  const declarative = await invokeBalance('custom-usage')
  assert.equal(declarative.ok, true)
  assert.deepEqual(declarative.value.data.rows, [
    { label: '套餐', value: '自定义用量' },
    { label: '剩余', value: 'USD7.00' },
    { label: '已用', value: 'USD3.00' },
    { label: '总额', value: 'USD10.00' },
  ])

  // POST bodies carry substituted placeholders and a JSON content type.
  services.set('settings', { describe: () => templateProfile({
    request: { url: '{{baseUrl}}/usage', method: 'POST', body: { key: '{{apiKey}}' } },
    extractor: 'function (response) { return { remaining: response.left, windows: [{ label: "月", used: 2, limit: 10 }] } }',
  }) })
  let postOptions
  globalThis.fetch = async (url, options) => {
    postOptions = options
    return { ok: true, json: async () => ({ left: 4 }) }
  }
  const posted = await invokeBalance('custom-usage')
  assert.equal(postOptions.body, JSON.stringify({ key: 'test-token' }))
  assert.equal(postOptions.headers['Content-Type'], 'application/json')
  assert.equal(posted.value.data.rows.at(-1).value, 'USD4.00')
  assert.deepEqual(posted.value.data.windows, [{ label: '月', used: 2, limit: 10, resetsAt: 0 }])

  // The key never leaves the provider's own origin.
  services.set('settings', { describe: () => templateProfile({
    request: { url: 'https://other.example.test/usage' },
    extractor: 'function (response) { return { remaining: 1 } }',
  }) })
  let crossOriginFetched = false
  globalThis.fetch = async () => { crossOriginFetched = true }
  const crossOrigin = await invokeBalance('custom-usage')
  assert.equal(crossOrigin.ok, false)
  assert.match(crossOrigin.error.message, /baseURL 一致/)
  assert.equal(crossOriginFetched, false)

  // A template saved in the Settings page travels with the query and wins over
  // the provider configuration.
  services.set('settings', { describe: () => templateProfile(undefined) })
  let browserTemplateUrl
  globalThis.fetch = async (url) => {
    browserTemplateUrl = String(url)
    return { ok: true, json: async () => ({ balance: 9 }) }
  }
  const fromBrowser = await invokeBalance('custom-usage', {
    template: {
      request: { url: '{{baseUrlRoot}}/custom/usage?key={{apiKey}}' },
      extractor: 'function (response) { return { remaining: response.balance } }',
    },
  })
  assert.equal(browserTemplateUrl, 'https://usage.example.test/gateway/custom/usage?key=test-token')
  assert.equal(fromBrowser.ok, true)
  assert.equal(fromBrowser.value.mode, 'template')
  assert.equal(fromBrowser.value.data.rows.at(-1).value, 'USD9.00')
  // The test result reports the resolved request with the key masked.
  assert.equal(fromBrowser.value.data.requestMethod, 'GET')
  assert.equal(fromBrowser.value.data.requestUrl, 'https://usage.example.test/gateway/custom/usage?key=***')
  assert.equal(String(fromBrowser.value.data.requestUrl).includes('test-token'), false)

  // A malformed browser template is ignored instead of executed.
  let malformedFetched = false
  globalThis.fetch = async () => {
    malformedFetched = true
    return { ok: false, json: async () => ({}) }
  }
  const malformed = await invokeBalance('custom-usage', { template: { extractor: 'function () { return 1 }' } })
  assert.equal(malformed.ok, false)
  assert.equal(malformedFetched, true) // falls back to the New API adapter for this route
  services.set('settings', { describe: () => templateProfile({
    request: { url: '{{baseUrlRoot}}/v1/usage' },
    extractor: 'function (response) { return { remaining: 1 } }',
  }) })
  globalThis.fetch = async () => { malformedFetched = true; return { ok: true, json: async () => ({ remaining: 1 }) } }
  const ignored = await invokeBalance('custom-usage', { template: { request: { url: 'x' }, extractor: 42 } })
  assert.equal(ignored.ok, true)
} finally {
  globalThis.fetch = originalFetch
}
console.log('Host test passed: both features mount, New API normalizes, and both usage-template shapes resolve.')
