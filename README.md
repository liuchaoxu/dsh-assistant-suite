# DSH Assistant Suite · 助手套件

[English](README.en.md) | 中文

[![npm version](https://img.shields.io/npm/v/dsh-assistant-suite.svg)](https://www.npmjs.com/package/dsh-assistant-suite)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-43853d.svg)](https://nodejs.org/)

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 提供**模型供应商用量查询、余额消耗趋势和系统提醒**。将 `dsh-model-usage` 与 `dsh-reminding` 合并为一个插件，在会话头部查看用量，在 **设置 → 助手套件** 统一管理通知和面板显示。

支持深浅色主题、磨砂玻璃面板和窄屏布局，中英文随应用语言切换。本文截图使用示例数据展示界面，余额、额度与通知权限状态不代表实际账户情况。

![深色用量面板：套餐额度、信用余额和余额消耗趋势](docs/screenshots/usage-dark-desktop.png)

## 功能

- **跟随会话模型**：查询当前模型对应供应商账户的余额、额度窗口与请求数；也可手动选择查询对象，不改变会话使用的模型。
- **手动与自动刷新**：时间右侧的刷新图标可立即查询，查询中暂时禁用。支持后台定时刷新；失败时保留上次成功的数据并显示错误。
- **余额消耗趋势**：Command Code 账户按时间采样，支持今天、昨天、近一周、近一月、自定义日期，以及按月清理和重置记录。
- **独立趋势弹框**：点击图表打开大图，日期控件与图表按可用空间布局；矮窗口支持滚动，坐标轴保持完整。
- **系统提醒**：需要授权、模型提问、回合完成、生成失败或输出截断时提醒，点击真实通知返回对应会话。
- **统一设置**：管理通知开关、权限测试，以及用量入口、刷新状态、历史趋势、数据来源等显示选项，修改立即生效并保存在本机。
- **主题适配**：使用宿主的深浅色配色，提供磨砂背景和柔和高光；支持减少动画、减少透明效果的系统偏好，不支持背景模糊时使用实色面板。

## 环境要求

| 项目 | 要求 |
| --- | --- |
| DeepSeek Harness | `>=0.2.1-rc.2`；清单声明兼容 `0.2.1-rc.2`、`0.2.1-rc.5` |
| Node.js | `>=18` |
| 界面 | DSH 桌面应用或 Web 界面 |
| 系统通知 | 浏览器或桌面环境支持 Notification API，并允许通知 |
| npm 运行时依赖 | 无；客户端的 `react`、`react-dom` 由 DSH 提供 |

## 安装与升级

### 插件页面

在 DSH 的 **Plugins / 插件** 页面安装 `dsh-assistant-suite` 并启用。npm 包发布后可按包名安装；本地开发可通过插件管理工具的 `install_bundle` 将目标指向项目目录。

安装后重新加载界面。若宿主未启用热更新，重启应用以加载主机端代码。桌面应用管理的 profile 请通过插件页面安装和启用。

### CLI

对于允许 CLI 管理的 profile：

```sh
dsh plugin --profile <profile> add dsh-assistant-suite
```

本地目录安装：

```sh
dsh plugin --profile <profile> add link:/absolute/path/to/dsh-assistant-suite
```

安装后在插件页面确认已启用。单独执行 `npm install` 只下载 npm 包，不会自动在 DSH 中启用插件。

### 从旧插件迁移

安装并启用本套件后，停用原来的 `dsh-model-usage` 和 `dsh-reminding`，避免重复的用量入口、提醒及相同路由注册。套件保留旧功能的本地存储键；在相同浏览器配置及站点来源下，原有刷新设置、查询对象、历史记录和提醒开关可继续读取。用量显示选项使用套件独立的存储键。

## 查看供应商用量

点击会话头部的 **用量**。默认跟随当前会话模型，点击 **查询对象** 可手动切换，密钥始终由宿主按供应商自己的凭据引用读取。

![浅色用量面板：跟随会话的查询对象和账户数据](docs/screenshots/usage-light-desktop.png)

当前适配来源：

| 供应商 / 路由 | 主要显示内容 |
| --- | --- |
| Command Code | 套餐、5 小时 / 7 天额度、信用余额、已花费、请求数、余额消耗趋势 |
| DeepSeek API | 按币种的账户余额 |
| DeepSeek 登录账户 | 通过宿主账户服务读取钱包余额，无需 API Key |
| OpenCode Go | 按模型的额度窗口；依据接口返回字段显示 |
| OpenRouter | Key 已用、额度、剩余，以及可获得的账户额度池 |
| Moonshot / Kimi | 可用余额、现金余额、代金券 |
| SiliconFlow | 总余额、充值余额、赠送余额 |
| 其他带 `baseURL` 的 OpenAI 兼容路由 | 尝试 New API 的 `/api/user/self` 约定，按接口数据换算额度 |

用量属于供应商账户，多个模型使用同一个凭据时可能共享余额或额度。不同供应商返回的字段不同，插件仅显示实际返回的数据；OpenCode Go 和 New API 适配依赖接口约定，无法保证所有兼容服务均可查询。OpenCode Zen 按量计费路由没有对应适配，不应与 OpenCode Go 混淆。

### 刷新与数据时效

- 默认开启自动刷新，间隔 **5 分钟**；预设 1、5、15、30、60 分钟，也可输入 **1–1440 分钟**。
- 挂载的会话组件会在模型切换时查询，自动刷新开启时，即使弹框关闭也会按间隔查询。
- **刷新时间** 右侧的图标手动刷新数据；刷新中禁用以避免重复请求。隐藏刷新状态栏后，手动刷新入口保留在详情底部。
- 打开弹框时，过期数据会重新查询；即使关闭后台自动刷新，打开的面板仍会检查数据是否过期。
- 刷新失败保留上次成功数据并标记错误，首次查询失败则显示错误及重试入口。

![窄屏刷新设置：自动刷新、间隔预设和自定义分钟数](docs/screenshots/refresh-settings-dark-mobile.png)

## 余额消耗趋势

此功能目前针对 **Command Code**。会话组件运行期间，按系统时钟每十分钟的整点（`:00`、`:10`、`:20` 等）采样，与面板自动刷新开关独立。记录按账户保存在浏览器本地，保留当前自然月和前两个月；关闭应用期间不会补采数据，清除浏览器站点数据会同时清除本地历史。

点击图表可放大查看，选择 **自定义** 后填写开始和结束日期，再点击 **应用时间段**。短时间范围按实际采样时间显示，近一周、近一月及较长自定义范围按日汇总；可切换 **仅显示消耗点**，也可在用量面板按月份清理记录或重置当前账户记录。

![深色趋势大图：自定义日期、消耗汇总和完整坐标轴](docs/screenshots/balance-history-dark-desktop.png)

![浅色趋势大图：与应用主题一致的图表配色](docs/screenshots/balance-history-light-desktop.png)

## 系统提醒与显示设置

打开 **设置 → 助手套件**。上方管理系统通知与测试，下方选择用量弹框的显示内容。**余额与额度** 是固定保留的核心内容，其余项目可按需显示或隐藏。

![深色助手套件设置：系统通知、权限测试与用量面板显示开关](docs/screenshots/settings-dark-desktop.png)

![浅色助手套件设置：通知权限与可选显示内容](docs/screenshots/settings-light-desktop.png)

| 提醒时机 | 行为 |
| --- | --- |
| 工具等待授权 | 提醒需要授权；短时间内自动处理的请求会被过滤 |
| 模型提问 / 计划审阅 | 提醒等待回答或审阅 |
| 回合完成 | 提醒本轮回复结束，短时间连续轮次会合并处理 |
| 生成失败 / 输出截断 | 提醒失败或达到输出长度上限 |

授权或提问被处理后，对应通知会关闭；子代理会话不单独提醒。页面处于前台且正在查看同一会话时会抑制通知，避免打扰。

首次使用时点击 **测试** 完成权限授权并验证通知。真实通知带有会话信息，点击后尝试将窗口切到前台并打开对应对话；测试通知只用于验证通知和聚焦窗口，不跳转会话。

## 窄屏与矮窗口

下面的截图分别展示窄屏用量、设置和趋势视图，以及矮窗口下可滚动的趋势布局。

| 窄屏用量 | 窄屏设置 |
| --- | --- |
| ![窄屏用量面板：刷新图标、查询对象与额度卡片](docs/screenshots/usage-dark-mobile.png) | ![窄屏助手套件设置：通知与显示选项](docs/screenshots/settings-dark-mobile.png) |

![窄屏余额消耗趋势：日期控件自动换行](docs/screenshots/balance-history-dark-mobile.png)

![矮窗口余额消耗趋势：内容可滚动，图表底部可完整查看](docs/screenshots/balance-history-dark-short-window.png)

## 数据与权限

供应商查询在宿主进程执行，浏览器接收归一化用量、凭据引用名和来源，不接收密钥值。查询会访问相应供应商 API；提醒通过宿主本地路由传递。相关路由使用宿主连接服务检查浏览器请求的信任状态。

刷新策略、手动查询对象、历史记录和显示开关保存在浏览器 `localStorage`，按浏览器配置及站点来源隔离。提醒根据已提交的会话事件生成，不修改会话内容。当前主机端提醒模块还会在 `lib/dsh-reminding-debug.log` 写入本地加载与窗口聚焦诊断信息，该日志不包含在 npm 发布包内。

## 常见问题

**没有用量入口或助手套件设置？** 确认插件已启用并重新加载界面；如果在显示设置中隐藏了用量入口，重新开启即可。

**收不到通知？** 先在助手套件设置中检查通知开关和权限，点击测试；再检查操作系统对 DSH 或浏览器的通知权限、横幅设置和勿扰模式。浏览器还需要可授予通知权限的站点环境。

**余额查询失败？** 检查查询对象，以及 **设置 → 模型** 中对应供应商的凭据与地址。并非每个 OpenAI 兼容服务都提供账户用量接口；失败时查看面板中的具体错误。

**看不到历史趋势？** 当前仅支持 Command Code，并且需要在本地积累采样。切换浏览器、站点来源或清空站点数据后，旧浏览器中的记录不会自动同步。

**出现重复用量按钮或重复提醒？** 检查原来的两个独立插件是否仍然启用，也检查其他通知插件是否同时提供相同提醒。

## 开发与 npm 发布

仓库不需要安装 npm 运行时依赖，检查与测试使用 Node 内置能力。两份功能客户端源码合成为一个浏览器入口：修改 `lib/model-usage.client.js` 或 `lib/reminding.client.js` 后，执行构建；不要直接修改生成的 `lib/client.js`。

```sh
npm run build:client   # 重新生成合并客户端
npm test               # 构建、包检查、Host 测试、Client 测试
npm run pack:check     # 预览 npm 打包文件（也会执行打包前构建与检查）
npm run verify         # 测试并检查打包内容
npm pack               # 生成本地 .tgz 安装包
```

主要目录：

```text
lib/index.js                  Host 合并入口
lib/model-usage.js             供应商用量查询
lib/reminding.js               系统提醒事件与本地路由
lib/model-usage.client.js      用量客户端源码
lib/reminding.client.js        提醒与设置客户端源码
lib/client.js                  生成的合并客户端
locale/                       插件管理页中英文元数据
docs/screenshots/             按功能、主题和显示场景命名的截图
scripts/                      构建、包检查与功能测试
cordis.patch.yml              assistant-suite bundle 注册行
LICENSE                       MIT 协议全文
```

发布前更新版本和 `CHANGELOG.md`，执行 `npm run verify`，确认打包内容后，在拥有包发布权限的 npm 账户下执行：

```sh
npm login
npm publish
```

`publishConfig` 已指定 npm 官方 registry 和公开访问；`prepublishOnly` 自动运行测试，`prepack` 自动重建客户端并检查包配置。包内包含主机端、生成的客户端及其源码、构建与检查脚本、locale、图标、截图、文档和 MIT 许可证；本地日志、缓存、编辑器文件不在发布白名单内。

## English

DSH Assistant Suite combines provider-account usage and system reminders for DeepSeek Harness. Open **Usage** in a conversation header to inspect balances and quota windows, refresh beside the updated time, or select a different query target without changing the conversation model. Command Code spending history supports custom dates and a larger scrollable chart dialog.

Manage notification permissions, test notifications, and choose visible panel sections under **Settings → Assistant Suite**. Real notifications return to their conversation; test notifications only test delivery and focus. The interface follows the host's language and light/dark appearance. Screenshots above use sample data.

Requires DeepSeek Harness `>=0.2.1-rc.2` and Node.js `>=18`. Install `dsh-assistant-suite` from the DSH plugin page once published, or use the CLI command above for a CLI-managed profile. Disable the standalone `dsh-model-usage` and `dsh-reminding` plugins when using the suite. No runtime npm dependencies are required; DSH supplies React and React DOM. Run `npm run verify` before publishing.

## 协议与链接

本项目采用 [MIT License](LICENSE)，Copyright © 2026 liuchaoxu。你可以按 MIT 条款使用、修改和分发，并保留原版权与许可声明。这是独立社区插件，与 DeepSeek 无隶属或背书关系。

- [GitHub 仓库](https://github.com/liuchaoxu/dsh-assistant-suite)
- [反馈问题](https://github.com/liuchaoxu/dsh-assistant-suite/issues)
- [npm 包页面](https://www.npmjs.com/package/dsh-assistant-suite)（发布后可用）
