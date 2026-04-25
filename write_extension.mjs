import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

const base = 'd:/cursor/cursor_programe1/zhilianweiji/extension'

// popup.js
fs.writeFileSync(path.join(base, 'popup.js'), `document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('login-view');
  const mainView  = document.getElementById('main-view');

  function showLogin() { loginView.style.display = 'block'; mainView.style.display = 'none'; }
  function showMain(user) {
    loginView.style.display = 'none';
    mainView.style.display  = 'block';
    if (user) {
      document.getElementById('user-name').textContent   = user.name || user.email;
      document.getElementById('user-email').textContent  = user.email;
      document.getElementById('user-avatar').textContent = (user.name || user.email)[0].toUpperCase();
    }
  }

  chrome.runtime.sendMessage({ action: 'getUser' }, (data) => {
    if (data && data.token && data.user) showMain(data.user);
    else showLogin();
  });

  document.getElementById('login-btn').addEventListener('click', () => {
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errEl    = document.getElementById('login-error');
    if (!email || !password) { errEl.textContent = '\u8bf7\u586b\u5199\u90ae\u7b71\u548c\u5bc6\u7801'; return; }
    errEl.textContent = '';
    chrome.runtime.sendMessage({ action: 'login', email, password }, (res) => {
      if (res && res.ok) showMain(res.user);
      else errEl.textContent = (res && res.message) || '\u767b\u5f55\u5931\u8d25';
    });
  });

  document.getElementById('capture-btn').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: 'startCapture' }, () => window.close());
    });
  });

  document.getElementById('graph-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:5173/graph' });
  });

  document.getElementById('dashboard-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:5173/dashboard' });
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'logout' }, () => showLogin());
  });
});
`, 'utf8')
console.log('popup.js written')

// Generate minimal solid-color PNG icons
function makePNG(size, r, g, b) {
  function crc32(buf) {
    let c = 0xFFFFFFFF
    for (const byte of buf) {
      c ^= byte
      for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0)
    }
    return (c ^ 0xFFFFFFFF) >>> 0
  }
  function chunk(type, data) {
    const nameBuf = Buffer.from(type)
    const lenBuf  = Buffer.allocUnsafe(4); lenBuf.writeUInt32BE(data.length)
    const crcBuf  = Buffer.allocUnsafe(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([nameBuf, data])))
    return Buffer.concat([lenBuf, nameBuf, data, crcBuf])
  }
  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8]=8; ihdr[9]=2; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(1 + size * 3)
    row[0] = 0
    for (let x = 0; x < size; x++) { row[1+x*3]=r; row[2+x*3]=g; row[3+x*3]=b }
    rows.push(row)
  }
  const raw  = Buffer.concat(rows)
  const idat = zlib.deflateSync(raw)
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ])
}

for (const size of [16, 48, 128]) {
  fs.writeFileSync(path.join(base, 'icons', `icon${size}.png`), makePNG(size, 102, 126, 234))
  console.log(`icon${size}.png written`)
}
console.log('ALL DONE')
