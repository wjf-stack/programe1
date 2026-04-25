<template>
  <div class="dashboard">
    <section class="hero panel">
      <div>
        <p class="eyebrow">星图控制台</p>
        <h2>你的知识宇宙</h2>
        <p class="hero-copy">把零散摘录、网页片段与笔记连接成一张可探索的知识星图。</p>
      </div>
      <div class="search-bar">
        <input v-model="searchKeyword" type="text" placeholder="搜索笔记、标签、概念..." @keyup.enter="handleSearch">
        <button @click="handleSearch" class="btn-search">搜索</button>
      </div>
    </section>

    <div class="stats-grid">
      <div class="stat-card panel"><h3>总笔记数</h3><p class="stat-value">{{ notes.length }}</p></div>
      <div class="stat-card panel"><h3>标签数</h3><p class="stat-value">{{ tags.length }}</p></div>
      <div class="stat-card panel"><h3>知识节点</h3><p class="stat-value">{{ graphNodes.length }}</p></div>
    </div>

    <div class="templates-section panel">
      <div class="section-header">
        <h3>示例笔记模板</h3>
        <div class="tpl-actions">
          <button class="btn-new ghost" @click="createAllTemplates" :disabled="creatingTemplates">
            {{ creatingTemplates ? '生成中...' : '一键生成全部' }}
          </button>
          <button class="btn-new ghost danger" @click="restoreDemoData" :disabled="creatingTemplates">
            恢复演示数据
          </button>
        </div>
      </div>
      <p class="templates-tip">用于展示不同记录形式：快速笔记 / 富文本 / 网页摘录 / 图片粘贴示例。点击任意卡片可直接生成并打开。</p>
      <div class="templates-grid">
        <button
          v-for="tpl in templates"
          :key="tpl.key"
          class="tpl-card"
          @click="createFromTemplate(tpl)"
        >
          <div class="tpl-top">
            <div class="tpl-badge">{{ tpl.badge }}</div>
            <div class="tpl-title">{{ tpl.title }}</div>
          </div>
          <div class="tpl-desc">{{ tpl.desc }}</div>
        </button>
      </div>
    </div>

    <div class="notes-section panel">
      <div class="section-header">
        <h3>最近笔记与操作</h3>
        <router-link to="/note/new" class="btn-new">+ 新建笔记</router-link>
      </div>
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="displayNotes.length === 0" class="empty-state">
        <p>还没有笔记，<router-link to="/note/new">创建第一条</router-link></p>
      </div>
      <div v-else class="notes-grid">
        <div v-for="note in displayNotes" :key="note.id" class="note-card" @click="goToNote(note.id)">
          <h4>{{ note.title }}</h4>
          <p>{{ (note.content || '').substring(0, 100) }}</p>
          <div class="note-meta">
            <span class="date">{{ formatDate(note.createdAt) }}</span>
            <span class="tags"><span v-for="tag in (note.tags || []).slice(0,3)" :key="tag.id" class="tag">{{ tag.name }}</span></span>
          </div>
          <div class="note-actions">
            <button class="btn-del-note" @click.stop="deleteNote(note)">删除笔记</button>
          </div>
        </div>
      </div>
    </div>

    <div class="tags-section panel">
      <h3>全部主题</h3>
      <div class="tags-list">
        <span v-for="tag in tags" :key="tag.id" class="tag-item" :class="{ active: selectedTag === tag.id }">
          <span class="tag-name" @click="filterByTag(tag)">{{ tag.name }}</span>
          <button class="tag-del" @click.stop="deleteTheme(tag)" title="删除主题">🗑</button>
        </span>
        <span v-if="tags.length === 0" class="empty-tags">暂无标签</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useNoteStore } from '../stores/note'
import { useGraphStore } from '../stores/graph'
import { resetDemoData } from '../api'

const router = useRouter()
const noteStore = useNoteStore()
const graphStore = useGraphStore()
const searchKeyword = ref('')
const selectedTag = ref(null)
const creatingTemplates = ref(false)

const notes = computed(() => noteStore.notes)
const tags = computed(() => noteStore.tags)
const graphNodes = computed(() => graphStore.nodes)
const loading = computed(() => noteStore.loading)

const displayNotes = computed(() => {
  if (selectedTag.value) return notes.value.filter(n => (n.tags || []).some(t => t.id === selectedTag.value))
  return notes.value.slice(0, 9)
})

onMounted(async () => {
  await noteStore.fetchNotes()
  await noteStore.fetchTags()
  await graphStore.fetchGraphData()
  if (notes.value.length === 0) {
    await createAllTemplates()
  }
})

