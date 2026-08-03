import fs from 'node:fs';
import path from 'node:path';

const SRC = 'src/main.jsx';
const text = fs.readFileSync(SRC, 'utf8');
const lines = text.split('\n');

const declRe = /^(?:async\s+)?function\s+([A-Za-z_]\w*)|^const\s+([A-Za-z_]\w*)|^let\s+([A-Za-z_]\w*)|^class\s+([A-Za-z_]\w*)/;
const decls = [];
for (let i = 0; i < lines.length; i++) {
  const m = declRe.exec(lines[i]);
  if (m) decls.push({ name: m[1] || m[2] || m[3] || m[4], start: i });
}
for (let i = 0; i < decls.length; i++) decls[i].end = i + 1 < decls.length ? decls[i + 1].start - 1 : lines.length - 1;

// 模块归属
const MODULES = {
  utils: new Set(['avatarOptions','memberColors','recommendations','emptyProfile','statusLabels','defaultHeroConfig','defaultUserSettings','hoverPreviewLabels','wallLayoutPresets','mergeUserSettings','roomQueryUrl','parseRoomQuery','wallLayoutStyle','cabinetDisplayTitle','loadJson','saveJson','avatarFor','avatarSrc','profileToDraft','publicMemberProfile','listToText','textToList','clampText','cleanImageUrl','normalizeHeroConfig','editableHeroConfig','countAlbumTracks','heroBackgroundImage','slugifyRoom','normalizeMusicText','trackTitle','trackArtist','albumKey','sameAlbum','trackMatchesTitle','colorHash','fallbackPalette','rgbToHslString','cssImageUrl','stableIndex','providerLabel','listeningLinksFor','authHeaders','api','imageFileToDataUrl','apiWithTimeout','recoTitle','recoReason','recoEntry']),
  common: new Set(['UserAvatar','AuthorChip','useCoverPalette','AlbumArt','AddGenerationLoader','PersonaGenerationLoader','ConfirmDialog','RatingPanel','Ai','EditableList']),
  gates: new Set(['AuthGate','RoomGate']),
  cabinet: new Set(['AlbumCabinetPage','CabinetSettingsPopover','AlbumCabinetGrid','CabinetListItem','AlbumCabinetTile','MemberProfileModal']),
  detail: new Set(['AlbumDetailPage','Review']),
  search: new Set(['GlobalMusicSearch','AddMusic']),
  persona: new Set(['PersonaReport','PersonaChatBox']),
  panels: new Set(['ProfilePanel','AdminPanel','RoomPanel','UserSettingsCard']),
  App: new Set(['App']),
};
const FILE_OF = {
  utils: 'lib/utils.js',
  common: 'components/common.jsx',
  gates: 'components/gates.jsx',
  cabinet: 'components/cabinet.jsx',
  detail: 'components/detail.jsx',
  search: 'components/search.jsx',
  persona: 'components/persona.jsx',
  panels: 'components/panels.jsx',
  App: 'App.jsx',
};
const nameToModule = {};
for (const [mod, set] of Object.entries(MODULES)) for (const n of set) nameToModule[n] = mod;

const ALL_NAMES = new Set(decls.map(d => d.name));
const ICONS = ['Album','ArrowUpRight','BookOpen','Bot','ChevronRight','CirclePlus','Disc3','DoorOpen','Grid3X3','Library','LockKeyhole','MessageCircle','Music2','Radio','Plus','Search','Send','Share2','Sparkles','Star','Trash2','UserRound','Users','Wand2'];
const HOOKS = ['useState','useEffect','useMemo','useRef','useCallback','useReducer','useContext','useLayoutEffect'];

