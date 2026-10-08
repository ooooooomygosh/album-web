'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path');
if (process.platform !== 'win32') { console.log('Native Windows wallpaper helper is not required on this platform.'); process.exit(0); }
const directory = path.join(__dirname, 'native', 'bin'); fs.mkdirSync(directory, { recursive: true });
const compiler = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
execFileSync(compiler, ['/nologo', '/target:exe', '/platform:x64', '/optimize+', '/reference:System.Web.Extensions.dll', '/out:' + path.join(directory, 'DesktopHost.exe'), path.join(__dirname, 'native', 'DesktopHost.cs')], { stdio: 'inherit', windowsHide: true });
