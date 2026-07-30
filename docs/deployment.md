# Deployment Checklist

## Firebase

The app uses two Firebase surfaces:

- Frontend Firebase Web SDK: initializes the public Firebase app. Analytics is optional and only runs when
  `VITE_ENABLE_ANALYTICS=1`.
- Serverless Firebase Admin SDK: reads/writes Firestore users, rooms, showroom items, and comments.

Required Firebase setup:

1. Enable Cloud Firestore API for project `music-b0420`.
2. Create a Firestore database, usually in production mode.
3. Keep the service account JSON out of git.
4. Configure Vercel environment variables:

```bash
FIREBASE_SERVICE_ACCOUNT_JSON=<full service account json>
DEEPSEEK_API_KEY=<your DeepSeek key>
DEEPSEEK_MODEL=deepseek-v4-flash
TAVILY_API_KEY=<your Tavily key>
ADMIN_LOGIN=<admin login name>
ADMIN_PASSWORD=<admin password>
```

Current verification reached Firebase Admin and Firestore successfully.

## Vercel

The project is Vercel-ready:

- `vercel.json` configures Vite build output and serverless API routes.
- `api/*.js` contains auth, rooms, search, link resolver, AI, Firestore showroom items, and comments.
- `npm run build` passes locally.

Deploy/verify:

```bash
npx vercel link
npx vercel env add FIREBASE_SERVICE_ACCOUNT_JSON production
npx vercel env add DEEPSEEK_API_KEY production
npx vercel env add DEEPSEEK_MODEL production
npx vercel env add TAVILY_API_KEY production
npx vercel env add ADMIN_LOGIN production
npx vercel env add ADMIN_PASSWORD production
npx vercel deploy --prod
APP_URL=https://<deployment-url> npm run api:smoke
APP_URL=https://<deployment-url> npm run review
```

## Current Production Deployment

- Production URL: https://album-circle.vercel.app
- Deployment URL: https://album-circle-fxomctpe1-homings-projects-d78a7226.vercel.app
- Deployment ID: `dpl_fxomctpe1`
- Vercel project: `homings-projects-d78a7226/album-circle`

Latest frontend polish (commit `4bf079f`):

- **Immersive reading — bottom cutoff fixed**: overlay now uses `100dvh` (dynamic viewport height) instead of fixed
  `100%`; scroll container adds `env(safe-area-inset-bottom)` padding so the browser chrome / notch no longer eats the
  last lines on mobile. IntersectionObserver reveal changed to `threshold: 0` + `rootMargin` bottom `-8%` plus a 1.4s
  safety fallback that forces every section visible — the last paragraph can no longer stay stuck at `opacity:0`.
  Added a top **reading-progress bar** (`--immersive-progress`) and an AI-curated attribution footer.
- **Immersive reading — entry made obvious**: the "沉浸阅读" action is promoted from one of four equal-weight buttons to a
  glass **primary CTA** (`.immersive-cta`, flowing sheen + arrow, `ArrowUpRight`). A floating CTA (`.art-immersive-cta`)
  now overlays the cover art itself (revealed on hover/focus and always visible on touch) so the feature is discoverable
  without hunting in the action row.
- **Cover corridor — visuals & interaction**: re-enabled a restrained `corridor-cover-wash` (single `is-current` that
  crossfades on active change, low opacity), added a floor glow + ground reflection and an **AI-curated** tagline in the
  copy block. New "随机漫游" button (`corridor-roam`) jumps to a random item for serendipitous browsing.
- **Verification**: Playwright measured the rebuilt immersive DOM — footer and last section fully reachable when scrolled
  to bottom (no cutoff). All 6 new selectors ship in the bundle (`immersive-progress`, `immersive-cta`, `art-immersive-cta`,
  `corridor-cover-wash`, `corridor-roam`, `corridor-ai-line`); online asset hashes match local
  (`index-CiiDpV-q.css` 262.73 kB / 47.76 kB gzip, `index-CHvdihPw.js` 400.70 kB / 120.52 kB gzip).

Latest frontend enhancement release (commit `9fde089`):

- **Interaction feedback**: adopted `sonner` 2.0.7 for toasts (single `<Toaster>` instance, bottom-right, dark theme);
  `src/toast-theme.css` re-skins it to match the `.glass-panel` recipe with per-type glow and a `toast-glass-in`
  blur/saturate entrance. Overrides use `!important` because sonner injects its base styles at runtime.
- **Optimistic comments**: `submitComment` inserts a `pending` placeholder immediately (`.comment-pending` pulse),
  swaps in the server record on success, and rolls back + restores the draft + fires `toast.error` on failure.
- **Form states**: publish buttons in both the detail composer and `Review` disable while sending and show `发送中…`.
- **Skeletons**: new `initialLoading` flag (first room load only) renders 12 `.skeleton-tile` placeholders in the cabinet grid.
- **Accessibility**: roving tabindex keyboard navigation across the cabinet grid (Arrow/Home/End, column count derived
  from computed `gridTemplateColumns`), `aria-valuetext` on the rating slider, `aria-live` on status lines.
- **Filter & sort**: cabinet page gains sort (added time / rating / year / title) plus type and rated filters,
  derived through `useMemo` and persisted to `userSettings.filters`.
- **Immersive reading**: new `src/ImmersiveDetail.jsx` + `src/immersive-detail.css` — full-screen dialog with parallax
  cover, IntersectionObserver section reveal, Esc-to-close, focus trap and scroll lock. Opened from a new button;
  the existing detail layout is untouched.
