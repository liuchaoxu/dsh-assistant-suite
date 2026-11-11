# 维护者指南 / Maintainer guide

发布包：`@liucxu/dsh-helper`。版本：`0.2.1`。Node.js `>=18`，无 npm 运行时依赖。发布命令由拥有 npm 包权限的维护者执行。

Package: `@liucxu/dsh-helper`; version: `0.2.1`. Requires Node.js `>=18`, with no npm runtime dependencies. Publishing requires an npm account authorized for the package.

## 开发 / Development

```sh
npm run build:client
npm test
npm run pack:check
```

修改客户端源码后重新构建 `lib/client.js`。测试使用 Node.js 内置能力，无需额外 npm 依赖。

Rebuild `lib/client.js` after editing client sources. Checks use built-in Node.js capabilities without extra npm dependencies.

## 1. 生成并验证 / Prepare and verify

在仓库根目录执行 / From the repository root:

```sh
npm run release:prepare
```

这会重建客户端，执行包配置、Host、Client 和回归测试，检查实际 npm 文件列表，生成：

This rebuilds the client, runs package/host/client/regression checks, audits the npm file list, and creates:

```text
release/liucxu-dsh-helper-0.2.1.tgz
release/liucxu-dsh-helper-0.2.1.tgz.sha256
release/liucxu-dsh-helper-0.2.1.manifest.json
```

manifest 包含名称、版本、文件列表、压缩前后大小、npm integrity 和 SHA-256。`release/` 不进入 npm 包；也不提交到仓库。每次修改源码、文档或版本后重新生成，不要发布旧归档。

The manifest records package identity, contents, sizes, npm integrity, and SHA-256. Release outputs are excluded from npm and Git. Regenerate after any source, documentation, or version change.

## 2. 核对身份和版本 / Check identity and version

```sh
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
npm view @liucxu/dsh-helper versions --json --registry=https://registry.npmjs.org/
```

首次发布时，404 可能表示包尚未公开；这不保证当前账号可注册该名称。包已存在时确认自己有权限，且版本尚未发布。npm 不允许覆盖相同版本；需要更换版本时同步更新 `package.json`、中英文 README、本指南和 `CHANGELOG.md`，重新生成归档。按 npm 提示完成双重验证。

A first-release 404 does not guarantee name availability. Confirm ownership and an unused version. npm versions are immutable. Keep metadata and documentation in sync, regenerate, and complete npm's authentication prompts.

## 3. 发布已验证的归档 / Publish the verified archive

```sh
npm publish ./release/liucxu-dsh-helper-0.2.1.tgz --access public --registry=https://registry.npmjs.org/
```

归档发布复用已经验证的文件。直接从源码执行 `npm publish` 也受 `prepublishOnly` 测试和 `prepack` 构建检查保护；发布归档前必须先运行 `release:prepare`，不要依赖归档发布再次运行源码检查。

Publish the exact archive produced above. Source publishing runs `prepublishOnly` tests and `prepack` checks. Archive publishing must follow `release:prepare`; do not assume it reruns source checks.

## 4. 发布后确认 / Confirm after publishing

```sh
npm view @liucxu/dsh-helper@0.2.1 name version dist.integrity --registry=https://registry.npmjs.org/
```

将远端 `dist.integrity` 与本地 manifest 的 `integrity` 对比。确认 [npm 包页面](https://www.npmjs.com/package/@liucxu/dsh-helper) 的 README、图标和链接显示正确，并在支持的 DSH profile 中安装、启用、重载，检查用量入口和通知。自动测试不替代真实宿主安装检查；兼容版本见 `package.json`。

Compare registry integrity with the local manifest. Check the npm README, icon, and links, then install/enable/reload in a supported DSH profile and exercise usage and notifications. Automated tests do not replace an actual host installation check.

## 发布范围 / Package contents

`package.json` 的 `files` 白名单包含主机端与客户端文件、Cordis 清单、中英文 locale、SVG 图标、截图、构建与检查脚本、README、变更日志、品牌及发布指南、MIT 协议。编辑器配置、凭据、日志、缓存和 `release/` 不应出现。无需额外维护 `.npmignore`；以 `npm run pack:check` 输出为准。

The explicit `files` allowlist includes runtime/client sources, the Cordis patch, locales, icon, screenshots, build/check scripts, documentation, and MIT license. Editor settings, credentials, logs, caches, and release archives stay out. `npm run pack:check` audits the actual npm file list.