const templates = computed(() => ([
  {
    key: 'quick',
    badge: '快速笔记',
    title: '一分钟抓住重点',
    desc: '适合随手记录：一句结论 + 3 个要点 + TODO。',
    payload: {
      title: '快速笔记｜今日要点',
      type: 'quick',
      branch: '概念',
      content: `一句话结论：\n\n- 要点1：\n- 要点2：\n- 要点3：\n\nTODO：\n- [ ] 把要点2扩展成案例`
    }
  },
  {
    key: 'rich',
    badge: '富文本',
    title: '结构化学习卡片',
    desc: '适合讲清楚：背景 → 方法 → 示例 → 误区。',
    payload: {
      title: '学习卡片｜如何做知识整理',
      type: 'rich',
      branch: '方法',
      content: `## 背景\n把碎片信息变成可检索、可复用的知识。\n\n## 方法\n1. 先写结论（30秒）\n2. 再写证据/例子（2分钟）\n3. 最后补一个反例/误区（1分钟）\n\n## 示例\n- 结论：用标签 + 分支让知识更可导航\n- 例子：同主题下按“概念/方法/案例”分支\n\n## 误区\n- 记录太长、没有结构\n- 只收藏不加工`
    }
  },
  {
    key: 'clip',
    badge: '网页摘录',
    title: '带来源的摘录记录',
    desc: '适合从网页/资料中摘录关键段落并标注来源。',
    payload: {
      title: '网页摘录｜一段有用的引用',
      type: 'clip',
      branch: '资料',
      source: 'https://example.com',
      content: `> “记录不是目的，复用才是。”\n\n来源：https://example.com\n\n我的理解：\n- 记录要能被检索\n- 记录要能被连接（标签/关联）`
    }
  },
  {
    key: 'image',
    badge: '图片示例',
    title: '图片 + 说明',
    desc: '展示图片插入的记录形式（演示版使用 base64）。',
    payload: {
      title: '图片记录｜截图说明示例',
      type: 'clip',
      branch: '案例',
      content: `这里是图片示例（可在编辑页点击“插入图片”或 Ctrl+V 粘贴）。\n\n![示例图片](data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%23667eea'/><stop offset='1' stop-color='%23764ba2'/></linearGradient></defs><rect width='640' height='360' fill='url(%23g)'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='34' fill='white'>Demo Image</text></svg>)\n\n说明：\n- 这张图用于展示“图片 + 文字说明”的记录样式。\n- 你可以替换成自己粘贴的截图。`
    }
  }
]))

const ensureTag = async (name) => {
  if (!name) return null
  try {
    const list = await noteStore.fetchTags()
    const existing = (list || []).find(t => t.name === name) || noteStore.tags.find(t => t.name === name)
    if (existing) return existing
  } catch {}
  try {
    const created = await noteStore.createTag(name)
    return created
  } catch {
    return null
  }
}

const createFromTemplate = async (tpl, options = {}) => {
  const { navigate = true } = options
  creatingTemplates.value = true
  try {
    const tag = await ensureTag('示例')
    const note = await noteStore.createNote({
      ...tpl.payload,
      tagIds: tag ? [tag.id] : []
    })
    await noteStore.fetchNotes()
    await graphStore.fetchGraphData()
    if (navigate) router.push('/note/' + note.id)
    return note
  } finally {
    creatingTemplates.value = false
  }
}

const createAllTemplates = async () => {
  creatingTemplates.value = true
  try {
    const tag = await ensureTag('示例')
    for (const tpl of templates.value) {
      // eslint-disable-next-line no-await-in-loop
      await noteStore.createNote({
        ...tpl.payload,
        tagIds: tag ? [tag.id] : []
      })
    }
    await noteStore.fetchNotes()
    await graphStore.fetchGraphData()
  } finally {
    creatingTemplates.value = false
  }
}

const restoreDemoData = async () => {
  if (!confirm('确定恢复演示数据吗？这会覆盖当前浏览器中的演示数据。')) return
  creatingTemplates.value = true
  try {
    await resetDemoData()
    await noteStore.fetchNotes()
    await noteStore.fetchTags()
    await graphStore.fetchGraphData()
  } finally {
    creatingTemplates.value = false
  }
}

const handleSearch = async () => {
  if (!searchKeyword.value.trim()) {
    await noteStore.fetchNotes()
    return
  }
  const result = await noteStore.searchNotes(searchKeyword.value)
  noteStore.notes = Array.isArray(result) ? result : []
}

const filterByTag = (tag) => {
  selectedTag.value = selectedTag.value === tag.id ? null : tag.id
}

const deleteTheme = async (tag) => {
  if (!confirm(`确定删除主题「${tag.name}」吗？`)) return
  await noteStore.deleteTag(tag.id)
  if (selectedTag.value === tag.id) selectedTag.value = null
}

const deleteNote = async (note) => {
  if (!confirm(`确定删除笔记「${note.title}」吗？`)) return
  await noteStore.deleteNote(note.id)
}

const goToNote = (id) => router.push('/note/' + id)
const formatDate = (date) => date ? new Date(date).toLocaleDateString('zh-CN') : ''
</script>