- **Style cleanup**: additive `--space-*` / `--radius-*` / `--shadow-*` tokens in `:root`; breakpoints converged
  720→760, 520→560, 420→430; removed the duplicate `.cabinet-grid` block in `final-overrides.css`.
- Verified online: local and production asset hashes match exactly (`index-BPt1K4PP.css` 257.69 kB / 46.98 kB gzip,
  `index-ChIbmlCx.js` 398.54 kB / 119.88 kB gzip); all new selectors and logic identifiers grep-confirmed in the
  shipped bundles; `APP_URL=https://album-circle.vercel.app npm run api:smoke` passes end to end.

Previous polish release (commit `1b91212`):

- Added `src/motion-polish.css` as a standalone aesthetic + motion layer (10 new keyframes, 19+ selectors):
  topbar breathing frame + scanline, brand-mark halo, cabinet tile 3D lift + sheen, AI card conic border,
  comment left accent + hover shine + stagger fade-in, rating slider glow + grab/active states,
  modal curtain blur + spring entrance, scroll reveal via `CabinetListItem` IntersectionObserver,
  aurora noise drift helper, action button micro-lift, member-stack pop. All wrapped in `.reduce-motion`
  and `@media (max-width: 720px)` fallbacks.
- `main.jsx` wraps each cabinet tile in `CabinetListItem` for staggered reveal without disturbing grid sizing.
- Refreshed dependency baseline (vite 8, firebase 12, react 19, vercel 54) and tightened `vercel.json` SPA rewrite
  to exclude dev-only paths.
- Verified online: API smoke (`APP_URL=https://album-circle.vercel.app npm run api:smoke`) passes; CSS bundle
  `/assets/index-wQbAYMec.css` is 248.50 kB (45.12 kB gzip) and contains all polish keyframes.

Verified online:

- `APP_URL=https://album-circle.vercel.app VERCEL_AUTOMATION_BYPASS_SECRET=... npm run review` passed for desktop and mobile.
- Album cover health passed: all visible rendered album images reported healthy natural dimensions, no broken images.
- Showroom review passed: cover wall, spotlight, and track rail modes are available on desktop and mobile.
- `Frank Ocean Blonde` showroom detail displayed 17 tracks from iTunes lookup.
- Song and album relationship review passed: `White Ferrari` by Frank Ocean was added as a song, then grouped under the
  `Blonde` album detail through the shared iTunes `collectionId`; song detail links back to its parent album context.
- Showroom selection race review passed: room refresh after adding an item preserves the user's current selected card.
- Room panel supports switching existing rooms, creating another room, copying invites, and joining by full URL, relative
  URL, or raw room id.
- Comments can be posted directly inside the showroom detail panel.
- AI profile review passed: added items persist structured guide fields for album position, creative context, melody motif, lyric perspective, arrangement, release state, first-listen guide, and discussion prompts.
- AI profile cards now use long-form guided notes: each card is generated as a concrete reading/listening guide rather than
  a short label, saved with longer Firestore field limits, and displayed as numbered expandable reading cards.
- AI background generation now requests JSON-mode recommendation essays, rejects malformed output, sanitizes unverifiable
  claims, and requires concrete listening/recommendation language before persisting.
- AI background and recommendation now use Tavily-backed web research before DeepSeek generation. The server injects
  retrieved source summaries into the prompt, returns source metadata, and saves source links into the AI profile shown in
  the showroom.
- Search metadata now provides a stable per-item palette so the page background, glass panels, and accent light change with
  the selected song or album without cross-origin image pixel reads.
- AI comment reply passed: after a user posts a comment, Album Circle AI writes a follow-up reply into the shared room comment stream.
- `/api/search` returned live iTunes candidates.
- `/api/search?term=李荣浩 我爱你` returns `我爱你` by `李荣浩` from album `麻雀` as the first candidate.
- `/api/search?term=Frank Ocean Blonde&type=album` returns `Blonde` by `Frank Ocean` as the first album candidate.
- `/api/resolve-link` returned structured Spotify link parsing.
- `/api/ai/background` returned a background-completion draft for newly added music.
- `/api/ai/recommend` returned a live DeepSeek recommendation.
- `/api/comments` wrote and read a Firestore comment through Firebase Admin SDK.
- `/api/items` wrote and read a Firestore showroom item through Firebase Admin SDK.
- User-owned deletion passed: normal users can delete their own comments and the songs/albums they added; other users are blocked server-side.
- Admin login passed with the reserved admin account; the admin role is returned by `/api/auth` and required by `/api/admin`.
- Admin console passed browser review: the UI loads rooms, users, and AI prompt configuration, and has room/user deletion controls.
- AI prompt configuration passed API review: admin can save generation settings from the GUI, and the smoke test restores the previous production config after verification.
- Tavily web research passed production API review: `EXPECT_TAVILY=1` smoke test verified 4 background sources and 4
  recommendation sources without changing existing user rooms.
- `USE_VERCEL_CURL=1 APP_URL=https://album-circle.vercel.app npm run api:smoke` passed end-to-end.

The browser review covers a full two-user flow: User A registers, creates a room, adds the `李荣浩 我爱你` song and
the `Frank Ocean Blonde` album, comments, asks AI, then User B joins through the invite link and verifies the same
showroom and room comments on mobile. It also verifies user comment deletion and admin console rendering.

Latest generated review artifacts:

- `artifacts/desktop.png`
- `artifacts/mobile.png`
- `artifacts/admin.png`
- `artifacts/review-report.json`
