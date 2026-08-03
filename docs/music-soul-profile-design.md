# 音乐灵魂侧写 · 深度重构设计方案

> 目标：把「音乐灵魂侧写」（即现有 Persona 功能）做成 Album Circle 里最戳人、最像魔法、最不像 AI 的旗舰体验。
> 本文是**分析与设计方案**，实现前需确认（见文末「待确认决策点」）。
> 配套：已建立 Ardot 设计板 `音乐灵魂侧写 · 魔法重构设计板`（fileId `710775494098220`，本轮适配器抖动未完成绘制，恢复后补绘四屏）。

---

## 0. 现状盘点（基于代码实测）

「音乐灵魂侧写」= 现有 **Persona** 功能，代码成熟度不低：

| 位置 | 现状 |
|---|---|
| `lib/music-persona.js`（~1295 行，服务端） | 完整双管线：① compact 单调用 JSON；② legacy 五写手（音乐/生活/文化/推荐/视觉）合并。内置 Tavily 联网、`personaChat` 多轮追问、丰富输出 schema、`strengthenProfileLanguage` 反 AI 味清洗、安全词拦截。 |
| `api/ai/background.js` | 专辑 AI 导览（**另一个功能**，非侧写），模型 `deepseek-chat`。 |
| `src/components/persona.jsx` | `PersonaReport`（报告渲染）+ `PersonaChatBox`（追问对话）。 |
| `src/components/panels.jsx` | 面板内生成入口：tone 选择、historyMode 选择、代表作勾选、`generatePersona`。 |
| `src/App.jsx` | `generatePersona` / `askPersona` 调用，路由 `/api/ai/recommend?action=persona`(chat) 全部收口到 `musicPersonaHandler`。 |
| 模型变量 | `recommend.js`/`comment.js` 已默认 `deepseek-v4-flash`；**`music-persona.js` 两处 `deepseek-v4-pro`（965/1031）、`background.js` 两处 `deepseek-chat`（161/284）需统一**。 |

**现有 schema 已含**：专属称号（`archetype.title`/`profileName`）、听歌人格（`personalitySketch`）、隐藏偏好（`preferenceReading`/`tasteDNA`/`evidenceCards`）、塔罗（`oracleCards`）、音乐年龄（`musicAge`）、灵魂主稿（`essay`）、生活侧写（`lifeReading`）、推荐（`recommendations`）等。

**缺口（本次重构要补）**：
1. 没有「交互式补全」——用户被动接受，不参与；
2. 动效只是卡片淡入，没有「魔法/酷炫/神秘/好玩」的沉浸感；
3. 没有分享形态；
4. 选择题/小游戏完全空白；
5. 反 AI 味已有雏形，但还能更狠、更具体。

---

## 1. 模型统一重构：deepseek-v4-flash（thinking high · 1M · 384K）

### 1.1 目标
所有 AI 调用统一为 `deepseek-v4-flash`；`thinking=high`；上下文 1M；输出上限 384K。

### 1.2 改法（最小侵入 + 单一真相）
新增 `api/ai/_model.js`：
```js
export const MODEL = 'deepseek-v4-flash';
export function deepseekChat({ key, model = MODEL, messages, temperature = 0.8, maxTokens = 16000, thinking = 'high', reasoningEffort }) {
  return fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      thinking,                                   // 'high'
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {})
    })
  }).then((r) => r.json());
}
```
替换点：
- `music-persona.js` 965/1031：`process.env.DEEPSEEK_PERSONA_MODEL || 'deepseek-v4-flash'`
- `background.js` 161/284：`process.env.DEEPSEEK_BACKGROUND_MODEL || 'deepseek-v4-flash'`
- `recommend.js`/`comment.js`：改为引用 `_model.MODEL`，保持单一来源。

### 1.3 参数语义
- **thinking high**：在 `callDeepSeekPersona` 中把 `thinking` 置为 `'high'`。当前 compact 管线 `thinking=undefined`——重构后给 compact 也开启，以增强 JSON 字段质量；narrative 管线已用 `reasoning_effort:'max'`，统一收敛到 `thinking:'high'`。
- **上下文 1M**：模型能力，无需配置；现有 messages 已 `slice` 到 5.2 万字符，远在窗口内。
- **输出 384K**：把 `personaMaxTokens` 默认从 16000 提到更高档（如 32000–64000，受成本约束），由 `_model.deepseekChat` 的 `maxTokens` 上限兜底。**注意**：JSON schema 字数约束（6200–7800 中文字）与 `max_tokens` 是两层——前者控质量，后者控安全上限，互不冲突。
- **风险**：DeepSeek V4 Flash 的推理开关字段名（`thinking` vs `enable_thinking`/`reasoning_effort`）需先对真实接口 smoke 一次；`scripts/persona-identity-smoke.mjs` 已存在，扩展它验证 `thinking:'high'` 是否返回 `finish_reason` 正常。

