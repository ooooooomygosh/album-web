# macOS 原生验收：2026-10-09

原生验收基线：PR #5 / `32f2d9683620227583ae5afef8f4091fec2a8129`，加上下述最小修复。此报告记录原生工作副本的测试结果；整合后的提交仍需单独运行 CI。此验收没有合并 PR、触发发行或修改生产部署。此公开版本已移除个人路径、账号会话信息及桌面操作细节。

## 环境与数据隔离

- macOS 26.5.2，Apple Silicon arm64；真实 Electron 44.6.0 / Chromium 152，Electron 内部 Node 24.21.0。
- 外接 LG ULTRAGEAR：1920×1080 逻辑像素、2×、约144Hz；内建 Retina：1728×1117、2×、约120Hz。
- 使用独立检出与隔离测试数据目录；未重置或清理既有工作。
- 使用独立测试配置；未读取原有应用数据。验收日志不记录 cookie、凭据或完整签名音频 URL。
- 含账号状态的测试数据目录不属于验收证据，不收录到仓库。
- 界面内容来自真实本地构建、QQ 公共曲库和已授权播放服务；没有加载 ui-fixture 或模拟音乐接口。背景取消测试明确注入协议延迟，故障检查明确注入缺失资源和真实 renderer crash。

## 原生验收矩阵

| 项目 | 结果 | 实际证据与范围 |
| --- | --- | --- |
| Electron 启动 | 通过 | 隔离 profile 启动真实窗口，读取运行时版本；`startup.png`、`report.json` |
| 五场景 / 五伙伴 | 通过 | pixel/cat、warm/chick、forest/bunny、seaside/bear、starlight/fox 在主界面、真实桌宠、真实动态背景中逐一同步；10张独立截图 |
| 选择保存恢复 | 通过 | 重启后 starlight 场景选择保留 |
| 桌宠启动 / 回家 / 置顶 | 通过 | 实际 BrowserWindow 启停、`isAlwaysOnTop()===true`、`isVisibleOnAllWorkspaces()===true`；这些属性不等于实际跨 Spaces 行为已验收 |
| 桌宠透明像素透传 / 真实拖动 | 未完成 | 原生输入测试受窗口定位、ScreenCaptureKit 截图错误和窗口状态保护限制而中止；不将桥命令或渲染截图算作系统透传通过 |
| 动态背景启停 | 通过 | 真实 macOS desktop 类型窗口；停止后窗口销毁，原桌面重新显露；没有调用系统壁纸设置接口 |
| 启动取消 | 通过（故障注入） | 独立壁纸协议延迟1500ms，真实开始/取消动作后 active=false、busy=false，延迟响应没有复活窗口 |
| 资源缺失失败恢复 | 通过 | 临时移走本工作副本的构建产物 wallpaper.html，获得明确错误并回到 idle；恢复文件后真实重试成功 |
| renderer 崩溃恢复 | 通过 | 强制终止实际背景 renderer，UI提示异常、销毁窗口；重新启动成功 |
| 双屏 | 通过（限定范围） | 分别把主窗口移到两个实际屏幕后启停背景；目标显示器、逻辑宽高一致，背景不置顶、不可聚焦；未测热拔插或同时铺满两屏 |
| Spaces / 全屏切换 | 未运行 | 仅验证所有工作区属性；未创建/切换用户 Spaces，未测全屏边界 |
| 一分钟专注 | 通过 | 无模拟时钟。设置1分钟、关闭测试内通知和提示音；隐藏窗口继续倒计时；中途重启保留 endsAt；完成后保存60000ms session和1条奖励 |
| 系统媒体空闲 | 通过 | 实际 macOS桥返回无活跃支持播放器，控制禁用；`system-media-idle.png` |
| Music / Spotify 实际控制 | 未运行 | 本机没有这两个支持播放器运行；没有新增自动化权限。小屋内 QQ 登录不验证这一条路径 |
| QQ 登录状态 | 通过（人工登录） | 播放服务能够识别测试会话；不以登录状态推断会员资格 |
| QQ 搜索 / 收藏 | 通过 | 真实曲库搜索《七里香》，10首曲目；原生验收专辑使用相同真实资料并标记测试标题 |
| QQ 实际音频播放 | 修复后通过（限定曲目） | 《我的地盘》244.640204秒：进度3.267→6.270秒、paused=false、无媒体错误；《七里香》299.200113秒：下一首后进度超过1秒 |
| QQ 暂停 / 继续 / 下一首 | 修复后通过 | 暂停进度保持71.060977秒；恢复推进到72.066005秒；下一首确实加载第二首音频。恢复有短暂缓冲，初次固定1.8秒断言过严，改成等待真实进度并通过 |
| QQ 整曲自然结束 / 会员与地区覆盖 | 未运行 | 没有完整等待两首歌曲自然结束；结果不能外推所有歌曲、会员曲目或其他地区。返回trial=false与约4/5分钟时长仍不构成全库授权保证 |
| QQ 我的歌单浏览 / 批量导入 | 未实现 | 已向用户直接说明；现有登录提供播放凭据，界面没有歌单同步入口。没有为此次验收添加新功能 |
| 网易云真实账户 / Music Assistant | 未运行 | 无对应测试账户、实际服务器或音箱 |
| 安装包 / Intel / Windows | 未运行 | 本次是Apple Silicon开发版原生验收，没有打包、安装或验证签名/公证 |

