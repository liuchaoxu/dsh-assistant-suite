// Live usage accounting. State belongs to one plugin activation; v1 daily
// buckets remain readable, but missing historical retry/cache-write data cannot
// be reconstructed without replaying session logs.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { rejected, readBody } from './http.js'
import { usageProviders } from './model-usage.js'

export const inject = ['webServer']
const FIELDS = ['input', 'output', 'cacheRead', 'cacheWrite']
const COUNTS = ['requests', ...FIELDS, 'total']
const KEEP_DAYS = 180
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const count = (v) => Number.isSafeInteger(v) && v >= 0 ? v : 0
const rate = (v) => Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0
const empty = () => Object.fromEntries(COUNTS.map((key) => [key, 0]))
const dayKey = (ms) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const calendarAgo = (days) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return dayKey(d.getTime())
}
const forbidden = (key) => ['__proto__', 'prototype', 'constructor'].includes(key)

function pricesOf(raw) {
  if (!object(raw) || Object.keys(raw).length > 200) throw new Error('Invalid price table (maximum 200 routes)')
  const result = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!key || key.length > 512 || forbidden(key) || !object(value)) throw new Error('Invalid price route')
    const entry = {}
    for (const field of FIELDS) {
      if (value[field] === undefined) continue
      const number = Number(value[field])
      if (!Number.isFinite(number) || number < 0) throw new Error('Prices must be non-negative numbers')
      entry[field] = number
    }
    result[key] = entry
  }
  return result
}

function usageOf(data) {
  if (object(data.usage)) return data.usage
  const stream = Array.isArray(data.stream) ? data.stream : []
  for (let i = stream.length - 1; i >= 0; i--) {
    const chunk = stream[i]?.type === 'chunk' ? stream[i].chunk : stream[i]
    if (chunk?.type === 'usage' && object(chunk.usage)) return chunk.usage
  }
}

function queryScope(req, ctx) {
  const params = new URL(req.url ?? '/', 'http://localhost').searchParams
  const provider = params.get('provider') || null
  const start = params.get('start') || calendarAgo(29)
  const end = params.get('end') || calendarAgo(-1)
  for (const day of [start, end]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day + 'T00:00:00Z'))
      || new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day) throw new Error('Invalid date range')
  }
  if (end <= start) throw new Error('Invalid date range')
  return { provider, providers: provider ? usageProviders(ctx, provider) : null, start, end }
}

function writeJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}
const failure = (error) => ({ ok: false, error: { code: 'internal', message: error.message ?? String(error), details: {} } })