---

## 2. 功能定位与边界

### 2.1 一句话定位
不是心理测评、不是报告、不是算命——是一件**会戳中你的音乐魔法装置**：输出「你的听歌灵魂侧写 + 一张可炫耀的专属灵魂牌 + 一串能继续聊下去的钩子」。

### 2.2 终版侧写维度（深度分级）
| 维度 | 字段（沿用/新增） | 深度要求 |
|---|---|---|
| 专属称号 | `archetype.title` / `profileName` | <15 字、有反差戏剧感，如「夜航审美师 / 展柜型听众」；要「像你」，不是文艺模板。 |
| 听歌人格 | `personalitySketch` + 一句话侧写 | 写具体：生活习惯、相处方式、审美弱点、听歌仪式感。 |
| 情绪光谱（**新增**） | `emotionSpectrum` | 4–6 条情绪坐标轴（怀旧/躁动/克制/浪漫/孤独/温柔），0–100 值 + 一句锐评；比 `tasteDNA` 更「情绪化」。 |
| 隐藏偏好 | `preferenceReading` / `tasteDNA` / `evidenceCards` | 你「嘴上不说但身体诚实」的偏好，每条必须有真实歌手/专辑/评论证据。 |
| 灵魂主稿 | `essay` | 1300–2200 字连续长文，朋友深夜毒舌式侧写。 |
| 日常人格 | `lifeReading` + `dailyVibes` + `oracleCards` | 社交/做事/亲密 + 塔罗牌。 |
| 音乐年龄 | `musicAge` | 象征性听歌年龄（如「27 岁半夜两点」）。 |
| 下一批歌 | `recommendations` + `playlistRoutes` + `hidden_gem` + `cross_domain` | 安全入口 / 稍微冒犯 / 跨界补刀。 |
| 彩蛋 + 标签 | `easterEggs` / `tags` | 可截图金句 + 可公开人格标签。 |
| 灵魂牌（**新增**） | `soulCard`（分享用） | 称号 + 金句 + 星图缩略 + 房间链接，供截图/分享。 |

### 2.3 边界（不做）
- 不让用户填长表单；不做严肃心理量表；不堆数据图表。
- 不越界到临床诊断/命运断言/职业硬建议/情感关系硬判断（现有 `safetyCheck` 已拦截「命中注定/人格缺陷/心理问题/职业适配/情感关系注定」）。

---

## 3. 消除「AI 味」——文案生成策略

现状已有 `strengthenProfileLanguage` 正则 + 双管线 + 第二遍 editor 合并。重构要更狠：

**A. 禁词/禁句双层清洗（服务端正则 + 前端兜底）**
- 删：同等级证据、精神图谱、坐标、解释维度、互相照亮、从哪里听、被什么击中、未来探索路线、核心矛盾、社交播放方式、30 天/90 天、画像会更立体、资料解释、证据维度、人口统计、我如何分析、下面从…角度、综上所述、值得注意的是、可以说、某种程度上、不难看出。
- 替换：「根据资料」→「看你歌单」；「这反映出」→「你就是那种」；「用户可能」→「你大概率」。

**B. 锚点强制（prompt 硬约束 + schema 校验）**
每一段必须引用 ≥2 个「真实锚点」（用户填的歌手/专辑/歌曲/评论原句/出生年/MBTI/专业），否则视为不合格并重写。扩展现有 `includesMusicEvidence` 校验到 `essay`/`lifeReading`。

**C. 金句密度**
要求每 ~200 字至少 1 句「可截图金句」（sharp one-liner），给写手范例。

**D. 声音预设（tone）升级**
`warm/mystic/critic/playful` 已有；新增「嘴替/毒舌」子风格——允许轻微毒舌、网络感、塔罗比喻、金句；不油腻、不羞辱身份。

