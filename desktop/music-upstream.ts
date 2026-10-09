export { handleQQSearch, handleQQSongUrl, getQQLoginInfo, parseCookieString, qqCookieUin, qqCookieMusicKey } from './vendor/simple-music/server/lib/qq-client';
export { handleSearch, handleSongUrl, normalizeLoginInfo, call, audioProxyHeadersFor } from './vendor/simple-music/server/lib/netease-client';

// Flow Cabin adapter: stored cookies are not proof of an authenticated account.
import { call as ncmCall, normalizeLoginInfo as normalizeNcmLogin, asObj } from './vendor/simple-music/server/lib/netease-client';
export async function getNeteaseLoginInfo(cookie: string) {
  if (!cookie) return { loggedIn: false };
  for (const endpoint of ['login_status', 'user_account']) {
    try {
      const response = await ncmCall(endpoint, { cookie, timestamp: Date.now() });
      const body = asObj(response.body), data = asObj(body.data || body);
      if (response.status >= 400 || (data.code != null && Number(data.code) !== 200) || (body.code != null && Number(body.code) !== 200)) continue;
      const info = normalizeNcmLogin(data.profile || body.profile, data.account || body.account, data);
      if (info.loggedIn) return info;
    } catch { /* No entitlement is inferred from an unavailable status endpoint. */ }
  }
  return { loggedIn: false };
}
