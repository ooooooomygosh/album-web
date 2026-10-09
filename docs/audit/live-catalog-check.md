# Live public catalog interface check

Checked 2026-10-08, 16:56–16:59 UTC, from the audit workspace. Query: `The Beatles Abbey Road`, album search only. This is a bounded representative check, not exhaustive catalog certification.

## Method and boundaries

- Invoked the real exported `searchCatalog(new URLSearchParams({term, type: 'album'}))` from `desktop/catalog-search.mjs` and `createQQMusic(fetcher).search(...)` from `desktop/qq-music.cjs`.
- Used Node 24.19 with its configured environment HTTP proxy. QQ requires an injected Fetch-compatible transport; production injects Electron `net.fetch`. iTunes uses global `fetch`. The harness wrapped real network fetches to record status/timing, without supplying mocked responses.
- Safety caps: 12 seconds per request and 90 seconds for the main run; MusicBrainz requests serialized with 1.1-second spacing. Two final direct public checks used 15-second caps. No credentials, cookies, private data, sign-in, purchases, audio downloading, or access-control bypass.
- This validates public metadata transport and response normalization, not Electron network parity, account entitlements, preview playback, or full-track streaming. No full-stream verification is claimed.

## Observed results (before the fixes below)

### iTunes

- All six issued search requests returned HTTP 200. The three initial album searches took roughly 7.8–7.9 seconds each through this environment's proxy.
- The actual module returned HTTP 200 and 15 candidates with numeric collection IDs and HTTPS provider links.
- Leading candidate: The Beatles, `Abbey Road (2019 Mix)`, collection ID `1474815798`, expected 17 tracks.
- The original nine-second deadline expired during song-derived album expansion. Track lookups inherited the expired signal; all 15 candidates correctly indicated `hasTracks: false` and `trackCountMatches: false`. This was partial metadata, not successful track-list verification.
- The leading artwork URL returned HTTP 200 with `image/jpeg`.
- A separate live GET to `https://itunes.apple.com/lookup?id=1474815798&entity=song&country=US` returned HTTP 200, 18 rows including the album and 17 tracks. Album ID, expected count, track collection IDs, and nonempty track IDs matched. Thus the public track endpoint itself was reachable; the initial app-level omission was consistent with the exhausted request budget.
- MusicBrainz enrichment never completed a live response because the inherited signal was already aborted. Cover Art Archive was not exercised. Neither is certified by this check.

### QQ Music

- Actual search POST and completed detail/list GET requests to `https://u.y.qq.com/cgi-bin/musicu.fcg` returned HTTP 200.
- Five album candidates were returned with complete, nonempty track lists and matching reported counts: 17, 40, 17, 10, and 6. Every candidate carried its QQ album identity and exact HTTPS provider link.
- Leading candidate: The Beatles, `Abbey Road (Remastered)`, QQ album MID `003wcjmO2nokGZ`, numeric ID `28024`, 17 tracks and 17 structured track details.
- One additional detail/list operation encountered the harness's overall deadline; the module returned a partial-result warning while retaining complete candidates. This is an audit-budget caveat, not evidence that QQ rejected access or that the provider is unavailable.
- The leading artwork check initially inherited the exhausted harness deadline. A separate bounded HEAD to `https://y.gtimg.cn/music/photo_new/T002R800x800M000003wcjmO2nokGZ_2.jpg` succeeded with HTTP 200 and `image/jpeg`.
- Album metadata varied by release/version; no assertion that the five editions are interchangeable is made.

## Focused fixes and regression evidence

Only `desktop/catalog-search.mjs` and a new `desktop/test/catalog-integrity.test.cjs` were edited for these fixes:

