'use strict';
const path = require('node:path');
const esbuild = require('esbuild');
Promise.all([
  esbuild.build({ entryPoints: [path.join(__dirname, 'music-upstream.ts')], outfile: path.join(__dirname, 'music-upstream.cjs'), bundle: true, platform: 'node', format: 'cjs', target: 'node24', packages: 'external', drop: ['console'], legalComments: 'eof' }),
  esbuild.build({ entryPoints: [path.join(__dirname, 'vendor/simple-music/electron/modules/login-manager.ts')], outfile: path.join(__dirname, 'music-login.cjs'), bundle: true, platform: 'node', format: 'cjs', target: 'node24', external: ['electron'], drop: ['console'], legalComments: 'eof' })
]).catch((error) => { console.error(error.message); process.exitCode = 1; });
