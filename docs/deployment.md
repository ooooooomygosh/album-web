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
- Deployment URL: https://album-circle-fvveeb71a-homings-projects-d78a7226.vercel.app
- Deployment ID: `dpl_F3Fo9bTwicTivSrgDBXdw7w8jetT`
- Vercel project: `homings-projects-d78a7226/album-circle`

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