1. The original nine-second timer was cleared before enrichment, leaving successful-search / stalled-enrichment cases without a deadline. Cleanup now occurs in `finally`, with a 15-second whole-operation cap and a separate nine-second search budget. Direct album results no longer trigger unnecessary song-derived expansion; this leaves useful time for album tracks.
2. iTunes tracks were sorted only by track number, truncated at 24, and rewritten as disc 1 with sequential numbering. Full track rows now preserve disc/track order, provider track ID, and duration. No 24-track cutoff remains.
3. MusicBrainz enrichment previously marked every nonempty fallback as count-complete and could truncate displayed titles independently of details. Count equality is now checked and title/detail arrays remain aligned.
4. Incomplete album metadata returns a `warnings` array and honest `metadataCompleteness.trackCountMatches: false`, allowing the UI to show a pending-track label.

Regression command: `node --test desktop/test/catalog-integrity.test.cjs desktop/test/search.test.cjs`.
The new deterministic tests cover a 30-track multidisc album, an abort during stalled enrichment with partial fallback, and a mismatched MusicBrainz count. These are regression fixtures, distinctly separate from the live network observations above. One bounded post-fix iTunes run was subsequently authorized and performed; see below. QQ was not repeated.


## Single post-fix iTunes comparison

At 2026-10-08 17:01:58 UTC, the updated `searchCatalog` was called once with the same `The Beatles Abbey Road` album query through the configured proxy. No retries or credentials were added. An outer 20-second safety cap was used; the app's own 15-second deadline ended the operation after **15,009 ms**.

- Response: HTTP 200, 15 album candidates, and `warnings: ["部分专辑曲目尚未读取完整，请核对版本或稍后重试。"]`.
- The leading `1474815798` album now contained **17/17 tracks and 17 structured details**, with `hasTracks: true` and `trackCountMatches: true`.
- The second `6818128121` album also contained **17/17 tracks and 17 structured details**, correctly complete.
- The third `1441164426` album contained **18/19 tracks**, correctly flagged `trackCountMatches: false`. No claim is made about the reason for the provider count discrepancy.
- The other 12 candidates had no completed track lists and remained explicitly incomplete after their requests were aborted at the deadline.
- Three search and three lookup requests returned HTTP 200. Two MusicBrainz release-search requests returned HTTP 200; no completed release-detail enrichment or Cover Art Archive request was established.

Compared with the initial run's zero complete candidates, the same representative query now supplies complete tracks for the top two albums while remaining bounded and reporting partial metadata honestly. This is a **partial-success live check**, not a guarantee that all returned editions load completely within 15 seconds or that account playback works.

## MusicBrainz protocol audit and scheduler fix

Official documentation checked 2026-10-08:
- [MusicBrainz API: application rate limiting and identification](https://musicbrainz.org/doc/MusicBrainz_API)
- [MusicBrainz API rate limiting and User-Agent requirements](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)

The official API documentation requires each client to stay at or below one request per second and identify the application in its User-Agent. Inspection confirmed that concurrent album enrichment previously called MusicBrainz directly, allowing a burst across candidates or simultaneous searches. The original User-Agent already identified the project; it now uses the full application version: `FlowCabin/1.7.0 (https://github.com/ooooooomygosh/album-web)`, without a personal email.

`desktop/musicbrainz-scheduler.mjs` now supplies one shared scheduler for all MusicBrainz release searches and detail lookups in this process. Starts are separated by at least 1.1 seconds, including while earlier responses are pending. The queue is capped at 64. Queued requests reject promptly on their existing abort signal; cancelled entries are removed without consuming future request slots. The existing 15-second catalog deadline still bounds enrichment and is passed into the underlying fetch. iTunes, QQ, and artwork requests are unaffected.

Three deterministic scheduler tests verify spacing under simultaneous/stalled requests, queued/pre-aborted work never starting, cancelled slots being reusable, bounded queue rejection, and recovery after errors. The catalog regression additionally checks the actual outgoing MusicBrainz User-Agent. Combined focused suite: 14 tests passed. No additional live catalog calls were issued for this protocol fix. The earlier live harness had its own 1.1-second MusicBrainz limiter, so its observed success never established that the pre-fix production client respected that policy. This fix addresses the confirmed protocol issue without asserting that throttling caused any specific earlier incomplete album.
