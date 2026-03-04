#!/usr/bin/env node
// Zepp OS Preview Server — замена zeus preview
// Запуск: node preview-server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 8088;
const PROJECT_DIR = __dirname;

// Find .zpk in dist/ or create one on the fly
function findOrBuildZpk() {
  const distDir = path.join(PROJECT_DIR, 'dist');
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir).filter(f => f.endsWith('.zpk'));
    if (files.length > 0) {
      console.log(`Found: dist/${files[0]}`);
      return path.join(distDir, files[0]);
    }
  }

  // Build it with zip
  console.log('No .zpk found in dist/, building...');
  const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, 'app.json'), 'utf8'));
  const version = pkg.app.version.name;
  const zpkPath = path.join(PROJECT_DIR, `starline-zepp-${version}.zpk`);

  execSync(`cd "${PROJECT_DIR}" && zip -r "${zpkPath}" app.json icon.png device-app/ side-service/ settings-app/ --exclude "*.DS_Store"`, { stdio: 'inherit' });
  return zpkPath;
}

function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

const zpkPath = findOrBuildZpk();
const zpkName = path.basename(zpkPath);
const localIP = getLocalIP();
const zpkUrl = `http://${localIP}:${PORT}/${zpkName}`;

// Zepp App preview URL format (same as zeus preview generates)
const previewUrl = `zeus://preview?path=%2F&url=${encodeURIComponent(zpkUrl)}`;

const server = http.createServer((req, res) => {
  if (req.url === '/' + zpkName || req.url === '/app.zpk') {
    const stat = fs.statSync(zpkPath);
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(zpkPath).pipe(res);
    console.log(`[${new Date().toLocaleTimeString()}] Served ${zpkName} to ${req.socket.remoteAddress}`);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n─────────────────────────────────────────');
  console.log('  StarLine Zepp — Preview Server');
  console.log('─────────────────────────────────────────');
  console.log(`  Package : ${zpkName}`);
  console.log(`  Server  : http://${localIP}:${PORT}`);
  console.log('─────────────────────────────────────────\n');
  console.log('  QR-код для Zepp App:\n');

  try {
    execSync(`source /home/msnk/.nvm/nvm.sh && nvm use 18 --silent && qrcode "${previewUrl}"`, {
      shell: '/bin/bash',
      stdio: 'inherit'
    });
  } catch {
    // Fallback: print URL for manual QR generation
    console.log('  URL для QR-кода:');
    console.log(`  ${previewUrl}\n`);
    console.log('  Сгенерируй QR вручную: https://qr.io или qrencode в терминале');
  }

  console.log('\n  Отсканируй QR в Zepp App → Developer Mode');
  console.log('  Ctrl+C для остановки\n');
});
