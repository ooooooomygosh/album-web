#!/usr/bin/env node
// The two macOS jobs (arm64, x64) each write their own latest-mac.yml. The
// updater reads one latest-mac.yml and picks the zip for its architecture, so
// the publish job merges them: same version, both files lists.
// Usage: node scripts/merge-mac-update-info.mjs out.yml a.yml b.yml
import fs from 'node:fs';

// electron-builder's update info is flat YAML: scalars plus a `files` list of
// flat maps. Parse exactly that and refuse anything else.
export function parseUpdateInfo(text) {
  const info = { files: [] }; let item = null, inFiles = false;
  for (const raw of String(text).split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const top = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(raw);
    if (top) { inFiles = top[1] === 'files' && top[2] === ''; item = null; if (!inFiles) info[top[1]] = unquote(top[2]); continue; }
    const start = /^\s+-\s+([A-Za-z0-9_]+):\s*(.*)$/.exec(raw);
    if (inFiles && start) { item = { [start[1]]: unquote(start[2]) }; info.files.push(item); continue; }
    const field = /^\s+([A-Za-z0-9_]+):\s*(.*)$/.exec(raw);
    if (inFiles && item && field) { item[field[1]] = unquote(field[2]); continue; }
    throw new Error('Unexpected update info line: ' + raw);
  }
  if (!info.version || !info.files.length) throw new Error('Update info has no version or files.');
  return info;
}
const unquote = (value) => /^'.*'$/.test(value) ? value.slice(1, -1).replace(/''/g, "'") : /^".*"$/.test(value) ? JSON.parse(value) : value;
const quote = (value) => /^[\w./+=-]+$/.test(String(value)) && !/^\d+$/.test(String(value)) || /^\d+$/.test(String(value)) ? String(value) : `'${String(value).replace(/'/g, "''")}'`;

export function mergeUpdateInfo(infos) {
  if (infos.length < 2) throw new Error('Need the update info of both macOS architectures.');
  const versions = new Set(infos.map((info) => info.version));
  if (versions.size !== 1) throw new Error('macOS update info versions differ: ' + [...versions].join(', '));
  const seen = new Set(), files = [];
  for (const info of infos) for (const file of info.files) if (!seen.has(file.url)) { seen.add(file.url); files.push(file); }
  if (!files.some((f) => /arm64.*\.zip$/.test(f.url)) || !files.some((f) => !/arm64/.test(f.url) && /\.zip$/.test(f.url))) throw new Error('Merged update info must contain an arm64 zip and an x64 zip.');
  const x64 = infos.find((info) => !/arm64/.test(info.path || '')) || infos[0];
  const releaseDate = infos.map((info) => info.releaseDate || '').sort().at(-1);
  return { version: infos[0].version, files, path: x64.path, sha512: x64.sha512, releaseDate };
}
export function stringifyUpdateInfo(info) {
  const lines = [`version: ${quote(info.version)}`, 'files:'];
  for (const file of info.files) Object.entries(file).forEach(([key, value], index) => lines.push(`${index ? '    ' : '  - '}${key}: ${quote(value)}`));
  for (const key of ['path', 'sha512', 'releaseDate']) if (info[key]) lines.push(`${key}: ${quote(info[key])}`);
  return lines.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const [out, ...inputs] = process.argv.slice(2);
  if (!out || inputs.length < 2) { console.error('usage: merge-mac-update-info.mjs out.yml a.yml b.yml'); process.exit(2); }
  fs.writeFileSync(out, stringifyUpdateInfo(mergeUpdateInfo(inputs.map((file) => parseUpdateInfo(fs.readFileSync(file, 'utf8'))))));
  console.log('merged', inputs.join(' + '), '->', out);
}
