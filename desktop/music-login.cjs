var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// vendor/simple-music/electron/modules/login-manager.ts
var login_manager_exports = {};
__export(login_manager_exports, {
  clearNeteaseLogin: () => clearNeteaseLogin,
  clearQQLogin: () => clearQQLogin,
  openNeteaseLogin: () => openNeteaseLogin,
  openQQLogin: () => openQQLogin
});
module.exports = __toCommonJS(login_manager_exports);
var import_electron2 = require("electron");

// vendor/simple-music/electron/modules/safe-open.ts
var import_electron = require("electron");
var ALLOWED_PROTOCOLS = /* @__PURE__ */ new Set(["http:", "https:", "mailto:"]);
function isExternallyOpenable(rawUrl) {
  try {
    return ALLOWED_PROTOCOLS.has(new URL(rawUrl).protocol);
  } catch {
    return false;
  }
}
function openExternalSafely(rawUrl) {
  if (!isExternallyOpenable(rawUrl)) {
    return;
  }
  import_electron.shell.openExternal(rawUrl).catch((e) => void 0);
}

// vendor/simple-music/electron/modules/login-manager.ts
var NETEASE_LOGIN_PARTITION = "persist:simplemusic-netease-login";
var NETEASE_LOGIN_URL = "https://music.163.com/#/login";
var QQ_LOGIN_PARTITION = "persist:simplemusic-qqmusic-login";
var QQ_LOGIN_URL = "https://y.qq.com/n/ryqq/profile";
var QQ_COOKIE_PRIORITY = [
  "uin",
  "qqmusic_uin",
  "wxuin",
  "login_type",
  "qm_keyst",
  "qqmusic_key",
  "p_skey",
  "skey",
  "psrf_qqopenid",
  "psrf_qqunionid",
  "psrf_qqaccess_token",
  "psrf_qqrefresh_token",
  "wxopenid",
  "wxunionid",
  "wxrefresh_token",
  "wxskey",
  "p_uin",
  "ptcz",
  "RK"
];
var NETEASE_COOKIE_PRIORITY = [
  "MUSIC_U",
  "__csrf",
  "NMTID",
  "MUSIC_A",
  "__remember_me",
  "_ntes_nuid",
  "_ntes_nnid",
  "WEVNSM",
  "WNMCID",
  "JSESSIONID-WYYY"
];
function parseCookieHeader(text) {
  const out = {};
  for (const part of String(text || "").split(";")) {
    const raw = part.trim();
    const idx = raw.indexOf("=");
    if (idx <= 0) continue;
    out[raw.slice(0, idx).trim()] = raw.slice(idx + 1).trim();
  }
  return out;
}
function qqCookieHasLogin(text) {
  const o = parseCookieHeader(text);
  const rawUin = Number(o.login_type) === 2 ? o.wxuin || o.uin || o.p_uin || "" : o.uin || o.qqmusic_uin || o.wxuin || o.p_uin || "";
  const uin = String(rawUin).replace(/\D/g, "");
  const key = o.qm_keyst || o.qqmusic_key || o.music_key || o.p_skey || o.skey || o.psrf_qqaccess_token || o.psrf_qqrefresh_token || o.wxrefresh_token || o.wxskey || "";
  return !!(uin && key);
}
function qqCookieHasPlaybackLogin(text) {
  const o = parseCookieHeader(text);
  const rawUin = Number(o.login_type) === 2 ? o.wxuin || o.uin || o.p_uin || "" : o.uin || o.qqmusic_uin || o.wxuin || o.p_uin || "";
  const uin = String(rawUin).replace(/\D/g, "");
  const key = o.qm_keyst || o.qqmusic_key || o.music_key || o.wxskey || "";
  return !!(uin && key);
}
function neteaseCookieHasLogin(text) {
  return !!parseCookieHeader(text).MUSIC_U;
}
function isQQCookieDomain(domain) {
  const d = String(domain || "").replace(/^\./, "").toLowerCase();
  return d === "qq.com" || d.endsWith(".qq.com") || d.endsWith("qqmusic.qq.com");
}
function isNeteaseCookieDomain(domain) {
  const d = String(domain || "").replace(/^\./, "").toLowerCase();
  return d === "163.com" || d.endsWith(".163.com") || d === "netease.com" || d.endsWith(".netease.com");
}
function buildCookieHeaderFor(cookies, allowed, priority) {
  const picked = /* @__PURE__ */ new Map();
  for (const c of cookies) {
    if (!c?.name || !allowed(c.domain ?? "")) continue;
    picked.set(c.name, c.value ?? "");
  }
  const ordered = [];
  for (const name of priority) {
    if (picked.has(name)) {
      ordered.push([name, picked.get(name) ?? ""]);
      picked.delete(name);
    }
  }
  picked.forEach((value, name) => ordered.push([name, value]));
  return ordered.filter(([name, value]) => name && value !== "").map(([name, value]) => `${name}=${value}`).join("; ");
}
async function readQQCookie(s) {
  return buildCookieHeaderFor(await s.cookies.get({}), isQQCookieDomain, QQ_COOKIE_PRIORITY);
}
async function readNeteaseCookie(s) {
  return buildCookieHeaderFor(await s.cookies.get({}), isNeteaseCookieDomain, NETEASE_COOKIE_PRIORITY);
}
function runLoginFlow(opts) {
  const cookieSession = import_electron2.session.fromPartition(opts.partition);
  return (async () => {
    const initial = await opts.read(cookieSession);
    if (opts.hasFullLogin(initial)) return { ok: true, cookie: initial, reused: true };
    return new Promise((resolve) => {
      let settled = false;
      let pollTimer = null;
      const win = new import_electron2.BrowserWindow({
        width: opts.width,
        height: opts.height,
        minWidth: 760,
        minHeight: 560,
        parent: opts.owner && !opts.owner.isDestroyed() ? opts.owner : void 0,
        show: false,
        autoHideMenuBar: true,
        title: opts.title,
        backgroundColor: "#111111",
        webPreferences: { partition: opts.partition, contextIsolation: true, nodeIntegration: false, sandbox: true }
      });
      const finish = (result) => {
        if (settled) return;
        settled = true;
        if (pollTimer) clearInterval(pollTimer);
        if (!win.isDestroyed()) win.close();
        resolve(result);
      };
      const check = async () => {
        try {
          const cookie = await opts.read(cookieSession);
          if (opts.hasFullLogin(cookie)) finish({ ok: true, cookie });
        } catch (e) {
        }
      };
      win.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url)) win.loadURL(url).catch(() => {
        });
        else openExternalSafely(url);
        return { action: "deny" };
      });
      win.webContents.on("did-finish-load", () => void check());
      win.on("ready-to-show", () => win.show());
      win.on("closed", async () => {
        if (settled) return;
        if (pollTimer) clearInterval(pollTimer);
        try {
          const cookie = await opts.read(cookieSession);
          resolve(opts.hasLogin(cookie) ? { ok: true, cookie } : { ok: false, cancelled: true, message: "\u767B\u5F55\u7A97\u53E3\u5DF2\u5173\u95ED" });
        } catch (e) {
          resolve({ ok: false, error: e.message || "\u767B\u5F55\u7A97\u53E3\u5DF2\u5173\u95ED" });
        }
      });
      pollTimer = setInterval(() => void check(), 1200);
      win.loadURL(opts.url).catch((e) => finish({ ok: false, error: e.message }));
    });
  })();
}
function openNeteaseLogin(owner) {
  return runLoginFlow({
    partition: NETEASE_LOGIN_PARTITION,
    url: NETEASE_LOGIN_URL,
    title: "\u7F51\u6613\u4E91\u97F3\u4E50\u767B\u5F55",
    width: 940,
    height: 760,
    read: readNeteaseCookie,
    hasLogin: neteaseCookieHasLogin,
    hasFullLogin: neteaseCookieHasLogin,
    owner
  });
}
function openQQLogin(owner) {
  return runLoginFlow({
    partition: QQ_LOGIN_PARTITION,
    url: QQ_LOGIN_URL,
    title: "QQ \u97F3\u4E50\u767B\u5F55",
    width: 900,
    height: 720,
    read: readQQCookie,
    hasLogin: qqCookieHasLogin,
    hasFullLogin: qqCookieHasPlaybackLogin,
    owner
  });
}
async function clearSession(partition) {
  await import_electron2.session.fromPartition(partition).clearStorageData({ storages: ["cookies", "localstorage", "indexdb", "cachestorage"] });
  return { ok: true };
}
var clearNeteaseLogin = () => clearSession(NETEASE_LOGIN_PARTITION);
var clearQQLogin = () => clearSession(QQ_LOGIN_PARTITION);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  clearNeteaseLogin,
  clearQQLogin,
  openNeteaseLogin,
  openQQLogin
});
