document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('login-view');
  const mainView  = document.getElementById('main-view');
  const FRONTEND_CANDIDATES = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
    'http://127.0.0.1:5176'
  ]

  async function openAppPath(path) {
    for (const base of FRONTEND_CANDIDATES) {
      try {
        const res = await fetch(`${base}/`, { method: 'GET', cache: 'no-store' })
        if (res.ok || res.status === 404) {
          chrome.tabs.create({ url: `${base}${path}` })
          return { ok: true }
        }
      } catch {
        // try next
      }
    }
    return { ok: false, message: '未检测到可用前端端口，请先启动前端服务' }
  }

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
    if (!email || !password) { errEl.textContent = '请填写邮箱和密码'; return; }
    errEl.textContent = '';
    chrome.runtime.sendMessage({ action: 'login', email, password }, (res) => {
      if (res && res.ok) showMain(res.user);
      else errEl.textContent = (res && res.message) || '登录失败';
    });
  });

  document.getElementById('capture-btn').addEventListener('click', () => {
    const btn = document.getElementById('capture-btn');
    const hint = document.getElementById('capture-hint');
    btn.disabled = true;
    btn.textContent = '正在进入摘录模式...';
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        btn.disabled = false;
        btn.textContent = '开始截图摘录';
        if (hint) hint.textContent = '未找到当前页面';
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: 'startCapture' }, (response) => {
        btn.disabled = false;
        btn.textContent = '开始截图摘录';
        if (chrome.runtime.lastError) {
          if (hint) hint.textContent = '当前页面暂不支持摘录，请刷新页面后重试';
          return;
        }
        if (response && response.ok && hint) {
          hint.textContent = '摘录模式已启动，请回到网页拖拽选择区域';
        }
      });
    });
  });

  document.getElementById('graph-btn').addEventListener('click', async () => {
    const res = await openAppPath('/graph')
    if (!res?.ok) {
      const hint = document.getElementById('capture-hint')
      if (hint) hint.textContent = res?.message || '打开图谱失败，请确认前端已启动'
    }
  });

  document.getElementById('dashboard-btn').addEventListener('click', async () => {
    const res = await openAppPath('/dashboard')
    if (!res?.ok) {
      const hint = document.getElementById('capture-hint')
      if (hint) hint.textContent = res?.message || '打开仪表盘失败，请确认前端已启动'
    }
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'logout' }, () => showLogin());
  });
});
