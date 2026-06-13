import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.APP_URL || 'http://localhost:5173/';
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
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
  await page.getByLabel('房间名称').fill(`视觉验收房间 ${stamp}`);
  await page.getByRole('button', { name: /创建房间/ }).click();
  await page.locator('.gallery-only-hero .album-wall-hero').waitFor({ timeout: 20000 });
  return new URL(page.url()).searchParams.get('room');
}

async function joinRoom(page, roomId) {
  if (await page.locator('.gallery-only-hero .album-wall-hero').count()) return;
  await page.getByLabel('房间 ID').fill(roomId);
  await page.getByRole('button', { name: /加入房间/ }).click();
  await page.locator('.gallery-only-hero .album-wall-hero').waitFor({ timeout: 20000 });
}

async function addMusic(page, type, titleQuery, artistQuery, expectedTitle, expectedArtist) {
  const addTab = page.locator('.mode-tabs').getByRole('button', { name: '添加', exact: true });
  if (await addTab.count() !== 1) throw new Error('Expected one add mode tab.');
  await addTab.click();
  await page.getByRole('button', { name: type === 'album' ? '专辑' : '歌曲', exact: true }).click();
  await page.waitForFunction(
    (label) => [...document.querySelectorAll('.type-toggle button')].some((button) => button.textContent.trim() === label && button.classList.contains('active')),
    type === 'album' ? '专辑' : '歌曲',
    { timeout: 5000 }
  );
  await page.getByLabel('歌曲 / 专辑名').fill(titleQuery);
  await page.getByLabel('歌手 / 乐队').fill(artistQuery);
  await page.getByRole('button', { name: /^搜索$/ }).click();
  await page.locator('.candidate').first().waitFor({ timeout: 35000 });
  await page.locator('.candidate-preview').filter({ hasText: type === 'album' ? '专辑' : '歌曲' }).waitFor({ timeout: 10000 });
  const firstTitle = await page.locator('.candidate strong').first().innerText();
  const firstMeta = await page.locator('.candidate small').first().innerText();
  if (!expectedTitle.test(firstTitle) || !expectedArtist.test(firstMeta)) {
    throw new Error(`${artistQuery} ${titleQuery} ranked unexpected candidate: ${firstTitle} / ${firstMeta}`);
  }
  await page.locator('.candidate').first().click();
  await page.getByRole('button', { name: type === 'album' ? /加入专辑/ : /加入歌曲/ }).click();
  await page.locator('.showroom-panel.showcase-tracks').waitFor({ timeout: 135000 });
  await page.locator('.main-stage .poster-tile strong').filter({ hasText: expectedTitle }).first().waitFor({ timeout: 15000 });
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

async function verifyNoOverflow(page, scopeName) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) throw new Error(`${scopeName} horizontal overflow ${overflow}px`);
  return overflow;
}

async function verifyMobileSections(page) {
  await page.locator('.showroom-detail').waitFor({ timeout: 15000 });
  const sections = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    return [
      '.showroom-panel',
      '.album-wall-rail',
      '.showroom-detail',
      '.detail-story',
      '.tracklist-panel',
      '.ai-dossier',
      '.showroom-comments',
      '.showroom-comment-list'
    ].map((selector) => {
      const node = document.querySelector(selector);
      const rect = node?.getBoundingClientRect();
      return {
        selector,
        found: Boolean(node),
        left: rect?.left || 0,
        right: rect?.right || 0,
        width: rect?.width || 0,
        viewport
      };
    });
  });
  const missing = sections.filter((item) => !item.found).map((item) => item.selector);
  if (missing.length) throw new Error(`mobile missing key sections: ${missing.join(', ')}`);
  const bad = sections.filter((item) => item.left < -1 || item.right > item.viewport + 1 || item.width > item.viewport + 1);
  if (bad.length) throw new Error(`mobile key sections overflow: ${JSON.stringify(bad)}`);

  const commentInput = page.locator('.showroom-comments textarea');
  await commentInput.fill('移动端评论排版验收：这段文字应该能正常换行，不撑破卡片，也不会挡住发布按钮。');
  await page.locator('.showroom-comments').getByRole('button', { name: /发布到展柜/ }).click();
  await page.getByText(/移动端评论排版验收/).waitFor({ timeout: 20000 });
  await verifyNoOverflow(page, 'mobile-after-comment');

  await page.locator('.ai-dossier .profile-note summary').first().click();
  await page.locator('.ai-dossier .profile-note[open]').first().waitFor({ timeout: 5000 });
  await verifyNoOverflow(page, 'mobile-after-ai-guide-open');

  await page.locator('.mode-tabs').getByRole('button', { name: '房间', exact: true }).click();
  await page.locator('.room-detail .room-manager').waitFor({ timeout: 10000 });
  const roomMetrics = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    return Array.from(document.querySelectorAll('.room-detail, .room-manager, .room-manager article, .room-url, .room-list button')).map((node) => {
      const rect = node.getBoundingClientRect();
      return { className: node.className || node.tagName, left: rect.left, right: rect.right, width: rect.width, viewport };
    });
  });
  const roomBad = roomMetrics.filter((item) => item.left < -1 || item.right > item.viewport + 1 || item.width > item.viewport + 1);
  if (roomBad.length) throw new Error(`mobile room sections overflow: ${JSON.stringify(roomBad.slice(0, 8))}`);
  await verifyNoOverflow(page, 'mobile-room');
  await page.locator('.mode-tabs').getByRole('button', { name: '展柜', exact: true }).click();
  await page.locator('.showroom-panel.showcase-tracks').waitFor({ timeout: 10000 });
  return { sections: sections.length, roomNodes: roomMetrics.length };
}

