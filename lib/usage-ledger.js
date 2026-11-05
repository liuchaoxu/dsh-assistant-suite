// Node half of the session usage ledger.
//
// `assistant/message` events already carry the exact usage of each model call
// (`inputTokens`, `outputTokens`, `cacheReadTokens`, `totalTokens`) together
// with the route that produced it (`message.source.provider/model`). This module
// folds those events into per-day, per-provider, per-model counters, keeps them
// in one small JSON document under DSH_HOME, and serves a 30-day summary plus a
// user-editable price table so the browser can show tokens and cost.
//
// Counting starts when the plugin first sees live events: sessions that produced
// their turns before the plugin was loaded are not scanned, and the ledger file
// is the only storage (no session log rewrite).
//
// Routes:
// - `GET /model-usage/ledger` → totals, daily rows, per-model rows, prices.
// - `PUT /model-usage/ledger/prices` → replace the price table, return the
//   refreshed summary. Prices are per one million tokens of that model.
//
// Only `webServer` is a hard dependency; `connection` is read through
// `ctx.get()` for the same browser-trust fence the other routes use.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const inject = ['webServer']

const ROUTE_LEDGER = '/model-usage/ledger'
const ROUTE_PRICES = '/model-usage/ledger/prices'
/** Days kept on disk; the summary only reads the newest 30. */
const KEEP_DAYS = 180
const SUMMARY_DAYS = 30
const MAX_PRICE_KEYS = 200
const SAVE_DELAY_MS = 1500
const PRICE_FIELDS = ['input', 'output', 'cacheRead']

/**
 * Where the ledger lives. `DSH_ASSISTANT_LEDGER` overrides the whole path
 * (used by the host test); otherwise it sits in the profile's DSH_HOME.
 * @returns absolute file path.
 */
function ledgerPath() {
  const explicit = typeof process.env.DSH_ASSISTANT_LEDGER === 'string' ? process.env.DSH_ASSISTANT_LEDGER.trim() : ''
  if (explicit !== '') return explicit
  const home = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.trim() !== ''
    ? process.env.DSH_HOME.trim()
    : join(homedir(), '.dsh')
  return join(home, 'assistant-suite', 'usage-ledger.json')
}

function pad(value) {
  return String(value).padStart(2, '0')
}

/** Local calendar day of one instant, as `YYYY-MM-DD` (lexically sortable). */
function dayKey(ms) {
  const date = new Date(Number.isFinite(ms) ? ms : Date.now())
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Non-negative integer token count, or 0. */
function count(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0
}

/** Non-negative price per million tokens, or 0. */
function rate(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0
}

let state = null
let saveTimer = null

function emptyTotals() {
  return { requests: 0, input: 0, output: 0, cacheRead: 0, total: 0, cost: 0 }
}

function pruneDays(target) {
  const cutoff = dayKey(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000)
  for (const day of Object.keys(target.days)) {
    if (day < cutoff) delete target.days[day]
  }
}

/** Read the ledger document once; a missing or broken file starts empty. */
function loadState() {
  if (state !== null) return state
  state = { version: 1, lastSeq: {}, days: {}, prices: {} }
  try {
    const parsed = JSON.parse(readFileSync(ledgerPath(), 'utf8'))
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if (parsed.days !== null && typeof parsed.days === 'object') state.days = parsed.days
      if (parsed.prices !== null && typeof parsed.prices === 'object') state.prices = parsed.prices
      if (parsed.lastSeq !== null && typeof parsed.lastSeq === 'object') state.lastSeq = parsed.lastSeq
    }
  } catch {
    // First run, unavailable home directory, or a hand-edited file: start empty.
  }
  pruneDays(state)
  return state
}

function flush() {
  loadState()
  pruneDays(state)
  try {
    const file = ledgerPath()
    mkdirSync(dirname(file), { recursive: true })
    const temp = `${file}.tmp`
    writeFileSync(temp, JSON.stringify(state))
    renameSync(temp, file)
  } catch (err) {
    console.error('[dsh-assistant-suite] usage ledger save failed:', err)
  }
}

