# Album Circle 1.5.0

macOS / Windows 客户端以本地收藏为默认，云端账号、数据库、AI 和在线分享为可选服务。最新版安装包见 [GitHub Releases](https://github.com/ooooooomygosh/album-web/releases/latest)。

无需登录即可管理专辑、唱片盒与黑胶外观。打开“收藏与分享”可离线手动添加专辑、导出或导入收藏；软件设置中切换云端账号，登录后返回本地模式即可发布只读展柜链接，或手动同步收藏到专用云端房间。访客通过浏览器查看分享，无需注册。公开分享是当次快照，后续修改需重新发布。

客户端开发：先在项目根目录运行 `npm ci`，再运行 `npm --prefix desktop ci`。`npm run desktop:dev` 启动软件；`npm --prefix desktop run dist:mac` 构建 Mac 两种芯片版本；Windows 上运行 `npm --prefix desktop run dist:win`。构建输出为 `desktop/release/`。标签 `v*` 触发 GitHub 自动构建、检查和发布三个平台版本。详见 [客户端说明](desktop/README.md)。


Album Circle is a collaborative album and song sharing web app. A room can collect music recommendations from friends, show albums in a visual cabinet, attach comments and ratings, and generate AI listening guides from catalog metadata plus web research.

Production: https://album-circle.vercel.app

## What It Does

- Account registration, login, profile editing, avatars, public music tags, and music-persona reports.
- Room creation, invite links, public discovery, password-gated rooms, member profiles, and room-isolated data.
- Global music search for albums and songs with title, artist, link, and type filters.
- iTunes Search plus MusicBrainz / Cover Art Archive enrichment for covers, tracks, release versions, years, labels, and source metadata.
- Share-link recognition for Apple Music, Spotify, Netease Cloud Music, QQ Music, and other music URLs.
- Album cabinet overview with hover/focus previews, configurable cover size, hover style, layout, filters, and copy.
- URL-addressable item detail pages with tracks, comments, AI guides, listening links, ratings, and member attribution.
- Hidden 3D cover corridor easter egg from the top-left room brand mark.
- Ratings stored separately from comments so users can rate without writing a comment.
- AI background essays, comment replies, recommendations, and persona analysis through server-only API keys.
- Tavily-backed web research for AI background, recommendation, and persona generation.
- Firebase Admin / Firestore-backed users, sessions, rooms, showroom items, ratings, and comments.
- Responsive Liquid Glass-inspired UI with reduced motion, glass strength, and rainbow status-frame controls.
- Vite PWA shell and Vercel serverless API deployment.

## Tech Stack

- Frontend: React 19, Vite, plain global CSS, lucide-react icons.
- Backend/API: Vercel serverless functions in `api/`.
- Database/auth sessions: Firebase Admin SDK and Firestore.
- Catalog search: iTunes Search, MusicBrainz, Cover Art Archive.
- AI: DeepSeek/OpenAI-compatible chat completion routes.
- Research: Tavily search summaries injected into AI prompts.
- Verification: Playwright-based review script plus API smoke tests.

## File Map

```text
.
├── api/
│   ├── _firebase.js          # Firebase Admin init and session validation helpers
│   ├── auth.js               # login/signup/profile/settings/stats/persona account APIs
│   ├── rooms.js              # room create/join/switch/settings/discovery APIs
│   ├── search.js             # iTunes/MusicBrainz/Cover Art Archive candidate search
│   ├── items.js              # room showroom item CRUD
│   ├── comments.js           # room comment CRUD and permissions
│   ├── ratings.js            # per-user item rating upsert and summaries
│   ├── resolve-link.js       # music URL parser/resolver
│   ├── admin.js              # admin room/user/config operations
│   └── ai/
│       ├── _research.js      # Tavily research helpers and source normalization
│       ├── background.js     # AI background / long guide generation
│       ├── comment.js        # AI follow-up comments
│       └── recommend.js      # recommendations and persona chat/report APIs
├── src/
│   ├── main.jsx              # main React SPA, room state, routing, panels, settings
│   ├── styles.css            # base Liquid Glass design system and app styles
│   ├── final-overrides.css   # late-stage cabinet/detail/topbar refinements
│   ├── ExperimentalCorridorCarousel.jsx  # hidden 3D cover corridor component
│   ├── corridor-carousel.css # isolated styles for the hidden corridor and brand mark
│   └── firebaseClient.js     # optional frontend Firebase analytics init
├── lib/
│   ├── member-profile.js     # member profile normalization helpers
│   └── music-persona.js      # persona report normalization helpers
├── scripts/
│   ├── review.mjs            # Playwright browser review and screenshots
│   ├── api-smoke.mjs         # production/local API smoke tests
│   ├── local-api-server.mjs  # helper for local API testing
│   ├── member-profile-smoke.mjs
│   ├── hero-config-smoke.mjs
│   └── persona-identity-smoke.mjs
├── docs/
│   ├── architecture.md       # architecture notes and contracts
│   ├── deployment.md         # deployment checklist and production review history
│   ├── product-plan.md       # product roadmap and planning notes
│   └── research-sources.md   # references for music APIs and product research
├── public/                   # icon and manifest assets
├── index.html                # Vite entry HTML
├── vercel.json               # Vercel build, functions, and SPA rewrite config
└── package.json              # scripts and dependencies
```

## Main Frontend Concepts

Most UI currently lives in `src/main.jsx`. It is intentionally a single large file, so use search symbols when changing a feature:

- `App`: owns session, room, items, comments, settings, ratings, URL state, and mode state.
- `GlobalMusicSearch`: topbar search/add entry. Enter and button submit both call `runOnlineSearch`.
- `AlbumCabinetPage`, `AlbumCabinetGrid`, `AlbumCabinetTile`: default cabinet overview.
- `AlbumDetailPage`: URL item detail page shown with `?room=<roomId>&item=<itemId>`.
- `CabinetSettingsPopover`: cabinet-specific display and copy settings.
- `AddMusic`: advanced add flow.
- `Review`, `Ai`, `RoomPanel`, `ProfilePanel`, `AdminPanel`: secondary modes.
- `RatingPanel`: per-item rating UI.
- `MemberProfileModal`, `ConfirmDialog`: modal UI surfaces.
- `ExperimentalCorridorCarousel`: hidden 3D cover corridor opened from the top-left brand mark.

URL state is part of the product contract:

- Cabinet: `?room=<roomId>&view=cabinet`
- Detail: `?room=<roomId>&item=<itemId>`
- Optional filter: `mine=1`

Use `openCabinet()` and `openItemDetail(itemId)` instead of manually mutating mode and history.

## Hidden 3D Cover Corridor

The top-left room brand mark is a button with class `brand corridor-secret-trigger`. It opens `ExperimentalCorridorCarousel`.

Key files:

- `src/ExperimentalCorridorCarousel.jsx`
- `src/corridor-carousel.css`
- `src/main.jsx` import and render near the end of `App`

Behavior:

- Reads current `items` from `App`; it does not fetch, write Firestore, or change room data.
- Uses a virtual unbounded `activeIndex`, so rotating past the last cover continues to `-360deg`, `-720deg`, etc. It should not snap back to `0deg`.
- The displayed item uses `clampIndex(activeIndex, count)`, so UI labels still show `01 / N`.
- Current cover is larger, brighter, and pushed forward; side covers are lower opacity and blurred.
- Background uses the current cover as a blurred “cover wash” when a cover image exists, with palette fallback.
- Manual controls: drag, wheel, previous/next buttons, ArrowLeft/ArrowRight, Home/End, Escape close.
- Detail navigation: click the active cover to close the corridor and call `openItemDetail(active.id)`.
- Autoplay: `自动/暂停` button plus `速度` range control. It is off by default and disabled when reduced motion is active.
- Mobile/coarse pointer fallback: horizontal scroll-snap rail instead of full 3D transforms.
- Reduced motion fallback: disables transform animations and autoplay.

When editing this feature, keep styles in `corridor-carousel.css` so it does not destabilize the main cabinet/detail styles.

## Backend/API Summary

All serverless APIs use JSON and expect a session token for room/user operations unless documented otherwise.

- `GET/POST /api/auth`
  - login/signup/profile/avatar/settings/stats/persona-related account data
  - `action: "updateSettings"` merges whitelisted private settings into the user document
- `GET/POST /api/rooms`
  - list rooms, discover rooms, create rooms, join rooms, update room settings
- `GET /api/search`
  - query music candidates with `term`, `type`, `title`, `artist`
  - combines iTunes plus optional MusicBrainz enrichment
- `GET /api/resolve-link`
  - parse platform links into structured search hints
- `GET/POST/DELETE /api/items?roomId=...`
  - room showroom item CRUD
- `GET/POST/DELETE /api/comments?roomId=...`
  - comments with owner/admin deletion permissions
- `GET/POST /api/ratings?roomId=...`
  - rating summary and current-user upsert for an item
- `POST /api/ai/background`
  - rich background/listening guide generation before item persistence
- `POST /api/ai/comment`
  - AI follow-up comment generation
- `POST /api/ai/recommend`
  - recommendations, persona report, and persona chat
- `GET/POST/DELETE /api/admin`
  - admin console data and admin-only operations

Firestore collections are organized around users and rooms:

- `albumCircleUsers/{userId}`
  - session hashes, private settings, profile, persona data
- `albumCircleRooms/{roomId}`
  - room metadata, members, member profiles
- `albumCircleRooms/{roomId}/items/{itemId}`
  - canonical room music items
- `albumCircleRooms/{roomId}/comments/{commentId}`
  - comments and AI replies
- `albumCircleRooms/{roomId}/ratings/{ratingId}`
  - one rating per user per item
- `albumCircleConfig/ai`
  - admin-managed AI generation settings

## Environment Variables

Copy `.env.example` and fill secrets locally. Do not commit real `.env.local` or `.vercel/.env.*` files.

Important variables:

```bash
FIREBASE_SERVICE_ACCOUNT_JSON=
FIREBASE_STORAGE_BUCKET=
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BACKGROUND_MODEL=deepseek-v4-pro
DEEPSEEK_PERSONA_MODEL=deepseek-v4-pro
TAVILY_API_KEY=
MUSICBRAINZ_USER_AGENT=AlbumCircle/0.1 (https://album-circle.vercel.app)
ADMIN_LOGIN=admin
ADMIN_PASSWORD=
```

Useful tuning variables are listed in `.env.example`, including AI token limits and Tavily timeouts.

## Local Development

Install dependencies:

```bash
npm install
```

Run only the frontend Vite server:

```bash
npm run dev
```

Run Vercel dev so API routes work locally:

```bash
FIREBASE_SERVICE_ACCOUNT_JSON="$(cat /path/to/serviceAccountKey.json)" \
DEEPSEEK_API_KEY="your-key" \
TAVILY_API_KEY="your-key" \
npm run vercel-dev
```

Open http://localhost:5173/ unless Vercel reports another port.

## Verification

Fast checks:

```bash
npm run build
git diff --check
```

API and browser smoke checks:

```bash
npm run api:smoke
npm run member:smoke
npm run hero:smoke
npm run persona:smoke
npm run review
```

The review script creates screenshots and JSON under `artifacts/`:

- `artifacts/desktop.png`
- `artifacts/mobile.png`
- `artifacts/review-report.json`

Production checks:

```bash
APP_URL=https://album-circle.vercel.app npm run review
USE_VERCEL_CURL=1 APP_URL=https://album-circle.vercel.app npm run api:smoke
```

## Deployment

The app is deployed on Vercel. `vercel.json` configures:

- `npm run build`
- output directory `dist`
- Vite framework
- longer max durations for AI serverless routes
- SPA rewrite for non-API paths

Typical production deployment:

```bash
npx vercel pull --yes --environment production
npm run build
npx vercel build --prod
npx vercel deploy --prebuilt --prod
```

Current production alias:

```text
https://album-circle.vercel.app
```

Important maintenance note: if another developer is actively editing or deploying, do not deploy from an older worktree. Use the current active project directory, apply the smallest patch needed, run build, then deploy the prebuilt output. This avoids overwriting unrelated work.

## Development Guidelines

- Prefer targeted edits. The project often has multiple active changes in parallel.
- Do not run destructive git commands such as `git reset --hard` or `git checkout --` unless explicitly requested.
- Before changing UI, inspect the relevant existing CSS because `styles.css`, `final-overrides.css`, and feature-specific CSS may all affect the same elements.
- Keep experimental or highly specific UI in isolated files when possible. The corridor uses this pattern.
- Use existing helpers and contracts:
  - `mergeUserSettings()` for user settings
  - `roomQueryUrl()`, `parseRoomQuery()`, `openCabinet()`, `openItemDetail()` for URL state
  - `AlbumArt` for standard cover rendering
  - `api()` / `apiWithTimeout()` for frontend API calls
- Forms should support keyboard submit, labels, disabled/loading states, and clear error text.
- Motion must honor both `prefers-reduced-motion` and the in-app reduced motion setting.
- Images should include explicit dimensions and useful `alt` text unless decorative.

## Common Debug Tasks

Search does not return expected albums:

1. Check `/api/search?term=...&type=album`.
2. Confirm iTunes result ordering and MusicBrainz enrichment.
3. Inspect candidate fields: `title`, `artist`, `year`, `cover`, `tracks`, `match`, `source`.

Adding an item fails:

1. Check `/api/ai/background` for timeout or malformed AI output.
2. Confirm `FIREBASE_SERVICE_ACCOUNT_JSON` is valid.
3. Confirm `/api/items?roomId=...` POST receives the enriched candidate.

Room data looks stale:

1. Check `loadRoomData()` in `src/main.jsx`.
2. Verify `room.id`, `session.token`, and Firestore room membership.
3. Confirm URL state is not pointing at a missing `item`.

Ratings do not update:

1. Check `/api/ratings?roomId=...&itemId=...`.
2. Confirm POST body has `itemId` and `score`.
3. Confirm `ratingsByItem[item.id]` is refreshed after submit.

Hidden corridor does not open:

1. Confirm `src/main.jsx` imports `ExperimentalCorridorCarousel` and `./corridor-carousel.css`.
2. Confirm `corridorOpen` state exists in `App`.
3. Confirm the top-left brand element has `className="brand corridor-secret-trigger"`.
4. Confirm the component is rendered inside the logged-in room shell.

## Related Docs

- `docs/architecture.md`: architecture and API contracts
- `docs/deployment.md`: deployment checklist and production review history
- `docs/product-plan.md`: product roadmap and planning notes
- `docs/research-sources.md`: API and research references