<style scoped>
.dashboard { animation: fadeIn .35s ease; }
.panel { background: rgba(10,18,38,.8); border: 1px solid rgba(141,169,255,.14); box-shadow: 0 16px 44px rgba(0,0,0,.34); backdrop-filter: blur(18px); }
.hero { margin-bottom:1.4rem; border-radius:20px; padding:1.3rem 1.4rem; display:flex; justify-content:space-between; align-items:end; gap:1rem; }
.eyebrow { color:#b4c6f7; font-size:.8rem; letter-spacing:.12em; text-transform:uppercase; margin-bottom:.3rem; }
.hero h2 { margin:0; font-size:2rem; color:#f1f6ff; }
.hero-copy { margin-top:.45rem; color:#b9c7eb; max-width:540px; }
.search-bar { display:flex; gap:.5rem; flex:1; max-width:430px; }
.search-bar input { flex:1; padding:.65rem 1rem; border:1px solid rgba(141,169,255,.25); border-radius:10px; color:#f3f7ff; background:rgba(7,13,29,.8); }
.btn-search { padding:.6rem 1.2rem; background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; border:none; border-radius:10px; cursor:pointer; }
.stats-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:1rem; margin-bottom:1.2rem; }
.stat-card { padding:1.2rem; border-radius:16px; text-align:center; }
.stat-card h3 { color:#afbedf; font-size:.85rem; margin-bottom:.35rem; }
.stat-value { font-size:2.3rem; font-weight:800; color:#eaf1ff; margin:0; }
.templates-section,.notes-section,.tags-section { padding:1.3rem; border-radius:18px; margin-bottom:1.2rem; }
.section-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; }
.section-header h3,.tags-section h3 { margin:0 0 1rem 0; color:#ecf2ff; font-size:1.05rem; }
.btn-new { padding:.5rem 1.2rem; background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; border-radius:10px; text-decoration:none; font-size:.9rem; }
.btn-new.ghost { background: rgba(112,131,199,0.14); border: 1px solid rgba(149,170,255,0.16); cursor: pointer; }
.btn-new.ghost:disabled { opacity: .6; cursor: not-allowed; }
.btn-new.ghost.danger { border-color: rgba(255,118,148,.34); background: rgba(255,90,115,.16); color: #ffd9e2; }
.tpl-actions { display:flex; gap:.6rem; flex-wrap:wrap; justify-content:flex-end; }
.templates-tip { margin: -0.3rem 0 1rem; color:#adb9d6; font-size:.9rem; }
.templates-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:.9rem; }
.tpl-card { text-align:left; background:rgba(7,13,30,.72); border:1px solid rgba(141,169,255,.14); border-radius:14px; padding:1rem; cursor:pointer; transition: transform .15s ease, border-color .15s ease, background .15s ease; }
.tpl-card:hover { transform: translateY(-2px); border-color: rgba(141,169,255,.28); background:rgba(7,13,30,.82); }
.tpl-top { display:flex; align-items:center; gap:.6rem; margin-bottom:.6rem; }
.tpl-badge { font-size:.74rem; padding:.18rem .55rem; border-radius:999px; background:rgba(102,126,234,.22); color:#dce8ff; border:1px solid rgba(141,169,255,.16); }
.tpl-title { font-weight:800; color:#eff4ff; }
.tpl-desc { color:#b9c6e7; font-size:.86rem; line-height:1.45; }
.loading,.empty-state { text-align:center; padding:2rem; color:#adb9d6; }
.notes-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:.9rem; }
.note-card { background:rgba(7,13,30,.78); padding:1rem; border-radius:14px; cursor:pointer; border:1px solid rgba(141,169,255,.12); }
.note-card h4 { margin:0 0 .45rem 0; color:#eff4ff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.note-card p { margin:0 0 .9rem 0; color:#b9c6e7; font-size:.86rem; line-height:1.5; }
.note-meta { display:flex; justify-content:space-between; align-items:center; }
.note-actions { margin-top:.65rem; display:flex; justify-content:flex-end; }
.btn-del-note { padding:.28rem .62rem; border-radius:8px; border:1px solid rgba(255,128,154,.4); background:rgba(255,74,109,.16); color:#ffd7e1; cursor:pointer; font-size:.76rem; }
.btn-del-note:hover { background:rgba(255,74,109,.28); }
.date { color:#95a7cd; font-size:.78rem; }
.tags { display:flex; gap:.25rem; flex-wrap:wrap; }
.tag { background:#667eea; color:#fff; padding:.15rem .45rem; border-radius:6px; font-size:.72rem; }
.tags-list { display:flex; flex-wrap:wrap; gap:.6rem; }
.tag-item { display:flex; align-items:center; gap:.4rem; background:rgba(102,126,234,.16); color:#dce8ff; padding:.36rem .62rem; border-radius:999px; border:1px solid rgba(141,169,255,.14); }
.tag-item.active { background:#667eea; }
.tag-name { cursor:pointer; }
.tag-del { background:none; border:none; color:#ffd0d0; cursor:pointer; font-size:.75rem; }
.tag-del:hover { color:#ff8b8b; }
.empty-tags { color:#9db0d8; font-size:.9rem; }
@keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
</style>
