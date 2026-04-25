// 智联微记 Background Service Worker
const API = 'http://localhost:3000';
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

function getToken() {
  return new Promise(resolve =>
    chrome.storage.local.get('token', d => resolve(d.token || null))
  );
}

async function apiRequest(method, path, body) {
  const token = await getToken();
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore parse error and fallback to status
    }
    if (res.status === 401) {
      await chrome.storage.local.remove(['token', 'user']);
      throw new Error('登录已失效，请先在插件中重新登录');
    }
    throw new Error(message);
  }
  return res.json();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'captureArea')  { handleCapture(msg, sender, sendResponse); return true; }
  if (msg.action === 'saveNote')     { handleSaveNote(msg, sendResponse);         return true; }
  if (msg.action === 'searchNotes')  { handleSearch(msg, sendResponse);           return true; }
  if (msg.action === 'listThemes')   { handleListThemes(sendResponse);            return true; }
  if (msg.action === 'openAppPath')  { handleOpenAppPath(msg, sendResponse);      return true; }
  if (msg.action === 'openTab')      { chrome.tabs.create({ url: msg.url }); sendResponse({ ok: true }); return true; }
  if (msg.action === 'login')        { handleLogin(msg, sendResponse);            return true; }
  if (msg.action === 'logout')       { chrome.storage.local.remove(['token','user']); sendResponse({ ok: true }); return true; }
  if (msg.action === 'getUser')      { chrome.storage.local.get(['token','user'], d => sendResponse(d)); return true; }
});

async function handleCapture(msg, sender, sendResponse) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });
    const cropped = await cropImage(dataUrl, msg.rect, msg.dpr);
    sendResponse({ dataUrl: cropped });
  } catch (e) {
    console.error('captureArea error', e);
    sendResponse({ error: e.message });
  }
}

async function cropImage(dataUrl, rect, dpr = 1) {
  const res    = await fetch(dataUrl);
  const blob   = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const ratio  = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(rect.width * ratio)), Math.max(1, Math.round(rect.height * ratio)));
  const ctx    = canvas.getContext('2d');
  ctx.drawImage(bitmap,
    Math.round(rect.x * ratio), Math.round(rect.y * ratio),
    Math.round(rect.width * ratio), Math.round(rect.height * ratio),
    0, 0, Math.round(rect.width * ratio), Math.round(rect.height * ratio)
  );
  const outBlob = await canvas.convertToBlob({ type: 'image/png' });
  return blobToDataUrl(outBlob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function handleListThemes(sendResponse) {
  try {
    const tags = await apiRequest('GET', '/tags')
    sendResponse({ tags: Array.isArray(tags) ? tags : [] })
  } catch (e) {
    sendResponse({ tags: [] })
  }
}

async function handleSaveNote(msg, sendResponse) {
  try {
    const token = await getToken();
    if (!token) { sendResponse({ ok: false, error: 'not_logged_in' }); return; }

    const themeName = (msg.themeName || '').trim()
    const branchName = (msg.branchName || '').trim()
    if (!themeName || !branchName) {
      sendResponse({ ok: false, error: '请先填写主题与分支' })
      return
    }

    // Upload screenshot
    const res  = await fetch(msg.dataUrl);
    const blob = await res.blob();
    const formData = new FormData();
    formData.append('file', blob, 'screenshot.png');
    const uploadRes = await fetch(API + '/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: formData
    });
    let imageUrl = '';
    if (uploadRes.ok) {
      const uploadData = await uploadRes.json();
      imageUrl = uploadData.url;
    }

    const tag = await apiRequest('POST', '/tags', { name: themeName })

    // Create note
    const noteContent = imageUrl
      ? `![截图](http://localhost:3000${imageUrl})\n\n来源：${msg.sourceUrl}\n分支：${branchName}`
      : `来源：${msg.sourceUrl}\n分支：${branchName}`;

    const note = await apiRequest('POST', '/notes', {
      title: msg.title,
      content: noteContent,
      type: 'clip',
      source: msg.sourceUrl,
      branch: branchName,
      tagIds: tag?.id ? [tag.id] : []
    });
    sendResponse({ ok: true, note });
  } catch (e) {
    console.error('saveNote error', e);
    const message = e?.message || '';
    if (message.includes('401')) {
      sendResponse({ ok: false, error: '登录已失效，请先在插件中重新登录后再保存' });
      return;
    }
    sendResponse({ ok: false, error: message || '保存失败，请稍后重试' });
  }
}

async function handleSearch(msg, sendResponse) {
  try {
    const notes = await apiRequest('GET', `/graph/related?keyword=${encodeURIComponent(msg.keyword)}`);
    sendResponse({ notes: Array.isArray(notes) ? notes : [] });
  } catch (e) {
    sendResponse({ notes: [] });
  }
}

async function handleOpenAppPath(msg, sendResponse) {
  const path = msg.path || '/'
  const checked = []
  for (const base of FRONTEND_CANDIDATES) {
    checked.push(base)
    try {
      const ping = await fetch(`${base}/`, { method: 'GET', cache: 'no-store' })
      if (!ping.ok && ping.status !== 404) continue
      const finalUrl = `${base}${path}`
      chrome.tabs.create({ url: finalUrl })
      sendResponse({ ok: true, url: finalUrl })
      return
    } catch {
      // try next candidate
    }
  }
  sendResponse({ ok: false, message: `未检测到可用前端端口，请先启动前端服务（已检查：${checked.join('、')}）` })
}

async function handleLogin(msg, sendResponse) {
  try {
    const res  = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: msg.email, password: msg.password })
    });
    const data = await res.json();
    if (!res.ok) { sendResponse({ ok: false, message: data.message }); return; }
    await chrome.storage.local.set({ token: data.token, user: data.user });
    sendResponse({ ok: true, user: data.user });
  } catch (e) {
    sendResponse({ ok: false, message: e.message });
  }
}
