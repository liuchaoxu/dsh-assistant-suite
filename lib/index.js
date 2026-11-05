import { apply as applyModelUsage, inject as modelUsageInject } from './model-usage.js'
import { apply as applyReminding, inject as remindingInject } from './reminding.js'
import { apply as applyLedger, inject as ledgerInject } from './usage-ledger.js'
export const inject = [...new Set([...modelUsageInject, ...remindingInject, ...ledgerInject])]
export function apply(ctx) { applyModelUsage(ctx); applyReminding(ctx); applyLedger(ctx) }