async function verifyHeroOnlyGallery(page, scopeName, expectedItems = 2) {
  await page.locator('.gallery-only-hero .album-wall-hero').waitFor({ timeout: 15000 });
  const metrics = await page.evaluate(() => {
    const hero = document.querySelector('.gallery-only-hero');
    const wall = document.querySelector('.gallery-only-hero .hero-wall-stage');
    const editButton = document.querySelector('.gallery-only-hero .hero-edit-button');
    const heroRect = hero?.getBoundingClientRect();
    const wallRect = wall?.getBoundingClientRect();
    return {
      heroWidth: heroRect?.width || 0,
      wallWidth: wallRect?.width || 0,
      wallHeight: wallRect?.height || 0,
      heroCopy: document.querySelectorAll('.gallery-only-hero .hero-copy').length,
      heroActions: document.querySelectorAll('.gallery-only-hero .hero-actions').length,
      wallToolbar: document.querySelectorAll('.gallery-only-hero .wall-toolbar').length,
      wallLabel: document.querySelector('.gallery-only-hero .wall-label strong')?.textContent?.trim() || '',
      wallLayoutButtons: document.querySelectorAll('.gallery-only-hero .wall-layout-buttons button').length,
      emptyCopy: document.querySelectorAll('.gallery-only-hero .poster-empty').length,
      editText: editButton?.textContent?.trim() || '',
      editWidth: editButton?.getBoundingClientRect().width || 0
    };
  });
  if (metrics.wallWidth < metrics.heroWidth * 0.82) {
    throw new Error(`${scopeName} hero wall is not the dominant first-screen object: ${JSON.stringify(metrics)}`);
  }
  if (metrics.wallHeight < 360) throw new Error(`${scopeName} hero wall is too short: ${JSON.stringify(metrics)}`);
  if (metrics.heroCopy || metrics.heroActions || metrics.emptyCopy) {
    throw new Error(`${scopeName} hero still contains old copy/actions/empty copy: ${JSON.stringify(metrics)}`);
  }
  if (metrics.wallToolbar !== 1 || metrics.wallLabel !== '专辑陈列柜' || metrics.wallLayoutButtons < 5) {
    throw new Error(`${scopeName} hero album cabinet controls are missing: ${JSON.stringify(metrics)}`);
  }
  if (metrics.editText || metrics.editWidth > 48) {
    throw new Error(`${scopeName} edit affordance should stay icon-sized: ${JSON.stringify(metrics)}`);
  }
  const heroPosterCount = await page.locator('.gallery-only-hero .poster-tile').count();
  if (heroPosterCount < expectedItems) throw new Error(`${scopeName} expected hero poster wall items, got ${heroPosterCount}`);
  return { ...metrics, heroPosterCount };
}

async function verifyShowroomTracks(page, scopeName) {
  await page.locator('.showroom-panel.showcase-tracks').waitFor({ timeout: 15000 });
  await page.locator('.album-wall-rail').waitFor({ timeout: 10000 });
  const activeMode = await page.locator('.showroom-views button.active').innerText();
  if (!/轨道/.test(activeMode)) throw new Error(`${scopeName} default showroom mode should be 轨道, got ${activeMode}`);
  const railToolbarCount = await page.locator('.main-stage .album-wall-rail .wall-toolbar').count();
  if (railToolbarCount) throw new Error(`${scopeName} rail view should not duplicate the album cabinet toolbar.`);
  const cardCount = await page.locator('.main-stage .poster-tile').count();
  if (cardCount < 2) throw new Error(`${scopeName} expected at least two rail posters, got ${cardCount}`);
  const coverBox = await page.locator('.main-stage .poster-tile .album-art').first().evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  if (coverBox.width < 120 || Math.abs(coverBox.width - coverBox.height) > 3) {
    throw new Error(`${scopeName} invalid cover box ${JSON.stringify(coverBox)}`);
  }
  return { activeMode, cardCount, coverBox };
}

