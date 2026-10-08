'use strict';
const $ = (id) => document.getElementById(id);
const nativeIcons = { back: 'chevron-left', forward: 'chevron-right', retry: 'arrow-path', home: 'home' };
for (const [id, name] of Object.entries(nativeIcons)) $(id).dataset.hero = name;
for (const node of document.querySelectorAll('[data-hero]')) {
  const request = new XMLHttpRequest(); request.open('GET', `icons/${node.dataset.hero}.svg`);
  request.onload = () => { if (request.status === 200) node.innerHTML = request.responseText; }; request.send();
}
let noticeTimer;
const actionMap = { back: 'back', forward: 'forward', retry: 'retry', home: 'home', copy: 'copy', browser: 'browser', menu: 'menu', 'retry-page': 'retry', 'browser-page': 'browser', settings: 'settings', 'fit-display': 'fit-display', minimize: 'minimize', maximize: 'maximize', close: 'close' };
for (const [id, command] of Object.entries(actionMap)) {
  $(id).addEventListener('click', () => {
    window.albumDesktop.command(command).catch(() => {});
  });
}
let panelOpen = false;
function showSettings(settings) {
  $('connection-mode').value = settings.connectionMode || 'local'; $('showroom').value = settings.showroom;
  $('show-purchases').checked = settings.showPurchases;
  $('theme').value = settings.theme; $('font').value = settings.font;
  $('weight').value = String(settings.weight); $('zoom').value = String(settings.zoom);
  $('reduce-motion').checked = settings.reduceMotion; updatePreview();
}
function showDisplay(display) { if (display) $('display-info').textContent = `${display.name} · ${display.width} × ${display.height} 像素 · 系统缩放 ${display.scale}% · ${Math.round(display.refreshRate)} Hz`; }
function updatePreview() {
  $('zoom-value').textContent = `${$('zoom').value}%`;
  const family = $('font').value === 'bundled' ? 'HarmonyOS Sans SC Bundled' : $('font').value;
  $('font-preview').style.fontFamily = `${JSON.stringify(family)}, "HarmonyOS Sans SC Bundled", sans-serif`;
  $('font-preview').style.fontWeight = $('weight').value;
}
async function loadSettings() {
  try {
    const data = await window.albumDesktop.settings('get');
    const pendingFont = $('font').value || data.settings.font;
    const group = document.createElement('optgroup'); group.label = '本机已安装字体';
    for (const font of data.fonts) { const option = document.createElement('option'); option.value = font; option.textContent = font; group.append(option); }
    $('font').querySelector('optgroup')?.remove(); $('font').append(group);
    $('font-hint').textContent = data.fonts.length ? `可切换到本机已安装的 ${data.fonts.length} 种字体。` : '本机字体列表读取失败，仍可使用内置字体。';
    $('font').value = pendingFont; updatePreview(); showDisplay(data.display);
  } catch { $('settings-notice').textContent = '无法读取设置，请关闭后重试。'; }
}
for (const id of ['font', 'weight', 'zoom']) $(id).addEventListener('input', updatePreview);
let saveQueue = Promise.resolve();
function saveDraft() {
  const draft = { theme: $('theme').value, font: $('font').value || 'bundled', weight: Number($('weight').value), zoom: Number($('zoom').value), reduceMotion: $('reduce-motion').checked, connectionMode: $('connection-mode').value, showroom: $('showroom').value, showPurchases: $('show-purchases').checked };
  $('settings-notice').textContent = '正在应用…';
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    await window.albumDesktop.settings('apply', draft);
    $('settings-notice').textContent = '设置已保存，已应用到展柜。';
  });
  return saveQueue;
}
const showSaveError = (error) => { $('settings-notice').textContent = `保存失败：${error.message}`; };
$('settings-form').addEventListener('change', () => saveDraft().catch(showSaveError));
$('settings-form').addEventListener('submit', (event) => { event.preventDefault(); saveDraft().catch(showSaveError); });
$('settings-close').addEventListener('click', async () => {
  try { await saveDraft(); await window.albumDesktop.command('settings-close'); } catch (error) { showSaveError(error); }
});
$('settings-reset').addEventListener('click', async () => {
  try { const data = await window.albumDesktop.settings('reset'); showSettings(data.settings); $('settings-notice').textContent = '已恢复默认设置。'; }
  catch { $('settings-notice').textContent = '恢复失败，请重试。'; }
});
$('font-license').addEventListener('click', async () => {
  const box = $('license-text'); box.hidden = !box.hidden;
  if (!box.hidden && !box.textContent) {
    // Same-document resource access, without network access or a privileged bridge.
    const request = new XMLHttpRequest(); request.open('GET', 'fonts/LICENSE.txt');
    request.onload = () => { box.textContent = request.responseText.replace(/\0/g, ''); };
    request.onerror = () => { box.textContent = '授权协议随程序的字体文件一起打包。'; }; request.send();
  }
});
window.albumDesktop.onState((state) => {
  document.body.dataset.shellVisible = String(Boolean(state.settingsOpen || state.loading || state.error));
  $('back').disabled = !state.canBack;
  $('forward').disabled = !state.canForward;
  $('status').textContent = state.error ? '连接中断' : state.loading ? '正在连接' : '界面就绪';
  $('status').className = 'status' + (state.error ? ' error' : state.loading ? ' loading' : '');
  $('connection').hidden = !state.loading && !state.error;
  $('loader').hidden = Boolean(state.error);
  $('recovery').hidden = !state.error;
  $('headline').textContent = state.error ? '暂时无法连接音乐展柜' : '连接你的音乐展柜';
  $('message').textContent = state.error || '正在打开 Album Circle，封面、曲目和房间内容直接来自原站。';
  $('settings-panel').hidden = !state.settingsOpen; showDisplay(state.display);
  if (state.settingsOpen && !panelOpen) { showSettings(state.settings); $('settings-notice').textContent = '修改仅保存在本机'; loadSettings(); $('settings-close').focus(); }
  if (!state.settingsOpen && panelOpen) $('settings').focus();
  panelOpen = state.settingsOpen;
  if (state.notice) {
    clearTimeout(noticeTimer); $('copy').textContent = '已复制';
    noticeTimer = setTimeout(() => { $('copy').textContent = '复制链接'; }, 2200);
  }
});
window.addEventListener('online', () => window.albumDesktop.command('network-restored').catch(() => {}));
window.addEventListener('keydown', (event) => {
  if (!panelOpen) return;
  if (event.key === 'Escape') { event.preventDefault(); window.albumDesktop.command('settings-close').catch(() => {}); }
  if (event.key === 'Tab') {
    const controls = [...$('settings-panel').querySelectorAll('button:not(:disabled), input, select')].filter((control) => control.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
window.albumDesktop.command('ready').catch(() => {});
