# Album Circle macOS / Windows 客户端 1.5.1

默认本地模式：软件在用户数据目录保存收藏，无需注册或远程数据库。搜索与平台播放需要联网；手动添加、展柜浏览、黑胶样式、唱片盒和已有收藏的管理可离线使用。

在软件设置的“本地与云端”中切换模式，两个模式分别保留数据。云端账号沿用原站。登录云端后可返回本地模式，在“收藏与分享”发布只读展柜快照。访客无需账号；快照包含当前房间的专辑和视觉配置，购买记录、平台凭据及其他房间不会发布。链接可撤回；后续修改需要重新发布。也可手动把本地专辑同步到专用云端房间，重复同步仅替换此前由客户端上传的条目。

`npm run build:local` 将本地 API 编译进客户端。`collection.json` 保存在应用用户数据目录的 `local/`，安装包不含环境密钥。macOS 系统字体通过系统字体清单读取，动态桌面采用 Electron 的 macOS desktop 窗口；Windows 继续使用 `DesktopHost.exe`。Mac 的 Windows helper 构建步骤自动跳过。

跨平台发布：根目录和 desktop 目录分别安装依赖。macOS 运行 `npm run dist:mac`；Windows 运行 `npm run dist:win`。文件输出到 `desktop/release/`，macOS 两种芯片分别生成 DMG 和 ZIP，Windows 生成安装版及便携版。GitHub 标签触发三组构建，所有检查通过后生成 Release 和 SHA256 校验文件。当前 Mac 包采用 ad-hoc 签名，没有 Apple 公证；Windows 未设置发布者证书。

下方为 1.4.0 原始交付功能记录，历史验收数量和 Windows 路径保留用于追溯；1.5.1 的验证以当前测试及 GitHub 构建结果为准。

# Album Circle Windows 联网客户端 1.4.0

交付包含原始展柜、写实/像素木屋、Coverflow、唱片盒、每张黑胶的底色/透明度/最多三种泼溅颜色、购买记录、Discogs 入口和专辑墙 PNG/JSON 编辑器。账号、房间、评论和收藏继续使用原站 https://album-circle.vercel.app，桌面包携带修正后的前端，原始代码目录保持下载时提交不变。

房间按原图片纵横比铺满客户区，中央四列三排唱片位置固定，↓ / ↑、滚轮和 Home / End 逐排浏览。单击选择，底栏查看详情；双击封面或拖到唱机放盘。唱机使用 CSS 3D 透视、机身厚度、唱臂和旋钮，摆在带侧面与支脚的木柜上。小窗口只滚动木柜面板。像素模式渲染时像素化封面，原始资源保持不变。

设置使用顶栏齿轮或 Ctrl+, 打开，修改立即保存并应用。内置原始 HarmonyOS Sans SC 六个真实字重，也可选本机字体；支持配色、缩放、减少动效、展柜风格和购买开关。F11 全屏，Esc 退出。窗口按钮集成在应用顶栏。背面文字移除多余滤镜和缩放，添加动画由封面遮挡部分黑胶，详情按列排布避免曲目遮住正文。

## 音源与音乐服务

默认「仅动画展示」不发声。在房间「音源设置」中通过独立音乐平台官网窗口登录 QQ / 网易云，然后在唱机选择平台。EXE 按需启动只监听 127.0.0.1 随机端口的服务，原生层注入服务令牌，前端通过 `/desktop-music` 使用有限接口。平台 Cookie 与 Music Assistant 令牌由 Electron safeStorage 加密保存。

有 QQ 原始单曲 MID 时直接定位；只有名称或切换平台时展示候选，用户选择版本后才播放，不自动替换收藏的封面与曲目。Audio 实际播放事件确认播放状态，支持暂停、进度、音量、切曲、自动下一首；失败显示权限或网络错误并停止旋转。离开房间释放 Audio。音频采用支持 Range 的流式响应，不保存音乐文件。平台会员、版权与地区限制仍生效。

Music Assistant 连接用户已有服务器，通过 HTTP POST `/api` 和 Bearer 令牌搜索原始 URI、选择已配置播放器并控制其队列。声音由服务器播放器发出，客户端不重复播放；保存配置立即刷新唱机连接。没有部署或嵌入 Music Assistant 服务器。

