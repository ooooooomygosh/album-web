'use strict';
const { _electron } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { mountFixture } = require('./ui-fixture.cjs');
const desktop = path.resolve(__dirname, '..'), output = path.join(desktop, 'test-results');
const profile = path.join(output, `purchase-ui-profile-${Date.now()}`);
const executablePath = process.env.ALBUM_QA_EXE || path.join(desktop, 'node_modules/electron/dist/electron.exe');
const env = { ...process.env, ALBUM_DESKTOP_TEST_PROFILE: profile }; delete env.ELECTRON_RUN_AS_NODE;
const report = { executablePath, startedAt: new Date().toISOString(), fixtureData: true, paidAIRequests: 0, productionWrites: 0, checks: [] };
let app, host, site;
async function launch() {
  app = await _electron.launch({ executablePath, args: process.env.ALBUM_QA_EXE ? [] : [desktop], env }); app.context().setDefaultTimeout(15000); await app.firstWindow();
  for (let i = 0; i < 100; i++) { site = app.context().pages().find((p) => p.url().startsWith('https://album-circle.vercel.app')); host = app.context().pages().find((p) => p.url() === 'album-desktop://shell/index.html'); if (site && host) break; await new Promise((r) => setTimeout(r, 100)); }
  await mountFixture(app, site);
}
async function appearance(showroom, showPurchases) { await host.evaluate((settings) => window.albumDesktop.settings('apply', settings), { showroom, showPurchases }); await site.waitForFunction(({ showroom, showPurchases }) => document.documentElement.dataset.desktopShowroom === showroom && document.documentElement.dataset.desktopPurchases === String(showPurchases), { showroom, showPurchases }); }
async function saveRecord(date, format) {
  const record = site.locator('.purchase-record').first();
  await record.getByRole('button', { name: /记录购买|编辑购买记录/ }).click();
  await record.getByLabel('购买日期', { exact: true }).fill(date); await record.getByLabel('购买形式', { exact: true }).selectOption(format);
  await record.getByRole('button', { name: '保存购买记录', exact: true }).click();
  await record.locator('.purchase-badge').waitFor();
}
(async () => {
  await launch();
  for (const style of ['original', 'room', 'coverflow']) { await appearance(style, false); assert.equal(await site.locator('.purchase-record').count(), 0); assert.equal(await site.getByRole('button', { name: '记录购买', exact: true }).count(), 0); }
  report.checks.push({ name: 'toggle-off-hides-all-purchase-controls-in-three-styles', passed: true });
  await site.getByRole('button', { name: '软件设置', exact: true }).click();
  await host.waitForFunction(() => document.querySelectorAll('#font optgroup option').length > 0);
  await host.locator('#showroom').selectOption('room'); await host.locator('#show-purchases').check();
  await host.getByRole('button', { name: '保存设置', exact: true }).click();
  await site.waitForSelector('.purchase-record'); await host.getByRole('button', { name: '完成', exact: true }).click();
  report.checks.push({ name: 'actual-settings-toggle-enables-purchase-entry', passed: true });
  await saveRecord('2026-10-08', 'vinyl');
  assert.ok((await site.locator('.purchase-badge').first().innerText()).includes('黑胶')); assert.ok((await site.locator('.purchase-badge').first().innerText()).includes('2026-10-08'));
  report.checks.push({ name: 'save-vinyl-purchase-date-in-warm-room', passed: true });
  await appearance('coverflow', true); assert.ok((await site.locator('.purchase-badge').first().innerText()).includes('黑胶'));
  await appearance('original', true); assert.ok((await site.locator('.purchase-badge').first().innerText()).includes('黑胶'));
  await saveRecord('2026-10-07', 'cd');
  assert.ok((await site.locator('.purchase-badge').first().innerText()).includes('CD'));
  report.checks.push({ name: 'purchase-is-shared-across-styles-and-edits-to-CD', passed: true });
  await appearance('room', false); assert.equal(await site.locator('.purchase-record').count(), 0);
  await appearance('room', true); assert.ok((await site.locator('.purchase-badge').first().innerText()).includes('2026-10-07'));
  await site.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await site.screenshot({ path: path.join(output, 'purchase-record.png'), fullPage: true });
  assert.equal(await app.evaluate(() => globalThis.__qaBlockedWrites), 0);
  report.checks.push({ name: 'toggle-off-preserves-saved-purchase-without-cloud-writes', passed: true });
  await app.close(); app = null; await launch();
  await site.locator('.purchase-badge').waitFor(); assert.ok((await site.locator('.purchase-badge').first().innerText()).includes('CD'));
  report.checks.push({ name: 'purchase-and-toggle-persist-after-restart', passed: true });
  await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1 }); });
  await host.evaluate(() => window.albumDesktop.command('clear'));
  await mountFixture(app, site); await site.locator('.purchase-badge').waitFor();
  assert.ok((await site.locator('.purchase-badge').first().innerText()).includes('2026-10-07'));
  report.checks.push({ name: 'purchase-survives-local-login-and-cache-reset', passed: true });
  await site.getByRole('button', { name: '编辑购买记录', exact: true }).click(); await site.getByRole('button', { name: '删除记录', exact: true }).click();
  assert.equal(await site.locator('.purchase-badge').count(), 0);
  const values = await site.evaluate(() => JSON.parse(localStorage.getItem('album-circle-purchases-v1'))); assert.deepEqual(values, {});
  report.checks.push({ name: 'delete-purchase-record', passed: true });
  report.passed = true;
})().catch((error) => { report.error = error.stack; report.passed = false; process.exitCode = 1; }).finally(async () => {
  if (!report.passed && site && !site.isClosed()) await site.screenshot({ path: path.join(output, 'purchase-failure.png'), fullPage: true }).catch(() => {});
  if (app) await app.close().catch(() => {});
  report.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(output, 'purchase-ui-report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
});
