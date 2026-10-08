// Installable web app check: manifest, service worker and an offline reload.
// Run after `npm run build`: node scripts/pwa-smoke.mjs
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const port = 4317, base = `http://127.0.0.1:${port}/`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
// PLAYWRIGHT_CHROMIUM lets a machine with a different browser build run this check.
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  const context = await browser.newContext(), page = await context.newPage();
  await page.goto(base);
  const manifest = await (await fetch(base + 'manifest.webmanifest')).json();
  assert.equal(manifest.display, 'standalone'); assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512'));
  for (const icon of manifest.icons) assert.equal((await fetch(new URL(icon.src, base))).status, 200, icon.src);
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated', null, { timeout: 15000 });
  await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller);
  console.log('PASS manifest-and-service-worker');
  await context.setOffline(true); await page.reload();
  await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 15000 });
  console.log('PASS offline-shell-renders');
} finally { await browser.close(); server.kill(); }
