// 智联微记 Content Script
// 负责：截图选区、悬浮菜单、与 background 通信

let isCapturing = false;
let startX, startY, endX, endY;
let startClientX, startClientY, endClientX, endClientY;
let overlay, selection, menu;

// 监听来自 background/popup 的消息
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startCapture') {
    startCaptureMode();
    sendResponse({ ok: true });
  }
});

function startCaptureMode() {
  if (isCapturing) return;
  isCapturing = true;
  document.body.style.cursor = 'crosshair';

  overlay = document.createElement('div');
  overlay.id = 'zlwj-overlay';
  document.body.appendChild(overlay);

  selection = document.createElement('div');
  selection.id = 'zlwj-selection';
  document.body.appendChild(selection);

  overlay.addEventListener('mousedown', onMouseDown);
  overlay.addEventListener('mousemove', onMouseMove);
  overlay.addEventListener('mouseup', onMouseUp);
  overlay.addEventListener('keydown', onKeyDown);
  overlay.setAttribute('tabindex', '0');
  overlay.focus();
}

function onKeyDown(e) {
  if (e.key === 'Escape') cancelCapture();
}

function onMouseDown(e) {
  startClientX = e.clientX;
  startClientY = e.clientY;
  startX = e.clientX + window.scrollX;
  startY = e.clientY + window.scrollY;
  selection.style.display = 'block';
  selection.style.left = startX + 'px';
  selection.style.top = startY + 'px';
  selection.style.width = '0';
  selection.style.height = '0';
}

function onMouseMove(e) {
  if (!startX && startX !== 0) return;
  endClientX = e.clientX;
  endClientY = e.clientY;
  endX = e.clientX + window.scrollX;
  endY = e.clientY + window.scrollY;
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const w = Math.abs(endX - startX);
  const h = Math.abs(endY - startY);
  selection.style.left = x + 'px';
  selection.style.top = y + 'px';
  selection.style.width = w + 'px';
  selection.style.height = h + 'px';
}

function onMouseUp(e) {
  endClientX = e.clientX;
  endClientY = e.clientY;
  endX = e.clientX + window.scrollX;
  endY = e.clientY + window.scrollY;
  if (Math.abs(endX - startX) < 10 || Math.abs(endY - startY) < 10) {
    cancelCapture();
    return;
  }
  finishCapture();
}

function finishCapture() {
  // 移除遮罩，保留选区框
  if (overlay) { overlay.remove(); overlay = null; }
  document.body.style.cursor = '';
  isCapturing = false;

  const rect = {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY)
  };

  // captureVisibleTab 返回的是当前可视区域截图，裁剪必须使用视口坐标
  const viewportRect = {
    x: Math.min(startClientX, endClientX),
    y: Math.min(startClientY, endClientY),
    width: Math.abs(endClientX - startClientX),
    height: Math.abs(endClientY - startClientY)
  };

  // 请求 background 截图
  chrome.runtime.sendMessage(
    { action: 'captureArea', rect: viewportRect, dpr: window.devicePixelRatio || 1, pageUrl: location.href, pageTitle: document.title },
    (response) => {
      if (response && response.dataUrl) {
        showMenu(rect, response.dataUrl);
      } else {
        cancelCapture();
      }
    }
  );
}

function showMenu(rect, dataUrl) {
  if (menu) menu.remove();

  // 获取选区周围页面文本（用于关联搜索）
  const selectedText = window.getSelection().toString().trim();

  menu = document.createElement('div');
  menu.id = 'zlwj-menu';

  // 计算菜单位置（选区右下角）
  const menuX = Math.min(rect.x + rect.width + 10, window.innerWidth + window.scrollX - 320);
  const menuY = rect.y + rect.height + 10;
  menu.style.left = menuX + 'px';
  menu.style.top = menuY + 'px';

  menu.innerHTML = `
    <div class="zlwj-menu-header">
      <img src="${dataUrl}" class="zlwj-preview" />
      <button class="zlwj-close" id="zlwj-close-btn"></button>
    </div>
    <div class="zlwj-menu-body">
      <input id="zlwj-title-input" class="zlwj-input" placeholder="命名该知识点（留空自动生成）" />
      <div class="zlwj-form-grid">
        <input id="zlwj-theme-input" class="zlwj-input" placeholder="主题（必填，可新建）" list="zlwj-theme-list" />
        <datalist id="zlwj-theme-list"></datalist>
        <input id="zlwj-branch-input" class="zlwj-input" placeholder="分支（必填，例如：概念/案例/方法）" />
      </div>
      <div class="zlwj-btn-group">
        <button class="zlwj-btn zlwj-btn-primary" id="zlwj-save-btn">
          <span>记录该知识点</span>
        </button>
        <button class="zlwj-btn zlwj-btn-secondary" id="zlwj-search-btn">
          <span>查找相关知识</span>
        </button>
        <button class="zlwj-btn zlwj-btn-graph" id="zlwj-graph-btn">
          <span>在知识图谱中查看</span>
        </button>
      </div>
      <div id="zlwj-result" class="zlwj-result" style="display:none"></div>
    </div>
  `;

  document.body.appendChild(menu)

  hydrateThemeSuggestions()

  document.getElementById('zlwj-close-btn').onclick = () => cancelCapture()

  document.getElementById('zlwj-save-btn').onclick = () => {
    const title = document.getElementById('zlwj-title-input').value.trim()
    const theme = document.getElementById('zlwj-theme-input').value.trim()
    const branch = document.getElementById('zlwj-branch-input').value.trim()
    saveKnowledge(dataUrl, title || document.title, location.href, theme, branch)
  }

  document.getElementById('zlwj-search-btn').onclick = () => {
    const title = document.getElementById('zlwj-title-input').value.trim();
    searchRelated(title || selectedText || document.title);
  };

  document.getElementById('zlwj-graph-btn').onclick = () => {
    openGraph();
  };
}

