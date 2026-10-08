'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path');
if (process.platform !== 'win32') { console.log('Native Windows helpers are not required on this platform.'); process.exit(0); }
const directory = path.join(__dirname, 'native', 'bin'); fs.mkdirSync(directory, { recursive: true });
const framework = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319');
const compiler = path.join(framework, 'csc.exe');
execFileSync(compiler, ['/nologo', '/target:exe', '/platform:x64', '/optimize+', '/reference:System.Web.Extensions.dll', '/out:' + path.join(directory, 'DesktopHost.exe'), path.join(__dirname, 'native', 'DesktopHost.cs')], { stdio: 'inherit', windowsHide: true });

// The system now-playing helper uses WinRT metadata. It is optional: if this
// Windows build cannot compile it, the client reports the source unavailable.
const metadata = path.join(process.env.WINDIR || 'C:\\Windows', 'System32', 'WinMetadata');
const references = [
  'System.Web.Extensions.dll',
  ...['Windows.Media.winmd', 'Windows.Foundation.winmd', 'Windows.Storage.winmd'].map((name) => path.join(metadata, name)),
  ...['System.Runtime.WindowsRuntime.dll', 'System.Runtime.dll', 'System.Threading.Tasks.dll', 'System.Runtime.InteropServices.WindowsRuntime.dll'].map((name) => path.join(framework, name)).filter((file) => fs.existsSync(file))
];
try {
  execFileSync(compiler, ['/nologo', '/target:exe', '/platform:x64', '/optimize+', ...references.map((file) => '/reference:' + file), '/out:' + path.join(directory, 'NowPlaying.exe'), path.join(__dirname, 'native', 'NowPlaying.cs')], { stdio: 'inherit', windowsHide: true });
} catch (error) {
  console.warn('NowPlaying.exe was not built; the system now-playing source will be unavailable. ' + error.message);
}