**E. 第二遍「锐评编辑」升级**
现有 `callPersonaEditorJson` 已是多草稿合并。重构：editor 额外做「具体度打分」——若某字段抽象度过高（如「你是一个有品味的人」）就打回重写该字段。轻量做法：新增 `sharpnessScore()` 检测代词密度（「你」过多且无具体名词）+ 抽象名词密度，超阈值触发重写。

**F. 去模板化结构**
称号/牌面/金句由「用户数据指纹」驱动（用喜欢的艺人组合做种子选称号池），而非固定模板，避免每个用户长一样。

---

## 4. 交互式补全机制（核心新增）

设计：**生成初步侧写后（或直接作为前置仪式），通过全屏、个性化的 3–4 道选择题/小游戏收集 AI 缺的拼图 → 输出更完善的终版侧写**；终版之后仍可用「追问」（复用现有 `persona-chat` 多轮对话）继续聊。

### 4.1 个性化题目怎么生成
- 新增 `persona-quiz` action：在 `musicPersonaHandler` 顶部 dispatch 到 `personaQuizHandler(req,res)`（与现有 `persona-chat` 同位置，零新路由）。
- 输入：`normalizeStoredPersona`（若有初版则用它）+ 用户资料 + `collectStats`。
- 模型生成 3–4 道题，结构：
  ```json
  { "id":"q1","kind":"choice|slider|pick-3|this-or-that",
    "prompt":"…","options":[{"id":"a","label":"…","echo":"…"}], "weight":1 }
  ```
- 题目由「资料缺失/矛盾」驱动：有艺人但无听歌场景 →「你最常在哪种时刻打开音乐？」；爱某风格但无情绪入口 →「哪句歌词最像你现在的深夜？」；资料空 →「用三个词形容你理想中的一首歌」。
- 题面嵌入用户真实数据（「你歌单里全是 Radiohead 和 王菲，那……」），像专门为他出的。
- 输出经 sanitize：限 3–4 题、选项 3–5、禁临床/命运题。

### 4.2 前端全屏游戏（新增 `PersonaQuest` 组件）
全屏 overlay（`fixed inset-0`），分阶段：
1. **入场仪式**：标题「抽一张你的音乐灵魂牌」+ 星轨旋转/粒子上浮动效。
2. **逐题**：每题一屏（或卡片流），选项做成「符文卡/星石」，选中后粒子反馈；支持 slider（情绪强度）、pick-3（多选）、this-or-that（二选一翻转）。
3. **进度**：顶部「灵魂进度条」（月相/星轨填充）。
4. **提交**：答案回传 → 调 `generatePersona(quizAnswers)` → 进入揭示动效 → 终版侧写。

### 4.3 答案如何喂给终版
在 `commonContext` 注入：`用户刚刚在灵魂仪式里亲手选了：Q1…A1…`，作为「最高权重」证据（高于推断），让终版明显体现用户选择（例：选了「深夜独处」→ `dailyVibes`/深夜状态更笃定）。

### 4.4 与「追问」的关系
- **仪式（quiz）**：一次性补全，初版 → 终版升级。
- **追问（chat）**：终版之后继续聊，复用多轮对话，不重跑全量生成。
- 终版报告内放「再问我一个问题」浮窗，直接进 chat。

---

## 5. 视觉与动效方案（魔法 / 酷炫 / 神秘 / 有趣）

### 5.1 设计令牌（驱动前端 + `ui_theme_hint`）
- 底色：近黑深空 `#0a0a14` → 午夜蓝紫 `#13121C` 渐变；叠加极光/星云晕。
- 主色（人格驱动）：神秘紫 `#a78bfa`、星河青 `#7dd3fc`、炼金金 `#f3d74c`、霓虹粉 `#ff7da8`。
- 卡片：玻璃拟态（半透白 8% + backdrop-blur 32–50px + 1px 白描边 22% + 顶部内发光 30%）+ 霓虹描边 + 柔光晕。
- 字体：标题用有仪式感的展示体（如 Cinzel / Noto Serif SC），正文干净无衬线。
- 安静模式：遵循现有 `reduceMotion`。

