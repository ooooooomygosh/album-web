'use strict';
const path = require('node:path');
require('../node_modules/esbuild').build({ entryPoints: [path.join(__dirname, 'local-runtime.mjs')], outfile: path.join(__dirname, 'local-runtime.cjs'), bundle: true, platform: 'node', format: 'cjs', target: 'node24', packages: 'external', legalComments: 'eof' }).catch((error) => { console.error(error); process.exitCode = 1; });
