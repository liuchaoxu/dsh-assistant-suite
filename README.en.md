# DSH Assistant Suite

[中文说明](README.md) | English

[![npm version](https://img.shields.io/npm/v/dsh-assistant-suite.svg)](https://www.npmjs.com/package/dsh-assistant-suite)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-43853d.svg)](https://nodejs.org/)

The suite combines provider usage queries, balance history, and system notifications for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Open **Usage** in a conversation header to inspect the account behind the selected model. Manage notifications and panel display under **Settings → Assistant Suite**.

It combines the features previously provided by `dsh-model-usage` and `dsh-reminding`. When migrating, install and enable the suite, then disable both standalone plugins to prevent duplicate usage entries, routes, or notifications. Existing local preferences and Command Code history are reused when the browser profile and site origin are the same.

Screenshots use sample data. Balances, quotas, and notification permission states shown in them do not represent a real account.

![Dark usage panel with plan limits, credit balance, and balance history](docs/screenshots/usage-dark-desktop.png)

## Features

- **Usage for the current model:** Query the provider account used by the conversation, or choose another configured target without changing the conversation model.
- **Manual and automatic refresh:** Refresh on demand or on a configurable background interval. A failed refresh keeps the last successful result visible.
- **Command Code balance history:** Collect local samples every ten minutes. Review today, yesterday, recent weeks or months, or a custom date range; clear individual months or reset the account history.
- **System notifications:** Get notified when an action needs approval, the model asks a question, a turn ends, generation fails, or output is truncated. Real notifications link back to their conversation.
- **Unified settings:** Control notification permissions and choose which optional sections appear in the usage panel.
- **Theme and compact layouts:** Follows the host's light or dark theme and adapts to narrow or short windows.

## Requirements

| Component | Requirement |
| --- | --- |
| DeepSeek Harness | `>=0.2.1-rc.2`; the manifest declares compatibility with `0.2.1-rc.2` and `0.2.1-rc.5` |
| Node.js | `>=18` |
| Interface | DSH desktop application or Web interface |
| Notifications | A browser or desktop environment with Notification API support and permission |
| Runtime npm dependencies | None; DSH provides `react` and `react-dom` to the client |

## Install or upgrade

Install and enable `dsh-assistant-suite` from the DSH **Plugins** page. For a profile managed by the CLI:

```sh
dsh plugin --profile <profile> add dsh-assistant-suite
```

For a local checkout:

```sh
dsh plugin --profile <profile> add link:/absolute/path/to/dsh-assistant-suite
```

Confirm that the bundle is enabled in the Plugins page, then reload the interface. If the host does not support hot reload, restart it. Profiles managed by the desktop application should be changed through the Plugins page. Running `npm install` only downloads the package; it does not enable the plugin in DSH.

Disable the standalone `dsh-model-usage` and `dsh-reminding` plugins after enabling the suite. On the same browser profile and site origin, the suite can continue using the old plugins' refresh settings, query target, history, and notification preference. Suite-specific panel display settings use a separate storage key.

## Provider usage

Click **Usage** in the conversation header. By default, the query follows the current conversation model. Use **Query target** to select another provider route; this does not change the model used for the conversation. Credentials are read by the host through the provider's credential reference.

| Provider or route | Reported information |
| --- | --- |
| Command Code | Plan, five-hour and seven-day windows, credit balance, spend, request count, balance history |
| DeepSeek API | Account balance by currency |
| Signed-in DeepSeek account | Wallet balance through the host account service; no API key required |
| OpenCode Go | Per-model quota windows, as returned by its endpoint |
| OpenRouter | Key usage, limit, remaining amount, and account credit pool when available |
| Moonshot / Kimi | Available, cash, and voucher balances |
| SiliconFlow | Total, charged, and granted balances |
| Other OpenAI-compatible routes with `baseURL` | Best-effort conversion of the New API `/api/user/self` quota convention |

Usage belongs to the provider account, so different models using the same credential may share a balance or quota. The plugin displays fields returned by each provider. The OpenCode Go and New API adapters depend on endpoint conventions and may not work with every compatible service. OpenCode Zen pay-as-you-go routes do not have a supported usage adapter.

The Command Code credit balance and its five-hour or seven-day windows are separate values. The suite displays provider-returned data; it does not infer a monthly total quota from a remaining credit balance.

## Refresh and data freshness

- Automatic refresh is enabled by default and runs every five minutes. Choose 1, 5, 15, 30, or 60 minutes, or enter 1–1440 minutes.
- The session component queries when the model changes. While automatic refresh is enabled, it continues on its interval even when the panel is closed.
- Use the refresh icon beside the update time to query immediately. It is disabled while a request is in progress.
- Opening the panel checks for stale data even when background refresh is disabled.
- On failure, the panel retains the previous successful result and marks the error. A first-query failure shows an error and retry action.

![Light usage panel with the query target and account data](docs/screenshots/usage-light-desktop.png)

## Balance history

Balance history currently supports Command Code. While the session component is running, the suite samples on each ten-minute clock mark (`:00`, `:10`, `:20`, and so on), independently of the panel refresh setting. Samples are stored locally per account for the current calendar month and the previous two months. Time when the application is closed is not backfilled, and clearing site data also removes the local history.

Open the chart for a larger view. Select a date range, including a custom start and end date, then apply it. Short ranges show actual sample times; week, month, and longer custom ranges are grouped by day. History can be cleared by month or reset for the current account.

![Large balance history chart with custom dates](docs/screenshots/balance-history-dark-desktop.png)

## Notifications and display settings

Open **Settings → Assistant Suite** to manage system notifications, test notification delivery, and choose optional sections in the usage panel. The balance and quota section is always shown.

| Event | Notification |
| --- | --- |
| A tool waits for approval | An approval reminder; requests answered automatically shortly after are filtered |
| The model asks a question or requests plan review | A reminder that a response or review is needed |
| A turn ends | A completion reminder; closely spaced turns are grouped |
| Generation fails or output is truncated | A failure or output-limit reminder |

When an approval or question is handled, its notification is dismissed. Subagent sessions do not send separate notifications. Notifications are suppressed while the page is focused on the same conversation. Click **Test** to grant permission when needed and verify delivery. Test notifications only check delivery and window focus; they do not open a conversation.

![Assistant Suite settings for notifications and usage panel display](docs/screenshots/settings-dark-desktop.png)

## Data and permissions

Provider queries run in the host process. The browser receives normalized usage, the credential reference name, and the data source; credential values stay in the host. Queries access the corresponding provider API. Notifications use a local host route, which checks browser request trust through the host connection service.

Refresh preferences, manual query target, history, and display settings are stored in browser `localStorage` and scoped to the browser profile and site origin. Notifications use committed session events and do not modify session content. The host notification module also writes local loading and window-focus diagnostics to `lib/dsh-reminding-debug.log`; this log is not included in the npm package.

## Troubleshooting

**Usage or Assistant Suite settings are missing.** Confirm that the suite is enabled and reload the interface. If the usage entry was hidden in display settings, enable it again.

**Notifications do not appear.** Check the suite notification switch and permission, use **Test**, then check operating-system notification permissions, banners, and Do Not Disturb settings. A browser also needs an origin where notification permission can be granted.

**A balance query fails.** Check the query target and the provider credential and address under **Settings → Models**. Some OpenAI-compatible services do not expose account usage endpoints. Read the error shown in the panel.

**No history is visible.** History currently supports Command Code and needs time to collect samples. Data is not synchronized when changing browser profiles, site origins, or after clearing site data.

**Duplicate usage entries or notifications appear.** Disable the standalone `dsh-model-usage` and `dsh-reminding` plugins, and check for other plugins that provide the same notifications.

## Development and publishing

The project has no npm runtime dependencies. Build and checks use Node.js built-in capabilities. The two feature client sources are combined into one browser entry: after editing `lib/model-usage.client.js` or `lib/reminding.client.js`, rebuild the generated `lib/client.js` instead of editing it directly.

```sh
npm run build:client   # Rebuild the combined client
npm test               # Build, package checks, host tests, and client tests
npm run pack:check     # Preview npm package contents
npm run verify         # Test and check package contents
npm pack               # Create a local .tgz package
```

Before publishing, update the version and `CHANGELOG.md`, run `npm run verify`, and review the package contents. Publish from an npm account with package access:

```sh
npm login
npm publish
```

`publishConfig` selects the public npm registry. `prepublishOnly` runs tests, and `prepack` rebuilds the client and checks the package configuration.

## License and links

This project is licensed under the [MIT License](LICENSE), Copyright © 2026 liuchaoxu. It is an independent community plugin and is not affiliated with or endorsed by DeepSeek.

- [GitHub repository](https://github.com/liuchaoxu/dsh-assistant-suite)
- [Report an issue](https://github.com/liuchaoxu/dsh-assistant-suite/issues)
- [npm package](https://www.npmjs.com/package/dsh-assistant-suite)
