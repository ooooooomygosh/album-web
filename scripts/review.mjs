import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.APP_URL || 'http://localhost:5173/';
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const adminLogin = process.env.ADMIN_LOGIN || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || '';
const outDir = fileURLToPath(new URL('../artifacts/', import.meta.url));
const stamp = Date.now();
await fs.mkdir(outDir, { recursive: true });

function withBypass(url) {
  if (!bypassSecret || !url.includes('vercel.app')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}x-vercel-protection-bypass=${encodeURIComponent(bypassSecret)}`;
}

async function newPage(browser, viewport, name) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  if (bypassSecret) {
    await context.setExtraHTTPHeaders({ 'x-vercel-protection-bypass': bypassSecret });
  }
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.reviewErrors = errors;
  page.reviewName = name;
  return page;
}

async function register(page, name, avatar) {
  await page.getByRole('button', { name: '注册' }).click();
  await page.getByLabel('昵称').fill(name);
  await page.getByLabel('邮箱').fill(`${name.toLowerCase().replace(/\s+/g, '-')}-${stamp}@albumcircle.app`);
  await page.getByLabel('密码').fill('password123');
  await page.getByRole('button', { name: avatar, exact: true }).click();
  await page.getByRole('button', { name: /创建账户/ }).click();
  await page.getByRole('button', { name: /创建房间|加入房间/ }).first().waitFor({ timeout: 20000 });
}

async function createRoom(page) {
  await page.getByLabel('房间名称').fill(`上线验收房间 ${stamp}`);
  await page.getByRole('button', { name: /创建房间/ }).click();
  await page.getByRole('button', { name: /添加音乐/ }).waitFor({ timeout: 20000 });
  return new URL(page.url()).searchParams.get('room');
}

async function addMusic(page, type, query, expectedTitle, expectedArtist, expectedCardCount) {
  await page.getByRole('button', { name: '添加', exact: true }).click();
  await page.getByRole('button', { name: type === 'album' ? '专辑' : '歌曲', exact: true }).click();
  await page.waitForFunction(
    (label) => [...document.querySelectorAll('.type-toggle button')].some((button) => button.textContent.trim() === label && button.classList.contains('active')),
    type === 'album' ? '专辑' : '歌曲',
    { timeout: 5000 }
  );
  await page.getByLabel('关键词').fill(query);
  await page.getByRole('button', { name: /^搜索$/ }).click();
  await page.locator('.candidate').first().waitFor({ timeout: 35000 });
  await page.locator('.candidate-preview').filter({ hasText: type === 'album' ? '专辑' : '歌曲' }).waitFor({ timeout: 10000 });
  const firstTitle = await page.locator('.candidate strong').first().innerText();
  const firstMeta = await page.locator('.candidate small').first().innerText();
  if (!expectedTitle.test(firstTitle) || !expectedArtist.test(firstMeta)) {
    throw new Error(`${query} ranked unexpected candidate: ${firstTitle} / ${firstMeta}`);
  }
  await page.locator('.candidate').first().click();
  await page.getByRole('button', { name: type === 'album' ? /加入专辑/ : /加入歌曲/ }).click();
  await page.waitForFunction(
    (count) => document.querySelectorAll('.showcase-card').length >= count || Boolean(document.querySelector('.error-line')?.textContent?.trim()),
    expectedCardCount,
    { timeout: 135000 }
  );
  const addErrors = await page.locator('.error-line').allTextContents();
  if (addErrors.some((text) => text.trim())) {
    throw new Error(`${query} add failed: ${addErrors.join(' | ')}`);
  }
  await page.locator('.showcase-card strong').filter({ hasText: expectedTitle }).first().waitFor({ timeout: 15000 });
  await page.getByText(expectedArtist).first().waitFor({ timeout: 15000 });
  return { firstTitle, firstMeta };
}

async function verifyImages(page, scopeName) {
  const imageHealth = await page.evaluate(() =>
    Array.from(document.images).map((image) => ({
      alt: image.alt,
      src: image.currentSrc || image.src,
      width: image.naturalWidth,
      height: image.naturalHeight,
      renderedWidth: image.getBoundingClientRect().width,
      renderedHeight: image.getBoundingClientRect().height
    }))
  );
  const brokenImages = imageHealth.filter((image) => image.renderedWidth > 20 && (image.width < 80 || image.height < 80));
  if (brokenImages.length) {
    throw new Error(`${scopeName} broken cover images: ${brokenImages.map((image) => image.alt || image.src).join(', ')}`);
  }
  return imageHealth;
}

async function verifyLayout(page, scopeName) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) throw new Error(`${scopeName} horizontal overflow ${overflow}px`);
  const cardCount = await page.locator('.showcase-card').count();
  if (cardCount < 2) throw new Error(`${scopeName} expected at least two showroom cards, got ${cardCount}`);
  const viewModes = await page.locator('.showroom-views button').count();
  if (viewModes < 3) throw new Error(`${scopeName} expected three showroom view modes, got ${viewModes}`);
  const coverBox = await page.locator('.showcase-card .album-art').first().evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  if (coverBox.width < 120 || Math.abs(coverBox.width - coverBox.height) > 3) {
    throw new Error(`${scopeName} invalid cover box ${JSON.stringify(coverBox)}`);
  }
  return { overflow, cardCount, viewModes, coverBox };
}

const browser = await chromium.launch();
const desktop = await newPage(browser, { width: 1440, height: 1040 }, 'desktop-user-a');
await desktop.goto(withBypass(baseUrl), { waitUntil: 'networkidle' });
await register(desktop, 'Alice Reviewer', 'A');
const roomId = await createRoom(desktop);
const song = await addMusic(desktop, 'song', '李荣浩 我爱你', /我[爱愛]你|I Love You/i, /李荣浩|李榮浩|Li Ronghao/i, 1);
const album = await addMusic(desktop, 'album', 'Frank Ocean Blonde', /Blonde/i, /Frank Ocean/i, 2);
const albumSong = await addMusic(desktop, 'song', 'Frank Ocean White Ferrari', /White Ferrari/i, /Frank Ocean/i, 3);
await desktop.getByRole('button', { name: /专辑 Blonde Frank Ocean/i }).click();
await desktop.screenshot({ path: path.join(outDir, 'desktop.png'), fullPage: true });
const desktopImages = await verifyImages(desktop, 'desktop');
const desktopLayout = await verifyLayout(desktop, 'desktop');
await desktop.getByRole('button', { name: /聚光/ }).click();
await desktop.locator('.spotlight-stage').waitFor({ timeout: 10000 });
await desktop.getByRole('button', { name: /轨道/ }).click();
await desktop.locator('.showcase-rail').waitFor({ timeout: 10000 });
await desktop.getByRole('button', { name: /封面墙/ }).click();
await desktop.locator('.showroom-track').first().waitFor({ timeout: 10000 });
const desktopTrackCount = await desktop.locator('.showroom-track').count();
if (desktopTrackCount < 10) throw new Error(`desktop expected album tracks in showroom detail, got ${desktopTrackCount}`);
await desktop.locator('.related-song-panel').filter({ hasText: /White Ferrari/i }).waitFor({ timeout: 10000 });
await desktop.locator('.related-song').filter({ hasText: /White Ferrari/i }).click();
await desktop.locator('.album-context-card').filter({ hasText: /Blonde/i }).waitFor({ timeout: 10000 });
await desktop.locator('.showroom-track.current').filter({ hasText: /White Ferrari/i }).waitFor({ timeout: 10000 });
await desktop.locator('.album-context-card button').filter({ hasText: /查看专辑/ }).click();
await desktop.locator('.showroom-track').first().waitFor({ timeout: 10000 });
await desktop.locator('.profile-note summary').filter({ hasText: /旋律动机/ }).waitFor({ timeout: 10000 });
await desktop.locator('.profile-note summary').filter({ hasText: /歌词视角/ }).waitFor({ timeout: 10000 });
await desktop.locator('.profile-note summary').filter({ hasText: /编曲层次/ }).waitFor({ timeout: 10000 });
await desktop.locator('.profile-note summary').filter({ hasText: /发行状态/ }).waitFor({ timeout: 10000 });
await desktop.locator('.profile-note').filter({ hasText: /旋律动机/ }).click();
const profileNoteCount = await desktop.locator('.profile-note').count();
if (profileNoteCount < 4) throw new Error(`desktop expected AI profile notes, got ${profileNoteCount}`);
const sourceLinkCount = await desktop.locator('.source-strip a').count();
if (sourceLinkCount < 1) throw new Error('desktop expected Tavily source links in AI profile.');
const profileLengths = await desktop.locator('.profile-note p').allTextContents();
const shortProfileNotes = profileLengths.filter((text) => text.trim().length < 120);
if (shortProfileNotes.length) throw new Error(`desktop expected rich AI profile notes, got short notes: ${shortProfileNotes.join(' | ')}`);
const concreteProfileNotes = profileLengths.filter((text) => /推荐|先听|入口|主歌|副歌|旋律|歌词|人声|编曲|节奏|发行/.test(text));
if (concreteProfileNotes.length < 4) throw new Error(`desktop expected concrete recommendation guide notes, got ${concreteProfileNotes.length}`);
const themeBefore = await desktop.evaluate(() => getComputedStyle(document.querySelector('.app')).getPropertyValue('--cover-a').trim());
await desktop.getByRole('button', { name: /歌曲 我爱你 李荣浩/ }).click();
await desktop.waitForTimeout(1200);
const themeAfter = await desktop.evaluate(() => getComputedStyle(document.querySelector('.app')).getPropertyValue('--cover-a').trim());
if (themeBefore === themeAfter) throw new Error(`desktop expected cover-driven theme color to change, stayed ${themeBefore}`);
await desktop.getByRole('button', { name: /专辑 Blonde Frank Ocean/i }).click();

await desktop.locator('.showroom-comments textarea').fill('这首歌已经确认版本和封面，适合放在房间里一起慢慢听。');
await desktop.getByRole('button', { name: /发布到展柜/ }).click();
await desktop.locator('.comment').filter({ hasText: '适合放在房间里一起慢慢听' }).waitFor({ timeout: 15000 });
await desktop.getByText(/AI 正在阅读你的评论|Album Circle AI/).first().waitFor({ timeout: 10000 }).catch(() => null);
await desktop.locator('.comment').filter({ hasText: 'Album Circle AI' }).waitFor({ timeout: 35000 });
const ownDelete = desktop.locator('.comment').filter({ hasText: '适合放在房间里一起慢慢听' }).getByRole('button', { name: /删除评论/ });
await ownDelete.waitFor({ timeout: 10000 });
await ownDelete.click();
await desktop.locator('.comment').filter({ hasText: '适合放在房间里一起慢慢听' }).waitFor({ state: 'detached', timeout: 15000 });

await desktop.getByRole('button', { name: 'AI', exact: true }).click();
await desktop.getByRole('button', { name: /生成推荐与追问/ }).click();
await desktop.waitForFunction(() => {
  const node = document.querySelector('.ai-insight');
  return node && node.textContent && node.textContent.length > 20;
}, null, { timeout: 40000 });
const aiText = await desktop.locator('.ai-insight.spacious').innerText();

const mobile = await newPage(browser, { width: 390, height: 844 }, 'mobile-user-b');
await mobile.goto(withBypass(`${baseUrl}?room=${encodeURIComponent(roomId)}`), { waitUntil: 'networkidle' });
await register(mobile, 'Ben Reviewer', 'R');
await mobile.getByRole('heading', { name: /上线验收房间/ }).waitFor({ timeout: 20000 });
await mobile.getByText(/我[爱愛]你|I Love You/i).first().waitFor({ timeout: 20000 });
await mobile.getByText(/Blonde/i).first().waitFor({ timeout: 20000 });
await mobile.locator('.showroom-comments textarea').fill('第二位成员加入后也能看到同一个展柜，并留下自己的评论。');
await mobile.getByRole('button', { name: /发布到展柜/ }).click();
await mobile.locator('.comment').filter({ hasText: '第二位成员加入后也能看到同一个展柜' }).waitFor({ timeout: 15000 });
await mobile.locator('.comment').filter({ hasText: 'Album Circle AI' }).first().waitFor({ timeout: 35000 });
await mobile.getByRole('button', { name: /聚光/ }).click();
await mobile.locator('.spotlight-stage').waitFor({ timeout: 10000 });
await mobile.getByRole('button', { name: /封面墙/ }).click();
await mobile.screenshot({ path: path.join(outDir, 'mobile.png'), fullPage: true });
const mobileImages = await verifyImages(mobile, 'mobile');
const mobileLayout = await verifyLayout(mobile, 'mobile');

const admin = await newPage(browser, { width: 1280, height: 920 }, 'admin-console');
await admin.goto(withBypass(`${baseUrl}?room=${encodeURIComponent(roomId)}`), { waitUntil: 'networkidle' });
if (adminPassword) {
  await admin.getByLabel('邮箱').fill(adminLogin);
  await admin.getByLabel('密码').fill(adminPassword);
  await admin.locator('.auth-shell .full-action').click();
  await admin.getByRole('button', { name: /管理/ }).waitFor({ timeout: 25000 });
  await admin.getByRole('button', { name: /管理/ }).click();
  await admin.getByRole('heading', { name: /管理后台/ }).waitFor({ timeout: 20000 });
  await admin.getByText(/AI Prompt 配置/).waitFor({ timeout: 10000 });
  await admin.getByText(/房间/).first().waitFor({ timeout: 10000 });
  await admin.getByText(/用户/).first().waitFor({ timeout: 10000 });
  await admin.locator('.admin-row').filter({ hasText: /上线验收房间/ }).first().waitFor({ timeout: 10000 });
  await admin.getByLabel('自定义系统提示').fill('验收中仅检查管理界面可编辑，不保存。');
} else {
  await admin.getByText(/登录|注册/).first().waitFor({ timeout: 10000 });
}
await admin.screenshot({ path: path.join(outDir, 'admin.png'), fullPage: true });
const adminOverflow = await admin.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (adminOverflow > 1) throw new Error(`admin horizontal overflow ${adminOverflow}px`);

const report = {
  baseUrl,
  roomId,
  song,
  album,
  albumSong,
  aiText: aiText.slice(0, 220),
  desktopLayout,
  mobileLayout,
  adminOverflow,
  desktopTrackCount,
  profileNoteCount,
  desktopImages: desktopImages.length,
  mobileImages: mobileImages.length,
  desktopErrors: desktop.reviewErrors,
  mobileErrors: mobile.reviewErrors,
  adminErrors: admin.reviewErrors
};

await fs.writeFile(path.join(outDir, 'review-report.json'), JSON.stringify(report, null, 2));
await desktop.context().close();
await mobile.context().close();
await admin.context().close();
await browser.close();

const failures = [...report.desktopErrors, ...report.mobileErrors, ...report.adminErrors].filter(Boolean);
console.log(JSON.stringify(report, null, 2));
if (failures.length) {
  throw new Error(`Review failed:\n${failures.join('\n')}`);
}