async function clickPoster(page, title, artist) {
  const posters = page.locator('.main-stage .poster-tile').filter({ hasText: title }).filter({ hasText: artist });
  const count = await posters.count();
  if (count < 1) throw new Error(`Expected poster ${title} / ${artist}.`);
  await posters.first().click();
}

const browser = await chromium.launch();
const desktop = await newPage(browser, { width: 1440, height: 1040 }, 'desktop-user-a');
await desktop.goto(withBypass(baseUrl), { waitUntil: 'networkidle' });
await register(desktop, 'Alice Visual', 'A');
const roomId = await createRoom(desktop);
await verifyHeroOnlyGallery(desktop, 'desktop-empty-room', 0);

const song = await addMusic(desktop, 'song', '我爱你', '李荣浩', /我[爱愛]你|I Love You/i, /李荣浩|李榮浩|Li Ronghao/i);
const album = await addMusic(desktop, 'album', 'Blonde', 'Frank Ocean', /Blonde/i, /Frank Ocean/i);
await clickPoster(desktop, 'Blonde', 'Frank Ocean');
await desktop.screenshot({ path: path.join(outDir, 'desktop.png'), fullPage: true });
const desktopImages = await verifyImages(desktop, 'desktop');
const desktopOverflow = await verifyNoOverflow(desktop, 'desktop');
const desktopHero = await verifyHeroOnlyGallery(desktop, 'desktop', 2);
const desktopTracks = await verifyShowroomTracks(desktop, 'desktop');
await desktop.getByRole('button', { name: /封面墙/ }).click();
await desktop.locator('.album-wall-showroom').waitFor({ timeout: 10000 });
await desktop.getByRole('button', { name: /聚光/ }).click();
await desktop.locator('.spotlight-stage').waitFor({ timeout: 10000 });
await desktop.getByRole('button', { name: /轨道/ }).click();
await desktop.locator('.album-wall-rail').waitFor({ timeout: 10000 });

const themeBefore = await desktop.evaluate(() => getComputedStyle(document.querySelector('.app')).getPropertyValue('--cover-a').trim());
await clickPoster(desktop, '我爱你', '李荣浩');
await desktop.waitForTimeout(1200);
const themeAfter = await desktop.evaluate(() => getComputedStyle(document.querySelector('.app')).getPropertyValue('--cover-a').trim());
if (themeBefore === themeAfter) throw new Error(`desktop expected cover-driven theme color to change, stayed ${themeBefore}`);

const mobile = await newPage(browser, { width: 390, height: 844 }, 'mobile-user-b');
await mobile.goto(withBypass(`${baseUrl}?room=${encodeURIComponent(roomId)}`), { waitUntil: 'networkidle' });
await register(mobile, 'Ben Visual', 'R');
await joinRoom(mobile, roomId);
await mobile.getByText(/我[爱愛]你|I Love You/i).first().waitFor({ timeout: 20000 });
await mobile.getByText(/Blonde/i).first().waitFor({ timeout: 20000 });
await mobile.screenshot({ path: path.join(outDir, 'mobile.png'), fullPage: true });
const mobileImages = await verifyImages(mobile, 'mobile');
const mobileOverflow = await verifyNoOverflow(mobile, 'mobile');
const mobileHero = await verifyHeroOnlyGallery(mobile, 'mobile', 2);
const mobileTracks = await verifyShowroomTracks(mobile, 'mobile');
const mobileSections = await verifyMobileSections(mobile);

const report = {
  baseUrl,
  roomId,
  song,
  album,
  desktopHero,
  desktopTracks,
  desktopOverflow,
  mobileHero,
  mobileTracks,
  mobileSections,
  mobileOverflow,
  desktopImages: desktopImages.length,
  mobileImages: mobileImages.length,
  desktopErrors: desktop.reviewErrors,
  mobileErrors: mobile.reviewErrors
};

await fs.writeFile(path.join(outDir, 'review-report.json'), JSON.stringify(report, null, 2));
await desktop.context().close();
await mobile.context().close();
await browser.close();

const failures = [...report.desktopErrors, ...report.mobileErrors].filter(Boolean);
console.log(JSON.stringify(report, null, 2));
if (failures.length) {
  throw new Error(`Review failed:\n${failures.join('\n')}`);
}