function scheduleSave() {
  if (saveTimer !== null) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    flush()
  }, SAVE_DELAY_MS)
  if (typeof saveTimer.unref === 'function') saveTimer.unref()
}

/**
 * Price entry for one route. The query target is `provider/model`, so the same
 * model served by two providers can be priced separately; a legacy table keyed
 * by the model name alone still applies until the route key is set.
 * @param provider - route provider id.
 * @param model - model id.
 * @returns `{ input, output, cacheRead }` per million tokens, zero when unset.
 */
function priceOf(provider, model) {
  const table = state?.prices?.[`${provider}/${model}`] ?? state?.prices?.[model]
  if (table === null || typeof table !== 'object') return { input: 0, output: 0, cacheRead: 0 }
  return {
    input: rate(table.input),
    output: rate(table.output),
    cacheRead: rate(table.cacheRead),
  }
}

/** Cost of one bucket under the current price table, in the price table's currency. */
function costOf(provider, model, bucket) {
  const price = priceOf(provider, model)
  return (bucket.input * price.input + bucket.output * price.output + bucket.cacheRead * price.cacheRead) / 1e6
}

/** Fold one live session event into the ledger; duplicate sequence numbers are ignored. */
function record(session, event) {
  if (event?.type !== 'assistant/message') return
  const data = event.data ?? {}
  const usage = data.usage
  if (usage === null || typeof usage !== 'object') return
  const sessionId = String(session?.header?.id ?? session?.id ?? '')
  const seq = Number(event.seq)
  if (sessionId === '' || !Number.isFinite(seq)) return
  const last = Number(state.lastSeq[sessionId])
  if (Number.isFinite(last) && seq <= last) return
  state.lastSeq[sessionId] = seq
  const source = data.message?.source ?? data.source ?? {}
  const provider = typeof source.provider === 'string' && source.provider !== '' ? source.provider : 'unknown'
  const model = typeof source.model === 'string' && source.model !== '' ? source.model : 'unknown'
  const input = count(usage.inputTokens)
  const output = count(usage.outputTokens)
  const cacheRead = count(usage.cacheReadTokens)
  const total = count(usage.totalTokens) || input + output + cacheRead
  const day = dayKey(Number(event.time))
  const dayNode = (state.days[day] ??= {})
  const providerNode = (dayNode[provider] ??= {})
  const bucket = (providerNode[model] ??= { requests: 0, input: 0, output: 0, cacheRead: 0, total: 0 })
  bucket.requests += 1
  bucket.input += input
  bucket.output += output
  bucket.cacheRead += cacheRead
  bucket.total += total
  scheduleSave()
}

/**
 * Aggregate the newest days into totals, a daily series, and a per-model table.
 * Cost is recomputed from the current prices so an edit applies retroactively.
 * @param daysBack - number of calendar days to include, ending today.
 */
function summary(daysBack = SUMMARY_DAYS) {
  loadState()
  const cutoff = dayKey(Date.now() - (daysBack - 1) * 24 * 60 * 60 * 1000)
  const totals = emptyTotals()
  const models = new Map()
  const days = []
  const add = (target, bucket, cost) => {
    target.requests += bucket.requests
    target.input += bucket.input
    target.output += bucket.output
    target.cacheRead += bucket.cacheRead
    target.total += bucket.total
    target.cost += cost
  }
  for (const [day, providers] of Object.entries(state.days)) {
    if (day < cutoff) continue
    const dayRow = { day, ...emptyTotals() }
    for (const [provider, modelMap] of Object.entries(providers)) {
      for (const [model, bucket] of Object.entries(modelMap)) {
        const cost = costOf(provider, model, bucket)
        add(dayRow, bucket, cost)
        add(totals, bucket, cost)
        const key = `${provider}\u0000${model}`
        const row = models.get(key) ?? { provider, model, ...emptyTotals() }
        add(row, bucket, cost)
        models.set(key, row)
      }
    }
    days.push(dayRow)
  }
  const roundCost = (row) => { row.cost = Math.round(row.cost * 1e6) / 1e6 }
  roundCost(totals)
  days.forEach(roundCost)
  days.sort((left, right) => left.day.localeCompare(right.day))
  const rows = [...models.values()].sort((left, right) => right.total - left.total)
  rows.forEach(roundCost)
  return { totals, days, models: rows, prices: state.prices }
}

