# Changelog

## Unreleased
- Add a sidebar-foot usage ticker for the current conversation's provider route: one scrolling line, one cached request, paused while the page is hidden, hidden in the collapsed rail, and switchable in the panel display settings.
- Document the design review against CC Switch, including the prioritized gaps (token/cost coverage, quota alerts, cross-device storage, request coalescing) in `docs/design-review.md`.
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
