# Album Circle — 点击封面无法进入详情页：修复报告

## 问题
用户报告：**进入房间后，点击封面无法直接进入详细介绍页面**。

## 根因（4 个并行子代理审核，结论一致，置信度 95%+）
`App.jsx` 维护了一份与 Zustand store **完全独立的本地 `useState` 副本** `routeState` / `mode`：
- 点击封面 → `cabinet.jsx` 调 `store.openItemDetail(item.id)`
- `useAppStore.js` 的 `openItemDetail` 更新的是 **store 的** `routeState`（含 `itemId`）与 `mode`，并 `pushState` 改 URL
- 但 `App.jsx:804` 的 `isDetailPage = mode==='showroom' && routeState.itemId && routeItem` 读的是 **App 本地** `routeState`
- 点击后 store 的 `routeState.itemId` 有值，本地那份没同步（popstate 不触发、相关 effect 依赖未变）→ `isDetailPage` 恒 `false` → 详情页不渲染

**表现**：地址栏 URL 变成 `?room=…&item=…`，但页面纹丝不动；F5 刷新深链能进、浏览器后退反而能进（这正是“点了没反应、退回去却有”的诡异来源）。
子代理确认“点击被覆盖层吞掉”的可能性 <5%（唯一确凿的拦截是搜索遮罩的首击失效，属边缘）。

## 修复（src/App.jsx + src/store/useAppStore.js）
1. **单一数据源**：`App.jsx:31/35` 的 `routeState`/`mode` 改回订阅 store（`useAppStore(s=>s.routeState)` 等），`setRouteState`/`setMode` 指向 store setter —— 所有调用点变量名不变，零改动成本。
2. **删除打架的旧 effect**：移除 `App.jsx:180-182` 的 `useEffect(()=>setRouteState(parseRoomQuery()),[mode])`（它会用 URL 反向覆盖刚写入 store 的 routeState，制造新竞态）。
3. **收紧重载 effect**：`App.jsx:227-233` 去掉 `setMode('showroom')`、加 `activeId` 守卫，避免 `items` 重载时把用户弹回展柜。
4. **渲染去重**：`App.jsx:971` 改用已定义的 `isDetailPage` 变量。
5. **补 `toast` import**：`App.jsx` 调用了 `toast.error` 却只 import `Toaster`（评论失败会白屏）→ 补 `import { toast, Toaster } from 'sonner'`。
6. **同源双副本缺陷一并修**：`initialLoading` / `ratingsByItem` 也收敛到 store（`ratingsByItem` 的 `loadRatingSummary` 改为先读 `useAppStore.getState().ratingsByItem` 再 set，因 store setter 不接受函数式 updater）。这修掉了“展柜永远骨架屏 / 评分永远待评分 / 按评分筛选展柜恒空”等可能混淆症状的隐患。
7. **store 收口**：`openItemDetail` 合并为单次 `set({ activeId, routeState, mode })` 并加 `items` 存在性校验。

## 验证（全绿）
- **`scripts/check-detail-render.mjs`（新，严格）**：点击封面 → URL 含 `item=`、详情页 `h2.ac-h1` 标题等于被点封面（`Blonde`）、陈列柜网格消失、浏览器后退回展柜、前进回详情、0 console/pageerror → **DETAIL_RENDER_OK ✅**
- **`scripts/verify-modernized.mjs`**：5 视口 × 7 视图 = **0 错误 / 0 横向溢出 / 0 空白 / 0 不可见瓦片**，a11y 与性能良好
- **生产冒烟**：`https://album-circle.vercel.app` 启动 0 错误（SMOKE_OK）

## 部署
清理陈旧 `.vercel/output` 后 `vercel deploy --prod`（云构建），生产别名 **https://album-circle.vercel.app**，上线 JS hash `index-IPp6gQpI.js` 与本地含修复 build 完全一致。

## 改动文件
- `src/App.jsx`（routeState/mode/initialLoading/ratingsByItem 订阅 store；删/收紧 2 个 effect；toast import）
- `src/store/useAppStore.js`（`openItemDetail` 合并 set + 校验）
- `scripts/check-detail-render.mjs`（新增严格验证）
