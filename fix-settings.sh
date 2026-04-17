#!/bin/bash
# fix-settings.sh — workaround for Zepp 10.2.0 __webview_comms__ regression
#
# Usage:
#   1. Open Zepp app → StarLine Remote → tap the settings icon
#   2. Run: ./fix-settings.sh
#   3. Keep terminal open while configuring settings
#   4. Ctrl+C when done

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_MODULES=/tmp/node_modules

echo "=== StarLine Settings Fix (Zepp 10.2.0 workaround) ==="

# Check ADB
if ! adb devices 2>/dev/null | grep -q "device$"; then
  echo "ERROR: Phone not connected via ADB. Enable USB debugging and connect."
  exit 1
fi
echo "[OK] Phone connected"

# Forward CDP port
PID=$(adb shell "ps -A 2>/dev/null | grep hmwatchmanager" | awk '{print $2}' | tr -d '\r')
if [ -z "$PID" ]; then
  echo "ERROR: Zepp app (hmwatchmanager) is not running"
  exit 1
fi
adb forward tcp:9222 "localabstract:webview_devtools_remote_${PID}" > /dev/null
echo "[OK] CDP port forwarded (Zepp PID: $PID)"

# Install ws module if needed
if [ ! -d "$NODE_MODULES/ws" ]; then
  echo "Installing ws module..."
  cd /tmp && npm install ws > /dev/null 2>&1
fi

# Download framework JS if not cached
FRAMEWORK=/tmp/app-settings-framework.js
if [ ! -f "$FRAMEWORK" ]; then
  echo "Downloading Zepp framework JS (709KB, one-time)..."
  curl -s -o "$FRAMEWORK" "https://zepp-os.zepp.com/app-settings/v1.0.1/app-settings.global.1718079255009.prod.js"
  echo "[OK] Downloaded $(wc -c < $FRAMEWORK) bytes"
else
  echo "[OK] Framework cached"
fi

# Extract setting.js from latest bundle
ZAB=$(ls -t "$SCRIPT_DIR/dist/"*.zab 2>/dev/null | head -1)
if [ -z "$ZAB" ]; then
  echo "No .zab found in dist/, building..."
  cd "$SCRIPT_DIR" && npm run build
  ZAB=$(ls -t "$SCRIPT_DIR/dist/"*.zab | head -1)
fi
echo "[OK] Bundle: $(basename $ZAB)"

cd /tmp && rm -rf _fix && mkdir _fix && cd _fix
unzip -q "$ZAB"
unzip -q *.zpk
unzip -q app-side.zip setting.js
echo "[OK] setting.js extracted ($(wc -c < setting.js) bytes)"
cp setting.js /tmp/_fix_setting.js
cd "$SCRIPT_DIR"

# Run the CDP injection and keep alive
node << 'JSEOF'
const WebSocket = require('/tmp/node_modules/ws');
const http = require('http');
const fs = require('fs');

const settingJs = fs.readFileSync('/tmp/_fix_setting.js', 'utf8');
const frameworkJs = fs.readFileSync('/tmp/app-settings-framework.js', 'utf8');

const polyfill = [
  '(function(){',
  'window.__webview_comms__={',
  '  getSettingsCode:function(){return{content:PLACEHOLDER};},',
  '  clearSettingsStorage:function(){return{};},',
  '  getSettingsStorage:function(){return null;},',
  '  setSettingsStorage:function(){},',
  '  onSettingsStorageChange:function(){}',
  '};',
  'console.log("[bridge] __webview_comms__ ready");',
  '})();',
].join('').replace('PLACEHOLDER', JSON.stringify(settingJs));

http.get('http://localhost:9222/json', (res) => {
  let raw = '';
  res.on('data', d => raw += d);
  res.on('end', () => {
    let pages;
    try { pages = JSON.parse(raw); } catch(e) {
      console.log('ERROR: CDP not reachable. Is the phone connected and Zepp running?');
      process.exit(1);
    }
    const sp = pages.find(p => p.url && p.url.includes('app-settings'));
    if (!sp) {
      console.log('');
      console.log('ERROR: Settings page not found in WebView list.');
      console.log('Steps:');
      console.log('  1. Open Zepp app on your phone');
      console.log('  2. Find StarLine Remote and tap the settings (gear) icon');
      console.log('  3. Run this script again');
      process.exit(1);
    }

    const ws = new WebSocket(sp.webSocketDebuggerUrl);
    let id = 1;
    let served = false;

    ws.on('open', () => {
      ws.send(JSON.stringify({ id: id++, method: 'Runtime.enable', params: {} }));
      ws.send(JSON.stringify({ id: id++, method: 'Page.enable', params: {} }));
      ws.send(JSON.stringify({
        id: id++, method: 'Fetch.enable',
        params: { patterns: [{ urlPattern: '*app-settings.global*' }] }
      }));
      ws.send(JSON.stringify({
        id: id++, method: 'Page.addScriptToEvaluateOnNewDocument',
        params: { source: polyfill }
      }));
      setTimeout(() => {
        ws.send(JSON.stringify({ id: id++, method: 'Page.reload', params: { ignoreCache: true } }));
        console.log('[OK] Reloading settings page on phone...');
      }, 500);
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.method === 'Fetch.requestPaused') {
        ws.send(JSON.stringify({
          id: id++, method: 'Fetch.fulfillRequest',
          params: {
            requestId: msg.params.requestId,
            responseCode: 200,
            responseHeaders: [{ name: 'Content-Type', value: 'application/javascript' }],
            body: Buffer.from(frameworkJs, 'utf8').toString('base64')
          }
        }));
        if (!served) {
          console.log('[OK] Framework JS served from local cache (bypassing CDN)');
          served = true;
        }
      }
      if (msg.method === 'Page.loadEventFired' && served) {
        console.log('[OK] Settings page loaded and rendered!');
        console.log('');
        console.log('Configure your StarLine settings on the phone.');
        console.log('Keep this terminal open while using settings.');
        console.log('Press Ctrl+C when done.');
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const args = msg.params.args.map(a => a.value || a.description || '').join(' ');
        if (args.includes('[bridge]')) console.log('[JS] ' + args);
      }
    });

    process.on('SIGINT', () => {
      console.log('\nDone.');
      ws.close();
      process.exit(0);
    });

    ws.on('close', () => process.exit(0));
    ws.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
  });
});
JSEOF
