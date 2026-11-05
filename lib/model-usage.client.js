// Browser half of dsh-model-usage — a hand-built client bundle in the
// closure-factory format client-modules expects. It registers one entry into
// the session header's right-aligned utilities slot ('用量') and renders a
// modal with the usage of the model THIS CONVERSATION is running on: the model
// comes from the Session's `modelSelection` projection (the same fact the model
// picker shows; the wire view is `{ lastUsed, next }`), the key comes from that
// provider's own credential reference on the host, and the numbers come from
// the matching usage API. The host resolves and holds every secret; this half
// only ever sees the normalized payload plus the credential REFERENCE NAME.
//
// Everything shared with the host is carried by ids and tokens only:
// - React comes from the loader's module table, and nothing else is imported:
//   the controls below are this plugin's own, styled exclusively with the
//   theme tokens the running build lists.
// - Copy lives in the Client locale service (`ctx.locale`), so the panel
//   follows the active language and switches live.
// - The stylesheet renders as a React element inside the cell, so it appears
//   and disappears with this slot entry instead of leaking a <style> tag.
//
// Refreshing is a background concern, not a click handler: this cell mounts
// with the session view, so it queries once on mount (and on every model
// switch) and then keeps the numbers warm on its own timer while 自动刷新 is on.
// Interval and toggle live in localStorage (`dsh-model-usage:refresh`).
window.__ModuleLoader__.load({
  id: "dsh-model-usage",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const { createPortal } = require("react-dom");

    /** Locale namespace every user-visible string of this plugin belongs to. */
    const NS = "dsh-model-usage";
    // Host routes are document-relative (like every shipped client plugin's own
    // routes) so the panel also works when the GUI is served under a directory
    // mount instead of the site root.
    const ROUTE_BALANCE = "model-usage/balance";
    const ROUTE_PROVIDERS = "model-usage/providers";
    const ROUTE_MODELS = "model-usage/models";

    // -----------------------------------------------------------------------
    // Copy. Keys are shared by both dictionaries; `t` reads the active locale
    // at call time and the slot system re-renders this cell on a switch.
    // Provider errors and endpoint field names stay as the host reports them —
    // they are data about a third-party service, not interface copy.
    const zh = {
      "button.label": "用量",
      "button.titleAuto": "用量（每 {interval}自动刷新）",
      "button.titleManual": "用量（自动刷新已关闭）",
      "action.refresh": "刷新",
      "action.retry": "重试",
      "action.save": "保存",
      "action.close": "关闭",
      "action.cancel": "取消",
      "action.info": "说明",
      "action.auto": "改回自动",
      "age.now": "刚刚",
      "age.minutes": "{count} 分钟前",
      "age.hours": "{count} 小时前",
      "age.days": "{count} 天前",
      "minutes.value": "{count} 分钟",
      "status.refreshing": "刷新中…",
      "status.refreshingAge": "刷新中… 显示 {age}的数据",
      "status.never": "尚未刷新",
      "status.updated": "更新于 {age}",
      "status.stale": " · 超过刷新间隔（{interval}）",
      "status.autoOn": "自动刷新：开",
      "status.autoOff": "自动刷新：关",
      "status.autoTooltipOn": "每 {interval}在后台刷新，关闭弹窗也继续",
      "status.autoTooltipOff": "后台刷新已关，打开弹窗且数据过期时才查",
      "status.settings": "刷新设置",
      "state.loading": "读取中…",
      "state.querying": "查询中…",
      "state.empty": "暂无数据",
      "error.lastRefresh": "上次刷新失败：{error}",
      "providers.none": "部署里还没有模型供应商",
      "providers.summary": "{total} 个路由 · 已配置密钥 {configured} · 支持用量 {supported}",
      "providers.keyConfigured": "密钥已配置",
      "providers.keyMissing": "密钥未配置",
      "providers.configuredUnsupported": "密钥已配置 · 暂无用量接口",
      "providers.collapse": "只看已配置或有用量接口的",
      "providers.expand": "显示其余 {count} 个未配置路由",
      "modelbar.label": "查询对象",
      "modelbar.auto": "自动 · 跟随当前对话",
      "modelbar.autoRoute": "自动 · {route}",
      "modelbar.titleAuto": "跟随当前对话，点击可切换",
      "modelbar.titleManual": "手动指定，点击可切换或回到自动",
      "picker.title": "选择模型",
      "picker.auto": "自动（跟随当前对话）",
      "picker.default": "部署默认：{route}",
      "picker.empty": "当前没有可用模型（检查 设置 → 模型）",
      "picker.hint": "选一个模型查它的用量，不影响当前对话用的模型。",
      "settings.title": "刷新设置",
      "settings.autoLabel": "后台自动刷新",
      "settings.on": "开启",
      "settings.off": "关闭",
      "settings.autoHint": "开启后，弹窗关着也会按间隔后台刷新，打开时直接显示最近结果。",
      "settings.interval": "刷新间隔",
      "settings.customHint": "也可直接填分钟数（1–1440）。",
      "settings.customInvalid": "填 1–1440 之间的分钟数。",
      "settings.staleHint": "数据过期时，打开弹窗先显示上次结果并标记「刷新中…」，查完再更新。",
      "display.section": "用量弹框内容",
      "display.hint": "选用量入口和弹框里显示的内容，改完立即生效。",
      "display.button": "会话头部用量按钮",
      "display.headline": "用量按钮旁显示余额",
      "display.balance": "余额与额度",
      "display.target": "查询对象栏",
      "display.status": "刷新状态与自动刷新",
      "display.history": "余额消耗趋势",
      "display.meta": "模型与来源",
      "display.refresh": "手动刷新",
      "display.raw": "原始接口数据",
      "display.ticker": "左下角显示供应商与余额",
      "info.title": "用量说明",
      "info.hint": "按当前对话的模型查询，密钥用该供应商的凭据（设置 → 模型）。",
      "card.subscribed": "订阅中",
      "card.windowLimit": "窗口限制",
      "card.notApplicable": "不适用",
      "card.credits": "信用余额",
      "card.monthlyRemaining": "月度剩余",
      "card.spent": "已花费",
      "card.requests": "请求数",
      "card.account": "账户",
      "card.cycleEnd": "本期截止",
      "card.balance": "余额",
      "card.balanceEmpty": "接口未返回 balance_infos",
      "card.available": "账户可用",
      "card.unavailable": "账户不可用",
      "card.deepseekAccount": "DeepSeek 账户",
      "card.noWallet": "账户没有可用钱包",
      "card.windowFallback": "窗口",
      "card.raw": "原始返回",
      "card.hideRaw": "隐藏原始返回",
      "card.unrecognized": "字段还没识别，下面是原始返回。",
      "history.title": "余额消耗趋势",
      "history.expand": "全屏查看",
      "history.pointsOnly": "仅显示消耗点",
      "history.range.today": "今天",
      "history.range.yesterday": "昨天",
      "history.range.week": "近一周",
      "history.range.month": "近一月",
      "history.range.custom": "自定义",
      "history.start": "开始日期",
      "history.end": "结束日期",
      "history.apply": "应用时间段",
      "history.empty": "这段时间记录太少，画不出趋势。",
      "history.amount": "消耗",
      "history.clearMonth": "清除所选月份",
      "history.confirmClearMonth": "确定清除 {month} 的余额记录吗？",
      "history.reset": "重置当前记录",
      "history.month": "数据月份",
      "history.noMonths": "还没有可清理的月份",
      "history.confirmReset": "确定清除当前账户的全部余额记录吗？",
      "card.used": "已用",
      "card.total": "总额",
      "window.fiveHour": "5 小时窗口",
      "window.weekly": "7 天窗口",
      "window.usedReset": "已用 {percent}% · {duration}后重置",
      "window.reset": "窗口已重置",
      "duration.reset": "已重置",
      "currency.CNY": "人民币（CNY）",
      "meta.model": "模型",
      "meta.credential": "密钥",
      "meta.accountLogin": "账户登录（无 API Key）",
      "meta.usageUrl": "用量页",
      "kind.commandcode": "Command Code 用量",
      "kind.deepseek": "DeepSeek 余额",
      "kind.deepseek-account": "DeepSeek 账户余额",
      "kind.opencode-go": "OpenCode Go 用量",
      "kind.openrouter": "OpenRouter 额度",
      "kind.moonshot": "Moonshot / Kimi 余额",
      "kind.siliconflow": "SiliconFlow 余额",
      "kind.newapi": "New API 兼容额度",
      "kind.template": "自定义模板",
      "kind.none": "暂无用量接口",
      "state.noHost": "连不上本机路由，插件可能没加载好（查看 设置 → 插件）",
      "ticker.label": "当前用量",
      "ticker.line": "供应商：{provider} {label}：{value}",
      "ticker.balance": "余额",
      "ticker.used": "已用",
      "ticker.limit": "额度",
      "ticker.total": "总额",
      "templates.section": "第三方用量模板",
      "templates.hint": "给单个供应商配用量接口。模板只存在这个浏览器，查询时随请求一起发出。",
      "templates.loading": "正在读取供应商…",
      "templates.empty": "没有已配置密钥的供应商。先到 设置 → 模型 填密钥。",
      "templates.loadError": "读取供应商列表失败",
      "templates.edit": "设置模板",
      "templates.closeEditor": "收起",
      "templates.remove": "移除模板",
      "templates.save": "保存模板",
      "templates.cancel": "取消",
      "templates.local": "本地模板",
      "templates.invalidJson": "不是有效的 JSON。",
      "templates.invalidShape": "缺少 request.url（或 url）。",
      "templates.saved": "已保存，下次刷新生效。",
      "templates.removed": "已移除，恢复内置适配。",
      "templates.editorLabel": "用量模板 JSON",
      "templates.preset": "从预设开始",
      "templates.preset.choose": "选择预设…",
      "templates.builtin": "用内置适配初始化",
      "templates.builtinHint": "按插件当前使用的接口生成模板",
      "templates.builtinDone": "已按内置适配生成，可继续修改。",
      "templates.builtinNone": "该供应商没有内置适配，先用预设或自己写。",
      "templates.builtinAccount": "账户登录的余额由宿主直接读取，不需要模板。",
      "templates.builtinConfigured": "该供应商用的是配置里的模板，没有内置适配可初始化。",
      "preset.commandcode": "Command Code",
      "preset.newapi": "One API / New API",
      "preset.openrouter": "OpenRouter",
      "preset.moonshot": "Moonshot / Kimi",
      "preset.siliconflow": "SiliconFlow",
      "preset.deepseek": "DeepSeek 官方",
      "preset.generic": "通用（空模板）",
      "templates.placeholderHint": "占位符：{{baseUrl}}、{{baseUrlRoot}}、{{origin}}、{{apiKey}}。extractor 同步执行，可返回 remaining、used、total、unit。",
      "templates.help.show": "配置说明",
      "templates.help.hide": "收起",
      "templates.help.title": "字段与返回值",
      "templates.help.url": "request.url 必填。{{baseUrl}} 是供应商 baseURL，{{baseUrlRoot}} 去掉结尾的 /v1，{{origin}} 是协议加域名，{{apiKey}} 自动编码。域名要和 baseURL 一致。",
      "templates.help.method": "request.method：GET 或 POST，默认 GET。",
      "templates.help.headers": "request.headers：请求头，值支持占位符。没写 Authorization 会自动加 Bearer {{apiKey}}。",
      "templates.help.body": "request.body：仅 POST，JSON 对象或字符串，占位符会替换，默认带 application/json。",
      "templates.help.extractor": "extractor：同步函数 (response, ctx)。response 是接口 JSON，ctx 有 now 和 baseUrl。也可以用 extract 写字段路径。",
      "templates.help.fields": "可以返回 remaining、used、total、unit、planName、account、totalCount，或 windows（label、used、limit、resetsAt）。数字可以写字符串；缺 total 或 remaining 会按另一侧算；直接返回数字当 remaining；isValid 为 false 且没有数字时提示密钥无效。",
      "templates.help.limits": "响应必须是 JSON，只能请求供应商同域地址，extractor 同步执行、限时 1 秒。",
      "templates.preview": "请求：{method} {url}（密钥已隐藏）",
      "templates.baseUrlNote": "baseURL：{baseUrl}",
      "templates.warnings": "提示",
      "templates.invalidMethod": "只支持 GET 或 POST。",
      "templates.bodyNeedsPost": "只有 POST 能带 request.body。",
      "templates.missingExtractor": "没有 extractor 或 extract，取不到任何余额字段。",
      "templates.unknownPlaceholder": "未知占位符 {name}。可用 {{baseUrl}}、{{baseUrlRoot}}、{{origin}}、{{apiKey}}。",
      "templates.crossOrigin": "地址要和供应商 baseURL 同域（{origin}）。",
      "templates.invalidUrl": "request.url 拼不出来，检查一下占位符和地址。",
      "templates.test": "测试模板",
      "templates.testing": "测试中…",
      "templates.testOk": "测试通过 · {url}",
      "templates.testFailed": "测试失败：{message}",
      "templates.testNoRows": "请求成功，但没取到字段。在 extractor 里返回 remaining 之类的值。",
    };

    const en = {
      "button.label": "Usage",
      "button.titleAuto": "Usage (refreshes every {interval})",
      "button.titleManual": "Usage (auto refresh off)",
      "action.refresh": "Refresh",
      "action.retry": "Retry",
      "action.save": "Save",
      "action.close": "Close",
      "action.cancel": "Cancel",
      "action.info": "About",
      "action.auto": "Follow the conversation",
      "age.now": "just now",
      "age.minutes": "{count} min ago",
      "age.hours": "{count} h ago",
      "age.days": "{count} d ago",
      "minutes.value": "{count} min",
      "status.refreshing": "Refreshing…",
      "status.refreshingAge": "Refreshing… showing {age} data",
      "status.never": "Not refreshed yet",
      "status.updated": "Updated {age}",
      "status.stale": " · past the refresh interval ({interval})",
      "status.autoOn": "Auto refresh: on",
      "status.autoOff": "Auto refresh: off",
      "status.autoTooltipOn": "Refreshes in the background every {interval}, even with the panel closed",
      "status.autoTooltipOff": "Background refresh is off; queries only when the panel opens on stale data",
      "status.settings": "Refresh settings",
      "state.loading": "Loading…",
      "state.querying": "Querying…",
      "state.empty": "No data yet",
      "error.lastRefresh": "Last refresh failed: {error}",
      "providers.none": "No model providers in this deployment",
      "providers.summary": "{total} routes · {configured} keyed · {supported} with usage",
      "providers.keyConfigured": "Key configured",
      "providers.keyMissing": "Key not configured",
      "providers.configuredUnsupported": "Key configured · no usage endpoint",
      "providers.collapse": "Only keyed or usage-capable routes",
      "providers.expand": "Show the other {count} unconfigured routes",
      "modelbar.label": "Target",
      "modelbar.auto": "Auto · follows the conversation",
      "modelbar.autoRoute": "Auto · {route}",
      "modelbar.titleAuto": "Follows the conversation; click to change",
      "modelbar.titleManual": "Picked manually; click to change or follow again",
      "picker.title": "Choose a model",
      "picker.auto": "Auto (follow the conversation)",
      "picker.default": "Deployment default: {route}",
      "picker.empty": "No usable model right now (check Settings → Models)",
      "picker.hint": "Inspect any model's usage. Doesn't change what this conversation runs on.",
      "settings.title": "Refresh settings",
      "settings.autoLabel": "Background auto refresh",
      "settings.on": "On",
      "settings.off": "Off",
      "settings.autoHint": "Keeps querying in the background at the interval below, even when the panel is closed. Opening it shows the latest result.",
      "settings.interval": "Refresh interval",
      "settings.customHint": "Or type minutes (1–1440).",
      "settings.customInvalid": "Enter 1–1440 minutes.",
      "settings.staleHint": "When data is stale, the panel opens with the previous numbers marked as refreshing, then updates.",
      "display.section": "Usage dialog",
      "display.hint": "Pick what the usage button and dialog show. Changes apply immediately.",
      "display.button": "Usage button in the header",
      "display.headline": "Balance next to the usage button",
      "display.balance": "Balance and quota",
      "display.target": "Target selector",
      "display.status": "Refresh status and auto refresh",
      "display.history": "Spend trend",
      "display.meta": "Model and source",
      "display.refresh": "Manual refresh",
      "display.raw": "Raw API response",
      "display.ticker": "Provider and balance at the sidebar bottom",
      "info.title": "Usage details",
      "info.hint": "Queried for this conversation's model, using that provider's own credential (Settings → Models).",
      "card.subscribed": "Subscribed",
      "card.windowLimit": "Window limits",
      "card.notApplicable": "Not applicable",
      "card.credits": "Credit balance",
      "card.monthlyRemaining": "Monthly remaining",
      "card.spent": "Spent",
      "card.requests": "Requests",
      "card.account": "Account",
      "card.cycleEnd": "Cycle ends",
      "card.balance": "Balance",
      "card.balanceEmpty": "The endpoint returned no balance_infos",
      "card.available": "Account available",
      "card.unavailable": "Account unavailable",
      "card.deepseekAccount": "DeepSeek account",
      "card.noWallet": "No wallet on this account",
      "card.windowFallback": "Window",
      "card.raw": "Raw response",
      "card.hideRaw": "Hide raw response",
      "card.unrecognized": "Fields not recognized yet. Raw response below.",
      "history.title": "Balance spend trend",
      "history.expand": "Full screen",
      "history.pointsOnly": "Show points only",
      "history.range.today": "Today",
      "history.range.yesterday": "Yesterday",
      "history.range.week": "Last 7 days",
      "history.range.month": "Last 30 days",
      "history.range.custom": "Custom",
      "history.start": "Start date",
      "history.end": "End date",
      "history.apply": "Apply range",
      "history.empty": "Not enough samples to draw a trend.",
      "history.amount": "Spent",
      "history.clearMonth": "Clear selected month",
      "history.confirmClearMonth": "Clear balance records for {month}?",
      "history.reset": "Reset current records",
      "history.month": "Data month",
      "history.noMonths": "No months to clear",
      "history.confirmReset": "Clear all balance records for this account?",
      "card.used": "Used",
      "card.total": "Total",
      "window.fiveHour": "5-hour window",
      "window.weekly": "7-day window",
      "window.usedReset": "{percent}% used · resets in {duration}",
      "window.reset": "Window reset",
      "duration.reset": "reset",
      "currency.CNY": "Chinese yuan (CNY)",
      "meta.model": "Model",
      "meta.credential": "Credential",
      "meta.accountLogin": "Account sign-in (no API key)",
      "meta.usageUrl": "Usage page",
      "kind.commandcode": "Command Code usage",
      "kind.deepseek": "DeepSeek balance",
      "kind.deepseek-account": "DeepSeek account balance",
      "kind.opencode-go": "OpenCode Go usage",
      "kind.openrouter": "OpenRouter credits",
      "kind.moonshot": "Moonshot / Kimi balance",
      "kind.siliconflow": "SiliconFlow balance",
      "kind.newapi": "New API credits",
      "kind.template": "Custom template",
      "kind.none": "No usage endpoint",
      "state.noHost": "Can't reach the local routes. The plugin may not have loaded (see Settings → Plugins).",
      "ticker.label": "Current usage",
      "ticker.line": "Provider: {provider} {label}: {value}",
      "ticker.balance": "Balance",
      "ticker.used": "Used",
      "ticker.limit": "Limit",
      "ticker.total": "Total",
      "templates.section": "Custom usage templates",
      "templates.hint": "Point a single provider at its own usage endpoint. Templates stay in this browser and go out with that provider's queries.",
      "templates.loading": "Reading providers…",
      "templates.empty": "No provider has a key yet. Add one in Settings → Models.",
      "templates.loadError": "Could not read the provider list",
      "templates.edit": "Set template",
      "templates.closeEditor": "Collapse",
      "templates.remove": "Remove template",
      "templates.save": "Save template",
      "templates.cancel": "Cancel",
      "templates.local": "Local template",
      "templates.invalidJson": "Not valid JSON.",
      "templates.invalidShape": "Missing request.url (or url).",
      "templates.saved": "Saved. Applies on the next refresh.",
      "templates.removed": "Removed. This provider uses its built-in adapter again.",
      "templates.editorLabel": "Usage template JSON",
      "templates.preset": "Start from a preset",
      "templates.preset.choose": "Choose a preset…",
      "templates.builtin": "Initialize from the built-in adapter",
      "templates.builtinHint": "Generate a template from the endpoint this plugin already uses",
      "templates.builtinDone": "Generated from the built-in adapter; edit as needed.",
      "templates.builtinNone": "No built-in adapter for this provider; start from a preset or write one.",
      "templates.builtinAccount": "The signed-in account balance is read by the host; no template is needed.",
      "templates.builtinConfigured": "This provider uses a template from its configuration; there is no built-in adapter to copy.",
      "preset.commandcode": "Command Code",
      "preset.newapi": "One API / New API",
      "preset.openrouter": "OpenRouter",
      "preset.moonshot": "Moonshot / Kimi",
      "preset.siliconflow": "SiliconFlow",
      "preset.deepseek": "DeepSeek official",
      "preset.generic": "Generic (empty template)",
      "templates.placeholderHint": "Placeholders: {{baseUrl}}, {{baseUrlRoot}}, {{origin}}, {{apiKey}}. The extractor runs synchronously and can return remaining, used, total, unit.",
      "templates.help.show": "How to configure",
      "templates.help.hide": "Hide",
      "templates.help.title": "Fields and return values",
      "templates.help.url": "request.url is required. {{baseUrl}} is the provider baseURL, {{baseUrlRoot}} drops a trailing /v1, {{origin}} is scheme and host, {{apiKey}} is percent-encoded. The host must match the baseURL.",
      "templates.help.method": "request.method: GET or POST, GET by default.",
      "templates.help.headers": "request.headers: values support placeholders. Without Authorization the host adds Bearer {{apiKey}}.",
      "templates.help.body": "request.body: POST only. A JSON object or string; placeholders are substituted, application/json is added by default.",
      "templates.help.extractor": "extractor: a synchronous function (response, ctx). response is the endpoint JSON, ctx has now and baseUrl. You can use extract paths instead.",
      "templates.help.fields": "Return remaining, used, total, unit, planName, account, totalCount, or windows (label, used, limit, resetsAt). Numbers may be strings; used and total fill in remaining and vice versa; a bare number means remaining; isValid false with no numbers reports the key as rejected.",
      "templates.help.limits": "The response must be JSON and the URL must stay on the provider host. The extractor runs synchronously with a one-second deadline.",
      "templates.preview": "Request: {method} {url} (key hidden)",
      "templates.baseUrlNote": "baseURL: {baseUrl}",
      "templates.warnings": "Notes",
      "templates.invalidMethod": "Only GET or POST.",
      "templates.bodyNeedsPost": "request.body needs POST.",
      "templates.missingExtractor": "No extractor or extract, so no balance fields can be read.",
      "templates.unknownPlaceholder": "Unknown placeholder {name}. Use {{baseUrl}}, {{baseUrlRoot}}, {{origin}}, or {{apiKey}}.",
      "templates.crossOrigin": "The URL must stay on the provider baseURL host ({origin}).",
      "templates.invalidUrl": "request.url does not resolve. Check the placeholders and the address.",
      "templates.test": "Test template",
      "templates.testing": "Testing…",
      "templates.testOk": "Test passed · {url}",
      "templates.testFailed": "Test failed: {message}",
      "templates.testNoRows": "The request worked, but nothing was extracted. Return remaining or similar from the extractor.",
    };

    /**
     * Substitute `{name}` placeholders ourselves so the panel does not depend
     * on the translate function's parameter form: `t(key)` returns the active
     * language's template, and anything it cannot fill stays visible.
     */
    function fill(template, params) {
      return String(template).replace(/\{(\w+)\}/g, (match, name) => (
        params !== undefined && params[name] !== undefined ? String(params[name]) : match
      ));
    }

    /**
     * The localized name of one usage adapter. The host reports a machine
     * `kind`; a kind this plugin does not know yet falls back to the host's own
     * label instead of showing a dictionary key.
     */
    function kindLabel(t, kind, fallback) {
      if (kind === null || kind === undefined) return t("kind.none");
      const key = `kind.${kind}`;
      const text = t(key);
      return text === key ? String(fallback ?? kind) : text;
    }

    // -----------------------------------------------------------------------
    // Shared by the header control, dialogs and independently mounted settings.
    // Theme tokens follow the host's active appearance, including manual changes.
    const SURFACE_STYLES = [
      ":is(.dsh-usage-btn, .dsh-usage-modal-overlay, .dsh-usage-display-settings) { --dsh-usage-glass: var(--dsw-alias-bg-layer-1); --dsh-usage-card: var(--dsw-alias-bg-layer-2); --dsh-usage-recess: var(--dsw-alias-bg-base); --dsh-usage-hover: var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2)); --dsh-usage-edge: var(--dsw-alias-border-l2); --dsh-usage-shine: rgba(255, 255, 255, 0.72); --dsh-usage-scrim: rgba(18, 24, 36, 0.28); --dsh-usage-thumb: var(--dsw-alias-switch-thumb, #fff); --dsh-usage-focus: var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary)); }",
      "body[data-ds-dark-theme] :is(.dsh-usage-btn, .dsh-usage-modal-overlay, .dsh-usage-display-settings) { --dsh-usage-shine: rgba(255, 255, 255, 0.075); --dsh-usage-scrim: rgba(4, 7, 13, 0.5); }",
      "@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) and (background: color-mix(in srgb, white, transparent)) { :is(.dsh-usage-btn, .dsh-usage-modal-overlay, .dsh-usage-display-settings) { --dsh-usage-glass: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 90%, transparent); --dsh-usage-card: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 78%, transparent); --dsh-usage-recess: color-mix(in srgb, var(--dsw-alias-bg-base) 84%, transparent); } }",
      "@media (prefers-reduced-transparency: reduce) { :is(.dsh-usage-btn, .dsh-usage-modal-overlay, .dsh-usage-display-settings) { --dsh-usage-glass: var(--dsw-alias-bg-layer-1); --dsh-usage-card: var(--dsw-alias-bg-layer-2); --dsh-usage-recess: var(--dsw-alias-bg-base); } .dsh-usage-btn, .dsh-usage-modal-dialog, .dsh-usage-modal-overlay, .dsh-usage-display-card { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; } }",
      "@media (prefers-reduced-motion: reduce) { :is(.dsh-usage-btn, .dsh-usage-modal-overlay, .dsh-usage-display-settings), :is(.dsh-usage-btn, .dsh-usage-modal-overlay, .dsh-usage-display-settings) *, :is(.dsh-usage-btn, .dsh-usage-modal-overlay, .dsh-usage-display-settings) ::after { animation: none !important; transition: none !important; } .dsh-usage-btn::after { animation: none !important; } }",
    ].join("\n");

    // Rendered inside the slot so unloading the plugin also removes its CSS.
    const STYLES = [
      SURFACE_STYLES,
      "@keyframes dsh-usage-spin { to { transform: rotate(360deg); } }",
      "@keyframes dsh-usage-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.92); } }",
      "@keyframes dsh-usage-modal-in { from { opacity: 0; transform: scale(0.96) translateY(4px); } to { opacity: 1; transform: scale(1) translateY(0); } }",
      ".dsh-usage-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 30px; padding: 0 12px; border: 1px solid var(--dsh-usage-edge); border-radius: 999px; color: var(--dsw-alias-label-primary); background: linear-gradient(145deg, var(--dsh-usage-shine), transparent 64%), var(--dsh-usage-glass); backdrop-filter: blur(16px) saturate(125%); -webkit-backdrop-filter: blur(16px) saturate(125%); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', sans-serif; font-size: 12.5px; font-weight: 500; letter-spacing: -0.01em; line-height: 18px; cursor: pointer; user-select: none; transition: background 160ms cubic-bezier(0.2, 0.8, 0.2, 1), border-color 160ms ease, box-shadow 160ms ease, transform 120ms ease; }",
      ".dsh-usage-btn:hover { background: var(--dsh-usage-hover); border-color: var(--dsw-alias-border-l2); box-shadow: 0 2px 5px rgba(0, 0, 0, 0.06); }",
      ".dsh-usage-btn:active { transform: scale(0.965); }",
      ".dsh-usage-btn:focus-visible { outline: 2px solid var(--dsh-usage-focus); outline-offset: 2px; }",
      ".dsh-usage-btn-icon { width: 13px; height: 13px; flex: 0 0 13px; color: var(--dsw-alias-brand-primary); opacity: 0.92; }",
      ".dsh-usage-btn-busy::after { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-success-primary); animation: dsh-usage-pulse 1.2s ease-in-out infinite; }",
      ".dsh-usage-btn-value { max-width: 96px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }",
      ".dsh-usage-hover { position: fixed; z-index: 80; min-width: 190px; max-width: 280px; padding: 10px 12px; border: 1px solid var(--dsh-usage-edge); border-radius: 10px; background: var(--dsh-usage-glass); backdrop-filter: blur(18px) saturate(120%); -webkit-backdrop-filter: blur(18px) saturate(120%); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18); color: var(--dsw-alias-label-primary); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', sans-serif; font-size: 12px; line-height: 17px; pointer-events: none; }",
      ".dsh-usage-hover-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 6px; font-weight: 600; }",
      ".dsh-usage-hover-value { font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary); font-weight: 500; }",
      ".dsh-usage-hover-row { display: flex; justify-content: space-between; gap: 12px; color: var(--dsw-alias-label-secondary); }",
      ".dsh-usage-hover-row span + span { color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums; text-align: right; }",
      ".dsh-usage-action { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 30px; padding: 0 14px; border: 1px solid transparent; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', sans-serif; font-size: 13px; font-weight: 500; letter-spacing: -0.01em; line-height: 18px; cursor: pointer; user-select: none; transition: background 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 120ms ease, opacity 150ms ease; }",
      ".dsh-usage-action:active { transform: scale(0.97); }",
      ".dsh-usage-action:focus-visible { outline: 2px solid var(--dsh-usage-focus); outline-offset: 2px; }",
      ".dsh-usage-action-primary { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary-foreground, var(--dsw-alias-bg-base)); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12); }",
      ".dsh-usage-action-primary:hover { opacity: 0.92; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.16); }",
      ".dsh-usage-action-outline { background: var(--dsw-alias-bg-layer-1); border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); box-shadow: 0 1px 1px rgba(0, 0, 0, 0.03); }",
      ".dsh-usage-action-ghost { background: transparent; border-color: transparent; color: var(--dsw-alias-label-secondary); }",
      ".dsh-usage-action-outline:hover { background: var(--dsh-usage-hover); border-color: var(--dsw-alias-border-l2); }",
      ".dsh-usage-action-ghost:hover { background: var(--dsh-usage-hover); color: var(--dsw-alias-label-primary); }",
      ".dsh-usage-modal-overlay { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 20px; background: var(--dsh-usage-scrim); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }",
      ".dsh-usage-modal-dialog { display: flex; flex-direction: column; width: min(620px, 100%); max-height: 100%; border: 1px solid var(--dsh-usage-edge); border-radius: 22px; background: linear-gradient(145deg, var(--dsh-usage-shine), transparent 36%), var(--dsh-usage-glass); backdrop-filter: blur(28px) saturate(125%); -webkit-backdrop-filter: blur(28px) saturate(125%); background-clip: padding-box; color: var(--dsw-alias-label-primary); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', sans-serif; box-shadow: 0 28px 80px rgba(0, 0, 0, 0.28), 0 4px 14px rgba(0, 0, 0, 0.08), inset 0 1px 0 var(--dsh-usage-shine); outline: none; overflow: hidden; animation: dsh-usage-modal-in 180ms cubic-bezier(0.2, 0.9, 0.3, 1); }",
      ".dsh-usage-modal-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 20px 13px; border-bottom: 1px solid var(--dsw-alias-border-l1); background: var(--dsh-usage-card); }",
      ".dsh-usage-modal-title { font-size: 15px; font-weight: 600; letter-spacing: -0.015em; line-height: 22px; color: var(--dsw-alias-label-primary); }",
      ".dsh-usage-modal-close { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: 1px solid transparent; border-radius: 50%; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: 15px; font-weight: 500; line-height: 1; cursor: pointer; transition: background 140ms ease, color 140ms ease, transform 120ms ease; }",
      ".dsh-usage-modal-close:hover { background: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }",
      ".dsh-usage-modal-close:active { transform: scale(0.93); }",
      ".dsh-usage-modal-close:focus-visible { outline: 2px solid var(--dsh-usage-focus); outline-offset: 2px; }",
      ".dsh-usage-modal-content { padding: 16px 20px; overflow: hidden; }",
      ".dsh-usage-modal-footer { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 12px 20px 15px; border-top: 1px solid var(--dsw-alias-border-l1); background: var(--dsh-usage-card); }",
      ".dsh-usage-state { padding: 16px 0; font-size: 13.5px; line-height: 20px; color: var(--dsw-alias-label-secondary); text-align: center; }",
      ".dsh-usage-error { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 12px 14px; border: 1px solid var(--dsh-usage-edge); border-radius: 12px; background: linear-gradient(135deg, var(--dsh-usage-shine), transparent 55%), var(--dsh-usage-card); }",
      ".dsh-usage-error-text { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); word-break: break-all; }",
      ".dsh-usage-inline-error { font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-error-primary); word-break: break-all; }",
      ".dsh-usage-stack { display: flex; flex-direction: column; gap: 12px; }",
      ".dsh-usage-status-bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding: 8px 12px; border: 1px solid var(--dsh-usage-edge); border-radius: 12px; background: linear-gradient(135deg, var(--dsh-usage-shine), transparent 55%), var(--dsh-usage-card); }",
      ".dsh-usage-status { display: inline-flex; align-items: center; gap: 7px; min-width: 0; flex: 1 1 auto; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }",
      ".dsh-usage-status-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
      ".dsh-usage-status-refresh { flex: 0 0 auto; width: 26px; min-height: 26px; padding: 0; border-radius: 50%; }",
      ".dsh-usage-status-refresh svg { width: 14px; height: 14px; }",
      ".dsh-usage-status-refresh:disabled { opacity: 0.5; cursor: default; transform: none; }",
      ".dsh-usage-status-actions { display: inline-flex; align-items: center; gap: 6px; }",
      ".dsh-usage-spinner { width: 11px; height: 11px; border-radius: 50%; border: 1.5px solid var(--dsw-alias-border-l2); border-top-color: var(--dsw-alias-brand-primary); animation: dsh-usage-spin 0.75s linear infinite; }",
      ".dsh-usage-chip { display: inline-flex; align-items: center; justify-content: center; gap: 5px; height: 26px; padding: 0 11px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 999px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', sans-serif; font-size: 12px; font-weight: 500; line-height: 18px; cursor: pointer; user-select: none; transition: background 140ms ease, border-color 140ms ease, color 140ms ease, transform 120ms ease; }",
      ".dsh-usage-chip:hover { background: var(--dsh-usage-hover); color: var(--dsw-alias-label-primary); }",
      ".dsh-usage-chip:active { transform: scale(0.97); }",
      ".dsh-usage-chip:focus-visible { outline: 2px solid var(--dsh-usage-focus); outline-offset: 2px; }",
      ".dsh-usage-chip-active { color: var(--dsw-alias-label-primary-foreground, var(--dsw-alias-bg-base)); border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-brand-primary); }",
      ".dsh-usage-chip-active:hover { background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary-foreground, var(--dsw-alias-bg-base)); opacity: 0.92; }",
      ".dsh-usage-chip-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px; }",
      ".dsh-usage-modelbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding: 8px 12px; border: 1px solid var(--dsh-usage-edge); border-radius: 12px; background: linear-gradient(135deg, var(--dsh-usage-shine), transparent 55%), var(--dsh-usage-card); }",
      ".dsh-usage-modelbar-label { flex: 0 0 auto; font-size: 12.5px; font-weight: 500; line-height: 18px; color: var(--dsw-alias-label-secondary); }",
      ".dsh-usage-balance-card { border: 1px solid var(--dsh-usage-edge); border-radius: 14px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; background: linear-gradient(135deg, var(--dsh-usage-shine), transparent 55%), var(--dsh-usage-card); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03); }",
      ".dsh-usage-balance-card-title { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 14px; font-weight: 600; letter-spacing: -0.01em; line-height: 20px; color: var(--dsw-alias-label-primary); padding-bottom: 6px; border-bottom: 1px solid var(--dsw-alias-border-l1); }",
      ".dsh-usage-balance-status { display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); font-size: 11.5px; font-weight: 500; line-height: 18px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }",
      ".dsh-usage-balance-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 26px; }",
      ".dsh-usage-balance-row + .dsh-usage-balance-row { border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 6px; }",
      ".dsh-usage-balance-label { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }",
      ".dsh-usage-balance-value { font-size: 13.5px; line-height: 20px; font-weight: 600; color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums; }",
      ".dsh-usage-refresh { display: flex; justify-content: flex-end; }",
      ".dsh-usage-meta { border: 1px solid var(--dsh-usage-edge); border-radius: 12px; padding: 10px 14px; background: linear-gradient(135deg, var(--dsh-usage-shine), transparent 55%), var(--dsh-usage-card); display: flex; flex-direction: column; gap: 6px; }",
      ".dsh-usage-meta-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }",
      ".dsh-usage-meta-key { flex: 0 0 auto; font-weight: 500; }",
      ".dsh-usage-meta-val { flex: 1 1 auto; text-align: right; color: var(--dsw-alias-label-primary); word-break: break-all; font-variant-numeric: tabular-nums; }",
      ".dsh-usage-form { display: flex; flex-direction: column; gap: 14px; padding: 2px 0; }",
      ".dsh-usage-field { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border: 1px solid var(--dsh-usage-edge); border-radius: 12px; background: linear-gradient(135deg, var(--dsh-usage-shine), transparent 55%), var(--dsh-usage-card); }",
      ".dsh-usage-field-label { font-size: 13px; font-weight: 600; line-height: 20px; color: var(--dsw-alias-label-primary); }",
      ".dsh-usage-hint { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }",
      ".dsh-usage-input { height: 34px; padding: 0 11px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsh-usage-recess); color: var(--dsw-alias-label-primary); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', sans-serif; font-size: 13px; line-height: 20px; transition: border-color 140ms ease; }",
      ".dsh-usage-mode-toggle { display: inline-flex; align-self: flex-start; flex-wrap: wrap; gap: 3px; padding: 3px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsh-usage-hover); }",
      ".dsh-usage-mode-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 27px; padding: 0 12px; border: 1px solid transparent; border-radius: 7px; background: transparent; color: var(--dsw-alias-label-secondary); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', sans-serif; font-size: 12px; font-weight: 500; line-height: 18px; cursor: pointer; user-select: none; transition: background 140ms ease, color 140ms ease, border-color 140ms ease, box-shadow 140ms ease; }",
      ".dsh-usage-mode-btn:hover { color: var(--dsw-alias-label-primary); }",
      ".dsh-usage-mode-btn-active { background: var(--dsw-alias-bg-layer-1); border-color: var(--dsw-alias-border-l1); color: var(--dsw-alias-label-primary); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }",
      ".dsh-usage-cc-window { display: flex; flex-direction: column; gap: 6px; padding: 6px 0 2px; }",
      ".dsh-usage-cc-window-head { display: flex; align-items: baseline; justify-content: space-between; font-size: 12.5px; font-weight: 500; line-height: 18px; color: var(--dsw-alias-label-secondary); }",
      ".dsh-usage-cc-window-val { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums; }",
      ".dsh-usage-cc-bar { height: 7px; border-radius: 999px; background: var(--dsh-usage-hover); overflow: hidden; }",
      ".dsh-usage-cc-bar-fill { height: 100%; border-radius: 999px; background: var(--dsw-alias-state-success-primary); transition: width 240ms cubic-bezier(0.2, 0.8, 0.2, 1); }",
      ".dsh-usage-cc-bar-fill-warn { height: 100%; border-radius: 999px; background: var(--dsw-alias-state-warn-primary); transition: width 240ms cubic-bezier(0.2, 0.8, 0.2, 1); }",
      ".dsh-usage-cc-bar-fill-danger { height: 100%; border-radius: 999px; background: var(--dsw-alias-state-error-primary); transition: width 240ms cubic-bezier(0.2, 0.8, 0.2, 1); }",
      ".dsh-usage-cc-reset { font-size: 11.5px; line-height: 16px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }",
      ".dsh-usage-history { display: flex; flex-direction: column; gap: 12px; }",
      ".dsh-usage-history-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding-bottom: 6px; border-bottom: 1px solid var(--dsw-alias-border-l1); }",
      ".dsh-usage-history-title { color: var(--dsw-alias-label-primary); font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em; line-height: 20px; }",
      ".dsh-usage-history-ranges { display: inline-flex; align-self: flex-start; gap: 2px; padding: 3px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; background: var(--dsh-usage-hover); flex-wrap: wrap; }",
      ".dsh-usage-history-ranges .dsh-usage-mode-btn { min-height: 25px; padding: 0 10px; border-color: transparent; border-radius: 6px; background: transparent; font-size: 11.5px; }",
      ".dsh-usage-history-ranges .dsh-usage-mode-btn-active { background: var(--dsw-alias-bg-layer-1); border-color: var(--dsw-alias-border-l1); color: var(--dsw-alias-label-primary); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); }",
      ".dsh-usage-history-controls { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }",
      ".dsh-usage-history-points-toggle { display: inline-flex; align-items: center; gap: 8px; color: var(--dsw-alias-label-secondary); font-size: 12px; font-weight: 500; line-height: 18px; cursor: pointer; user-select: none; }",
      ".dsh-usage-history-points-toggle input { appearance: none; -webkit-appearance: none; position: relative; width: 36px; height: 20px; flex: 0 0 36px; margin: 0; border: 1px solid var(--dsw-alias-border-l2); border-radius: 999px; background: var(--dsh-usage-hover); cursor: pointer; transition: background 160ms cubic-bezier(0.2, 0.8, 0.2, 1), border-color 160ms ease; }",
      ".dsh-usage-history-points-toggle input::after { content: ''; position: absolute; top: 1px; left: 1px; width: 16px; height: 16px; border-radius: 50%; background: var(--dsh-usage-thumb); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.24); transition: transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1); }",
      ".dsh-usage-history-points-toggle input:checked { border-color: var(--dsh-usage-focus); background: var(--dsh-usage-focus); }",
      ".dsh-usage-history-points-toggle input:checked::after { background: #fff; transform: translateX(16px); }",
      ".dsh-usage-history-points-toggle input:focus-visible { outline: 2px solid var(--dsh-usage-focus); outline-offset: 2px; }",
      ".dsh-usage-history-form { display: flex; align-items: end; gap: 8px; flex-wrap: wrap; padding: 8px 10px; border-radius: 10px; background: var(--dsh-usage-hover); }",
      ".dsh-usage-history-date { display: flex; flex-direction: column; gap: 4px; color: var(--dsw-alias-label-secondary); font-size: 11px; font-weight: 500; line-height: 16px; }",
      ".dsh-usage-history-date input, .dsh-usage-history-month { height: 28px; min-width: 112px; padding: 0 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', sans-serif; font-size: 12px; }",
      ".dsh-usage-history-date input:focus, .dsh-usage-history-month:focus, .dsh-usage-input:focus { outline: 2px solid var(--dsh-usage-focus); outline-offset: 1px; }",
      ".dsh-usage-history-manage { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 8px; border-top: 1px solid var(--dsw-alias-border-l1); }",
      ".dsh-usage-history-manage .dsh-usage-action { min-height: 26px; padding: 0 10px; font-size: 11.5px; border-radius: 7px; }",
      ".dsh-usage-history-chart { display: block; width: 100%; height: auto; aspect-ratio: 360 / 132; max-height: 220px; overflow: visible; }",
      ".dsh-usage-history-chart-trigger { display: block; width: 100%; padding: 6px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsh-usage-recess); cursor: zoom-in; transition: border-color 140ms ease; }",
      ".dsh-usage-history-chart-trigger:hover { border-color: var(--dsw-alias-border-l2); }",
      ".dsh-usage-history-chart-trigger:focus-visible { outline: 2px solid var(--dsh-usage-focus); outline-offset: 2px; }",
      ".dsh-usage-history-fullscreen-dialog { box-sizing: border-box; width: min(1120px, 94vw); height: min(800px, 88dvh); max-height: calc(100dvh - 40px); }",
      ".dsh-usage-history-fullscreen-dialog > .dsh-usage-modal-head { flex: 0 0 auto; }",
      ".dsh-usage-history-fullscreen-dialog > .dsh-usage-modal-content { display: flex; flex: 1 1 auto; min-height: 0; padding: 0; }",
      ".dsh-usage-history-fullscreen-content { box-sizing: border-box; display: flex; flex: 1 1 auto; min-width: 0; min-height: 0; flex-direction: column; gap: 16px; padding: 20px 24px 24px; overflow: auto; overscroll-behavior: contain; scrollbar-width: thin; }",
      ".dsh-usage-history-fullscreen-content > :not(.dsh-usage-history-chart) { flex-shrink: 0; }",
      ".dsh-usage-history-fullscreen-content .dsh-usage-history-chart { flex: 1 0 240px; width: 100%; height: auto; min-height: 240px; max-height: none; aspect-ratio: auto; }",
      ".dsh-usage-history-fullscreen-content .dsh-usage-history-ranges { align-self: flex-start; }",
      "@media (max-width: 640px) { .dsh-usage-history-fullscreen-overlay { padding: 12px; } .dsh-usage-history-fullscreen-dialog { width: calc(100vw - 24px); height: 90dvh; max-height: calc(100dvh - 24px); } .dsh-usage-history-fullscreen-content { padding: 16px 14px; } .dsh-usage-history-fullscreen-content .dsh-usage-history-chart { flex-basis: 220px; min-height: 220px; } }",
      ".dsh-usage-history-empty { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; padding: 12px 0; text-align: center; }",
      ".dsh-usage-modal-body { max-height: max(140px, calc(100vh - 260px)); overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--dsw-alias-border-l2) transparent; }",
      ".dsh-usage-provider-list { display: flex; flex-direction: column; border: 1px solid var(--dsh-usage-edge); border-radius: 12px; background: linear-gradient(135deg, var(--dsh-usage-shine), transparent 55%), var(--dsh-usage-card); overflow: hidden; }",
      ".dsh-usage-provider-row { display: flex; flex-direction: column; gap: 3px; padding: 10px 14px; }",
      ".dsh-usage-provider-row + .dsh-usage-provider-row { border-top: 1px solid var(--dsw-alias-border-l1); }",
      ".dsh-usage-provider-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; font-weight: 500; line-height: 20px; color: var(--dsw-alias-label-primary); }",
      ".dsh-usage-provider-meta { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); word-break: break-all; }",
      ".dsh-usage-provider-toggle { display: flex; justify-content: center; }",
      ".dsh-usage-raw { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-secondary); word-break: break-all; max-height: 140px; overflow: auto; border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; padding: 8px 10px; background: var(--dsw-alias-bg-layer-2); }",
    ].join("\n");

    const CONFIG_KEY = "dsh-model-usage:refresh";
    const DISPLAY_KEY = "dsh-assistant-suite:usage-display";
    const DISPLAY_EVENT = "dsh-assistant-suite:usage-display-change";
    /** Per-provider usage templates saved from the Settings page, in this browser. */
    const TEMPLATE_KEY = "dsh-assistant-suite:usage-templates";
    /** Starter template offered for a provider that has none yet (cc-switch shape). */
    const TEMPLATE_SKELETON = {
      request: {
        url: "{{baseUrlRoot}}/v1/usage",
        method: "GET",
        headers: { Authorization: "Bearer {{apiKey}}" },
      },
      extractor: [
        "function (response) {",
        "  const remaining = response?.remaining ?? response?.quota?.remaining ?? response?.balance",
        '  return { remaining, unit: response?.unit ?? "USD" }',
        "}",
      ].join("\n"),
    };
    /**
     * Rebuild the template the plugin's own adapter uses for a route, so a user
     * can start from behavior that already works and then edit it. Null for a
     * route without a built-in adapter, and for the account-only route, which
     * has no key and cannot be expressed as a template.
     */
    function builtinTemplate(entry) {
      const kind = entry?.kind;
      const origin = "{{origin}}";
      const root = "{{baseUrlRoot}}";
      if (kind === "commandcode") {
        return {
          request: { url: `${origin}/alpha/billing/credits`, method: "GET" },
          extractor: [
            "function (response) {",
            "  const credits = response?.credits ?? {}",
            "  const limits = response?.windowLimits",
            "  const windows = []",
            "  if (limits?.fiveHour) windows.push({ label: '5 小时窗口', used: Number(limits.fiveHour.used ?? 0), limit: Number(limits.fiveHour.cap ?? 0), resetsAt: Number(limits.fiveHour.resetAt ?? 0) })",
            "  if (limits?.weekly) windows.push({ label: '7 天窗口', used: Number(limits.weekly.used ?? 0), limit: Number(limits.weekly.cap ?? 0), resetsAt: Number(limits.weekly.resetAt ?? 0) })",
            "  return {",
            "    remaining: Number(credits.monthlyCredits ?? 0) + Number(credits.purchasedCredits ?? 0) + Number(credits.freeCredits ?? 0),",
            "    windows,",
            "    unit: 'USD',",
            "  }",
            "}",
          ].join("\n"),
        };
      }
      if (kind === "deepseek") {
        return {
          request: { url: `${origin}/user/balance`, method: "GET" },
          extractor: [
            "function (response) {",
            "  const info = (response?.balance_infos ?? [])[0] ?? {}",
            "  return { remaining: info.total_balance, unit: info.currency === 'CNY' ? 'CNY' : 'USD' }",
            "}",
          ].join("\n"),
        };
      }
      if (kind === "openrouter") {
        return {
          request: { url: `${root}/api/v1/key`, method: "GET" },
          extractor: [
            "function (response) {",
            "  const data = response?.data ?? {}",
            "  const used = Number(data.usage ?? 0)",
            "  const limit = data.limit == null ? null : Number(data.limit)",
            "  const remaining = data.limit_remaining != null",
            "    ? Number(data.limit_remaining)",
            "    : limit === null ? undefined : Math.max(0, limit - used)",
            "  return { remaining, used, unit: 'USD' }",
            "}",
          ].join("\n"),
        };
      }
      if (kind === "moonshot") {
        return {
          request: { url: `${root}/v1/users/me/balance`, method: "GET" },
          extractor: [
            "function (response) {",
            "  const data = response?.data ?? {}",
            "  return { remaining: data.available_balance, unit: 'CNY' }",
            "}",
          ].join("\n"),
        };
      }
      if (kind === "siliconflow") {
        return {
          request: { url: `${root}/v1/user/info`, method: "GET" },
          extractor: [
            "function (response) {",
            "  const data = response?.data ?? {}",
            "  return { remaining: data.totalBalance ?? data.total_balance, unit: 'CNY', account: data.name }",
            "}",
          ].join("\n"),
        };
      }
      if (kind === "opencode-go") {
        return {
          request: { url: `${origin}/zen/go/v1/usage`, method: "GET" },
          extractor: [
            "function (response) {",
            "  const data = response?.data ?? response ?? {}",
            "  const five = data?.fiveHour ?? data?.five_hour",
            "  const weekly = data?.weekly",
            "  const windows = []",
            "  if (five) windows.push({ label: '5 小时窗口', used: Number(five.used ?? 0), limit: Number(five.limit ?? five.cap ?? 0) })",
            "  if (weekly) windows.push({ label: '7 天窗口', used: Number(weekly.used ?? 0), limit: Number(weekly.limit ?? weekly.cap ?? 0) })",
            "  return { windows }",
            "}",
          ].join("\n"),
        };
      }
      if (kind === "newapi") {
        return {
          request: { url: `${root}/api/user/self`, method: "GET" },
          extractor: [
            "function (response) {",
            "  if (response?.success !== true || response?.data == null) {",
            "    throw new Error(response?.message || '接口没有返回数据')",
            "  }",
            "  const data = response.data",
            "  const quota = Number(data.quota) / 500000",
            "  const used = Number(data.used_quota) / 500000",
            "  return {",
            "    remaining: quota,",
            "    used,",
            "    total: quota + used,",
            "    unit: 'USD',",
            "    account: data.display_name ?? data.username,",
            "    totalCount: data.request_count,",
            "  }",
            "}",
          ].join("\n"),
        };
      }
      return null;
    }

    /** Presets mirror the built-in adapters; the generic entry is a blank start. */
    const TEMPLATE_PRESETS = [
      { id: "commandcode", labelKey: "preset.commandcode", template: builtinTemplate({ kind: "commandcode" }) },
      { id: "newapi", labelKey: "preset.newapi", template: builtinTemplate({ kind: "newapi" }) },
      { id: "openrouter", labelKey: "preset.openrouter", template: builtinTemplate({ kind: "openrouter" }) },
      { id: "moonshot", labelKey: "preset.moonshot", template: builtinTemplate({ kind: "moonshot" }) },
      { id: "siliconflow", labelKey: "preset.siliconflow", template: builtinTemplate({ kind: "siliconflow" }) },
      { id: "deepseek", labelKey: "preset.deepseek", template: builtinTemplate({ kind: "deepseek" }) },
      { id: "generic", labelKey: "preset.generic", template: TEMPLATE_SKELETON },
    ];
    const DEFAULT_DISPLAY = { button: true, headline: true, balance: true, target: true, status: true, history: true, meta: true, refresh: true, raw: true, ticker: false };
    /** Key this plugin used before it was renamed to dsh-model-usage. */
    const LEGACY_CONFIG_KEY = "dsh-desktop-usage:refresh";
    const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
    const MIN_INTERVAL_MS = 60 * 1000;
    const MAX_INTERVAL_MS = 24 * 60 * 60 * 1000;
    /** Offered intervals, in minutes; the input next to them takes any 1–1440. */
    const INTERVAL_PRESETS = [1, 5, 15, 30, 60];
    /** How often the open panel re-reads the clock and re-checks staleness. */
    const TICK_MS = 5000;
    const HISTORY_KEY = "dsh-model-usage:commandcode-history";
    const HISTORY_INTERVAL_MS = 10 * 60 * 1000;
    const HISTORY_RANGES = ["today", "yesterday", "week", "month", "custom"];
    /** Everything Tab may land on inside a dialog, for the focus trap. */
    const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    /**
     * Coerce stored or edited values onto the current key set: `balance` is the
     * fixed core, every other key falls back to its own default (most default
     * on, the sidebar ticker defaults off).
     */
    function normalizeDisplay(source) {
      return Object.fromEntries(Object.keys(DEFAULT_DISPLAY).map((key) => {
        if (key === "balance") return [key, true];
        const value = source !== null && typeof source === "object" ? source[key] : undefined;
        return [key, value === undefined ? DEFAULT_DISPLAY[key] : value !== false];
      }));
    }

    function readDisplayOptions() {
      try {
        const parsed = JSON.parse(localStorage.getItem(DISPLAY_KEY) ?? "null");
        return normalizeDisplay(parsed);
      } catch {
        return { ...DEFAULT_DISPLAY };
      }
    }

    function writeDisplayOptions(options) {
      const next = normalizeDisplay(options);
      try { localStorage.setItem(DISPLAY_KEY, JSON.stringify(next)); } catch { /* current page still applies the value */ }
      try { window.dispatchEvent(new CustomEvent(DISPLAY_EVENT, { detail: next })); } catch { /* storage remains the source of truth */ }
      return next;
    }

    /**
     * Read the per-provider templates saved in this browser. Entries without a
     * usable `request.url` are dropped, so a half-written draft can never reach
     * the host and fail a query unexpectedly.
     */
    function readTemplates() {
      try {
        const parsed = JSON.parse(localStorage.getItem(TEMPLATE_KEY) ?? "null");
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
        const templates = {};
        for (const [provider, template] of Object.entries(parsed)) {
          if (template === null || typeof template !== "object") continue;
          const spec = template.request !== null && typeof template.request === "object" ? template.request : template;
          if (typeof spec.url !== "string" || spec.url.trim() === "") continue;
          templates[provider] = template;
        }
        return templates;
      } catch {
        return {};
      }
    }

    function writeTemplates(templates) {
      try { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates)); } catch { /* the panel still uses the in-memory copy */ }
      return templates;
    }

    /** Placeholder names a template may use; everything else is a typo to report. */
    const TEMPLATE_PLACEHOLDERS = ["baseUrl", "baseUrlRoot", "origin", "apiKey"];

    /**
     * Expand a template URL for display only: the key is masked, so a preview
     * can be shown and compared without exposing a credential. A malformed
     * baseURL leaves the raw placeholders in place; the host reports that at
     * query time.
     */
    function previewTemplateUrl(raw, baseUrl) {
      const base = String(baseUrl ?? "").replace(/\/+$/, "");
      let root = base;
      let origin = base;
      try {
        origin = new URL(base).origin;
        root = base.replace(/\/v\d+(?:alpha\d+|beta\d+)?$/i, "");
      } catch { /* the preview simply stays unresolved */ }
      return String(raw)
        .replaceAll("{{baseUrlRoot}}", root)
        .replaceAll("{{baseUrl}}", base)
        .replaceAll("{{origin}}", origin)
        .replaceAll("{{apiKey}}", "***");
    }

    /**
     * Inspect a draft before it is saved or tested: JSON validity, the request
     * shape, same-origin rules, known placeholders, and whether the template
     * can produce a balance at all. Errors block saving; warnings only inform.
     * @returns `{ error }` or `{ method, url, warnings }`.
     */
    function inspectTemplateDraft(text, baseUrl, t) {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        return { error: `${t("templates.invalidJson")} ${err instanceof Error ? err.message : ""}`.trim() };
      }
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { error: t("templates.invalidShape") };
      }
      const spec = parsed.request !== null && typeof parsed.request === "object" ? parsed.request : parsed;
      if (typeof spec.url !== "string" || spec.url.trim() === "") {
        return { error: t("templates.invalidShape") };
      }
      const method = typeof spec.method === "string" ? spec.method.toUpperCase() : "GET";
      if (method !== "GET" && method !== "POST") return { error: t("templates.invalidMethod") };
      if (spec.body !== undefined && spec.body !== null && method !== "POST") {
        return { error: t("templates.bodyNeedsPost") };
      }
      const warnings = [];
      if (typeof parsed.extractor !== "string" || parsed.extractor.trim() === "") {
        if (parsed.extract === null || typeof parsed.extract !== "object") {
          warnings.push(t("templates.missingExtractor"));
        }
      }
      const unknown = new Set();
      String(text).replace(/\{\{([^{}]*)\}\}/g, (match, name) => {
        const key = name.trim();
        if (!TEMPLATE_PLACEHOLDERS.includes(key) && !unknown.has(key)) {
          unknown.add(key);
          warnings.push(fill(t("templates.unknownPlaceholder"), { name: `{{${key}}}` }));
        }
        return match;
      });
      try {
        const target = new URL(previewTemplateUrl(spec.url, baseUrl));
        if (typeof baseUrl === "string" && baseUrl !== "") {
          const origin = new URL(baseUrl).origin;
          if (target.origin !== origin) {
            return { error: fill(t("templates.crossOrigin"), { origin }) };
          }
        }
        return { method, url: target.toString(), warnings };
      } catch {
        return { error: t("templates.invalidUrl") };
      }
    }

    function UsageDisplaySettings({ t, fetchProviders, testTemplate }) {
      const [options, setOptions] = React.useState(readDisplayOptions);
      const update = (key, value) => setOptions(writeDisplayOptions({ ...options, [key]: value }));
      return React.createElement("div", { className: "dsh-usage-display-settings" },
        React.createElement("style", { dangerouslySetInnerHTML: { __html: [
          SURFACE_STYLES,
          ".dsh-usage-display-settings { display: flex; flex-direction: column; gap: 10px; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', sans-serif; }",
          ".dsh-usage-display-header { display: flex; flex-direction: column; gap: 3px; padding: 0 2px; }",
          ".dsh-usage-display-title { font-size: 13px; font-weight: 600; letter-spacing: -0.01em; line-height: 18px; color: var(--dsw-alias-label-primary); }",
          ".dsh-usage-display-hint { font-size: 12px; line-height: 17px; color: var(--dsw-alias-label-secondary); }",
          ".dsh-usage-display-card { display: flex; flex-direction: column; border: 1px solid var(--dsh-usage-edge); border-radius: 12px; background: linear-gradient(135deg, var(--dsh-usage-shine), transparent 55%), var(--dsh-usage-card); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03); backdrop-filter: blur(20px) saturate(120%); -webkit-backdrop-filter: blur(20px) saturate(120%); overflow: hidden; }",
          ".dsh-usage-display-settings label { display: flex; align-items: center; justify-content: space-between; gap: 14px; min-height: 42px; padding: 8px 16px; color: var(--dsw-alias-label-primary); font-size: 13.5px; font-weight: 400; line-height: 20px; cursor: pointer; user-select: none; transition: background 140ms ease; }",
          ".dsh-usage-display-settings label:hover { background: var(--dsh-usage-hover); }",
          ".dsh-usage-display-settings label + label { border-top: 1px solid var(--dsw-alias-border-l1); }",
          ".dsh-usage-display-settings input { appearance: none; -webkit-appearance: none; position: relative; width: 38px; height: 22px; flex: 0 0 38px; margin: 0; border: 1px solid var(--dsw-alias-border-l2); border-radius: 999px; background: var(--dsh-usage-hover); cursor: pointer; transition: background 160ms cubic-bezier(0.2, 0.8, 0.2, 1), border-color 160ms ease, opacity 140ms ease; }",
          ".dsh-usage-display-settings input::after { content: ''; position: absolute; top: 1px; left: 1px; width: 18px; height: 18px; border-radius: 50%; background: var(--dsh-usage-thumb); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.24); transition: transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1); }",
          ".dsh-usage-display-settings input:checked { background: var(--dsh-usage-focus); border-color: var(--dsh-usage-focus); }",
          ".dsh-usage-display-settings input:checked::after { background: #fff; transform: translateX(16px); }",
          ".dsh-usage-display-settings input:disabled { opacity: 0.52; cursor: not-allowed; }",
          ".dsh-usage-display-settings input:focus-visible { outline: 2px solid var(--dsh-usage-focus); outline-offset: 2px; }",
        ].join("\n") } }),
        React.createElement("div", { className: "dsh-usage-display-header" },
          React.createElement("div", { className: "dsh-usage-display-title" }, t("display.section")),
          React.createElement("div", { className: "dsh-usage-display-hint" }, t("display.hint")),
        ),
        React.createElement("div", { className: "dsh-usage-display-card" },
          Object.keys(DEFAULT_DISPLAY).map((key) => React.createElement("label", { key },
            React.createElement("span", null, t(`display.${key}`)),
            React.createElement("input", {
              type: "checkbox",
              checked: options[key],
              disabled: key === "balance",
              "aria-label": t(`display.${key}`),
              onChange: (event) => update(key, event.target.checked),
            }),
          )),
        ),
        React.createElement(UsageTemplatesSettings, { t, fetchProviders, testTemplate }),
      );
    }

    /**
     * Per-credential usage templates in the suite's settings page. Values live
     * in this browser (like the refresh and display preferences); every query
     * for that provider route carries the template to the host, which is the
     * only place the API key and the extractor's sandbox live.
     */
    function UsageTemplatesSettings({ t, fetchProviders, testTemplate }) {
      const [providers, setProviders] = React.useState(null);
      const [loadError, setLoadError] = React.useState("");
      const [templates, setTemplates] = React.useState(readTemplates);
      const [editing, setEditing] = React.useState("");
      const [draft, setDraft] = React.useState("");
      const [draftError, setDraftError] = React.useState("");
      const [notice, setNotice] = React.useState("");
      const [helpOpen, setHelpOpen] = React.useState(false);
      const [testing, setTesting] = React.useState(false);
      const [testResult, setTestResult] = React.useState(null);

      React.useEffect(() => {
        let alive = true;
        if (typeof fetchProviders !== "function") {
          setProviders([]);
          return () => { alive = false; };
        }
        fetchProviders()
          .then((result) => {
            if (!alive) return;
            if (result !== null && result.ok === true && Array.isArray(result.value)) {
              setProviders(result.value);
            } else {
              setLoadError(result?.error?.message ?? t("templates.loadError"));
              setProviders([]);
            }
          })
          .catch((err) => {
            if (!alive) return;
            setLoadError(String(err));
            setProviders([]);
          });
        return () => { alive = false; };
      }, []);

      const begin = (provider) => {
        setEditing(provider);
        setDraftError("");
        setNotice("");
        setTestResult(null);
        const existing = templates[provider];
        setDraft(JSON.stringify(existing === undefined ? TEMPLATE_SKELETON : existing, null, 2));
      };

      /** Fill the draft with a shipped preset; the user can still edit or test it. */
      const applyPreset = (id) => {
        const preset = TEMPLATE_PRESETS.find((candidate) => candidate.id === id);
        if (preset === undefined) return;
        setDraft(JSON.stringify(preset.template, null, 2));
        setDraftError("");
        setTestResult(null);
      };

      /**
       * Copy the route's built-in adapter into the draft. Providers without an
       * adapter, the account-only route, and routes already using a configured
       * template explain why there is nothing to copy.
       */
      const useBuiltin = (entry) => {
        if (entry.kind === "template") {
          setDraftError(t("templates.builtinConfigured"));
          return;
        }
        if (entry.kind === "deepseek-account") {
          setDraftError(t("templates.builtinAccount"));
          return;
        }
        const template = builtinTemplate(entry);
        if (template === null) {
          setDraftError(t("templates.builtinNone"));
          return;
        }
        setDraft(JSON.stringify(template, null, 2));
        setDraftError("");
        setTestResult(null);
        setNotice(t("templates.builtinDone"));
      };

      const save = () => {
        const entry = (providers ?? []).find((row) => row.provider === editing);
        const inspection = inspectTemplateDraft(draft, entry?.baseUrl ?? "", t);
        if (inspection.error !== undefined) {
          setDraftError(inspection.error);
          return;
        }
        setTemplates(writeTemplates({ ...templates, [editing]: JSON.parse(draft) }));
        setEditing("");
        setDraftError("");
        setTestResult(null);
        setNotice(t("templates.saved"));
      };

      const remove = (provider) => {
        const next = { ...templates };
        delete next[provider];
        setTemplates(writeTemplates(next));
        if (editing === provider) setEditing("");
        setDraftError("");
        setTestResult(null);
        setNotice(t("templates.removed"));
      };

      /**
       * Run the draft against the provider without saving it. The host executes
       * the same path as a real refresh, so the answer is exactly what the
       * panel would show — including the resolved request URL (key masked).
       */
      const runTest = (entry) => {
        const inspection = inspectTemplateDraft(draft, entry.baseUrl, t);
        if (inspection.error !== undefined) {
          setDraftError(inspection.error);
          return;
        }
        setTesting(true);
        setDraftError("");
        setTestResult(null);
        testTemplate(entry.provider, JSON.parse(draft))
          .then((result) => {
            if (result !== null && result.ok === true) {
              const data = result.value?.data ?? {};
              setTestResult({
                ok: true,
                url: typeof data.requestUrl === "string" ? data.requestUrl : inspection.url,
                rows: Array.isArray(data.rows) ? data.rows : [],
              });
            } else {
              setTestResult({ ok: false, message: result?.error?.message ?? t("templates.testFailed") });
            }
          })
          .catch((err) => setTestResult({ ok: false, message: String(err) }))
          .finally(() => setTesting(false));
      };

      const rows = (providers ?? []).filter((entry) => entry !== null && typeof entry === "object"
        && (templates[entry.provider] !== undefined
          || (entry.configured === true && typeof entry.baseUrl === "string" && entry.baseUrl !== "")));
      const inspections = Object.fromEntries(rows.map((entry) => [
        entry.provider,
        editing === entry.provider ? inspectTemplateDraft(draft, entry.baseUrl, t) : null,
      ]));

      return React.createElement("div", { className: "dsh-usage-templates" },
        React.createElement("style", { dangerouslySetInnerHTML: { __html: [
          SURFACE_STYLES,
          ".dsh-usage-templates { display: flex; flex-direction: column; gap: 10px; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', sans-serif; }",
          ".dsh-usage-template-row { display: flex; flex-direction: column; gap: 8px; padding: 10px 14px; }",
          ".dsh-usage-template-row + .dsh-usage-template-row { border-top: 1px solid var(--dsw-alias-border-l1); }",
          ".dsh-usage-template-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }",
          ".dsh-usage-template-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }",
          ".dsh-usage-template-name { font-size: 13.5px; font-weight: 500; line-height: 20px; color: var(--dsw-alias-label-primary); }",
          ".dsh-usage-template-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }",
          ".dsh-usage-template-badge { display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 999px; background: var(--dsh-usage-focus); color: var(--dsw-alias-label-primary-foreground, #fff); font-size: 11px; font-weight: 500; }",
          ".dsh-usage-template-editor { display: flex; flex-direction: column; gap: 8px; }",
          ".dsh-usage-template-preset { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }",
          ".dsh-usage-template-select { height: 30px; padding: 0 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsh-usage-recess); color: var(--dsw-alias-label-primary); font-size: 12px; }",
          ".dsh-usage-template-input { box-sizing: border-box; width: 100%; min-height: 190px; padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; background: var(--dsh-usage-recess); color: var(--dsw-alias-label-primary); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; line-height: 17px; resize: vertical; tab-size: 2; }",
          ".dsh-usage-template-input:focus-visible { outline: 2px solid var(--dsh-usage-focus); outline-offset: 1px; }",
          ".dsh-usage-template-note { font-size: 11.5px; line-height: 17px; color: var(--dsw-alias-label-secondary); word-break: break-word; }",
          ".dsh-usage-template-error { font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-error-primary); }",
          ".dsh-usage-template-editor-actions { display: flex; justify-content: flex-end; gap: 8px; }",
          ".dsh-usage-template-notice { font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-success-primary, var(--dsw-alias-label-secondary)); }",
          ".dsh-usage-display-title-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }",
          ".dsh-usage-template-help { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border: 1px solid var(--dsh-usage-edge); border-radius: 10px; background: var(--dsh-usage-recess); }",
          ".dsh-usage-template-help-title { font-size: 12px; font-weight: 600; line-height: 18px; color: var(--dsw-alias-label-primary); }",
          ".dsh-usage-template-help-line { font-size: 11.5px; line-height: 17px; color: var(--dsw-alias-label-secondary); word-break: break-word; }",
          ".dsh-usage-template-preview { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-secondary); word-break: break-all; }",
          ".dsh-usage-template-warning { font-size: 11.5px; line-height: 17px; color: var(--dsw-alias-label-secondary); }",
          ".dsh-usage-template-result { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; background: var(--dsh-usage-recess); }",
          ".dsh-usage-template-result.is-error { border-color: var(--dsw-alias-state-error-primary); }",
          ".dsh-usage-template-result-title { font-size: 11.5px; line-height: 17px; color: var(--dsw-alias-label-secondary); word-break: break-all; }",
          ".dsh-usage-template-result-row { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-primary); }",
          ".dsh-usage-template-preset .dsh-usage-chip:disabled { opacity: 0.5; cursor: not-allowed; }",
        ].join("\n") } }),
        React.createElement("div", { className: "dsh-usage-display-header" },
          React.createElement("div", { className: "dsh-usage-display-title-row" },
            React.createElement("div", { className: "dsh-usage-display-title" }, t("templates.section")),
            React.createElement("button", {
              type: "button",
              className: "dsh-usage-chip",
              "aria-expanded": helpOpen,
              onClick: () => setHelpOpen(!helpOpen),
            }, helpOpen ? t("templates.help.hide") : t("templates.help.show")),
          ),
          React.createElement("div", { className: "dsh-usage-display-hint" }, t("templates.hint")),
        ),
        helpOpen
          ? React.createElement("div", { className: "dsh-usage-template-help" },
              React.createElement("div", { className: "dsh-usage-template-help-title" }, t("templates.help.title")),
              ["url", "method", "headers", "body", "extractor", "fields", "limits"].map((key) =>
                React.createElement("div", { key, className: "dsh-usage-template-help-line" },
                  t(`templates.help.${key}`))),
            )
          : null,
        loadError !== "" ? React.createElement("div", { className: "dsh-usage-inline-error" }, loadError) : null,
        providers === null ? React.createElement("div", { className: "dsh-usage-hint" }, t("templates.loading")) : null,
        providers !== null && rows.length === 0
          ? React.createElement("div", { className: "dsh-usage-hint" }, t("templates.empty"))
          : null,
        rows.length > 0
          ? React.createElement("div", { className: "dsh-usage-display-card" },
              rows.map((entry) => React.createElement("div", {
                key: String(entry.provider),
                className: "dsh-usage-template-row",
              },
                React.createElement("div", { className: "dsh-usage-template-head" },
                  React.createElement("div", { className: "dsh-usage-template-info" },
                    React.createElement("div", { className: "dsh-usage-template-name" },
                      String(entry.displayName ?? entry.provider)),
                    React.createElement("div", { className: "dsh-usage-provider-meta" },
                      `${entry.provider}${entry.credentialRef ? ` · ${entry.credentialRef}` : ""}`),
                  ),
                  React.createElement("div", { className: "dsh-usage-template-actions" },
                    templates[entry.provider] !== undefined
                      ? React.createElement("span", { className: "dsh-usage-template-badge" }, t("templates.local"))
                      : null,
                    React.createElement("button", {
                      type: "button",
                      className: "dsh-usage-chip",
                      "aria-expanded": editing === entry.provider,
                      onClick: () => { if (editing === entry.provider) setEditing(""); else begin(entry.provider); },
                    }, editing === entry.provider ? t("templates.closeEditor") : t("templates.edit")),
                    templates[entry.provider] !== undefined
                      ? React.createElement("button", {
                          type: "button",
                          className: "dsh-usage-chip",
                          onClick: () => remove(entry.provider),
                        }, t("templates.remove"))
                      : null,
                  ),
                ),
                editing === entry.provider
                  ? React.createElement("div", { className: "dsh-usage-template-editor" },
                      React.createElement("div", { className: "dsh-usage-template-preset" },
                        React.createElement("label", {
                          className: "dsh-usage-template-note",
                          htmlFor: `dsh-usage-preset-${entry.provider}`,
                        }, t("templates.preset")),
                        React.createElement("select", {
                          id: `dsh-usage-preset-${entry.provider}`,
                          className: "dsh-usage-template-select",
                          value: "",
                          onChange: (event) => applyPreset(event.target.value),
                        },
                          React.createElement("option", { value: "" }, t("templates.preset.choose")),
                          TEMPLATE_PRESETS.map((preset) => React.createElement("option", {
                            key: preset.id,
                            value: preset.id,
                          }, t(preset.labelKey))),
                        ),
                        React.createElement("button", {
                          type: "button",
                          className: "dsh-usage-chip",
                          disabled: entry.kind === null || entry.kind === undefined,
                          title: t("templates.builtinHint"),
                          onClick: () => useBuiltin(entry),
                        }, t("templates.builtin")),
                      ),
                      React.createElement("textarea", {
                        className: "dsh-usage-template-input",
                        value: draft,
                        spellCheck: false,
                        "aria-label": t("templates.editorLabel"),
                        onChange: (event) => { setDraft(event.target.value); setDraftError(""); setTestResult(null); },
                      }),
                      inspections[entry.provider] !== null && inspections[entry.provider].error === undefined
                        ? React.createElement("div", { className: "dsh-usage-template-preview" },
                            fill(t("templates.preview"), {
                              method: inspections[entry.provider].method,
                              url: inspections[entry.provider].url,
                            }))
                        : null,
                      inspections[entry.provider] !== null && inspections[entry.provider].error !== undefined
                        ? React.createElement("div", { className: "dsh-usage-template-error" }, inspections[entry.provider].error)
                        : null,
                      inspections[entry.provider] !== null && inspections[entry.provider].error === undefined
                        && inspections[entry.provider].warnings.length > 0
                        ? React.createElement("div", { className: "dsh-usage-template-warnings" },
                            inspections[entry.provider].warnings.map((message, index) =>
                              React.createElement("div", { key: `w-${index}`, className: "dsh-usage-template-warning" }, message)))
                        : null,
                      draftError !== "" ? React.createElement("div", { className: "dsh-usage-template-error" }, draftError) : null,
                      React.createElement("div", { className: "dsh-usage-template-note" },
                        fill(t("templates.baseUrlNote"), { baseUrl: String(entry.baseUrl ?? "") })),
                      React.createElement("div", { className: "dsh-usage-template-note" }, t("templates.placeholderHint")),
                      React.createElement("div", { className: "dsh-usage-template-editor-actions" },
                        React.createElement(ActionButton, {
                          variant: "ghost",
                          onClick: () => { setEditing(""); setDraftError(""); setTestResult(null); },
                        }, t("templates.cancel")),
                        React.createElement(ActionButton, {
                          variant: "outline",
                          onClick: () => runTest(entry),
                        }, testing ? t("templates.testing") : t("templates.test")),
                        React.createElement(ActionButton, { variant: "primary", onClick: save }, t("templates.save")),
                      ),
                      testResult === null
                        ? null
                        : React.createElement("div", {
                            className: `dsh-usage-template-result${testResult.ok ? "" : " is-error"}`,
                          },
                            React.createElement("div", { className: "dsh-usage-template-result-title" },
                              testResult.ok
                                ? fill(t("templates.testOk"), { url: testResult.url })
                                : fill(t("templates.testFailed"), { message: testResult.message })),
                            testResult.ok
                              ? (testResult.rows.length > 0
                                  ? React.createElement("div", { className: "dsh-usage-template-result-rows" },
                                      testResult.rows.map((row, index) =>
                                        React.createElement("div", { key: `r-${index}`, className: "dsh-usage-template-result-row" },
                                          React.createElement("span", null, String(row.label)),
                                          React.createElement("span", null, String(row.value)))))
                                  : React.createElement("div", { className: "dsh-usage-template-note" }, t("templates.testNoRows")))
                              : null,
                          ),
                    )
                  : null,
              )),
            )
          : null,
        notice !== "" ? React.createElement("div", { className: "dsh-usage-template-notice" }, notice) : null,
      );
    }

    function clampInterval(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return DEFAULT_INTERVAL_MS;
      return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, Math.round(ms)));
    }

    /** Shortest time between two ticker refreshes, whatever the panel interval is. */
    const TICKER_MIN_INTERVAL_MS = 60 * 1000;
    /**
     * The route the panel is showing right now, published by the conversation
     * header cell. The sidebar ticker follows the selected conversation instead
     * of sweeping every configured provider.
     */
    let activeRoute = null;
    const activeRouteListeners = new Set();

    function publishActiveRoute(route) {
      if ((activeRoute?.provider ?? null) === (route?.provider ?? null)
          && (activeRoute?.model ?? null) === (route?.model ?? null)) return;
      activeRoute = route;
      for (const listener of activeRouteListeners) {
        try { listener(route); } catch { /* one listener must not break the rest */ }
      }
    }

    function subscribeActiveRoute(listener) {
      activeRouteListeners.add(listener);
      return () => { activeRouteListeners.delete(listener); };
    }

    /** Latest successful answer for one route, shared across remounts and language switches. */
    let tickerCache = { key: "", at: 0, fields: null };
    let tickerInflight = null;

    /** Map a host row label onto the ticker's own copy (rows are Chinese by contract). */
    function tickerLabelKey(label) {
      if (typeof label !== "string") return null;
      if (label.includes("剩余")) return "balance";
      if (label.includes("余额")) return "balance";
      if (label.includes("已用")) return "used";
      if (label.includes("额度")) return "limit";
      if (label.includes("总额")) return "total";
      return null;
    }

    /**
     * One provider / label / value triple from a normalized balance payload, or
     * null when the payload carries no figure the ticker can name.
     */
    function tickerFields(providerName, value) {
      const data = value?.data ?? {};
      const credits = data.credits;
      if (credits !== undefined && credits !== null && Number.isFinite(Number(credits.totalRemaining))) {
        return {
          name: providerName,
          labelKey: "balance",
          labelText: null,
          value: `$${Number(credits.totalRemaining).toFixed(2)}`,
        };
      }
      const wallets = Array.isArray(data.wallets) ? data.wallets : [];
      if (wallets.length > 0) {
        const wallet = wallets[0] ?? {};
        return {
          name: providerName,
          labelKey: "balance",
          labelText: null,
          value: `${String(wallet.currency ?? "")}${Number(wallet.balance ?? 0).toFixed(2)}`,
        };
      }
      const rows = Array.isArray(data.rows) ? data.rows : [];
      const row = rows.find((entry) => typeof entry?.label === "string" && entry.label.includes("剩余"))
        ?? rows.find((entry) => typeof entry?.label === "string" && entry.label.includes("余额"))
        ?? rows[0];
      if (row === undefined || row === null || row.value === undefined) return null;
      const labelKey = tickerLabelKey(row.label);
      return {
        name: providerName,
        labelKey: labelKey ?? "balance",
        labelText: labelKey === null ? String(row.label) : null,
        value: String(row.value),
      };
    }

    /** Refresh the one route the panel shows; a failure keeps the previous line. */
    function refreshTicker(route, fetchBalance) {
      if (tickerInflight !== null) return tickerInflight;
      const key = `${route.provider}|${route.model}`;
      tickerInflight = (async () => {
        try {
          const answer = await fetchBalance({ provider: route.provider, model: route.model });
          if (answer?.ok === true) {
            const name = String(answer.value?.providerName ?? route.provider);
            tickerCache = { key, at: Date.now(), fields: tickerFields(name, answer.value) };
          }
        } catch {
          // Keep the previous line: one failed refresh must not blank the ticker.
        }
      })().finally(() => { tickerInflight = null; });
      return tickerInflight;
    }

    /**
     * The sidebar-foot usage ticker. It follows the route the conversation
     * header is showing, keeps a shared short-lived cache, and renders one
     * scrolling line so the numbers stay visible with the dialog closed.
     */
    function UsageTicker({ wide, t, fetchBalance }) {
      const [display, setDisplay] = React.useState(readDisplayOptions);
      const config = readRefreshConfig();
      const enabled = wide === true && display.ticker === true && config.auto !== false;
      const [route, setRoute] = React.useState(activeRoute);
      const [fields, setFields] = React.useState(tickerCache.fields);

      React.useEffect(() => subscribeActiveRoute(setRoute), []);

      React.useEffect(() => {
        const sync = (event) => setDisplay(event?.detail ?? readDisplayOptions());
        window.addEventListener(DISPLAY_EVENT, sync);
        return () => window.removeEventListener(DISPLAY_EVENT, sync);
      }, []);

      React.useEffect(() => {
        if (!enabled || route === null || typeof fetchBalance !== "function") return undefined;
        let alive = true;
        const key = `${route.provider}|${route.model}`;
        if (tickerCache.key !== key) setFields(null);
        const tick = () => {
          if (document.hidden === true) return;
          const fresh = tickerCache.key === key
            && Date.now() - tickerCache.at < Math.max(TICKER_MIN_INTERVAL_MS, config.intervalMs);
          if (fresh) {
            setFields(tickerCache.fields);
            return;
          }
          refreshTicker(route, fetchBalance).then(() => {
            if (alive) setFields(tickerCache.key === key ? tickerCache.fields : null);
          });
        };
        tick();
        const timer = window.setInterval(tick, Math.max(TICKER_MIN_INTERVAL_MS, config.intervalMs));
        const onVisible = () => {
          if (document.hidden !== true) tick();
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => {
          alive = false;
          window.clearInterval(timer);
          document.removeEventListener("visibilitychange", onVisible);
        };
      }, [enabled, route?.provider, route?.model, config.intervalMs, fetchBalance]);

      if (!enabled || route === null || fields === null) return null;
      const label = fields.labelText ?? t(`ticker.${fields.labelKey}`);
      const text = fill(t("ticker.line"), { provider: fields.name, label, value: fields.value });
      const scrolling = text.length > 34;
      const run = (key, hidden) => React.createElement("span", {
        key,
        className: "dsh-usage-ticker-run",
        "aria-hidden": hidden ? "true" : undefined,
      }, text);
      return React.createElement("div", {
        className: `dsh-usage-ticker${scrolling ? "" : " is-static"}`,
        title: text,
        "aria-label": t("ticker.label"),
        role: "status",
      },
        React.createElement("style", { dangerouslySetInnerHTML: { __html: [
          ".dsh-usage-ticker { box-sizing: border-box; width: 100%; overflow: hidden; padding: 2px 6px 4px; }",
          ".dsh-usage-ticker-run { display: inline-block; padding-right: 24px; white-space: nowrap; color: var(--dsw-alias-label-secondary); font-size: 11.5px; line-height: 16px; font-variant-numeric: tabular-nums; }",
          ".dsh-usage-ticker-track.is-scrolling { display: flex; width: max-content; animation: dsh-usage-ticker-scroll 28s linear infinite; }",
          ".dsh-usage-ticker-track.is-scrolling:hover { animation-play-state: paused; }",
          ".dsh-usage-ticker.is-static .dsh-usage-ticker-track { display: block; width: 100%; }",
          ".dsh-usage-ticker.is-static .dsh-usage-ticker-run { display: block; padding-right: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }",
          "@keyframes dsh-usage-ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }",
          "@media (prefers-reduced-motion: reduce) { .dsh-usage-ticker-track.is-scrolling { animation: none; } .dsh-usage-ticker-run[aria-hidden='true'] { display: none; } }",
        ].join("\n") } }),
        React.createElement("div", { className: `dsh-usage-ticker-track${scrolling ? " is-scrolling" : ""}` },
          run("a", false),
          scrolling ? run("b", true) : null,
        ),
      );
    }

    /** Read the saved refresh policy; anything malformed falls back to the default. */
    function readRefreshConfig() {
      const fallback = { auto: true, intervalMs: DEFAULT_INTERVAL_MS };
      try {
        // The pre-rename key is still honoured so a rename does not silently
        // reset the policy someone already chose.
        const raw = localStorage.getItem(CONFIG_KEY) ?? localStorage.getItem(LEGACY_CONFIG_KEY);
        if (raw == null) return fallback;
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== "object") return fallback;
        return {
          auto: parsed.auto !== false,
          intervalMs: clampInterval(Number(parsed.intervalMs)),
        };
      } catch {
        // Corrupt storage (quota/private mode) degrades to the default policy.
        return fallback;
      }
    }

    /** Persist the refresh policy; storage failures keep the in-memory value only. */
    function writeRefreshConfig(config) {
      try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
      } catch {
        // Quota/private mode: the policy still applies for this session.
      }
    }

    function historyStorageKey(data) {
      if (data?.mode !== "commandcode") return null;
      const account = typeof data.data?.account === "string" && data.data.account !== ""
        ? data.data.account
        : `${data.provider ?? "commandcode"}:${data.credential?.ref ?? "default"}:${data.credential?.source ?? ""}`;
      return `${HISTORY_KEY}:${encodeURIComponent(account)}`;
    }

    // Keep the current calendar month plus the two preceding complete months.
    // In October this retains October, September and August, and removes July.
    function historyCutoff(value = Date.now()) {
      const date = new Date(value);
      return new Date(date.getFullYear(), date.getMonth() - 2, 1).getTime();
    }

    function readHistory(data) {
      const key = historyStorageKey(data);
      if (key === null) return [];
      try {
        const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
        if (!Array.isArray(parsed)) return [];
        const now = Date.now();
        const cutoff = historyCutoff(now);
        const retained = parsed.filter((point) => point !== null && typeof point === "object"
          && Number.isFinite(point.at) && point.at >= cutoff && point.at <= now
          && Number.isFinite(point.balance)
          && (point.spend === null || Number.isFinite(point.spend)))
          .sort((a, b) => a.at - b.at);
        if (retained.length !== parsed.length) {
          try {
            localStorage.setItem(key, JSON.stringify(retained));
          } catch {
            // The chart still uses the filtered in-memory history.
          }
        }
        return retained;
      } catch {
        return [];
      }
    }

    function pruneStoredHistories(now = Date.now()) {
      const prefix = `${HISTORY_KEY}:`;
      const cutoff = historyCutoff(now);
      try {
        for (let index = localStorage.length - 1; index >= 0; index -= 1) {
          const key = localStorage.key(index);
          if (typeof key !== "string" || !key.startsWith(prefix)) continue;
          let parsed;
          try { parsed = JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { parsed = []; }
          const retained = Array.isArray(parsed)
            ? parsed.filter((point) => point !== null && typeof point === "object"
                && Number.isFinite(point.at) && point.at >= cutoff && point.at <= now
                && Number.isFinite(point.balance)
                && (point.spend === null || Number.isFinite(point.spend)))
            : [];
          if (retained.length === 0) localStorage.removeItem(key);
          else if (retained.length !== parsed.length) localStorage.setItem(key, JSON.stringify(retained));
        }
      } catch {
        // A storage restriction must not stop balance queries.
      }
    }

    function recordHistorySample(data, now = Date.now()) {
      const key = historyStorageKey(data);
      const balance = Number(data?.data?.credits?.totalRemaining);
      if (key === null || !Number.isFinite(balance)) return [];
      pruneStoredHistories(now);
      const points = readHistory(data);
      const last = points[points.length - 1];
      if (last !== undefined && Math.floor(last.at / HISTORY_INTERVAL_MS) === Math.floor(now / HISTORY_INTERVAL_MS)) return points;
      points.push({
        at: now,
        balance,
        spend: last === undefined ? null : Math.max(0, last.balance - balance),
      });
      const retained = points.filter((point) => point.at >= historyCutoff(now));
      try {
        localStorage.setItem(key, JSON.stringify(retained));
      } catch {
        // Storage can be unavailable or full; the current session still renders.
      }
      return retained;
    }

    function storedMonths(points) {
      return [...new Set(points.map((point) => {
        const date = new Date(point.at);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }))].sort().reverse();
    }

    function clearHistoryMonth(data, month) {
      const key = historyStorageKey(data);
      if (key === null || !/^\d{4}-\d{2}$/.test(month)) return [];
      const points = readHistory(data).filter((point) => {
        const date = new Date(point.at);
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        return value !== month;
      });
      try { localStorage.setItem(key, JSON.stringify(points)); } catch { /* memory view remains usable */ }
      return points;
    }

    function resetHistoryStorage(data) {
      const key = historyStorageKey(data);
      if (key !== null) {
        try { localStorage.removeItem(key); } catch { /* memory view remains usable */ }
      }
      return [];
    }

    const MODEL_KEY = "dsh-model-usage:model";
    /** Key this plugin used before it was renamed to dsh-model-usage. */
    const LEGACY_MODEL_KEY = "dsh-desktop-usage:model";

    /** Read the manual model override; absent or malformed means "follow the conversation". */
    function readModelOverride() {
      try {
        const raw = localStorage.getItem(MODEL_KEY) ?? localStorage.getItem(LEGACY_MODEL_KEY);
        if (raw == null) return null;
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== "object") return null;
        if (typeof parsed.provider !== "string" || parsed.provider === "") return null;
        return {
          provider: parsed.provider,
          model: typeof parsed.model === "string" ? parsed.model : "",
        };
      } catch {
        // Corrupt storage degrades to following the conversation.
        return null;
      }
    }

    /** Persist the override (`null` restores 自动). */
    function writeModelOverride(override) {
      try {
        if (override === null) localStorage.removeItem(MODEL_KEY);
        else localStorage.setItem(MODEL_KEY, JSON.stringify(override));
      } catch {
        // Quota/private mode: the choice still applies for this session.
      }
    }

    function minutesLabel(t, ms) {
      const minutes = ms / 60000;
      const value = Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1);
      return fill(t("minutes.value"), { count: value });
    }

    /** Human age of one refresh: 刚刚 / N 分钟前 / N 小时前 / N 天前. */
    function formatAge(t, ms) {
      if (!Number.isFinite(ms) || ms < 60000) return t("age.now");
      const minutes = Math.floor(ms / 60000);
      if (minutes < 60) return fill(t("age.minutes"), { count: minutes });
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return fill(t("age.hours"), { count: hours });
      return fill(t("age.days"), { count: Math.floor(hours / 24) });
    }

    function currencyName(t, currency) {
      return currency === "CNY" ? t("currency.CNY") : String(currency);
    }

    function currencySymbol(currency) {
      return currency === "CNY" ? "¥" : `${currency} `;
    }

    function unitSymbol(unit) {
      if (unit === "CNY") return "¥";
      if (unit === "USD") return "$";
      return `${unit} `;
    }

    function row(label, value, key) {
      return React.createElement("div", { key, className: "dsh-usage-balance-row" },
        React.createElement("span", { className: "dsh-usage-balance-label" }, label),
        React.createElement("span", { className: "dsh-usage-balance-value" }, value),
      );
    }

    // -----------------------------------------------------------------------
    // Own controls. Copying the shipped primitives' markup is not an option for
    // an out-of-tree bundle (that package is a build-time dependency), so these
    // are this plugin's own: they use only theme tokens, keep the behaviors
    // users rely on (Escape to close, focus moved in and restored on close,
    // Tab cycling inside the dialog), and carry their accessible names.

    const ACTION_VARIANTS = {
      primary: "dsh-usage-action-primary",
      outline: "dsh-usage-action-outline",
      ghost: "dsh-usage-action-ghost",
    };

    /** One dialog action button: variant + native button props. */
    function ActionButton(props) {
      const { variant, className, children } = props;
      const rest = { ...props };
      delete rest.variant;
      delete rest.className;
      delete rest.children;
      const variantClass = ACTION_VARIANTS[variant] ?? ACTION_VARIANTS.ghost;
      return React.createElement("button", {
        type: "button",
        ...rest,
        className: "dsh-usage-action " + variantClass + (className ? ` ${className}` : ""),
      }, children);
    }

    const modalLayers = [];

    /**
     * One modal dialog. `onClose` is held in a ref so the focus effect runs only
     * on open/close — the panel re-renders on every background refresh, and
     * re-running it there would steal focus every few seconds.
     */
    function UsageModal(props) {
      const { open, onClose, title, closeLabel, className, overlayClassName, footer, children } = props;
      const dialogRef = React.useRef(null);
      const restoreRef = React.useRef(null);
      const closeRef = React.useRef(onClose);
      closeRef.current = onClose;

      React.useEffect(() => {
        if (!open) return undefined;
        const layer = dialogRef;
        modalLayers.push(layer);
        restoreRef.current = typeof document === "undefined" ? null : document.activeElement;
        const close = () => { closeRef.current(); };
        const onKeyDown = (event) => {
          if (modalLayers[modalLayers.length - 1] !== layer) return;
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
          }
          if (event.key !== "Tab") return;
          const dialog = dialogRef.current;
          if (dialog === null) return;
          const focusable = dialog.querySelectorAll(FOCUSABLE);
          if (focusable.length === 0) {
            event.preventDefault();
            dialog.focus();
            return;
          }
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          const active = document.activeElement;
          const inside = active !== null && dialog.contains(active);
          if (event.shiftKey) {
            if (!inside || active === first) {
              event.preventDefault();
              last.focus();
            }
          } else if (!inside || active === last) {
            event.preventDefault();
            first.focus();
          }
        };
        document.addEventListener("keydown", onKeyDown, true);
        const timer = window.setTimeout(() => {
          const dialog = dialogRef.current;
          if (dialog === null) return;
          const focusable = dialog.querySelectorAll(FOCUSABLE);
          const target = focusable.length > 0 ? focusable[0] : dialog;
          if (typeof target.focus === "function") target.focus();
        }, 0);
        return () => {
          const index = modalLayers.indexOf(layer);
          if (index !== -1) modalLayers.splice(index, 1);
          document.removeEventListener("keydown", onKeyDown, true);
          window.clearTimeout(timer);
          const restore = restoreRef.current;
          if (restore !== null && typeof restore.focus === "function") restore.focus();
        };
      }, [open]);

      if (!open) return null;
      return createPortal(React.createElement("div", {
        className: "dsh-usage-modal-overlay" + (overlayClassName ? ` ${overlayClassName}` : ""),
        onMouseDown: (event) => { if (event.target === event.currentTarget) closeRef.current(); },
      },
        React.createElement("div", {
          ref: dialogRef,
          role: "dialog",
          "aria-modal": "true",
          "aria-label": title,
          tabIndex: -1,
          className: "dsh-usage-modal-dialog" + (className ? ` ${className}` : ""),
        },
          React.createElement("div", { className: "dsh-usage-modal-head" },
            React.createElement("span", { className: "dsh-usage-modal-title" }, title),
            React.createElement("button", {
              type: "button",
              className: "dsh-usage-modal-close",
              "aria-label": closeLabel,
              title: closeLabel,
              onClick: () => { closeRef.current(); },
            }, "×"),
          ),
          React.createElement("div", { className: "dsh-usage-modal-content" }, children),
          footer === undefined || footer === null
            ? null
            : React.createElement("div", { className: "dsh-usage-modal-footer" }, footer),
        ),
      ), document.body);
    }

    /** Format a duration (ms) as "Xh Ym" / "Xd Yh", falling back to "已重置". */
    function formatDuration(t, ms) {
      if (!Number.isFinite(ms) || ms <= 0) return t("duration.reset");
      const totalMin = Math.floor(ms / 60000);
      if (totalMin < 60) return `${totalMin}m`;
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
      const d = Math.floor(h / 24);
      const rh = h % 24;
      return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
    }

    /** The short number shown in the header button; "" when the payload has none. */
    function usageHeadline(value) {
      const data = value?.data ?? {};
      const credits = data.credits;
      if (credits !== undefined && credits !== null && Number.isFinite(Number(credits.totalRemaining))) {
        return `$${Number(credits.totalRemaining).toFixed(2)}`;
      }
      const wallets = Array.isArray(data.wallets) ? data.wallets : [];
      if (wallets.length > 0) {
        const wallet = wallets[0] ?? {};
        return `${String(wallet.currency ?? "")}${Number(wallet.balance ?? 0).toFixed(2)}`;
      }
      const rows = Array.isArray(data.rows) ? data.rows : [];
      const row = rows.find((entry) => typeof entry?.label === "string"
        && (entry.label.includes("剩余") || entry.label.includes("余额")));
      if (row !== undefined && row !== null && row.value !== undefined) return String(row.value);
      const infos = Array.isArray(data.balance_infos)
        ? data.balance_infos
        : Array.isArray(data.raw?.balance_infos) ? data.raw.balance_infos : [];
      if (infos.length > 0) {
        const info = infos[0] ?? {};
        return `${String(info.currency ?? "")}${String(info.total_balance ?? info.totalBalance ?? "")}`;
      }
      const window = (Array.isArray(data.windows) ? data.windows : [])[0];
      if (window !== undefined && window !== null && Number(window.limit) > 0) {
        return `${Math.round((Number(window.used ?? 0) / Number(window.limit)) * 100)}%`;
      }
      return "";
    }

    /** Label/value lines for the header button's hover card. */
    function usageHoverItems(t, value, now) {
      if (value === null || value === undefined) return [];
      const data = value.data ?? {};
      const items = [];
      const rows = Array.isArray(data.rows) ? data.rows : [];
      for (const row of rows.slice(0, 4)) items.push([String(row?.label ?? ""), String(row?.value ?? "")]);
      const windows = Array.isArray(data.windows) ? data.windows : [];
      for (const window of windows.slice(0, 3)) {
        const used = Number(window?.used ?? 0);
        const limit = Number(window?.limit ?? 0);
        const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
        const reset = Number(window?.resetsAt ?? 0) > now ? formatDuration(t, Number(window.resetsAt) - now) : "";
        items.push([
          String(window?.label ?? t("card.windowFallback")),
          reset === "" ? `${percent}%` : `${percent}% · ${reset}`,
        ]);
      }
      if (rows.length === 0 && data.credits) {
        items.push([t("card.credits"), `$${Number(data.credits.totalRemaining ?? 0).toFixed(2)}`]);
        items.push([t("card.spent"), `$${Number(data.credits.totalSpent ?? 0).toFixed(2)}`]);
      }
      for (const wallet of (Array.isArray(data.wallets) ? data.wallets : []).slice(0, 2)) {
        items.push([String(wallet?.currency ?? ""), String(wallet?.balance ?? "")]);
      }
      const infos = Array.isArray(data.balance_infos)
        ? data.balance_infos
        : Array.isArray(data.raw?.balance_infos) ? data.raw.balance_infos : [];
      for (const info of infos.slice(0, 2)) {
        items.push([String(info?.currency ?? ""), String(info?.total_balance ?? info?.totalBalance ?? "")]);
      }
      return items.slice(0, 6);
    }

    /** One rolling-window meter: label, used/cap, percentage bar, reset countdown. */
    function CcWindowMeter({ label, used, cap, resetAt, now, t }) {
      const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
      const barClass = pct >= 90 ? "dsh-usage-cc-bar-fill-danger"
        : pct >= 70 ? "dsh-usage-cc-bar-fill-warn"
        : "dsh-usage-cc-bar-fill";
      const resetIn = resetAt > 0 ? resetAt - now : 0;
      return React.createElement("div", { className: "dsh-usage-cc-window" },
        React.createElement("div", { className: "dsh-usage-cc-window-head" },
          React.createElement("span", null, label),
          React.createElement("span", { className: "dsh-usage-cc-window-val" },
            `$${used.toFixed(2)} / $${cap.toFixed(2)}`),
        ),
        React.createElement("div", { className: "dsh-usage-cc-bar" },
          React.createElement("div", { className: barClass, style: { width: `${pct}%` } }),
        ),
        React.createElement("div", { className: "dsh-usage-cc-reset" },
          resetIn > 0
            ? fill(t("window.usedReset"), { percent: Math.round(pct), duration: formatDuration(t, resetIn) })
            : t("window.reset")),
      );
    }

    /** Command Code route: plan windows + credits, normalized by the host. */
    function CommandCodeCard({ data, t }) {
      const d = data.data;
      const windows = d.windows;
      const credits = d.credits;
      const now = typeof d.now === "number" ? d.now : Date.now();
      const cycleEnd = typeof d.cycleEnd === "number" && d.cycleEnd > 0
        ? new Date(d.cycleEnd).toLocaleDateString()
        : null;
      return React.createElement("div", { className: "dsh-usage-balance-card" },
        React.createElement("div", { className: "dsh-usage-balance-card-title" },
          String(d.planName),
          React.createElement("span", { className: "dsh-usage-balance-status" },
            d.status === "active" ? t("card.subscribed") : String(d.status ?? "")),
        ),
        windows !== null && windows.limited
          ? React.createElement("div", { className: "dsh-usage-stack" },
              windows.fiveHour !== null && windows.fiveHour.cap > 0
                ? React.createElement(CcWindowMeter, { label: t("window.fiveHour"), ...windows.fiveHour, now, t })
                : null,
              windows.weekly !== null && windows.weekly.cap > 0
                ? React.createElement(CcWindowMeter, { label: t("window.weekly"), ...windows.weekly, now, t })
                : null,
            )
          : row(t("card.windowLimit"), t("card.notApplicable"), "cc-window"),
        React.createElement("div", { className: "dsh-usage-stack" },
          row(t("card.credits"), `$${(credits.totalRemaining ?? 0).toFixed(2)}`, "cc-total"),
          row(t("card.monthlyRemaining"), `$${(credits.monthlyRemaining ?? 0).toFixed(2)}`, "cc-monthly"),
          row(t("card.spent"), `$${(credits.totalSpent ?? 0).toFixed(2)}`, "cc-spent"),
          row(t("card.requests"), String(credits.totalCount ?? 0), "cc-count"),
          d.account !== null && d.account !== undefined ? row(t("card.account"), String(d.account), "cc-account") : null,
          cycleEnd !== null ? row(t("card.cycleEnd"), cycleEnd, "cc-cycle") : null,
        ),
      );
    }

    function dateInputValue(value) {
      const date = new Date(value);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    function localDateStart(value) {
      const [year, month, day] = String(value).split("-").map(Number);
      return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
        ? new Date(year, month - 1, day).getTime()
        : NaN;
    }

    function BalanceHistory({ points, range, customRange, appliedCustomRange, selectedMonth, onRange, onCustomRange, onApplyCustomRange, onSelectMonth, onClearMonth, onReset, t }) {
      const [expanded, setExpanded] = React.useState(false);
      const [pointsOnly, setPointsOnly] = React.useState(false);
      const now = Date.now();
      const todayStart = new Date(new Date(now).setHours(0, 0, 0, 0)).getTime();
      let start = todayStart;
      let end = todayStart + 24 * 60 * 60 * 1000;
      let daily = false;
      if (range === "yesterday") {
        start -= 24 * 60 * 60 * 1000;
        end -= 24 * 60 * 60 * 1000;
      } else if (range === "week") {
        start -= 6 * 24 * 60 * 60 * 1000;
        daily = true;
      } else if (range === "month") {
        start -= 29 * 24 * 60 * 60 * 1000;
        daily = true;
      } else if (range === "custom") {
        const customStart = localDateStart(appliedCustomRange.start);
        const customEnd = localDateStart(appliedCustomRange.end);
        if (Number.isFinite(customStart) && Number.isFinite(customEnd) && customEnd >= customStart) {
          start = customStart;
          end = customEnd + 24 * 60 * 60 * 1000;
          daily = end - start >= 7 * 24 * 60 * 60 * 1000;
        }
      }
      const rawVisible = points.filter((point) => point.spend !== null && point.at >= start && point.at < end);
      let visible = rawVisible;
      if (daily) {
        const buckets = new Map();
        for (const point of rawVisible) {
          const date = new Date(point.at);
          const bucket = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
          buckets.set(bucket, (buckets.get(bucket) ?? 0) + point.spend);
        }
        visible = [...buckets.entries()].map(([at, spend]) => ({ at: at + 12 * 60 * 60 * 1000, spend })).sort((a, b) => a.at - b.at);
      }
      const maxSpend = Math.max(0.01, ...visible.map((point) => point.spend));
      const chartPoints = visible.map((point) => ({
        x: 42 + Math.max(0, Math.min(1, (point.at - start) / (end - start))) * 306,
        y: 104 - (point.spend / maxSpend) * 78,
        point,
      }));
      const sum = visible.reduce((total, point) => total + point.spend, 0);
      const span = end - start;
      const tickCount = span <= 2 * 24 * 60 * 60 * 1000 ? 7 : span <= 8 * 24 * 60 * 60 * 1000 ? 8 : 7;
      const tickLabel = (value) => span <= 2 * 24 * 60 * 60 * 1000
        ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : new Date(value).toLocaleDateString([], { month: "2-digit", day: "2-digit" });
      const children = [];
      for (let index = 0; index < tickCount; index += 1) {
        const ratio = index / (tickCount - 1);
        const x = 42 + ratio * 306;
        const value = start + ratio * span;
        children.push(
          React.createElement("line", { key: `grid-${index}`, x1: x, x2: x, y1: 26, y2: 104, stroke: "var(--dsw-alias-border-l2)", strokeWidth: 1, strokeOpacity: 0.65, strokeDasharray: "2 4" }),
          React.createElement("text", { key: `tick-${index}`, x, y: 126, textAnchor: index === 0 ? "start" : index === tickCount - 1 ? "end" : "middle", fill: "var(--dsw-alias-label-secondary)", fontSize: 10 }, tickLabel(value)),
        );
      }
      for (let index = 0; index <= 4; index += 1) {
        const ratio = index / 4;
        const y = 104 - ratio * 78;
        children.push(
          React.createElement("line", { key: `amount-grid-${index}`, x1: 42, x2: 348, y1: y, y2: y, stroke: "var(--dsw-alias-border-l2)", strokeWidth: 1, strokeOpacity: 0.9 }),
          React.createElement("text", { key: `amount-${index}`, x: 36, y: y + 3, textAnchor: "end", fill: "var(--dsw-alias-label-secondary)", fontSize: 9 }, `$${(maxSpend * ratio).toFixed(2)}`),
        );
      }
      if (chartPoints.length > 0) {
        if (!pointsOnly) children.push(React.createElement("polyline", {
          key: "line", points: chartPoints.map(({ x, y }) => `${x},${y}`).join(" "), fill: "none",
          stroke: "var(--dsw-alias-state-success-primary)", strokeWidth: 1.35,
          vectorEffect: "non-scaling-stroke", strokeLinecap: "round", strokeLinejoin: "round",
        }));
        chartPoints.forEach(({ x, y, point }, index) => children.push(
          React.createElement("g", { key: `point-${index}` },
            React.createElement("circle", {
              cx: x, cy: y, r: 1.8,
              fill: "var(--dsw-alias-state-success-primary)",
              stroke: "var(--dsw-alias-bg-layer-1)", strokeWidth: 1.4,
              vectorEffect: "non-scaling-stroke",
            }),
            React.createElement("title", null, `${new Date(point.at).toLocaleString()} · $${point.spend.toFixed(2)}`),
          ),
        ));
      }
      const months = storedMonths(points);
      const activeMonth = months.includes(selectedMonth) ? selectedMonth : (months[0] ?? "");
      const rangeControls = React.createElement("div", { className: "dsh-usage-history-controls" },
        React.createElement("div", { className: "dsh-usage-history-ranges" }, HISTORY_RANGES.map((item) =>
          React.createElement("button", { key: item, type: "button", className: "dsh-usage-mode-btn" + (range === item ? " dsh-usage-mode-btn-active" : ""), onClick: () => onRange(item) }, t(`history.range.${item}`)))),
        React.createElement("label", { className: "dsh-usage-history-points-toggle" },
          React.createElement("input", {
            type: "checkbox",
            role: "switch",
            checked: pointsOnly,
            onChange: (event) => setPointsOnly(event.target.checked),
            "aria-label": t("history.pointsOnly"),
          }),
          t("history.pointsOnly"),
        ),
      );
      const customRangeForm = range === "custom"
        ? React.createElement("div", { className: "dsh-usage-history-form" },
            React.createElement("label", { className: "dsh-usage-history-date" }, t("history.start"), React.createElement("input", { type: "date", value: customRange.start, onChange: (event) => onCustomRange({ ...customRange, start: event.target.value }) })),
            React.createElement("label", { className: "dsh-usage-history-date" }, t("history.end"), React.createElement("input", { type: "date", value: customRange.end, onChange: (event) => onCustomRange({ ...customRange, end: event.target.value }) })),
            React.createElement(ActionButton, { variant: "outline", onClick: onApplyCustomRange }, t("history.apply")),
          )
        : null;
      const chart = (className) => React.createElement("svg", {
        className,
        viewBox: "0 0 360 132",
        preserveAspectRatio: "xMidYMid meet",
        role: "img",
        "aria-label": t("history.title"),
      }, children);
      return React.createElement("div", { className: "dsh-usage-balance-card dsh-usage-history" },
        React.createElement("div", { className: "dsh-usage-history-head" },
          React.createElement("span", { className: "dsh-usage-history-title" }, t("history.title")),
          visible.length > 0 ? React.createElement("span", { className: "dsh-usage-balance-status" }, `${t("history.amount")} $${sum.toFixed(2)}`) : null,
        ),
        rangeControls,
        customRangeForm,
        visible.length > 0
          ? React.createElement("button", {
              type: "button",
              className: "dsh-usage-history-chart-trigger",
              title: t("history.expand"),
              "aria-label": t("history.expand"),
              onClick: () => setExpanded(true),
            }, chart("dsh-usage-history-chart"))
          : React.createElement("div", { className: "dsh-usage-history-empty" }, t("history.empty")),
        React.createElement("div", { className: "dsh-usage-history-manage" },
          React.createElement("span", { className: "dsh-usage-history-title" }, t("history.month")),
          months.length > 0
            ? React.createElement("select", { className: "dsh-usage-history-month", value: activeMonth, onChange: (event) => onSelectMonth(event.target.value) }, months.map((month) => React.createElement("option", { key: month, value: month }, month)))
            : React.createElement("span", { className: "dsh-usage-history-empty" }, t("history.noMonths")),
          months.length > 0 ? React.createElement(ActionButton, { variant: "ghost", onClick: () => onClearMonth(activeMonth) }, t("history.clearMonth")) : null,
          React.createElement(ActionButton, { variant: "ghost", onClick: onReset }, t("history.reset")),
        ),
        React.createElement(UsageModal, {
          open: expanded,
          onClose: () => setExpanded(false),
          title: t("history.title"),
          closeLabel: t("action.close"),
          className: "dsh-usage-history-fullscreen-dialog",
          overlayClassName: "dsh-usage-history-fullscreen-overlay",
        },
          React.createElement("div", { className: "dsh-usage-history-fullscreen-content" },
            rangeControls,
            customRangeForm,
            React.createElement("span", { className: "dsh-usage-balance-status" }, `${t("history.amount")} $${sum.toFixed(2)}`),
            visible.length > 0 ? chart("dsh-usage-history-chart") : React.createElement("div", { className: "dsh-usage-history-empty" }, t("history.empty")),
          ),
        ),
      );
    }

    /** Official DeepSeek route: one card per currency, 余额 only. */
    function DeepSeekCard({ data, t }) {
      const infos = Array.isArray(data.data.balance_infos) ? data.data.balance_infos : [];
      if (infos.length === 0) {
        return React.createElement("div", { className: "dsh-usage-balance-card" },
          row(t("card.balance"), t("card.balanceEmpty"), "balance-empty"));
      }
      return React.createElement("div", { className: "dsh-usage-stack" },
        infos.map((info) => React.createElement(
          "div",
          { key: info.currency, className: "dsh-usage-balance-card" },
          React.createElement("div", { className: "dsh-usage-balance-card-title" },
            currencyName(t, info.currency),
            React.createElement("span", { className: "dsh-usage-balance-status" },
              data.data.is_available === true ? t("card.available") : t("card.unavailable")),
          ),
          row(t("card.balance"), currencySymbol(info.currency) + String(info.total_balance), "balance"),
        )));
    }

    /** DeepSeek account route: platform wallets (recharge + bonus). */
    function DeepSeekAccountCard({ data, t }) {
      const wallets = Array.isArray(data.data.wallets) ? data.data.wallets : [];
      return React.createElement("div", { className: "dsh-usage-balance-card" },
        React.createElement("div", { className: "dsh-usage-balance-card-title" }, t("card.deepseekAccount")),
        wallets.length === 0
          ? row(t("card.balance"), t("card.noWallet"), "account-empty")
          : React.createElement("div", { className: "dsh-usage-stack" },
              wallets.map((wallet, index) => row(
                currencyName(t, wallet.currency),
                currencySymbol(wallet.currency) + String(wallet.balance),
                `wallet-${index}`,
              ))),
      );
    }

    /**
     * Generic provider card for the adapters that normalize to the same two
     * building blocks: `windows` (used / limit / reset meters — OpenCode Go's
     * 5h / weekly / monthly allowances) and `rows` (label → value lines —
     * OpenRouter credits, Moonshot and SiliconFlow balances).
     *
     * Whatever the endpoint returned rides along as `raw` behind a toggle: the
     * OpenCode Go payload is not publicly documented, so an unrecognized field
     * stays visible instead of turning into an empty card.
     */
    function UsageRowsCard({ data, t, showRawOption }) {
      const [showRaw, setShowRaw] = React.useState(false);
      const d = data.data;
      const windows = Array.isArray(d.windows) ? d.windows : [];
      const models = Array.isArray(d.models) ? d.models : [];
      const rows = Array.isArray(d.rows) ? d.rows : [];
      const now = typeof d.now === "number" ? d.now : Date.now();
      const recognized = windows.length > 0 || models.length > 0 || rows.length > 0;
      const money = (value) => (value === null || value === undefined ? "—" : `$${Number(value).toFixed(2)}`);
      return React.createElement("div", { className: "dsh-usage-balance-card" },
        React.createElement("div", { className: "dsh-usage-balance-card-title" },
          String(data.providerName ?? data.provider)),
        windows.length > 0
          ? React.createElement("div", { className: "dsh-usage-stack" },
              windows.map((w, i) => React.createElement(CcWindowMeter, {
                key: `w-${i}`,
                label: String(w.label ?? t("card.windowFallback")),
                used: Number(w.used ?? 0),
                cap: Number(w.limit ?? 0),
                resetAt: Number(w.resetsAt ?? 0),
                now,
                t,
              })))
          : null,
        rows.length > 0
          ? React.createElement("div", { className: "dsh-usage-stack" },
              rows.map((entry, i) => row(String(entry.label), String(entry.value), `r-${i}`)))
          : null,
        models.length > 0
          ? React.createElement("div", { className: "dsh-usage-stack" },
              models.slice(0, 12).map((entry, i) => row(
                String(entry.model),
                entry.limit === null || entry.limit === undefined
                  ? money(entry.used)
                  : `${money(entry.used)} / ${money(entry.limit)}`,
                `m-${i}`,
              )))
          : null,
        !recognized
          ? React.createElement("div", { className: "dsh-usage-hint" }, t("card.unrecognized"))
          : null,
        showRawOption !== true || d.raw === undefined || d.raw === null
          ? null
          : React.createElement("div", { className: "dsh-usage-stack" },
              React.createElement("div", { className: "dsh-usage-provider-toggle" },
                React.createElement("button", {
                  type: "button",
                  className: "dsh-usage-chip",
                  onClick: () => { setShowRaw(!showRaw); },
                }, showRaw ? t("card.hideRaw") : t("card.raw"))),
              showRaw ? React.createElement("div", { className: "dsh-usage-raw" }, rawJson(d.raw)) : null),
      );
    }

    /** Compact one-line JSON for the raw-payload toggle. */
    function rawJson(value) {
      let text;
      try {
        text = JSON.stringify(value);
      } catch {
        text = String(value);
      }
      if (typeof text !== "string") text = String(text);
      return text.length > 900 ? `${text.slice(0, 900)}…` : text;
    }

    /** New API route: quota / used / total, normalized by the host. */
    function NewApiCard({ data, t }) {
      const d = data.data;
      const symbol = unitSymbol(d.unit);
      return React.createElement("div", { className: "dsh-usage-balance-card" },
        React.createElement("div", { className: "dsh-usage-balance-card-title" }, String(d.planName)),
        d.account !== null && d.account !== undefined && d.account !== ""
          ? row(t("card.account"), String(d.account), "newapi-account")
          : null,
        row(t("card.balance"), symbol + String(d.remaining), "remaining"),
        row(t("card.used"), symbol + String(d.used), "used"),
        row(t("card.total"), symbol + String(d.total), "total"),
        d.totalCount !== null && d.totalCount !== undefined
          ? row(t("card.requests"), String(d.totalCount), "newapi-requests")
          : null,
      );
    }

    /**
     * The model, provider and credential REFERENCE the numbers came from — the
     * answer to "which key was this queried with", never the key itself.
     */
    function UsageMeta({ data, t }) {
      const credential = data.credential;
      const usageUrl = data.data?.usageUrl;
      return React.createElement("div", { className: "dsh-usage-meta" },
        React.createElement("div", { className: "dsh-usage-meta-row" },
          React.createElement("span", { className: "dsh-usage-meta-key" }, t("meta.model")),
          React.createElement("span", { className: "dsh-usage-meta-val" },
            `${data.providerName ?? data.provider} / ${data.model}${data.reasoningEffort ? ` · ${data.reasoningEffort}` : ""}`),
        ),
        credential !== null && credential !== undefined
          ? React.createElement("div", { className: "dsh-usage-meta-row" },
              React.createElement("span", { className: "dsh-usage-meta-key" }, t("meta.credential")),
              React.createElement("span", { className: "dsh-usage-meta-val" },
                `${credential.ref}${credential.source ? ` · ${credential.source}` : ""}`),
            )
          : React.createElement("div", { className: "dsh-usage-meta-row" },
              React.createElement("span", { className: "dsh-usage-meta-key" }, t("meta.credential")),
              React.createElement("span", { className: "dsh-usage-meta-val" }, t("meta.accountLogin")),
            ),
        typeof usageUrl === "string" && usageUrl !== ""
          ? React.createElement("div", { className: "dsh-usage-meta-row" },
              React.createElement("span", { className: "dsh-usage-meta-key" }, t("meta.usageUrl")),
              React.createElement("span", { className: "dsh-usage-meta-val" }, usageUrl),
            )
          : null,
      );
    }

    function UsageBalance({ data, history, historyRange, customRange, appliedCustomRange, selectedMonth, onHistoryRange, onCustomRange, onApplyCustomRange, onSelectMonth, onClearMonth, onResetHistory, onRefresh, display, t }) {
      let card;
      if (data.mode === "commandcode") card = React.createElement(CommandCodeCard, { data, t });
      else if (data.mode === "newapi") card = React.createElement(NewApiCard, { data, t });
      else if (data.mode === "deepseek-account") card = React.createElement(DeepSeekAccountCard, { data, t });
      else if (data.mode === "opencode-go" || data.mode === "openrouter"
          || data.mode === "moonshot" || data.mode === "siliconflow") {
        card = React.createElement(UsageRowsCard, { data, t, showRawOption: display.raw });
      } else card = React.createElement(DeepSeekCard, { data, t });
      return React.createElement("div", { className: "dsh-usage-stack" },
        card,
        display.history && data.mode === "commandcode"
          ? React.createElement(BalanceHistory, {
              points: history, range: historyRange, onRange: onHistoryRange, t,
              customRange, appliedCustomRange, selectedMonth, onCustomRange, onApplyCustomRange, onSelectMonth,
              onClearMonth, onReset: onResetHistory,
            })
          : null,
        display.meta ? React.createElement(UsageMeta, { data, t }) : null,
        display.refresh && !display.status ? React.createElement("div", { className: "dsh-usage-refresh" },
          React.createElement(ActionButton, { variant: "ghost", onClick: onRefresh }, t("action.refresh")),
        ) : null,
      );
    }

    /**
     * Refresh status: how old the numbers on screen are, whether a query is in
     * flight, and the two controls (auto-refresh toggle, interval settings).
     * While a refresh runs over existing numbers the age stays visible, so the
     * panel never blanks out to a spinner.
     *
     * The line is deliberately ONE line that never re-flows: the dialog is
     * vertically centred, so a status text that wrapped while a background
     * refresh swapped it would move the whole panel under the reader.
     */
    function RefreshStatus({ view, config, now, onToggleAuto, onOpenSettings, onRefresh, showRefresh, t }) {
      const age = view.updatedAt > 0 ? now - view.updatedAt : null;
      const label = age === null ? null : formatAge(t, age);
      const stale = !view.refreshing && age !== null && age > config.intervalMs;
      let text;
      if (view.refreshing) {
        text = label === null
          ? t("status.refreshing")
          : fill(t("status.refreshingAge"), { age: label });
      } else if (label === null) text = t("status.never");
      else {
        text = fill(t("status.updated"), { age: label })
          + (stale ? fill(t("status.stale"), { interval: minutesLabel(t, config.intervalMs) }) : "");
      }
      return React.createElement("div", { className: "dsh-usage-status-bar" },
        React.createElement("div", { className: "dsh-usage-status" },
          view.refreshing ? React.createElement("span", { className: "dsh-usage-spinner" }) : null,
          React.createElement("span", { className: "dsh-usage-status-text", title: text }, text),
          showRefresh ? React.createElement(ActionButton, {
            variant: "ghost",
            className: "dsh-usage-status-refresh",
            onClick: () => { onRefresh(); },
            disabled: view.refreshing,
            title: t("action.refresh"),
            "aria-label": t("action.refresh"),
          }, React.createElement("svg", {
            viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
            strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
            "aria-hidden": "true", focusable: "false",
          },
            React.createElement("path", { d: "M20 7v5h-5" }),
            React.createElement("path", { d: "M20 12a8 8 0 1 0-2.34 5.66M20 12l-3-3" }),
          )) : null,
        ),
        React.createElement("div", { className: "dsh-usage-status-actions" },
          React.createElement("button", {
            type: "button",
            className: "dsh-usage-chip" + (config.auto ? " dsh-usage-chip-active" : ""),
            onClick: onToggleAuto,
            title: config.auto
              ? fill(t("status.autoTooltipOn"), { interval: minutesLabel(t, config.intervalMs) })
              : t("status.autoTooltipOff"),
          }, config.auto ? t("status.autoOn") : t("status.autoOff")),
          React.createElement("button", {
            type: "button",
            className: "dsh-usage-chip",
            onClick: onOpenSettings,
          }, t("status.settings")),
        ),
      );
    }

    /** 刷新设置 form: the auto-refresh switch, preset intervals, and a custom one. */
    function RefreshSettings({ form, onChange, t }) {
      const set = (patch) => onChange({ ...form, ...patch });
      const chip = (label, active, onClick, key) => React.createElement("button", {
        key: key ?? label,
        type: "button",
        className: "dsh-usage-mode-btn" + (active ? " dsh-usage-mode-btn-active" : ""),
        onClick,
      }, label);
      const minutes = Number(form.minutes);
      const valid = Number.isFinite(minutes) && minutes >= 1 && minutes <= 1440;
      return React.createElement("div", { className: "dsh-usage-form" },
        React.createElement("div", { className: "dsh-usage-field" },
          React.createElement("span", { className: "dsh-usage-field-label" }, t("settings.autoLabel")),
          React.createElement("div", { className: "dsh-usage-mode-toggle" },
            chip(t("settings.on"), form.auto === true, () => set({ auto: true })),
            chip(t("settings.off"), form.auto === false, () => set({ auto: false })),
          ),
          React.createElement("span", { className: "dsh-usage-hint" }, t("settings.autoHint")),
        ),
        React.createElement("div", { className: "dsh-usage-field" },
          React.createElement("span", { className: "dsh-usage-field-label" }, t("settings.interval")),
          React.createElement("div", { className: "dsh-usage-mode-toggle" },
            INTERVAL_PRESETS.map((value) => chip(
              fill(t("minutes.value"), { count: value }),
              Number(form.minutes) === value,
              () => set({ minutes: String(value) }),
              `preset-${value}`,
            )),
          ),
          React.createElement("input", {
            className: "dsh-usage-input",
            type: "number",
            min: 1,
            max: 1440,
            step: 1,
            value: form.minutes,
            "aria-label": t("settings.interval"),
            onChange: (event) => set({ minutes: event.target.value }),
          }),
          React.createElement("span", { className: "dsh-usage-hint" },
            valid ? t("settings.customHint") : t("settings.customInvalid")),
        ),
        React.createElement("span", { className: "dsh-usage-hint" }, t("settings.staleHint")),
      );
    }

    /**
     * Read the current conversation's model selection. The host always passes
     * `useProjection` for Session slots; the guard keeps the panel alive in a
     * composition that omits it. The wire view is `{ lastUsed, next }`, where
     * `next` already resolves a pending pick over the last used route.
     */
    function useModelSelection(props) {
      const useProjection = props.useProjection;
      const projected = typeof useProjection === "function" ? useProjection("modelSelection") : undefined;
      return projected?.next ?? projected?.lastUsed ?? null;
    }

    /**
     * The 说明 dialog: which provider routes exist and whether each key is set.
     * A deployment can declare dozens of routes (`llm-pi-ai` ships a whole
     * catalog), so the ones that matter — routes with a usage API or a
     * configured key — come first, and the rest wait behind a toggle.
     */
    function ProviderInfo({ providers, t }) {
      const [expanded, setExpanded] = React.useState(false);
      if (providers === null) {
        return React.createElement("div", { className: "dsh-usage-state" }, t("state.loading"));
      }
      if (providers.length === 0) {
        return React.createElement("div", { className: "dsh-usage-state" }, t("providers.none"));
      }
      // A template saved in this browser's settings page grants a route usage
      // support even when the host reports no built-in adapter for it.
      const templates = readTemplates();
      const kindOfEntry = (entry) => (entry.kind !== null
        ? entry.kind
        : templates[entry.provider] !== undefined ? "template" : null);
      const rank = (entry) => (kindOfEntry(entry) !== null ? 0 : entry.configured ? 1 : 2);
      const sorted = [...providers].sort((left, right) => rank(left) - rank(right)
        || String(left.displayName).localeCompare(String(right.displayName)));
      const relevant = sorted.filter((entry) => kindOfEntry(entry) !== null || entry.configured === true);
      const visible = expanded ? sorted : relevant;
      const hidden = sorted.length - visible.length;
      const supported = sorted.filter((entry) => kindOfEntry(entry) !== null).length;
      const configured = sorted.filter((entry) => entry.configured === true).length;
      return React.createElement("div", { className: "dsh-usage-stack" },
        React.createElement("div", { className: "dsh-usage-hint" },
          fill(t("providers.summary"), { total: sorted.length, configured, supported })),
        React.createElement("div", { className: "dsh-usage-provider-list" },
          visible.map((entry) => React.createElement("div", {
            key: entry.provider,
            className: "dsh-usage-provider-row",
          },
            React.createElement("div", { className: "dsh-usage-provider-head" },
              React.createElement("span", null, String(entry.displayName)),
              React.createElement("span", { className: "dsh-usage-balance-status" },
                kindOfEntry(entry) === null
                  ? (entry.configured ? t("providers.configuredUnsupported") : t("kind.none"))
                  : (entry.configured ? t("providers.keyConfigured") : t("providers.keyMissing"))),
            ),
            React.createElement("div", { className: "dsh-usage-provider-meta" },
              `${entry.provider} · ${kindLabel(t, kindOfEntry(entry), entry.kindLabel)}${entry.credentialRef ? ` · ${entry.credentialRef}` : ""}${
                templates[entry.provider] !== undefined ? ` · ${t("templates.local")}` : ""
              }`),
            entry.baseUrl !== null && entry.baseUrl !== undefined
              ? React.createElement("div", { className: "dsh-usage-provider-meta" }, String(entry.baseUrl))
              : null,
          ))),
        hidden > 0 || expanded
          ? React.createElement("div", { className: "dsh-usage-provider-toggle" },
              React.createElement("button", {
                type: "button",
                className: "dsh-usage-chip",
                onClick: () => { setExpanded(!expanded); },
              }, expanded ? t("providers.collapse") : fill(t("providers.expand"), { count: hidden })))
          : null,
      );
    }

    /**
     * The query-target row: which route the numbers belong to, and the manual
     * override that can point the panel somewhere other than the conversation.
     */
    function ModelBar({ override, effective, onOpen, t }) {
      const route = (selection) => override !== null
        ? `${selection.provider}${selection.model ? ` / ${selection.model}` : ""}`
        : "";
      const label = override !== null
        ? route(override)
        : (effective === null
            ? t("modelbar.auto")
            : fill(t("modelbar.autoRoute"), {
                route: `${effective.provider}${effective.model ? ` / ${effective.model}` : ""}`,
              }));
      return React.createElement("div", { className: "dsh-usage-modelbar" },
        React.createElement("span", { className: "dsh-usage-modelbar-label" }, t("modelbar.label")),
        React.createElement("button", {
          type: "button",
          className: "dsh-usage-chip" + (override === null ? "" : " dsh-usage-chip-active"),
          title: override === null ? t("modelbar.titleAuto") : t("modelbar.titleManual"),
          onClick: onOpen,
        }, React.createElement("span", { className: "dsh-usage-chip-text" }, label)),
      );
    }

    /**
     * The 选择模型 dialog: 自动 (follow the conversation) plus every routable
     * route, so usage can be checked for a provider the conversation is not on.
     */
    function ModelPicker({ catalog, override, onAuto, onPick, t }) {
      if (catalog === null) {
        return React.createElement("div", { className: "dsh-usage-state" }, t("state.loading"));
      }
      const groups = Array.isArray(catalog.groups) ? catalog.groups : [];
      const head = React.createElement("div", { className: "dsh-usage-stack" },
        React.createElement("button", {
          type: "button",
          className: "dsh-usage-mode-btn" + (override === null ? " dsh-usage-mode-btn-active" : ""),
          onClick: onAuto,
        }, t("picker.auto")),
        catalog.default === null || catalog.default === undefined
          ? null
          : React.createElement("div", { className: "dsh-usage-hint" },
              fill(t("picker.default"), {
                route: `${catalog.default.provider}${catalog.default.model ? ` / ${catalog.default.model}` : ""}`,
              })),
      );
      if (groups.length === 0) {
        return React.createElement("div", { className: "dsh-usage-stack" }, head,
          React.createElement("div", { className: "dsh-usage-state" }, t("picker.empty")));
      }
      return React.createElement("div", { className: "dsh-usage-stack" }, head,
        groups.map((group) => React.createElement("div", {
          key: group.provider,
          className: "dsh-usage-balance-card",
        },
          React.createElement("div", { className: "dsh-usage-balance-card-title" },
            String(group.name),
            React.createElement("span", { className: "dsh-usage-balance-status" },
              kindLabel(t, group.kind, group.kindLabel))),
          React.createElement("div", { className: "dsh-usage-mode-toggle" },
            group.models.map((model) => React.createElement("button", {
              key: model.id,
              type: "button",
              className: "dsh-usage-mode-btn"
                + (override !== null && override.provider === group.provider && override.model === model.id
                  ? " dsh-usage-mode-btn-active"
                  : ""),
              title: model.id,
              onClick: () => { onPick(group.provider, model.id); },
            }, React.createElement("span", { className: "dsh-usage-chip-text" }, String(model.name))))),
        )));
    }

    function UsageAction(props) {
      const { fetchBalance, fetchProviders, fetchModels } = props;
      // The slot passes the bound translate function; a composition that does
      // not mount the locale service still renders the Chinese source text
      // instead of blanking the cell.
      const t = typeof props.t === "function" ? props.t : (key) => (zh[key] ?? key);
      const selection = useModelSelection(props);
      // A manual override outranks the conversation: the panel can inspect any
      // routable route without switching what the conversation runs on.
      const [override, setOverride] = React.useState(readModelOverride);
      const effective = override ?? selection;
      const provider = effective?.provider ?? null;
      const model = effective?.model ?? null;
      const effort = override === null ? (selection?.reasoningEffort ?? null) : null;
      const sessionId = props.sessionId === undefined ? null : String(props.sessionId);
      // The sidebar ticker shows this conversation's route; leaving the
      // conversation clears it so a stale provider cannot stay on screen.
      React.useEffect(() => {
        publishActiveRoute(provider !== null && model !== null ? { provider, model } : null);
        return () => { publishActiveRoute(null); };
      }, [provider, model]);
      const [open, setOpen] = React.useState(false);
      const buttonRef = React.useRef(null);
      const [hoverAt, setHoverAt] = React.useState(null);
      const [pickerOpen, setPickerOpen] = React.useState(false);
      const [catalog, setCatalog] = React.useState(null);
      const [infoOpen, setInfoOpen] = React.useState(false);
      const [settingsOpen, setSettingsOpen] = React.useState(false);
      const [display, setDisplay] = React.useState(readDisplayOptions);
      const [providers, setProviders] = React.useState(null);
      const [dialogError, setDialogError] = React.useState("");
      const [config, setConfig] = React.useState(readRefreshConfig);
      const [form, setForm] = React.useState({ auto: true, minutes: "5" });
      const [view, setView] = React.useState({ refreshing: false, data: null, error: "", updatedAt: 0 });
      const [history, setHistory] = React.useState([]);
      const [historyRange, setHistoryRange] = React.useState("today");
      const [customRange, setCustomRange] = React.useState(() => ({
        start: dateInputValue(Date.now() - 6 * 24 * 60 * 60 * 1000),
        end: dateInputValue(Date.now()),
      }));
      const [appliedCustomRange, setAppliedCustomRange] = React.useState(() => ({
        start: dateInputValue(Date.now() - 6 * 24 * 60 * 60 * 1000),
        end: dateInputValue(Date.now()),
      }));
      const [selectedMonth, setSelectedMonth] = React.useState("");
      const [, forceRender] = React.useState(0);
      const viewRef = React.useRef(view);
      const inFlight = React.useRef(false);
      const samplePending = React.useRef(false);
      const generation = React.useRef(0);
      viewRef.current = view;

      React.useEffect(() => {
        const sync = (event) => setDisplay(event?.detail ?? readDisplayOptions());
        window.addEventListener(DISPLAY_EVENT, sync);
        return () => window.removeEventListener(DISPLAY_EVENT, sync);
      }, []);

      /** One usage query; concurrent calls collapse into the first one. */
      const refresh = React.useCallback((sample = false) => {
        if (inFlight.current) {
          if (sample) samplePending.current = true;
          return;
        }
        inFlight.current = true;
        const gen = generation.current;
        // A missing host route binding is reported in the panel, never thrown:
        // a throwing cell would blank the whole slot entry.
        if (typeof fetchBalance !== "function") {
          inFlight.current = false;
          setView((s) => ({ ...s, refreshing: false, error: t("state.noHost") }));
          return;
        }
        setView((s) => ({ ...s, refreshing: true, error: "" }));
        fetchBalance({ provider, model, effort, sessionId })
          .then((result) => {
            // A model switch bumped the generation: this answer is for a route
            // the panel no longer shows, so it must not write anything.
            if (gen !== generation.current) return;
            inFlight.current = false;
            const pendingSample = samplePending.current;
            samplePending.current = false;
            if (result.ok) {
              const sampledAt = Date.now();
              const previousHistory = result.value.mode === "commandcode" ? readHistory(result.value) : [];
              const shouldRecord = sample || (!pendingSample && previousHistory.length === 0);
              const nextHistory = result.value.mode === "commandcode"
                ? shouldRecord
                  ? recordHistorySample(result.value, sampledAt)
                  : previousHistory
                : [];
              if (result.value.mode === "commandcode") setHistory(nextHistory);
              setView((s) => ({ ...s, refreshing: false, data: result.value, error: "", updatedAt: sampledAt }));
            } else {
              // Keep the last numbers: a failed background refresh must not
              // blank out what the user was reading.
              setView((s) => ({ ...s, refreshing: false, error: result.error.message }));
            }
            if (pendingSample && !sample) setTimeout(() => { refresh(true); }, 0);
          })
          .catch((err) => {
            if (gen !== generation.current) return;
            inFlight.current = false;
            setView((s) => ({ ...s, refreshing: false, error: String(err) }));
            if (samplePending.current) {
              samplePending.current = false;
              setTimeout(() => { refresh(true); }, 0);
            }
          });
      }, [fetchBalance, provider, model, effort, sessionId]);

      /** Whether what is on screen is older than the configured interval. */
      const isStale = React.useCallback(() => {
        const s = viewRef.current;
        return s.updatedAt === 0 || (Date.now() - s.updatedAt) > config.intervalMs;
      }, [config.intervalMs]);

      // Mount and every model switch: the new route owns the panel, so drop the
      // old numbers and query at once — this is what makes the first click show
      // data instead of starting a query.
      React.useEffect(() => {
        generation.current += 1;
        inFlight.current = false;
        samplePending.current = false;
        setView({ refreshing: false, data: null, error: "", updatedAt: 0 });
        setHistory([]);
        setSelectedMonth("");
        refresh();
      }, [refresh]);

      // Background auto refresh: lives with the cell, not with the modal, so the
      // numbers stay warm while the panel is closed.
      React.useEffect(() => {
        if (!config.auto) return undefined;
        const id = setInterval(() => { refresh(); }, config.intervalMs);
        return () => { clearInterval(id); };
      }, [config.auto, config.intervalMs, refresh]);

      // Sample at the system clock's 00/10/20/30/40/50 minute marks, even when
      // the configurable display auto-refresh is disabled.
      React.useEffect(() => {
        if (view.data?.mode !== "commandcode") return undefined;
        const now = new Date();
        const elapsed = (now.getMinutes() % 10) * 60 * 1000 + now.getSeconds() * 1000 + now.getMilliseconds();
        const wait = HISTORY_INTERVAL_MS - elapsed;
        let intervalId;
        const sampleId = setTimeout(() => {
          refresh(true);
          intervalId = setInterval(() => { if (!inFlight.current) refresh(true); }, HISTORY_INTERVAL_MS);
        }, wait);
        return () => {
          clearTimeout(sampleId);
          if (intervalId !== undefined) clearInterval(intervalId);
        };
      }, [view.data, refresh]);

      // Opening the panel: show what is known, and only pay for a query when the
      // numbers are stale (which also renders as 刷新中 over those numbers).
      React.useEffect(() => {
        if (!open) return;
        if (isStale() && !viewRef.current.refreshing) refresh();
      }, [open, isStale, refresh]);

      // While open: keep the age text moving and self-refresh when the numbers
      // age past the interval.
      React.useEffect(() => {
        if (!open) return undefined;
        const id = setInterval(() => {
          forceRender((n) => n + 1);
          if (isStale() && !viewRef.current.refreshing) refresh();
        }, TICK_MS);
        return () => { clearInterval(id); };
      }, [open, isStale, refresh]);

      const applyConfig = (next) => {
        setConfig(next);
        writeRefreshConfig(next);
        if (next.auto && isStale() && !viewRef.current.refreshing) refresh();
      };
      const toggleAuto = () => { applyConfig({ auto: !config.auto, intervalMs: config.intervalMs }); };
      // One dialog at a time: a sub-dialog replaces the panel, and closing it
      // returns to the panel. Nothing is stacked, so a background refresh
      // re-rendering the cell cannot reflow or re-order two centred cards
      // while the user is reading one of them.
      const openSettings = () => {
        setForm({ auto: config.auto, minutes: String(Math.max(1, Math.round(config.intervalMs / 60000))) });
        setOpen(false);
        setSettingsOpen(true);
      };
      const closeSettings = () => {
        setSettingsOpen(false);
        setOpen(true);
      };
      const saveSettings = () => {
        const minutes = Number(form.minutes);
        const intervalMs = Number.isFinite(minutes) && minutes >= 1
          ? clampInterval(minutes * 60000)
          : config.intervalMs;
        setSettingsOpen(false);
        setOpen(true);
        applyConfig({ auto: form.auto === true, intervalMs });
      };
      const openInfo = () => {
        setOpen(false);
        setProviders(null);
        setDialogError("");
        setInfoOpen(true);
        fetchProviders()
          .then((result) => setProviders(result.ok ? result.value : []))
          .catch((err) => { setDialogError(String(err)); setProviders([]); });
      };
      const closeInfo = () => {
        setInfoOpen(false);
        setOpen(true);
      };
      const openPicker = () => {
        setOpen(false);
        setCatalog(null);
        setDialogError("");
        setPickerOpen(true);
        fetchModels()
          .then((result) => setCatalog(result.ok ? result.value : { groups: [], default: null }))
          .catch((err) => { setDialogError(String(err)); setCatalog({ groups: [], default: null }); });
      };
      const closePicker = () => {
        setPickerOpen(false);
        setOpen(true);
      };
      // Switching the target resets the route: the effect below re-queries at once.
      const pickModel = (nextProvider, nextModel) => {
        const next = { provider: nextProvider, model: nextModel };
        setOverride(next);
        writeModelOverride(next);
        setPickerOpen(false);
        setOpen(true);
      };
      const pickAuto = () => {
        setOverride(null);
        writeModelOverride(null);
        setPickerOpen(false);
        setOpen(true);
      };

      const clearMonth = (month) => {
        if (view.data?.mode !== "commandcode" || month === "") return;
        const message = fill(t("history.confirmClearMonth"), { month });
        if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm(message)) return;
        const next = clearHistoryMonth(view.data, month);
        setHistory(next);
        setSelectedMonth(storedMonths(next)[0] ?? "");
      };
      const resetHistory = () => {
        if (view.data?.mode !== "commandcode") return;
        if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm(t("history.confirmReset"))) return;
        setHistory(resetHistoryStorage(view.data));
        setSelectedMonth("");
      };
      const applyCustomRange = () => {
        const start = localDateStart(customRange.start);
        const end = localDateStart(customRange.end);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return;
        setAppliedCustomRange({ ...customRange });
        setHistoryRange("custom");
      };

      let body;
      if (view.data !== null) {
        body = React.createElement("div", { className: "dsh-usage-stack" },
          React.createElement(UsageBalance, {
            data: view.data,
            history,
            historyRange,
            customRange,
            appliedCustomRange,
            selectedMonth,
            onHistoryRange: setHistoryRange,
            onCustomRange: setCustomRange,
            onApplyCustomRange: applyCustomRange,
            onSelectMonth: setSelectedMonth,
            onClearMonth: clearMonth,
            onResetHistory: resetHistory,
            onRefresh: refresh,
            display,
            t,
          }),
          view.error !== ""
            ? React.createElement("div", { className: "dsh-usage-inline-error" },
                fill(t("error.lastRefresh"), { error: view.error }))
            : null,
        );
      } else if (view.refreshing) {
        body = React.createElement("div", { className: "dsh-usage-state" }, t("state.querying"));
      } else if (view.error !== "") {
        body = React.createElement("div", { className: "dsh-usage-error" },
          React.createElement("div", { className: "dsh-usage-error-text" }, view.error),
          React.createElement(ActionButton, { variant: "outline", onClick: refresh }, t("action.retry")),
        );
      } else {
        body = React.createElement("div", { className: "dsh-usage-state" }, t("state.empty"));
      }

      const now = Date.now();
      // Deliberately stable: a title that changed on every background refresh
      // would re-open its tooltip under a resting pointer.
      const buttonTitle = config.auto
        ? fill(t("button.titleAuto"), { interval: minutesLabel(t, config.intervalMs) })
        : t("button.titleManual");
      const headline = display.button && display.headline !== false && view.data !== null ? usageHeadline(view.data) : "";
      const showHover = () => {
        const node = buttonRef.current;
        if (node === null || typeof node.getBoundingClientRect !== "function") return;
        const rect = node.getBoundingClientRect();
        const maxLeft = Math.max(8, (window.innerWidth || 1024) - 288);
        setHoverAt({ left: Math.max(8, Math.min(rect.left, maxLeft)), top: rect.bottom + 8 });
      };
      const hideHover = () => { setHoverAt(null); };

      return React.createElement(React.Fragment, null,
        React.createElement("style", {
          "data-plugin-css": "dsh-model-usage/styles",
          dangerouslySetInnerHTML: { __html: STYLES },
        }),
        display.button ? React.createElement("button", {
          ref: buttonRef,
          type: "button",
          className: "dsh-usage-btn" + (view.refreshing ? " dsh-usage-btn-busy" : ""),
          title: buttonTitle,
          onPointerEnter: showHover,
          onPointerLeave: hideHover,
          onFocus: showHover,
          onBlur: hideHover,
          onClick: () => { hideHover(); setOpen(true); },
        },
          React.createElement("svg", {
            className: "dsh-usage-btn-icon",
            viewBox: "0 0 16 16",
            fill: "none",
            "aria-hidden": "true",
          },
            React.createElement("rect", { x: "2", y: "9", width: "2.6", height: "5", rx: "1.2", fill: "currentColor", fillOpacity: "0.65" }),
            React.createElement("rect", { x: "6.7", y: "5.5", width: "2.6", height: "8.5", rx: "1.2", fill: "currentColor", fillOpacity: "0.85" }),
            React.createElement("rect", { x: "11.4", y: "2.5", width: "2.6", height: "11.5", rx: "1.2", fill: "currentColor" }),
          ),
          React.createElement("span", null, t("button.label")),
          headline === "" ? null : React.createElement("span", { className: "dsh-usage-btn-value" }, headline),
        ) : null,
        display.button && hoverAt !== null && view.data !== null
          ? createPortal(React.createElement("div", {
              className: "dsh-usage-hover",
              style: { left: `${hoverAt.left}px`, top: `${hoverAt.top}px` },
            },
              React.createElement("div", { className: "dsh-usage-hover-head" },
                React.createElement("span", null, String(view.data.providerName ?? "")),
                headline === "" ? null : React.createElement("span", { className: "dsh-usage-hover-value" }, headline)),
              usageHoverItems(t, view.data, now).map((item, index) => React.createElement("div", {
                key: `hover-${index}`,
                className: "dsh-usage-hover-row",
              },
                React.createElement("span", null, item[0]),
                React.createElement("span", null, item[1]))),
            ), document.body)
          : null,
        React.createElement(UsageModal, {
          open,
          onClose: () => { setOpen(false); },
          title: t("button.label"),
          closeLabel: t("action.close"),
          footer: React.createElement(React.Fragment, null,
            React.createElement(ActionButton, { variant: "ghost", onClick: openInfo }, t("action.info")),
            React.createElement(ActionButton, { variant: "primary", onClick: () => { setOpen(false); } }, t("action.close")),
          ),
        }, React.createElement("div", { className: "dsh-usage-modal-body" },
          React.createElement("div", { className: "dsh-usage-stack" },
            display.status ? React.createElement(RefreshStatus, {
              view,
              config,
              now,
              onToggleAuto: toggleAuto,
              onOpenSettings: openSettings,
              onRefresh: refresh,
              showRefresh: display.refresh,
              t,
            }) : null,
            display.target ? React.createElement(ModelBar, { override, effective, onOpen: openPicker, t }) : null,
            body,
          ))),
        React.createElement(UsageModal, {
          open: pickerOpen,
          onClose: closePicker,
          title: t("picker.title"),
          closeLabel: t("action.cancel"),
          footer: React.createElement(React.Fragment, null,
            React.createElement(ActionButton, { variant: "outline", onClick: closePicker }, t("action.cancel")),
            React.createElement(ActionButton, { variant: "ghost", onClick: pickAuto }, t("action.auto")),
          ),
        }, React.createElement("div", { className: "dsh-usage-modal-body" },
          React.createElement("div", { className: "dsh-usage-stack" },
            React.createElement("div", { className: "dsh-usage-hint" }, t("picker.hint")),
            dialogError !== "" ? React.createElement("div", { className: "dsh-usage-inline-error" }, dialogError) : null,
            React.createElement(ModelPicker, { catalog, override, onAuto: pickAuto, onPick: pickModel, t }),
          ))),
        React.createElement(UsageModal, {
          open: settingsOpen,
          onClose: closeSettings,
          title: t("settings.title"),
          closeLabel: t("action.cancel"),
          footer: React.createElement(React.Fragment, null,
            React.createElement(ActionButton, { variant: "outline", onClick: closeSettings }, t("action.cancel")),
            React.createElement(ActionButton, { variant: "primary", onClick: saveSettings }, t("action.save")),
          ),
        }, React.createElement("div", { className: "dsh-usage-modal-body" },
          React.createElement(RefreshSettings, { form, onChange: setForm, t }))),
        React.createElement(UsageModal, {
          open: infoOpen,
          onClose: closeInfo,
          title: t("info.title"),
          closeLabel: t("action.close"),
          footer: React.createElement(ActionButton, { variant: "primary", onClick: closeInfo }, t("action.close")),
        }, React.createElement("div", { className: "dsh-usage-modal-body" },
          React.createElement("div", { className: "dsh-usage-stack" },
            React.createElement("div", { className: "dsh-usage-hint" }, t("info.hint")),
            dialogError !== "" ? React.createElement("div", { className: "dsh-usage-inline-error" }, dialogError) : null,
            React.createElement(ProviderInfo, { providers, t }),
          ))),
      );
    }

    function apply(ctx) {
      // Copy lives in the Client locale service, so a language switch re-renders
      // this cell. The service is read through `ctx.get()` rather than declared
      // as a hard dependency: a composition that does not mount it still gets
      // the panel (in the Chinese source language) instead of no panel at all.
      const locale = typeof ctx.get === "function" ? ctx.get("locale") : undefined;
      let t = (key) => (zh[key] ?? key);
      if (locale !== undefined && typeof locale.register === "function" && typeof locale.bind === "function") {
        ctx.effect(() => locale.register(NS, { zh, en }), "model-usage: dictionaries");
        t = locale.bind(NS);
      }
      /**
       * One JSON read from a host route. A refused request (the trust fence
       * answers 401/403) becomes a readable error instead of a JSON parse
       * failure, so the panel says what happened.
       */
      const readEnvelope = (res) => {
        if (res.ok) return res.json();
        throw new Error(`HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}`);
      };
      /** Ask the host for the usage of one conversation model (secrets stay host-side). */
      const fetchBalance = (selection) => {
        const payload = {};
        if (selection?.provider) payload.provider = selection.provider;
        if (selection?.model) payload.model = selection.model;
        if (selection?.effort) payload.reasoningEffort = selection.effort;
        if (selection?.sessionId) payload.sessionId = selection.sessionId;
        // A template saved in the settings page belongs to this provider route;
        // sending it here keeps the host stateless and per-browser.
        if (selection?.provider) {
          const template = readTemplates()[selection.provider];
          if (template !== undefined) payload.template = template;
        }
        // The host itself gives up after 30s; this is the outer guard that makes
        // sure a stranded request cannot keep the single in-flight slot busy and
        // silently stop every later auto refresh.
        const controller = typeof AbortController === "function" ? new AbortController() : null;
        const timer = controller === null ? null : setTimeout(() => { controller.abort(); }, 45000);
        return fetch(ROUTE_BALANCE, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          ...(controller === null ? {} : { signal: controller.signal }),
        })
          .then(readEnvelope)
          .finally(() => { if (timer !== null) clearTimeout(timer); });
      };
      /** Read-only provider/credential directory (reference names only). */
      const fetchProviders = () => fetch(ROUTE_PROVIDERS).then(readEnvelope);
      /**
       * Test one draft template against its provider: the same balance route,
       * with the draft in the payload and a throwaway model name. Nothing is
       * saved; the answer is exactly what a refresh would show.
       */
      const testTemplate = (provider, template) => fetch(ROUTE_BALANCE, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, model: "usage-template-test", template }),
      }).then(readEnvelope);
      /** Routable models + per-route usage kind, for the manual picker. */
      const fetchModels = () => fetch(ROUTE_MODELS).then(readEnvelope);
      ctx.slots.inject("assistant-suite.usage-settings", () => ctx.slots.register({
        name: "assistant-suite.usage-settings",
        locale: NS,
        inject: () => ({ t, fetchProviders, testTemplate }),
      }, UsageDisplaySettings));
      ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
        name: "conversation.session.header.utilities",
        id: "model-usage",
        order: 100,
        locale: NS,
        label: () => t("button.label"),
        inject: () => ({ fetchBalance, fetchProviders, fetchModels, t }),
      }, UsageAction));
      // Sidebar foot: a one-line ticker of the key numbers, above Settings.
      ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
        name: "sidebar.footer.action",
        id: "usage-ticker",
        order: 90,
        locale: NS,
        label: () => t("ticker.label"),
        inject: () => ({ fetchBalance, t }),
      }, UsageTicker));
    }

    // `slots` is the one hard dependency (the cell is the whole point); every
    // other service, locale included, is read through `ctx.get()` so the plugin
    // mounts in as many compositions as possible.
    const inject = ["slots"];

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