## 发现与最小修复

1. **QQ 合法候选镜像被首选 CDN 拦住**。真实上游首选主机为 `aqqmusic.tc.qq.com`，不在既有白名单；同一曲目同时有允许的 `sjy6.stream.qqmusic.qq.com` 镜像。服务现在在首选不通过时选择已验证候选，不扩大主机白名单，也不接受本地地址、带凭据URL或上游标记不可播放的候选。签名URL仍只留在服务内。
2. **QQ 音频文件标识丢失**。歌曲 mid `004WrpV81DMGHv` 对应的文件 media_mid 为 `0025nWDH4PCVfs`。旧元数据导入没有保留这个字段，exactTrack 也没有传它，导致错误文件名产生真实404。现在单曲/专辑元数据保留 mediaMid，并传给解析服务。修复后两首真实歌曲开始播放，暂停/继续和下一首通过。
3. **macOS目录别名无法移除**。addFolder 保存 realpath，removeFolder 却比较原始路径；macOS临时目录别名触发已有并发扫描测试失败。现在移除时同样 canonicalize，增加显式符号链接别名回归。

**旧数据边界：** 本次没有迁移或覆盖既有收藏。此前导入且缺失 mediaMid 的 QQ 记录没有被自动补全；只重载旧记录可能继续请求错误文件。正确字段来自重新取得的曲库资料，验收使用重新导入的测试记录验证。自动补全旧收藏仍需另行实现、审核并验证，不能声称本补丁已完成迁移。

修改文件：`desktop/music-service.cjs`、`desktop/qq-music.cjs`、`src/room-playback.mjs`、`desktop/local-music.cjs`；回归覆盖位于 `desktop/test/music.test.cjs`、`search.test.cjs`、`runtime-security.test.cjs`。

## 自动检查及交付

- 修复后 `npm run check`：151/151 桌面 Node、16/16 音频测试、Vite构建通过；桌面本地网页构建通过；`git diff --check`通过。
- 测试驱动终端Node为26.0.0（根项目声明24.x）；原生Electron内部使用24.21.0。CI仍需在整合补丁后的新提交运行，不能复用旧提交的远端成功。
- 云端整合复验（Node 24.19.0）：`npm run check` 的151项桌面测试、16项音频测试与生产构建通过；`npm --prefix desktop run build:music`、`npm --prefix desktop run build:web` 和 `git diff --check` 通过。此复验不重复原生平台操作，也不替代新提交的远端CI。
- 原始证据包括结构化测试报告、自动检查日志、桌面构建日志和截图；原始私人证据未复制到公开仓库。报告保留调试阶段失败和预期故障注入，不声称一次全通过。
- 主要截图：`five-picker.png`、`pet-{cat,chick,bunny,bear,fox}.png`、`wallpaper-{pixel,warm,forest,seaside,starlight}.png`、`display-{1,2}-wallpaper.png`、`wallpaper-missing-resource.png`、`wallpaper-crash.png`、`qq-playback.png`（修复前）、`qq-after-fix.png`、`qq-next-track.png`。
- 此报告随最小修复一同整合；不代表远端新提交的 CI 结果。
- 测试结束后已销毁测试背景、桌宠和诊断窗口；未更改系统壁纸。

依赖15项历史告警、根项目/GPL分发义务、未实现的官方 MusicKit/Spotify 内嵌SDK及第三方插件市场边界仍然保留。此次局部原生通过不表示产品全部完成、依赖清洁或可直接正式发行。