export function apply(ctx) {
  const file = process.env.DSH_ASSISTANT_LEDGER?.trim() || join(process.env.DSH_HOME?.trim() || join(homedir(), '.dsh'), 'assistant-suite', 'usage-ledger.json')
  const state = { version: 2, days: {}, prices: {}, lastSeq: {}, attempts: {} }
  let timer = null
  let disposed = false
  try {
    const saved = JSON.parse(readFileSync(file, 'utf8'))
    if (object(saved)) {
      for (const name of ['lastSeq', 'attempts']) if (object(saved[name])) state[name] = saved[name]
      if (object(saved.prices)) state.prices = pricesOf(saved.prices)
      if (object(saved.days)) {
        for (const [day, providers] of Object.entries(saved.days)) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !object(providers)) continue
          const dayNode = state.days[day] = {}
          for (const [provider, models] of Object.entries(providers)) {
            if (forbidden(provider) || !object(models)) continue
            const node = dayNode[provider] = {}
            for (const [model, bucket] of Object.entries(models)) {
              if (!forbidden(model) && object(bucket)) node[model] = Object.fromEntries(COUNTS.map((key) => [key, count(bucket[key])]))
            }
          }
        }
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('[dsh-helper] ledger load failed:', err.message)
  }
  function prune() {
    const cutoff = calendarAgo(KEEP_DAYS)
    for (const day of Object.keys(state.days)) if (day < cutoff) delete state.days[day]
    for (const [id, attempt] of Object.entries(state.attempts)) if (attempt?.day < cutoff) delete state.attempts[id]
  }
  prune()
  function flush() {
    prune()
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file + '.tmp', JSON.stringify(state))
    renameSync(file + '.tmp', file)
  }
  function scheduleSave() {
    if (disposed || timer !== null) return
    timer = setTimeout(() => {
      timer = null
      try { flush() } catch (err) { console.error('[dsh-helper] ledger save failed:', err) }
    }, 1500)
    timer.unref?.()
  }
  function adjust(sample, sign) {
    if (!sample || sample.day < calendarAgo(KEEP_DAYS)) return
    const node = (state.days[sample.day] ??= {})
    const models = (node[sample.provider] ??= {})
    const bucket = (models[sample.model] ??= empty())
    for (const key of COUNTS) bucket[key] = Math.max(0, (bucket[key] ?? 0) + sign * sample.counts[key])
  }
  function record(session, event) {
    if (disposed) return
    const id = String(session?.header?.id ?? session?.id ?? '')
    const seq = Number(event?.seq)
    if (!id || forbidden(id) || !Number.isSafeInteger(seq)) return
    if (Number.isFinite(state.lastSeq[id]) && seq <= state.lastSeq[id]) return
    const data = event.data ?? {}
    if (event.type === 'llm/retry-started' || event.type === 'step/start' || event.type === 'turn/end') {
      // A retry is another billed attempt, never a replacement of the old one.
      delete state.attempts[id]
      state.lastSeq[id] = seq
      scheduleSave()
      return
    }
    if (!['assistant/message', 'assistant/attempt'].includes(event.type)) return
    const usage = usageOf(data)
    if (!usage) return
    const counts = { requests: 1, input: count(usage.inputTokens), output: count(usage.outputTokens),
      cacheRead: count(usage.cacheReadTokens), cacheWrite: count(usage.cacheWriteTokens) }
    counts.total = count(usage.totalTokens) || FIELDS.reduce((sum, key) => sum + counts[key], 0)
    const previous = state.attempts[id]
    // Legacy events without step boundaries remain independent requests.
    const replace = data.turn !== undefined && data.step !== undefined && previous?.turn === data.turn && previous?.step === data.step
    const source = data.message?.source ?? data.source ?? usage.route ?? {}
    const projection = ctx.get('sessionProjections')?.stateOf?.(session, 'modelSelection')
    const selection = projection?.pending ?? projection?.lastUsed ?? {}
    const provider = source.provider || (replace ? previous.provider : selection.provider) || 'unknown'
    const model = source.model || (replace ? previous.model : selection.model) || 'unknown'
    if (typeof provider !== 'string' || typeof model !== 'string' || forbidden(provider) || forbidden(model)) return
    // Replacements belong to the original attempt's calendar day, even across midnight.
    const day = replace ? previous.day : dayKey(Number.isFinite(Number(event.time)) ? Number(event.time) : Date.now())
    if (replace) adjust(previous, -1)
    const sample = { day, provider, model, counts, turn: data.turn, step: data.step }
    adjust(sample, 1)
    state.attempts[id] = sample
    state.lastSeq[id] = seq
    scheduleSave()
  }
  function summary(scope) {
    prune()
    const totals = { ...empty(), cost: 0 }
    const models = new Map()
    const days = []
    const add = (target, bucket, cost) => {
      for (const field of COUNTS) target[field] += bucket[field] ?? 0
      target.cost += cost
    }
    for (const [day, providers] of Object.entries(state.days)) {
      if (day < scope.start || day >= scope.end) continue
      const daily = { day, ...empty(), cost: 0 }
      for (const [provider, entries] of Object.entries(providers)) {
        if (scope.providers && !scope.providers.includes(provider)) continue
        for (const [model, bucket] of Object.entries(entries)) {
          const price = state.prices[`${provider}/${model}`] ?? state.prices[model] ?? {}
          const cost = FIELDS.reduce((sum, field) => sum + (bucket[field] ?? 0) * rate(price[field]), 0) / 1e6
          const key = `${provider}\0${model}`
          const row = models.get(key) ?? { provider, model, ...empty(), cost: 0 }
          add(row, bucket, cost)
          models.set(key, row)
          add(daily, bucket, cost)
          add(totals, bucket, cost)
        }
      }
      days.push(daily)
    }
    return { scope, totals, days: days.sort((a, b) => a.day.localeCompare(b.day)), models: [...models.values()].sort((a, b) => b.total - a.total), prices: state.prices }
  }
  ctx.on('session/event', (session, event) => {
    try { record(session, event) } catch (err) { console.error('[dsh-helper] ledger fold failed:', err) }
  })
  ctx.effect(() => () => {
    disposed = true
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
      try { flush() } catch (err) { console.error('[dsh-helper] ledger flush failed:', err) }
    }
  }, 'usage-ledger: lifecycle')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/model-usage/ledger',
    handler(req, res) {
      if (rejected(ctx, req, res)) return
      if (req.method !== 'GET') return writeJson(res, 405, failure(new Error('Use GET')))
      try { writeJson(res, 200, { ok: true, value: summary(queryScope(req, ctx)) }) }
      catch (err) { writeJson(res, 400, failure(err)) }
    },
  }), 'usage-ledger: summary')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/model-usage/ledger/prices',
    async handler(req, res) {
      if (rejected(ctx, req, res)) return
      if (!['PUT', 'POST'].includes(req.method)) return writeJson(res, 405, failure(new Error('Use PUT or POST')))
      try {
        const scope = queryScope(req, ctx)
        const payload = JSON.parse((await readBody(req)) || '{}')
        const next = pricesOf(payload.prices)
        const previous = state.prices
        state.prices = next
        // A successful save means the file was actually committed.
        try { flush() } catch (err) { state.prices = previous; throw err }
        writeJson(res, 200, { ok: true, value: summary(scope) })
      } catch (err) { writeJson(res, err.statusCode ?? 400, failure(err)) }
    },
  }), 'usage-ledger: prices')
}
