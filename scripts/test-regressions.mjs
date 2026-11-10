import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter, once } from 'node:events'
import { createServer, request } from 'node:http'
import { readBody } from '../lib/http.js'
import { apply } from '../lib/index.js'
import { apply as applyLedger } from '../lib/usage-ledger.js'

const dir = mkdtempSync(join(tmpdir(), 'dsh-helper-regression-'))
const oldPath = process.env.DSH_ASSISTANT_LEDGER
const contexts = []
function context(file, activate = applyLedger) {
  process.env.DSH_ASSISTANT_LEDGER = file
  const routes = [], listeners = [], cleanups = []
  let admission = { requestRejection: () => undefined }
  const ctx = {
    on(name, fn) { if (name === 'session/event') listeners.push(fn) },
    effect(fn) { const cleanup = fn(); if (typeof cleanup === 'function') cleanups.push(cleanup) },
    webServer: { register(route) { routes.push(route); return () => {} } },
    get(name) {
      if (name === 'connection') return admission
      if (name === 'llm') return { listConfigurableProviders: () => ['alpha', 'alias', 'other'].map(provider => ({ provider, settingsNs: provider })) }
      if (name === 'settings') return { describe: () => ['alpha', 'alias', 'other'].map(ns => ({ ns, value: { baseURL: 'https://billing.example.test/v1', apiKeyEnv: ns === 'other' ? 'OTHER' : 'SHARED' } })) }
      if (name === 'sessionProjections') return { stateOf: () => ({ lastUsed: { provider: 'alpha', model: 'model' } }) }
    },
  }
  activate(ctx)
  const api = {
    routes,
    admission(value) { admission = value },
    emit(session, event) { for (const listener of listeners) listener(session, event) },
    dispose() { cleanups.splice(0).reverse().forEach(fn => fn()) },
    async call(path, method = 'GET', payload, raw) {
      const route = routes.find(route => route.path === path.split('?')[0])
      assert.ok(route, path)
      const req = new EventEmitter()
      req.method = method; req.url = path; req.headers = {}
      req[Symbol.asyncIterator] = async function* () {
        if (raw) yield raw
        else if (payload !== undefined) yield Buffer.from(JSON.stringify(payload))
      }
      const res = new EventEmitter()
      res.statusCode = 200
      res.writeHead = (status) => { res.statusCode = status }
      res.end = (body) => { res.body = body }
      await route.handler(req, res)
      return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null }
    },
  }
  contexts.push(api)
  return api
}
const date = (offset) => {
  const d = new Date(); d.setDate(d.getDate() + offset); d.setHours(12, 0, 0, 0); return d
}
const key = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
try {
  const gate = context(join(dir, 'admission.json'), apply)
  for (const admission of [undefined, {}, { requestRejection() { throw Error('offline') } }]) {
    gate.admission(admission)
    for (const route of gate.routes) assert.equal((await gate.call(route.path)).status, 503, route.path)
  }
  for (const status of [401,403]) {
    gate.admission({ requestRejection: () => status })
    for (const route of gate.routes) assert.equal((await gate.call(route.path)).status, status)
  }
  gate.admission({ requestRejection: () => undefined })
  const big = Buffer.alloc(256 * 1024 + 1, 32)
  assert.equal((await gate.call('/model-usage/balance','POST',undefined,big)).status,413)
  assert.equal((await gate.call('/model-usage/ledger/prices','PUT',undefined,big)).status,413)

  // A real IncomingMessage must still deliver HTTP 413 after the limit trips.
  const server = createServer(async (req,res) => {
    try { await readBody(req,32);res.end('ok') }
    catch (err) { res.writeHead(err.statusCode ?? 500);res.end('too large') }
  })
  server.listen(0,'127.0.0.1')
  await once(server,'listening')
  try {
    const status=await new Promise((resolve,reject)=>{
      const req=request({host:'127.0.0.1',port:server.address().port,method:'POST'},res=>{res.resume();resolve(res.statusCode)})
      req.on('error',reject);req.end(Buffer.alloc(64))
    })
    assert.equal(status,413)
  } finally { await new Promise(resolve=>server.close(resolve)) }

  const file = join(dir, 'ledger.json')
  const a = context(file)
  const session = { header: { id: 's' } }
  let seq = 0
  const event = (type, data, offset = 0) => ({ type, data, seq: ++seq, time: date(offset).getTime() })
  const usage = { inputTokens: 100, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 40 }
  const sample = (u) => [{ type: 'chunk', chunk: { type: 'usage', usage: u } }]
  a.emit(session,event('step/start',{turn:1,step:1}))
  const first = event('assistant/attempt',{turn:1,step:1,stream:sample(usage)})
  a.emit(session,first); a.emit(session,first)
  let result = (await a.call('/model-usage/ledger')).body.value
  assert.equal(result.totals.requests,1); assert.equal(result.totals.total,190)
  a.emit(session,event('assistant/message',{turn:1,step:1,usage:{...usage,outputTokens:25},message:{source:{provider:'alpha',model:'model'}}}))
  result = (await a.call('/model-usage/ledger')).body.value
  assert.equal(result.totals.requests,1); assert.equal(result.totals.output,25)
  a.emit(session,event('llm/retry-started',{turn:1,step:1}))
  a.emit(session,event('assistant/attempt',{turn:1,step:1,stream:sample(usage)}))
  a.emit(session,event('assistant/message',{turn:1,step:1,usage,message:{source:{provider:'alpha',model:'model'}}}))
  result = (await a.call('/model-usage/ledger')).body.value
  assert.equal(result.totals.requests,2); assert.equal(result.totals.total,385)
  for (const [provider, offset] of [['alias',0],['other',0],['alpha',-1]]) {
    a.emit({id:provider+offset},event('assistant/message',{usage,message:{source:{provider,model:'model'}}},offset))
  }
  const query = `?provider=alpha&start=${key(date(0))}&end=${key(date(1))}`
  result = (await a.call('/model-usage/ledger'+query)).body.value
  assert.deepEqual(result.scope.providers,['alpha','alias'])
  assert.equal(result.totals.requests,3); assert.equal(result.totals.cacheWrite,120)
  const prices = Object.fromEntries(['alpha','alias','other'].map(p=>[p+'/model',{input:1,output:2,cacheRead:3,cacheWrite:4}]))
  result = await a.call('/model-usage/ledger/prices'+query,'PUT',{prices})
  assert.equal(result.status,200)
  assert.ok(Math.abs(result.body.value.totals.cost - 0.00118) < 1e-12)
  assert.equal(JSON.parse(readFileSync(file,'utf8')).prices['other/model'].cacheWrite,4)
  assert.equal((await a.call('/model-usage/ledger?start=2026-02-31&end=2026-03-02')).status,400)
  assert.equal((await a.call('/model-usage/ledger/prices','PUT',{prices:{broken:{input:-1}}})).status,400)
  assert.deepEqual((await a.call('/model-usage/ledger')).body.value.prices,prices)

  const b=context(join(dir,'separate.json'))
  assert.equal((await b.call('/model-usage/ledger')).body.value.totals.requests,0,'activation state must be independent')
  a.dispose()
  const before=(await a.call('/model-usage/ledger')).body.value.totals.requests
  a.emit({id:'late'},event('assistant/message',{usage}))
  assert.equal((await a.call('/model-usage/ledger')).body.value.totals.requests,before,'disposed instance must ignore events')
  const reload=context(file)
  assert.equal((await reload.call('/model-usage/ledger')).body.value.totals.requests,5)
  reload.emit(session,first)
  assert.equal((await reload.call('/model-usage/ledger')).body.value.totals.requests,5,'persisted cursors prevent replay double counts')

  const midnight=context(join(dir,'midnight.json'))
  midnight.emit({id:'midnight'},event('assistant/attempt',{turn:2,step:1,source:{provider:'alpha',model:'model'},stream:sample(usage)},-1))
  midnight.emit({id:'midnight'},event('assistant/message',{turn:2,step:1,usage,message:{source:{provider:'alpha',model:'model'}}},0))
  const prior=(await midnight.call(`/model-usage/ledger?start=${key(date(-1))}&end=${key(date(0))}`)).body.value
  assert.equal(prior.totals.requests,1)
  assert.equal((await midnight.call('/model-usage/ledger'+query)).body.value.totals.requests,0)

  const legacy=join(dir,'legacy.json')
  writeFileSync(legacy,JSON.stringify({version:1,days:{[key(date(0))]:{alpha:{model:{requests:1,input:10,output:2,cacheRead:3,total:15}}}},prices:{'alpha/model':{input:1}},lastSeq:{}}))
  const migrated=context(legacy)
  result=(await migrated.call('/model-usage/ledger')).body.value
  assert.equal(result.totals.requests,1); assert.equal(result.totals.cacheWrite,0)
  console.log('Regression tests passed: admission, bounded bodies, retry replacement, cache writes, shared-account/date scopes, prices, activation isolation, migration and disposal.')
} finally {
  for (const ctx of contexts) ctx.dispose()
  if (oldPath === undefined) delete process.env.DSH_ASSISTANT_LEDGER
  else process.env.DSH_ASSISTANT_LEDGER=oldPath
  rmSync(dir,{recursive:true,force:true})
}
