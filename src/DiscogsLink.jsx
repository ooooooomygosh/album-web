import { External } from './icons';
export function discogsUrl(item) {
  // Only use a release URL when the original data actually contains one.
  for (const value of [item.discogsUrl, ...(item.listeningLinks || []).map((link) => link.url)]) {
    try { const url = new URL(value); if (url.protocol === 'https:' && ['discogs.com', 'www.discogs.com'].includes(url.hostname) && /^\/(?:release|master)\/\d+/.test(url.pathname)) return url.href; } catch {}
  }
  const url = new URL('https://www.discogs.com/search/');
  url.searchParams.set('q', `${item.artist || ''} ${item.title || ''}`.trim());
  url.searchParams.set('type', 'release');
  return url.href;
}
export default function DiscogsLink({ item, compact = false }) {
  return <a className={`discogs-link ${compact ? 'compact' : ''}`} href={discogsUrl(item)} target="_blank" rel="noreferrer" title={`在 Discogs 查阅 ${item.artist || ''} · ${item.title}`} aria-label={`在 Discogs 查阅 ${item.title}`}><External size={16}/><span>Discogs</span></a>;
}