### 5.2 动效清单（无第三方库也能做，用 CSS/SVG/Canvas；可加 framer-motion 增强）
1. **入口**：星轨旋转 + 粒子上浮（canvas 粒子 / CSS keyframes），标题「溶解」淡入。
2. **抽牌**：3–4 张灵魂牌从中心扇形展开（transform rotate+translate），hover 轻微浮动。
3. **选题**：选项卡点击 → 霓虹脉冲 + 粒子迸发。
4. **揭示**：终版以「卷轴展开 / 星座连线」逐段揭示——关键字段（称号、金句）stagger 逐个点亮；`tasteDNA`/`emotionSpectrum` 数值条从 0 充能。
5. **结果页**：个人「灵魂星图」（SVG 星座，节点=维度，连线=关系），可旋转/视差。
6. **分享卡**：生成「灵魂牌」海报（HTML/CSS → 截图；或 canvas 绘制），含称号+金句+星图缩略+房间链接，一键复制/保存/分享。
7. **减少动效**：`reduceMotion` 降级为静态分层。

---

## 6. 多套可选方案（脑洞 + 取舍）

| 方案 | 体验 | 记忆点 | 工作量 | 取舍 |
|---|---|---|---|---|
| **A 星图塔罗流（推荐）** | 占卜+星图：洗牌→抽 3–4 题符文卡→终版以「灵魂星图+卷轴」揭示 | 最强，分享卡天然是星图海报 | 最大（canvas/SVG 粒子） | 动效最重；CSS/SVG 可降级 |
| **B 炼金熔炉流** | 4 道题=4 味材料投入炼金炉，炉火融合→出炉「灵魂结晶/称号」 | 酷炫有仪式感 | 中 | 揭示偏单一，分享形态弱于星图 |
| **C 人格棱镜流（轻量好玩）** | 哈哈镜/棱镜，每题翻转一个人格面，终版多面体旋转 | 轻松好玩，动效易做（CSS 3D） | 小 | 「神秘感」最弱 |
| **D 轻量增强流（最小改动）** | 复用现有面板，仅加 3–4 题 modal + 答案喂 pipeline，动效只加淡入/高亮 | 最快上线、风险最低 | 最小 | 「魔法酷炫」不足，最不戳人 |

**推荐组合**：A 为旗舰首屏 wow 体验；D 作保底/低端机降级；C 可作「重玩」趣味模式。B 可选。

---

## 7. 数据依赖与改动清单

**后端（`lib/music-persona.js`）**
- 新增 `personaQuizHandler` + `personaQuizSchema`；`musicPersonaHandler` 顶部 dispatch `persona-quiz`。
- `callDeepSeekPersona`：`thinking:'high'`。
- 新增 `emotionSpectrum` 维度（`personaSchemaPrompt` + `sanitizePersona` 兼容）；新增 `soulCard` 分享字段。
- `commonContext` 注入 `quizAnswers`（最高权重证据）。
- 升级 `sharpnessScore()` 具体度校验。

**前端**
- 新增 `src/components/personaQuest.jsx`（全屏仪式 + 题）、`src/components/personaShare.jsx`（分享卡 + 截图）、可选 `src/components/starMap.jsx`（SVG 星图）。
- `panels.jsx`：生成按钮旁加「开始灵魂仪式」入口。
- `App.jsx`：加 `fetchPersonaQuiz` / `generatePersonaWithQuiz`。
- `useAppStore.js`：加 quiz 状态（题目、答案、阶段）。
- 模型：见 §1。

**依赖**
- 高级动效建议加 `framer-motion`（React 19 友好，轻量）；或纯 CSS/SVG/Canvas（零依赖）。给选项。

---

## 8. 实现路径（确认后执行）
- **Phase 0** 模型统一（§1）+ smoke 验证 `thinking:'high'`。
- **Phase 1** 后端 quiz 接口 + 答案注入 pipeline。
- **Phase 2** 前端全屏仪式组件（方案 A 或 D）+ 动画。
- **Phase 3** 反 AI 味升级（§3）。
- **Phase 4** 星图 / 分享卡（§5.5–5.6）。
- **Phase 5** 多轮追问联动 + 安静模式 + Playwright 验收。

---

## 9. 待确认决策点
1. **视觉方案**：A / B / C / D，或组合（推荐 A + D 降级）？
2. **动效技术**：是否引入 `framer-motion`？还是坚持零依赖（纯 CSS/SVG/Canvas）？
3. **仪式时机**：生成前作为前置仪式（参与感强）/ 先出初版→再邀请补全→出终版（更戳中）？
4. **输出 384K**：实际侧写不需要这么长——是否仅抬高 `max_tokens` 上限，字数质量约束维持现有？
5. **分享卡形态**：站内分享（生成图片+房间链接）/ 接系统分享 / 两者都要？

> 确认以上后进入实现；本轮不改动任何源码。
