# Script to write Chrome extension files
import os

base = r'd:\cursor\cursor_programe1\zhilianweiji\extension'
os.makedirs(base, exist_ok=True)

# popup.js
with open(os.path.join(base, 'popup.js'), 'w', encoding='utf-8') as f:
    f.write("""document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('login-view');
  const mainView = document.getElementById('main-view');

  function showLogin() { loginView.style.display = 'block'; mainView.style.display = 'none'; }
  function showMain(user) {
    loginView.style.display = 'none';
    mainView.style.display = 'block';
    if (user) {
      document.getElementById('user-name').textContent = user.name || user.email;
      document.getElementById('user-email').textContent = user.email;
      document.getElementById('user-avatar').textContent = (user.name || user.email)[0].toUpperCase();
    }
  }

  chrome.runtime.sendMessage({ action: 'getUser' }, (data) => {
    if (data && data.token && data.user) showMain(data.user);
    else showLogin();
  });

  document.getElementById('login-btn').addEventListener('click', () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errEl = document.getElementById('login-error');
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
      chrome.tabs.sendMessage(tabs[0].id, { action: 'startCapture' }, () => { window.close(); });
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
""")
print('popup.js written')

# Generate simple SVG icons using canvas-style PNG via Python
import struct, zlib

def make_png(size, color=(102, 126, 234)):
    """Generate a minimal solid-color PNG"""
    def chunk(name, data):
        c = zlib.crc32(name + data) & 0xffffffff
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', c)
    
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    r, g, b = color
    raw = b''
    for _ in range(size):
        row = b'\x00' + bytes([r, g, b] * size)
        raw += row
    compressed = zlib.compress(raw)
    
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', ihdr)
    png += chunk(b'IDAT', compressed)
    png += chunk(b'IEND', b'')
    return png

for size in [16, 48, 128]:
    icon_path = os.path.join(base, 'icons', f'icon{size}.png')
    with open(icon_path, 'wb') as f:
        f.write(make_png(size))
    print(f'icon{size}.png written')

print('ALL DONE')
