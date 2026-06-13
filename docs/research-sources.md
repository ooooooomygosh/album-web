# Research Sources

These sources informed the product plan, API strategy, and UI decisions.

## Music Metadata APIs

- Spotify Web API Search: supports searching albums, artists, playlists, tracks, shows, episodes, and audiobooks; Spotify policy also constrains how Spotify content may be used with AI and standalone metadata products.
  https://developer.spotify.com/documentation/web-api/reference/search
- Apple iTunes Search API: public search endpoint returns JSON for media catalog results and is useful as a low-friction candidate source.
  https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html
- Apple Music API Search: catalog search for albums, songs, artists, and other Apple Music catalog resources.
  https://developer.apple.com/documentation/applemusicapi/search
- MusicBrainz API: canonical open music entity layer with a documented `/ws/2/` API root; clients must use proper User-Agent and rate limiting.
  https://musicbrainz.org/doc/Development/XML_Web_Service/Version_2
- MusicBrainz rate limits: public API users should keep to one request per second per IP unless agreed otherwise.
  https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
- Cover Art Archive API: cover art lookup for MusicBrainz releases and release groups.
  https://musicbrainz.org/doc/Cover_Art_Archive/API
- Discogs API terms: useful for releases, versions, labels, and credits, with attribution and terms constraints.
  https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use
- Last.fm API: useful for tags, album/artist/track info, scrobbling, and social listening context.
  https://www.last.fm/api

## Product References

- Musicboard: rating, reviewing, organizing favorite music, user reviews, rankings, and listening statistics.
  https://play.google.com/store/apps/details?id=com.musicboard
- Apple Music collaborative playlists: invite collaborators, approve participants, add/remove/reorder songs, and react to songs.
  https://support.apple.com/en-ie/118494
- Spotify collaborative playlists: collaborators can add, remove, and reorder tracks.
  https://support.spotify.com/ca-en/article/collaborative-playlists/
- Rate Your Music: long-running music cataloging, rating, review, and list-making community.
  https://en.wikipedia.org/wiki/Rate_Your_Music

## Open Source Candidates

- Spotify TypeScript SDK: https://github.com/spotify/spotify-web-api-ts-sdk
- Spotipy Python SDK: https://github.com/spotipy-dev/spotipy
- MusicBrainz JS client: https://github.com/Borewit/musicbrainz-api
- musicbrainzngs Python client: https://python-musicbrainzngs.readthedocs.io/
- NeteaseCloudMusicApi: https://github.com/Binaryify/NeteaseCloudMusicApi
- QQ Music API examples: https://github.com/UtoYuri/QQMusicApi
- Odesli/Songlink API docs: https://linktree.notion.site/API-d0ebe08a5e304a55928405eb682f6741
