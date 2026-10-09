# 产品呈现与上手体验打磨

日期：2026-10-09。基线为远端 main `f46bdf6a30b63faca8937e3fef4b81bf57ce268a`（v1.8.0）。开发在独立副本与 `polish/product-presentation` 分支进行，没有改动其他验收副本、个人数据或账号，没有推 main、打标签或发布版本。

## 设计与参考

定位是「听一张喜欢的唱片，安心做完这一轮」。采用[Zen](https://github.com/zen-browser/desktop)的短首屏导航、[AppFlowy](https://github.com/AppFlowy-IO/AppFlowy)的下载优先结构，以及[MusicFree](https://github.com/maotoumao/MusicFree)明确解释音源边界的方式；同时参考了父任务对[AFFiNE](https://github.com/toeverything/AFFiNE)与[MusicFreeDesktop](https://github.com/maotoumao/MusicFreeDesktop)的研究。只借鉴信息组织，不复用品牌、图片或角色素材，也不把其功能写成小屋功能。

## 已实现

- README 从 140 行精简至 103 行：定位、平台、下载和一张实际主界面截图位于首屏；三个体验故事代替审计流水账与重复图组。
- Mac arm64、Mac x64、Windows x64 安装／便携下载分别直达 v1.8.0 发布文件，顶部「下载最新版」指向稳定 Release 入口。所有文件名经 GitHub Release API 核对存在；不使用未来会失效的「latest + 固定版本文件名」组合。
- 新增[上手指南](../getting-started.md)、[完整边界](../limitations.md)、[贡献指南](../../CONTRIBUTING.md)、Issue 表单和 PR 模板。保留历史审计证据，标清人工验收的补充和未实现项。
- 空收藏可「添加第一张专辑」或「先专注一会儿」；后者打开番茄钟面板，仍需明确点「开始专注」才计时。空收藏不再显示没有内容的底部信息条与翻页器，十二张以内也不显示无用翻页器。
- 闲置时专注入口显示当前时长和面板展开状态；唱机明确提醒展示模式无音频、听歌前需选音源；选中唱片提示双击放盘，伙伴补充轻量悬停互动提示。
- 桌面尺寸下，布置窗口的五场景排成一行，五伙伴、名字与返回入口完整可见；紧凑尺寸仍可使用面板滚动。没有更改播放解析、计时状态机、存储键或原生桌面逻辑。

## 截图来源与脱敏

三张公开图：[小屋](../images/showcase/cabin.jpg)、[专注](../images/showcase/focus.jpg)、[布置](../images/showcase/personalization.jpg)。来自本分支实际 React 界面在隐藏 Chromium 中的渲染，不是原画假装截图。唱片是代码生成的原创示意图，数据在内存及隔离浏览器上下文中，未登录真实音乐账号。专注图通过点击实际按钮开始计时；没有注入完成记录或奖励。

生成命令为 `npm run screenshots:product`，已有 Chromium 可通过 `BROWSER_EXECUTABLE` 指定。脚本阻止外部请求与原生动作，等待缩略图解码后截图，并执行对应交互断言。所有新图只包含小屋界面，无账户、个人路径或其他窗口。没有可见窗口操作，也未触碰用户桌面。

桌面与紧凑尺寸的空收藏、主界面、五场景、沉浸截图及报告随任务交付；未将完整截图重复堆到 README。截图使用减少动态效果，不能作为原生窗口性能验收。

## 本分支已验证

运行时 Node.js 24.14.0；从锁定文件安装依赖。最终代码完成以下检查：

| 检查 | 结果与范围 |
| --- | --- |
| `npm run qa` | 通过：151/151 桌面 Node、16/16 音频生命周期、前端生产构建、音乐适配器构建、23/23 浏览器回归 |
| `npm --prefix desktop run build:web` | 通过：Electron 本地网页产物构建 |
| `npm run screenshots:product` | 8/8 检查通过：两尺寸空收藏双路径、十二张无冗余翻页、无音频提示、开始／暂停、完整伙伴名字与缩略图、点击互动、沉浸进出、五场景紧凑工具可达 |
| 1440×900 与 960×600 人工图片检查 | 空收藏按钮不重叠，主界面可读，布置窗口完整显示；五场景紧凑图逐一生成 |
| GitHub Markdown API | 成功返回实际 GFM HTML，含品牌首屏、两个表格、详情折叠、图文与链接；本地隐藏浏览器载入 4 张图片（含图标），0 张损坏 |
| 本地文档链接、脚本语法、`git diff --check` | 通过 |
| 锁定依赖安装审计 | 根目录 0；桌面 15（9 moderate、6 high），本次未改变依赖或自动强制修复 |

机器结果：[本次浏览器报告](product-presentation-browser.json)、[截图与交互报告](product-presentation-showcase.json)。前者保持既有 23 项夹具边界，后者记录新增路径；错误与意外请求列表均为空。

初次在受限 shell 中运行检查时，回环服务器因 EPERM 被阻止；经执行环境审查允许后成功运行。GitHub CLI 没有登录，未新增授权；改用公开 Markdown API 成功取得 HTML。没有因此改动系统权限或读取其他任务凭据。

## 未验证与尚未执行

- 新分支未推送，未创建 PR，未运行新提交远端 CI，也未更改 GitHub About／topics／主页网址。API 渲染和本地排版预览不是已发布的仓库页面截图。
- 本轮不重复真实 QQ 账号、原生桌宠／动态桌面或安装包验证；沿用明确标注的 v1.8.0 验收事实，不能把隐藏浏览器结果算作新一轮原生验收。
- 未新增系统授权。Music / Spotify 控制、真实网易云／Music Assistant、Windows / Intel 功能完整验收、Spaces／热拔插仍未补齐。
- 依赖告警、根许可／GPL 组合发行义务、开发者签名与公证仍待解决；官方内嵌 SDK、QQ 歌单导入、通用插件市场、旧收藏标识自动补全仍未实现。[详细边界](../limitations.md)

## GitHub 仓库首页设置建议

以下是可审阅建议，本轮没有直接修改远端设置：

| 字段 | 建议 |
| --- | --- |
| About 描述 | 心流小屋 Flow Cabin：听歌、专注与像素伙伴陪伴的桌面小屋。A cozy music & focus cabin for macOS and Windows. |
| Website | 暂用 `https://github.com/ooooooomygosh/album-web/releases/latest`；待正式产品主页上线后再替换，不填旧夹具预览 |
| Topics | `electron`, `react`, `lofi`, `pomodoro`, `music-player`, `desktop-pet`, `macos`, `windows`, `local-first` |
| Social preview | 可选本次实际主界面图，按 GitHub 提示手动检查裁切；不使用其他项目素材或模拟账号图 |

没有建议加入官方 Spotify / MusicKit、插件市场或已许可标签，以免误导当前支持范围。