Simple Music 使用的模块在 `vendor/simple-music`，固定提交 `da4db22e8e15cf400ff23fc261686ae73a4f8197`，GPL-3.0-only 原始许可、对应源码、构建脚本和锁文件随交付保留。仓库 https://github.com/Yyyangshenghao/simple-music 。MA 接口参考 https://github.com/music-assistant/server 提交 `a813bcd44da9bac651eaabf08e9ede890dfaba53`；安装说明 https://www.music-assistant.io/installation/ 。完整参考源码在项目的 `参考源码` 目录。

## 动态桌面

「设为桌面动态背景」创建独立只读窗口，使用自行编写的 C# Win32 helper 挂到 Windows 桌面图标后方。仅同步12个封面、行号、当前唱片、曲目和样式，不传账号/音源令牌，不重复播放音频。每750毫秒同步，渲染上限30 FPS，原生层每10秒检查。

开启后关闭主窗口隐藏到托盘；托盘可恢复、停止或退出。退出释放自己的窗口与本机服务，不修改系统静态壁纸，不重启资源管理器。注销停止背景，离开房间保留场景并暂停旋转。当前一次使用主窗口所在显示器，不设置开机启动；更多多屏与系统组合需要后续兼容验收。

## 数据与维护位置

业务 WebContentsView 禁用 Node、启用沙箱和上下文隔离，原生层只提供有限窗口/设置/平台登录/背景命令。外链使用系统浏览器，登录窗口使用隔离分区。没有打包 Firebase Admin、AI 密钥或后台环境变量。本机资料在 `%APPDATA%\Album Circle`，库偏好按账号隔离，唱片盒和房间外观按房间保存，换电脑不自动同步。清除原站登录保留个人购买与唱片盒；平台登录在音源设置另行退出。

| 位置 | 职责 |
| --- | --- |
| `src/CabinRoom.jsx`、`RoomScene.jsx`、`room-model.mjs` | 固定唱片架、浏览、放盘和场景几何 |
| `src/RoomTurntable.jsx`、`room-immersive.css` | 立体唱机、木柜与响应式面板 |
| `src/useRoomPlayback.jsx`、`MusicSettings.jsx` | 音频生命周期、版本选择与服务器设置 |
| `desktop/music-service.cjs`、`music-policy.cjs` | 回环服务、凭据、流式音频和 MA 命令 |
| `desktop/wallpaper*.cjs`、`native/DesktopHost.cs` | 只读快照与原生桌面窗口 |
| `src/RecordLibrary.jsx`、`record-library.mjs` | 唱片盒、筛选和黑胶样式 |
| `src/AlbumWall.jsx`、`album-wall-*.mjs` | 本机专辑墙与 PNG/JSON 导出 |

## 构建与验收

环境：Windows 11 x64、Node.js 24.18.0、npm 11.16.0、Electron 44.6.0、electron-builder 26.15.3、Playwright 1.63.0。两层依赖由 package-lock.json 锁定。原生 helper 用 Windows .NET Framework 4 的64位 csc.exe 编译，输出随包携带。

```powershell
cd 'D:\Codex Project\Album wall\开发代码\desktop'
npm --prefix .. ci --omit=dev --ignore-scripts
npm ci
# npm 如阻止 Electron 安装脚本，执行：
node node_modules/electron/install.js
npm start
npm test
npm run dist
```

prestart/predist 自动构建原生 helper、音乐模块及前端，输出到 `发布版本/Windows`。设置 `ALBUM_QA_EXE` 为 `win-unpacked/Album Circle.exe`，可执行 test:integration、test:search、test:motion、test:settings、test:showroom、test:purchases、test:delivery、test:library、test:room 和 test:music。

交付验收共145项：32规则/模型、12集成、6搜索、8动画、9设置、14展柜、8购买、19界面/专辑墙、12唱片盒/黑胶、15沉浸房间/桌面、10音乐。测试使用隔离账户响应并阻止生产写入；QQ 元数据及封面是真实请求，音乐链路用静音 WAV，MA 用官方协议模拟服务器。实际平台登录、会员曲目与用户自己的 MA 服务器还需使用其账号与设备验收。QQ 游客播放检查返回登录/授权限制，网易云搜索可返回候选。

本版本没有数字签名和自动更新，安装版未做交互安装流程。原站 AI 使用 DeepSeek/Tavily 配置，本次未调用付费 AI。原项目 https://github.com/ooooooomygosh/album-web 固定提交 `855a631eec33bd8063bef3698c8ac5e066f178e3`。当前交付为 Windows EXE，APK属于后续设计范围。
