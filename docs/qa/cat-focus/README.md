# 猫咪活动、夜景毛色与专注分钟显示

基线：`d7ee5a6a6cfd57a4680a62bc4260b4528a740354`。
独立集成分支：`feature/cat-ambience-focus-display`。供主任务 cherry-pick 至草稿 PR #4；未合并、发布或部署。

## 行为与存储

- 猫咪每次挂载选择 90–150 秒休息间隔，随后用 8 秒走完最多 16 CSS px 的往返路径。正在专注、播放音乐、庆祝或被摸时保留既有行为；休息阶段改为间歇散步。桌宠仅改变窗口内元素位置，原生窗口仍只响应既有用户拖动。
- 系统或应用减少动态效果偏好禁用散步和帧动画。隐藏页面暂停猫行为时钟与绘制，恢复可见后重新休息；取消 rAF、清理 interval 和监听器。房间猫出门时停止房间猫绘制。
- 在专注工具 → 统计 → 小猫毛色选择柔光橘猫/黑猫。素材来自现有代码生成像素网格；两种调色板降低高亮，并保留黑猫的炭灰轮廓、眼睛和面部层次。
- 在番茄钟 → 计时设置勾选“隐藏秒数（仅显示剩余分钟）”。正数剩余时间按分钟向上取整，1ms 仍显示 1 分钟；数字、无障碍标签和进度条均不逐秒变化。倒计时、暂停/恢复、完成奖励继续使用原毫秒时间戳。
- 偏好持久化到既有 `album-circle-focus-v1:<userId>` 的 `settings.hideSeconds` / `settings.catSkin`。通过既有 `focus` 展示快照与 `cleanFocus` 白名单传递两个标量；**无新增 API、IPC、preload 方法或命令**。旧数据默认显示秒数、柔光橘猫。未改雪/火/光照逻辑。

## 验证

环境：Linux x64、Node 24.19.0、npm 11.9.0、Electron 44.6.0，Xorg dummy `DISPLAY=:99`。

通过：

- `npm run build`
- `npm --prefix desktop run build:web`
- `npm run desktop:test`：65/65（含新增 3 项纯逻辑测试）
- `DISPLAY=:99 npm --prefix desktop run test:cat-focus`：9 项真实 Electron 专项检查，零 pageErrors，见 [报告](electron-report.json)
- `DISPLAY=:99 npm --prefix desktop run test:focus`：9 项既有专注回归
- `DISPLAY=:99 npm --prefix desktop run test:pet`：6 项既有桌宠回归
- `DISPLAY=:99 npm --prefix desktop run test:improvements`：9 项既有唱机、颜色、壁纸协议回归
- `DISPLAY=:99 npm --prefix desktop run test:cover-editor`：4 项延迟取色回归
- `git diff --check`

专项测试覆盖：散步前至少 89 秒休息、有限路径、返回休息；系统与应用 reduced-motion；后台绘制暂停与恢复；卸载后的房间 sprite 无后续绘制；分钟边界与静态进度；暂停/恢复、完成仅触发一次；重载保留偏好；真实桌宠皮肤同步且原生窗口 bounds 不变；独立壁纸协议页的毛色与分钟快照更新。

Linux 壁纸协议页验证不等于 Windows/macOS 原生桌面挂载通过。后两平台挂载与视觉体验仍由主任务/验收补验。

## 截图

- [橘猫短途散步](cat-orange-walking.png)
- [夜景黑猫与毛色设置](cat-black-room.png)
- [黑猫独立桌宠](cat-black-pet-walking.png)
- [隐藏秒数设置与分钟显示](focus-hidden-seconds.png)
- [壁纸协议页中的分钟显示和黑猫](cat-wallpaper-hidden-seconds.png)

截图使用隔离测试数据。桌宠截图的休息分钟源于模拟时钟推进，不是原生窗口自动移动。
