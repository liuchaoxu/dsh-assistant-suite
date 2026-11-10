# Changelog

## Unreleased
- Match the dark switch reference: near-white enabled track with a near-black thumb.
- Use white-gray enabled notification and display switches in dark mode, and document the renamed `dsh-helper` settings page with fresh dark, light, and narrow-screen previews.
- Make settings own shared button/text styles on first entry instead of depending on the conversation header; scope switch rules to display rows so template labels remain unaffected.
- Refine settings cards, button variants, keyboard focus, narrow layouts and notification/test busy states.
- Rename the package and client module to `dsh-helper` (DSH Helper / DSH 助手), retaining existing browser settings and ledger storage paths. Disable the old package before enabling the renamed package to avoid duplicate routes.
- Fail closed when request admission is unavailable; bound JSON request bodies to 256 KiB and return HTTP 413 for oversized requests.
- Scope ledger state to each plugin activation, reload existing data on activation, preserve v1 aggregates, and commit prices before reporting a successful save.
- Count retry attempts, replace repeated settlement samples, and account for cache-write tokens and prices.
- Align token costs with the current provider/shared-credential routes and the balance trend's local-calendar date range; display sampled spend and the difference without equating estimated cost with real billing.
- Refresh the ledger with the usage panel, prevent late responses from crossing scopes, and make diagnostics opt-in through `DSH_ASSISTANT_DEBUG=1`.

## 0.2.0
- Add a host-side session usage ledger: `assistant/message` usage (input, output, cache read, total tokens and requests) is folded per day/provider/model into `$DSH_HOME/assistant-suite/usage-ledger.json`, with duplicate sequence numbers ignored.
- Add a **Tokens and cost** card to the usage panel showing the last 30 days, per-model rows, and a structured price editor keyed by provider/model: three fields per route, a DeepSeek reference-rate preset, clear-all, and live per-route/total cost preview. Legacy model-only price keys still apply as a fallback.
- Accept a pasted cc-switch template object literal in the template editor: a `function` extractor becomes the stored source string and the usual `.replace(...)` URL becomes `{{baseUrlRoot}}`, with a conversion note instead of a JSON error.
- Fix custom-template results being rendered by the DeepSeek card: only `mode === "deepseek"` uses that card now, and every other mode (including `template`) uses the generic rows card.
- Make the DeepSeek balance card resilient: read `balance_infos` through relay wrappers, fall back to plain `balance`/`remaining` fields, surface an endpoint `error` message, and keep the raw response one click away.
- Compute the ledger's cost in the panel from the current price table (route key first, legacy model key second), so saving a price immediately refreshes every visible figure rather than waiting for a host rebuild.
- Add display settings for the header balance (default on) and the sidebar provider/balance line (default off), with per-key defaults instead of "everything on".
- Show the current route's headline figure (credits, wallet balance, remaining row, or window percentage) inside the conversation-header usage button, with a hover card listing rows, window percentages, and reset countdowns.
- Add provider presets to the template editor: Command Code, One API / New API, OpenRouter, Moonshot / Kimi, SiliconFlow, DeepSeek official, and a generic blank template.
- Add **Initialize from the built-in adapter** to the template editor: it turns the route's built-in endpoint and field mapping into an editable draft, and explains why there is nothing to copy for account-only routes, configured templates, or providers without an adapter.
- Add a sidebar-foot usage ticker for the current conversation's provider route: one scrolling line, one cached request, paused while the page is hidden, hidden in the collapsed rail, and switchable in the panel display settings.
- Tighten the user-facing copy in both languages: shorter panel hints and setting labels, plainer template guidance, and shorter error messages.
- Fix the settings page not forwarding the injected template-test function to the editor, which made **Test template** report that the host did not support it.
- Add a per-provider template editor to the assistant suite settings page: templates saved in the browser are sent with that provider's usage query (host validates the shape and never trusts it blindly) and override the provider-configuration template.
- Add an in-editor configuration guide (field table, placeholders, extractor result fields, limits), live request preview with the key masked, draft validation for JSON / method / origin / placeholders, and a **Test template** action that runs the draft against the provider without saving it.
- Report the resolved request URL (credential masked) from template queries so the settings page can confirm what was actually called.
- Add cc-switch compatible custom usage templates: a provider may declare `usageTemplate.request` plus a JavaScript `extractor`, run by the host in a sandboxed `vm` context with a one-second deadline.
- Support `{{baseUrlRoot}}` and `{{origin}}` placeholders, optional POST bodies, and extractor fields such as `used`, `total`, `windows`, and `status`; keep the declarative `extract` shape working.
- Add an explicit New API usage adapter for named routes and reverse-proxy subpaths.
- Show the New API account name and request count when returned by `/api/user/self`.
- Add host regression coverage for endpoint URL construction, bearer auth, quota normalization, both template shapes, and payload-template precedence.

## 0.1.1
- Prepare public npm packaging with repository metadata, keywords, build and publish checks, and the MIT license; include client sources, scripts and documentation assets.
- Expand the README with installation, migration, usage, notification settings, and 11 screenshots renamed by feature, theme and display layout.
- Widen and raise the expanded balance history dialog, keep custom date controls and chart axes reachable by scrolling, and preserve chart proportions. Portal dialogs to the page so parent glass surfaces cannot constrain or clip them; only the top dialog handles keyboard dismissal.
- Move manual refresh beside the last-updated time as an accessible icon button, disabled while querying; keep a fallback action when the status section is hidden.
- Improve light and dark appearance with frosted usage dialogs, translucent settings cards, and subtle edge highlights.
- Fix switch thumb and primary button foreground colors, strengthen chart grid visibility, and use the theme accent for toggles and keyboard focus.
- Respect reduced transparency and motion preferences, with solid surfaces when backdrop blur is unavailable.

## 0.1.0
- Combine dsh-model-usage and dsh-reminding behind one plugin entry.
- Preserve both feature surfaces and host routes.