/**
 * Validate a submitted price table. Anything malformed rejects the whole write
 * so a typo cannot silently zero out existing prices.
 * @returns sanitized table, or null.
 */
function sanitizePrices(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const prices = {}
  let kept = 0
  for (const [model, value] of Object.entries(raw)) {
    if (kept >= MAX_PRICE_KEYS) break
    if (typeof model !== 'string' || model === '' || model.length > 120) continue
    if (value === null || typeof value !== 'object' || Array.isArray(value)) continue
    const entry = {}
    for (const field of PRICE_FIELDS) {
      if (value[field] === undefined) continue
      const numeric = Number(value[field])
      if (!Number.isFinite(numeric) || numeric < 0) return null
      entry[field] = numeric
    }
    prices[model] = entry
    kept += 1
  }
  return prices
}

/** Read the entirety of a node:http request body as a UTF-8 string. */
async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

/** Write a JSON response with the normalized `{ ok, value | error }` envelope. */
function writeJson(res, statusCode, value) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(value))
}

/** Apply the composition's browser-trust fence; true when the answer is already sent. */
function rejected(ctx, req, res) {
  let rejection
  try {
    rejection = ctx.get('connection')?.requestRejection?.(req)
  } catch {
    rejection = undefined
  }
  if (rejection === undefined) return false
  res.statusCode = rejection
  res.end()
  return true
}

/** Failure envelope for a route. */
function failure(message) {
  return { ok: false, error: { code: 'internal', message, details: {} } }
}

/**
 * Register the ledger routes and start folding session events.
 * @param ctx - host context with webServer.
 */
export function apply(ctx) {
  loadState()
  ctx.on('session/event', (session, event) => {
    try {
      record(session, event)
    } catch (err) {
      console.error('[dsh-assistant-suite] usage ledger record failed:', err)
    }
  })
  // Persist whatever is buffered when the plugin unloads.
  ctx.effect(() => () => {
    if (saveTimer !== null) {
      clearTimeout(saveTimer)
      saveTimer = null
      flush()
    }
  }, 'usage-ledger: flush on unload')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE_LEDGER,
    handler: (req, res) => {
      if (rejected(ctx, req, res)) return
      try {
        writeJson(res, 200, { ok: true, value: summary() })
      } catch (err) {
        writeJson(res, 200, failure(err instanceof Error ? err.message : String(err)))
      }
    },
  }), 'usage-ledger: /model-usage/ledger')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE_PRICES,
    handler: async (req, res) => {
      if (rejected(ctx, req, res)) return
      if (req.method !== 'PUT' && req.method !== 'POST') {
        writeJson(res, 405, failure('只支持 PUT 或 POST'))
        return
      }
      try {
        const payload = JSON.parse((await readBody(req)) || '{}')
        const prices = sanitizePrices(payload?.prices)
        if (prices === null) {
          writeJson(res, 200, failure('单价必须是 {模型: {input, output, cacheRead}} 形式的对象'))
          return
        }
        loadState().prices = prices
        scheduleSave()
        writeJson(res, 200, { ok: true, value: summary() })
      } catch (err) {
        writeJson(res, 200, failure(err instanceof Error ? err.message : String(err)))
      }
    },
  }), 'usage-ledger: /model-usage/ledger/prices')
}
