# Album Circle

Album Circle is a cross-platform web app for collaborative music rooms. Friends can create a room, add songs or albums, confirm the correct catalog result and cover art, write comments, and ask AI for background notes or follow-up recommendations.

It supports:

- account registration, login, profile editing, avatars, public music tags, and user stats
- room creation, public room discovery, invite-link joining, password-gated membership, member attribution, and room-isolated data
- separate title and artist search fields for songs and albums, with candidate disambiguation
- iTunes Search plus MusicBrainz / Cover Art Archive enrichment for covers, tracks, release versions, labels, years, and platform metadata
- share-link recognition for Spotify, Apple Music, Netease Cloud Music, QQ Music, and other music URLs
- DeepSeek/OpenAI-compatible AI background essays, comment replies, recommendations, and music-persona reports through server-only API keys
- Tavily-backed web research for AI background, recommendation, and persona generation
- Firebase Admin / Firestore-backed users, rooms, showroom items, and comments
- showroom, track rail, spotlight, add music, review, AI recommendation, room management, admin, and profile modes
- owner deletion for comments and added items, plus admin room/user/prompt management
- listening entry points for Apple/iTunes, YouTube, YouTube Music, QQ Music, Netease Cloud Music, and Songlink/Odesli
- responsive Liquid Glass-inspired UI with motion and glass controls
- PWA manifest for installable cross-platform use

## Run

```bash
npm install
FIREBASE_SERVICE_ACCOUNT_JSON="$(cat /path/to/serviceAccountKey.json)" \
DEEPSEEK_API_KEY="your-key" \
DEEPSEEK_MODEL="deepseek-v4-flash" \
DEEPSEEK_PERSONA_MODEL="deepseek-v4-pro" \
TAVILY_API_KEY="your-key" \
npm run vercel-dev
```

Then open http://localhost:5173/.

## Verify

```bash
npm run build
npm run api:smoke
npm run review
```

The review script saves desktop, mobile, and interaction screenshots to `artifacts/` and writes `artifacts/review-report.json`.

Production verification:

- `https://album-circle.vercel.app`
- `APP_URL=https://album-circle.vercel.app VERCEL_AUTOMATION_BYPASS_SECRET=... npm run review`
- `USE_VERCEL_CURL=1 APP_URL=https://album-circle.vercel.app npm run api:smoke`

The browser review covers:

- User A registers, creates a room, searches `李荣浩 我爱你`, confirms the Li Ronghao song, and adds it to the showroom.
- User A searches `Frank Ocean Blonde`, confirms the album, and adds it to the same showroom.
- User A publishes a comment and requests an AI recommendation.
- User B registers through the invite link, joins the same room, sees both the song and album, and publishes a separate comment.
- Desktop and mobile layouts are checked for horizontal overflow, showroom card health, real cover image dimensions, admin rendering, and owner deletion.

Metadata regression targets:

- `王菲 唱游` returns Wang Fei's `唱遊/唱游` album first, with 13 tracks from MusicBrainz enrichment.
- `Frank Ocean Blonde` returns the album with a populated track list and cover.
- `李荣浩 我爱你` returns the Li Ronghao song first with provider links and AI background fields.

## Documents

- `docs/product-plan.md`: product plan, feature modes, agent plan, API strategy
- `docs/architecture.md`: current architecture and data contracts
- `docs/research-sources.md`: research references and API/open-source sources
