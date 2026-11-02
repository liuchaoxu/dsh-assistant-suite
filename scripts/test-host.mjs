import assert from 'node:assert/strict'
import { apply, inject } from '../lib/index.js'
const routes = [], listeners = new Map()
const ctx = {
  on(event, listener) { listeners.set(event, listener); return () => listeners.delete(event) },
  get(name) { return name === 'connection' ? { requestRejection: () => undefined } : undefined },
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
console.log('Host test passed: both features mount together.')