// bootstrap 行
const bootstrapLine = lines.findIndex(l => /createRoot\(/.test(l));
const bootstrap = bootstrapLine >= 0 ? lines.slice(bootstrapLine).join('\n') : '';
// 最后一个声明截断到 bootstrap 之前
if (bootstrapLine >= 0) {
  const last = decls[decls.length - 1];
  if (last.end >= bootstrapLine) last.end = bootstrapLine - 1;
}

const bodyOf = (d) => {
  const raw = lines.slice(d.start, d.end + 1);
  let first = raw[0];
  if (d.name === 'App') {
    first = first.replace(/^(async\s+)?function\s+App\b/, 'export default function App');
  } else {
    first = first
      .replace(/^(async\s+)?function\s+/, 'export $1function ')
      .replace(/^const\s+/, 'export const ')
      .replace(/^let\s+/, 'export let ')
      .replace(/^class\s+/, 'export class ');
  }
  raw[0] = first;
  return raw.join('\n');
};

function scanFor(src, names) {
  const found = new Set();
  for (const n of names) {
    const re = new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    if (re.test(src)) found.add(n);
  }
  return found;
}

// 为每个模块组装内容
const out = {};
for (const [mod, set] of Object.entries(MODULES)) {
  const declItems = decls.filter(d => nameToModule[d.name] === mod);
  const bodies = declItems.map(bodyOf).join('\n\n');
  const src = bodies;
  const usedHooks = scanFor(src, HOOKS);
  const usedIcons = scanFor(src, ICONS);
  const usedToast = /\btoast\s*\(/.test(src);
  const usedToaster = /\bToaster\b/.test(src);
  const usesPortal = /createPortal\s*\(/.test(src);

  // 跨文件引用
  const extRefs = {};
  for (const n of ALL_NAMES) {
    if (set.has(n)) continue; // 自身定义
    const re = new RegExp('\\b' + n + '\\b');
    if (re.test(src)) {
      const targetMod = nameToModule[n];
      (extRefs[targetMod] ||= new Set()).add(n);
    }
  }

  const imports = [];
  imports.push("import React from 'react';");
  if (usedHooks.size) imports.push(`import { ${[...usedHooks].join(', ')} } from 'react';`);
  if (usesPortal) imports.push("import { createPortal } from 'react-dom';");
  if (usedIcons.size) imports.push(`import { ${[...usedIcons].join(', ')} } from 'lucide-react';`);
  const sonner = [];
  if (usedToaster) sonner.push('Toaster');
  if (usedToast) sonner.push('toast');
  if (sonner.length) imports.push(`import { ${[...new Set(sonner)].join(', ')} } from 'sonner';`);

  // App.jsx 额外依赖
  if (mod === 'App') {
    imports.push("import { initAnalytics } from './firebaseClient';");
    imports.push("import ExperimentalCorridorCarousel from './ExperimentalCorridorCarousel';");
    imports.push("import ImmersiveDetail from './ImmersiveDetail';");
  }

  // 跨文件 import
  for (const [targetMod, ns] of Object.entries(extRefs)) {
    const file = FILE_OF[targetMod];
    const rel = mod === 'App' ? './' + file : (file.startsWith('lib/') ? '../' + file : './' + path.basename(file));
    imports.push(`import { ${[...ns].join(', ')} } from '${rel}';`);
  }

  out[mod] = { file: FILE_OF[mod], content: imports.join('\n') + '\n\n' + bodies + '\n' };
}

// 写文件
fs.mkdirSync('src/lib', { recursive: true });
fs.mkdirSync('src/components', { recursive: true });
for (const [mod, info] of Object.entries(out)) {
  fs.writeFileSync('src/' + info.file, info.content);
  console.log(`wrote src/${info.file} (${info.content.split('\n').length} lines)`);
}

// main.jsx
const mainContent = `import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles.css';
import './final-overrides.css';
import './corridor-carousel.css';
import './motion-polish.css';
import './toast-theme.css';
import './immersive-detail.css';
import App from './App.jsx';

${bootstrap}
`;
fs.writeFileSync('src/main.jsx', mainContent);
console.log('wrote src/main.jsx');
console.log('\nDONE. Bootstrap captured:', bootstrapLine >= 0);
