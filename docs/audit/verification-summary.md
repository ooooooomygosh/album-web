# 本轮验证汇总

日期：2026-10-08。基于主线 `db029819` 的产品改进，加上草稿 [PR #4](https://github.com/ooooooomygosh/album-web/pull/4) 的 `d7ee5a6` 及本地整合修复。

## 已执行

- `npm run check`：148 项桌面 Node 测试 + 16 项音频生命周期测试通过；Vite 生产构建通过
- `npm --prefix desktop run build:music`：桌面音乐适配器重新生成成功
- `npm --prefix desktop run build:web`：桌面三页面入口构建成功；随后相同入口继续通过生产构建
- `git diff --check`：通过
- V6 实际云浏览器、960×600：31/31 夹具自测通过，捕获运行时错误为空；不是仅存在一份测试脚本
- 真实指针移动唱机并重载：位置、林间场景与兔子选择保留；Home 复位再重载也保持
- V5 实际画面采样：正常动态 10 次取样出现 4 个不同帧；减少动态效果 10 次完全相同
- 公共 QQ／iTunes 元数据接口有真实 HTTP 检查；修复后 iTunes 首两项专辑为 17/17 曲目，部分其他候选仍明确标记不完整

证据：[浏览器记录](browser-validation.md)、[V6 JSON](browser-self-test-v6-result.json)、[唱机重载 JSON](browser-turntable-v6-result.json)、[动态效果 JSON](browser-pet-motion-v5-result.json)、[公共曲库检查](live-catalog-check.md)、[PR 整合说明](pr4-integration.md)。

## 尚未执行或解决

- 独立 Playwright 套件因执行环境启动限制未完成；仓库 CI 已定义，但尚未对本轮远端提交执行
- 真实 QQ／网易云会员账号的登录、完整播放、地区限制、重启和退出；Music Assistant 实际服务器／音箱；系统播放器真实控制
- macOS Intel／Apple Silicon、Windows 的安装包与原生壁纸、穿透、窗口、多屏及系统权限检查
- 任意第三方插件市场／权限沙箱与官方 Apple Music、Spotify 内嵌 SDK 接入并未实现；不能把内置工具注册表或系统播放器控制冒充这些功能
- 根目录依赖审计已清理至零；桌面依赖仍有 15 项上游公告。有限调用路径检查不是无漏洞保证，也不以强制降级掩盖问题
- 根项目许可与组合 GPL 模块的分发义务仍需明确；本轮不擅自重新许可

## 发布与验收方式

统一开发分支整合 PR #4 至 `f4b422b`，保留本轮五伙伴／五场景与安全回归；最新火焰更新另有确定性测试和空画布回退检查。V6 浏览器证据对应较早的合并快照，不能作为最新火焰更新的完整浏览器验收。

草稿 PR 用于审阅代码、运行远端 CI 和跟踪剩余验收，不代表生产发行或原生账号功能全部通过。以 PR 的实际 Checks 为准，不把旧提交的成功转用到新提交。模拟预览不替换生产域名。
