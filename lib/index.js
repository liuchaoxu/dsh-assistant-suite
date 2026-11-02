import { apply as applyModelUsage, inject as modelUsageInject } from './model-usage.js'
import { apply as applyReminding, inject as remindingInject } from './reminding.js'
export const inject = [...new Set([...modelUsageInject, ...remindingInject])]
export function apply(ctx) { applyModelUsage(ctx); applyReminding(ctx) }
