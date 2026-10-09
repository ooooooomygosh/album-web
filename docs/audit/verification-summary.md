# 本轮验证汇总

更新：2026-10-09。基于主线 `db029819`，完整整合 [PR #4](https://github.com/ooooooomygosh/album-web/pull/4) 至 `f4b422b` 及本轮修复。PR #4 已按仓库所有者指示关闭；统一 [PR #5](https://github.com/ooooooomygosh/album-web/pull/5) 保留草稿，交由所有者决定合并。

## 已执行

- `npm run check`：151 项桌面 Node 测试 + 16 项音频生命周期测试通过（原生修复整合后，云端 Node 24.19.0）；Vite 生产构建通过
- `npm --prefix desktop run build:music`：桌面音乐适配器重新生成成功
- `npm --prefix desktop run build:web`：桌面三页面入口构建成功；随后相同入口继续通过生产构建
- `git diff --check`：通过
- V6 实际云浏览器、960×600：31/31 夹具自测通过，捕获运行时错误为空；不是仅存在一份测试脚本
- 真实指针移动唱机并重载：位置、林间场景与兔子选择保留；Home 复位再重载也保持
- V5 实际画面采样：正常动态 10 次取样出现 4 个不同帧；减少动态效果 10 次完全相同
- 公共 QQ／iTunes 元数据接口有真实 HTTP 检查；修复后 iTunes 首两项专辑为 17/17 曲目，部分其他候选仍明确标记不完整

- macOS Apple Silicon 原生验收：五场景／五伙伴同步与选择恢复、桌宠启停、动态背景启停／取消／故障恢复、两个屏幕分别启动、真实一分钟专注通过；QQ 两首真实歌曲音频推进、暂停／继续／下一首在最小修复后通过。限定范围与未完成项见原生报告

证据：[macOS 原生验收](native-mac-acceptance-2026-10-09.md)、[浏览器记录](browser-validation.md)、[V6 JSON](browser-self-test-v6-result.json)、[唱机重载 JSON](browser-turntable-v6-result.json)、[动态效果 JSON](browser-pet-motion-v5-result.json)、[公共曲库检查](live-catalog-check.md)、[PR 整合说明](pr4-integration.md)。

## 已记录的远端 CI：旧提交通过，原生修复新提交待验

草稿 [PR #5](https://github.com/ooooooomygosh/album-web/pull/5) 的提交 `3b2f70d3875af19ed1277cac28d1c2d2c5a83959` 已完成 [GitHub Actions Checks #37869344271](https://github.com/ooooooomygosh/album-web/actions/runs/37869344271)，结论为 **success**。依据为连接器读取的运行状态、任务步骤、完整任务日志与产物元数据，不是仅观察到工作流文件。

- 桌面 Node：**148/148 通过，0 失败**
- 音频生命周期：**16/16 通过，0 失败**
- 音乐适配器构建、Vite 生产构建：通过
- 独立 Chromium Playwright 浏览器冒烟：**23/23 检查通过**，包括场景／伙伴、1440×900 与960×600、收藏笔记及删除、生成 WAV、备份导出／无效导入／合并、PNG、壁纸与桌宠渲染夹具，以及删除后不得再次自动保存笔记的回归
- [浏览器产物](https://github.com/ooooooomygosh/album-web/actions/runs/37869344271/artifacts/11589263956)：27 个文件，包含报告与截图，GitHub 保留至2026-10-23

初次远端运行 #37868948441 暴露了唱片卡片卸载时使用旧笔记闭包重复保存、删除后夹具 PATCH 崩溃的问题；已用持久化笔记引用、删除意图保护、正确404响应和显式回归断言修复，后续上述运行通过。[结构化 CI 证据](ci-browser-smoke-37869344271.json)保留了精确检查名称与提交／运行／产物标识。

这个结果只适用于上述提交。V5／V6 是较早的夹具预览快照，不能声称包含最新提交；远端冒烟成功也不构成真实音乐账号、原生壁纸或安装包验收。

## 尚未执行或解决

- 本地执行环境仍限制 Chromium 启动；独立 Playwright 已在上述 GitHub 托管 CI 中通过，不再把本地限制等同于远端未验收
- QQ 整曲自然结束、会员／地区覆盖、退出与旧收藏 mediaMid 自动补全；QQ 我的歌单浏览／批量导入未实现；网易云真实账号、Music Assistant 实际服务器／音箱、系统 Music／Spotify 真实控制未验收
- macOS 桌宠真实拖动／透明透传未完成；Spaces／全屏边界、显示器热拔插未运行。macOS Intel／Apple Silicon 安装包、Windows 原生行为及系统权限检查仍未验收
- 任意第三方插件市场／权限沙箱与官方 Apple Music、Spotify 内嵌 SDK 接入并未实现；不能把内置工具注册表或系统播放器控制冒充这些功能
- 根目录依赖审计已清理至零；桌面依赖上次成功审计仍有 15 项告警（含依赖传播），详见[依赖审计](dependency-review.md)。有限调用路径检查不是无漏洞保证，也不以强制降级掩盖问题
- 根项目许可与组合 GPL 模块的分发义务仍需明确；本轮不擅自重新许可

## 发布与验收方式

统一开发分支整合 PR #4 至 `f4b422b`，保留本轮五伙伴／五场景与安全回归；最新火焰更新另有确定性测试和空画布回退检查。V6 浏览器证据对应较早的合并快照，不能作为最新火焰更新的完整浏览器验收。

草稿 PR 用于审阅代码、运行远端 CI 和跟踪剩余验收，不代表生产发行或原生账号功能全部通过。以 PR 的实际 Checks 为准，不把旧提交的成功转用到新提交。模拟预览不替换生产域名。