async function hydrateThemeSuggestions() {
  const listEl = document.getElementById('zlwj-theme-list')
  if (!listEl) return
  chrome.runtime.sendMessage({ action: 'listThemes' }, (res) => {
    const tags = res?.tags || []
    listEl.innerHTML = tags.map(t => `<option value="${t.name}"></option>`).join('')
  })
}

function saveKnowledge(dataUrl, title, sourceUrl, themeName, branchName) {
  const resultEl = document.getElementById('zlwj-result')
  if (!themeName || !branchName) {
    resultEl.style.display = 'block'
    resultEl.innerHTML = '<span class="zlwj-error">必须填写主题和分支后才能创建知识点</span>'
    return
  }

  resultEl.style.display = 'block'
  resultEl.innerHTML = '<span class="zlwj-loading">保存中...</span>'

  chrome.runtime.sendMessage(
    { action: 'saveNote', dataUrl, title, sourceUrl, themeName, branchName },
    (response) => {
      if (response && response.ok) {
        resultEl.innerHTML = `
          <div class="zlwj-success">
            <span>✓ 保存成功：${response.note.title}</span>
            <button class="zlwj-link" id="zlwj-view-graph">查看知识图谱 →</button>
          </div>`
        document.getElementById('zlwj-view-graph').onclick = () => openGraph(response.note.id)
        searchRelated(response.note.title, true)
      } else {
        const msg = response?.error || '保存失败，请先在扩展中登录'
        resultEl.innerHTML = `<span class="zlwj-error">${msg}</span>`
      }
    }
  )
}

function searchRelated(keyword, append) {
  const resultEl = document.getElementById('zlwj-result');
  if (!append) {
    resultEl.style.display = 'block';
    resultEl.innerHTML = '<span class="zlwj-loading">搜索相关知识...</span>';
  }

  chrome.runtime.sendMessage(
    { action: 'searchNotes', keyword },
    (response) => {
      if (response && response.notes && response.notes.length > 0) {
        const list = response.notes.slice(0, 5).map(n =>
          `<li class="zlwj-related-item" data-id="${n.id}">
            <span class="zlwj-related-title">${n.title}</span>
            <span class="zlwj-related-tags">${(n.tags || []).map(t => t.name).join(', ')}</span>
           </li>`
        ).join('');
        const relatedHtml = `
          <div class="zlwj-related-header">相关知识点 (${response.notes.length})</div>
          <ul class="zlwj-related-list">${list}</ul>
          <button class="zlwj-link" id="zlwj-open-graph-related">在图谱中查看全部 →</button>`;
        if (append) {
          resultEl.innerHTML += relatedHtml;
        } else {
          resultEl.innerHTML = relatedHtml;
        }
        resultEl.style.display = 'block';
        // 点击相关笔记跳转图谱
        resultEl.querySelectorAll('.zlwj-related-item').forEach(el => {
          el.onclick = () => openGraph(el.dataset.id);
        });
        const openBtn = document.getElementById('zlwj-open-graph-related');
        if (openBtn) openBtn.onclick = () => openGraph();
      } else if (!append) {
        resultEl.innerHTML = '<span class="zlwj-empty">暂无相关知识点</span>';
      }
    }
  );
}

const openGraph = (noteId) => {
  const path = noteId ? `/graph?highlight=${noteId}` : '/graph'
  chrome.runtime.sendMessage({ action: 'openAppPath', path }, (res) => {
    if (!res?.ok) {
      const resultEl = document.getElementById('zlwj-result')
      if (resultEl) {
        resultEl.style.display = 'block'
        resultEl.innerHTML = `<span class="zlwj-error">${res?.message || '打开图谱失败，请先启动前端'}</span>`
      }
    } else {
      cancelCapture()
    }
  })
}

function cancelCapture() {
  isCapturing = false;
  document.body.style.cursor = '';
  startX = startY = endX = endY = undefined;
  startClientX = startClientY = endClientX = endClientY = undefined;
  if (overlay) { overlay.remove(); overlay = null; }
  if (selection) { selection.remove(); selection = null; }
  if (menu) { menu.remove(); menu = null; }
}
