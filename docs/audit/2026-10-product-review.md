# Flow Cabin 产品审查与本轮验收

审查基线：`db029819dacc6c12588041b07cd72f71656a6bd5`（v1.7.0）。本轮目标：让「选择房间 → 选择伙伴 → 放一张唱片 → 开始专注」成为连贯体验。本文记录需求与边界，测试结果另见验证报告；功能存在不等于已在真实账号、所有操作系统验证。

## 1. 产品判断

现有唱片收藏、播放源、专注和桌面窗口基础值得保留。主要问题不是缺少更多面板，而是场景与角色选择不足、主窗口与伴随窗口的状态契约脆弱、音乐连接状态含义不清，以及运行时安全和回归测试不足。

参考 [Chill Pulse／心流小筑](https://store.steampowered.com/app/2826180/Chill_Pulse/) 的安静空间、计时、音乐、陪伴循环，不复制它的美术或界面。Flow Cabin 保留自己的唱片架和黑胶收藏定位。

### 体验原则

- 内容和房间是主角；设置集中于「布置小屋」，不要不断增加工具栏按钮
- 五种伙伴须有不同轮廓和动作，不能只是给同一只猫换颜色
- 新场景必须有不同的空间主题，保留唱片架与唱机的可操作位置
- 切换房间或伙伴不能重置专注、丢失唱片或打断声音
- 不设置喂养惩罚、专注中打扰或付费解锁；减少动态效果有完整静态呈现
- 收藏元数据、试听、真实平台播放、控制外部播放器必须明确区分

## 2. 本轮范围与验收

| 范围 | 验收要求 | 验证方法 |
|---|---|---|
| 五种伙伴 | 猫、小黄鸡、兔、熊、狐狸；六种状态；原始猫兼容 | 模型测试、逐帧检查、桌宠页面渲染 |
| 五套场景 | 旧像素／写实木屋 + 林间、海边、星夜；独立原创画面 | 图片完整加载、布局截图、场景元数据测试 |
| 布置面板 | 可预览、持久保存、键盘可操作；错误反馈 | 浏览器操作与重载 |
| 跨窗口 | look/petId 验证后进入桌宠／壁纸，只传显示数据 | 契约测试、受控桥接页面测试 |
| 专注与待办 | 自由专注、任务清理、睡眠恢复、DST统计正确 | 确定性时间和状态回归测试 |
| 音乐 | 音源切换、异步取消、退出、权限错误不误报成功 | 音频夹具与服务单元测试；真实账号另验 |
| 桌面安全 | 令牌不得随服务器变更泄漏；路径与窗口边界 | 安全回归测试 |
| 可维护性 | 构建、全部 Node 测试、浏览器回归进入 PR CI | 精确提交的 CI 结果 |

## 3. 音乐接入的真实边界

- 本地音乐：索引本机文件、保留原位置、受控范围读取。文件标签支持不等于浏览器支持所有音频编码
- 系统播放器：Windows 使用系统媒体控制；macOS 当前支持 Music 与 Spotify，受系统自动化权限影响。它是控制已有播放器，不是在小屋内获得平台流媒体授权
- QQ／网易云：当前使用 Simple Music 的非官方接口与用户自己的登录会话。会员、地区、购买、试听、接口变更均可能影响播放。保存登录不等于账号已通过服务器验证
- Music Assistant：控制用户已有服务器与选定远端播放器，不自动安装服务、不等于本机出声
- Apple Music 全量内嵌播放需要 MusicKit 开发者配置、用户授权及适用订阅；Spotify 内嵌播放需要 PKCE、Premium、SDK/DRM支持及开发模式用户限制。没有凭证和真实设备测试时不能标注完成
- 本轮不会自动创建开发者账号、生成长期访问密钥、绕过版权／会员限制，或把未公开授权接口宣称为官方接口

官方核对入口：[Apple MusicKit](https://developer.apple.com/musickit/)、[Spotify PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)、[Spotify SDK](https://developer.spotify.com/documentation/web-playback-sdk/reference)、[Spotify 配额](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)、[Music Assistant](https://www.music-assistant.io/music-providers/)。

## 4. 平台、部署与插件

当前产品是 Electron 桌面软件。`vite build` 产物不是拥有完整桌面权限的在线服务；不能把网页预览成功当作桌面部署成功。桌面壁纸原生实现针对 macOS／Windows，Linux未实现。macOS当前采用 ad-hoc 签名，不等于公证分发。

扩展采用可审查的内置模块与场景／角色目录；不引入任意下载脚本执行器。第三方插件市场、未审查插件的权限沙箱，以及云端账号同步是独立范围，不能用几个开关冒充完成。

## 5. 发行前待确认

- 在 macOS Intel／Apple Silicon、Windows 上运行打包客户端与窗口行为测试
- 在本人授权下逐平台验证登录、完整歌曲超过试听时长、切歌、定位、重启与退出
- 确认实际发布目标；预览构建不替换线上生产部署
- 仓库根目录没有明确项目许可证；已组合 GPL-3.0-only Simple Music 模块。必须明确相应源码和分发许可义务，不能仅凭致谢宣称合规。本轮不替所有权人擅自给整个项目重新授权
- 所有后续 PR 或冲突修复都应对最终提交重新测试；不把旧提交的绿色状态转用到新代码

## 6. 可借鉴项目

[lofi-engine](https://github.com/meel-hd/lofi-engine)（MIT，声音／沉浸模式）、[NextBeats](https://github.com/btahir/next-beats)（MIT，已归档，混音体验）、[PixelPet](https://github.com/guscatalano/PixelPet)（MIT，角色与窗口交互）、[Simple Music](https://github.com/Yyyangshenghao/simple-music)（GPL-3.0-only，现有依赖）。本轮新角色与背景为原创代码绘制，不导入这些项目的品牌角色素材。
