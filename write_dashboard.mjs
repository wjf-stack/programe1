import fs from 'fs'

const content = `<template>
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
      <div class="stat-card panel">
        <h3>总笔记数</h3>
        <p class="stat-value">{{ notes.length }}</p>
      </div>
      <div class="stat-card panel">
        <h3>标签数</h3>
        <p class="stat-value">{{ tags.length }}</p>
      </div>
      <div class="stat-card panel">
        <h3>知识节点</h3>
        <p class="stat-value">{{ graphNodes.length }}</p>
      </div>
    </div>

    <div class="notes-section panel">
      <div class="section-header">
        <h3>最近笔记</h3>
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
            <span class="tags">
              <span v-for="tag in (note.tags || []).slice(0,3)" :key="tag.id" class="tag">{{ tag.name }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="tags-section panel">
      <h3>全部标签</h3>
      <div class="tags-list">
        <span v-for="tag in tags" :key="tag.id" class="tag-item" :class="{ active: selectedTag === tag.id }" @click="filterByTag(tag)">{{ tag.name }}</span>
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

const router = useRouter()
const noteStore = useNoteStore()
const graphStore = useGraphStore()
const searchKeyword = ref('')
const selectedTag = ref(null)

const notes = computed(() => noteStore.notes)
const tags = computed(() => noteStore.tags)
const graphNodes = computed(() => graphStore.nodes)
const loading = computed(() => noteStore.loading)

const displayNotes = computed(() => {
  if (selectedTag.value) {
    return notes.value.filter(n => (n.tags || []).some(t => t.id === selectedTag.value))
  }
  return notes.value.slice(0, 9)
})

onMounted(async () => {
  await noteStore.fetchNotes()
  await noteStore.fetchTags()
  await graphStore.fetchGraphData()
})

const handleSearch = async () => {
  if (!searchKeyword.value.trim()) return
  await noteStore.searchNotes(searchKeyword.value)
}

const filterByTag = (tag) => {
  selectedTag.value = selectedTag.value === tag.id ? null : tag.id
}

const goToNote = (id) => {
  router.push('/note/' + id)
}

const formatDate = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.dashboard { animation: fadeIn 0.35s ease; }
.panel {
  background: rgba(10, 18, 38, 0.8);
  border: 1px solid rgba(141, 169, 255, 0.14);
  box-shadow: 0 16px 44px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.03);
  backdrop-filter: blur(18px);
}
.hero {
  margin-bottom: 1.4rem;
  border-radius: 20px;
  padding: 1.3rem 1.4rem;
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 1rem;
}
.eyebrow { color: #b4c6f7; font-size: 0.8rem; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 0.3rem; }
.hero h2 { margin: 0; font-size: 2rem; color: #f1f6ff; }
.hero-copy { margin-top: 0.45rem; color: #b9c7eb; max-width: 540px; }
.search-bar { display: flex; gap: 0.5rem; flex: 1; max-width: 430px; }
.search-bar input { flex: 1; padding: 0.65rem 1rem; border: 1px solid rgba(141, 169, 255, 0.25); border-radius: 10px; outline: none; color: #f3f7ff; background: rgba(7, 13, 29, 0.8); }
.search-bar input::placeholder { color: #9db0dc; }
.btn-search { padding: 0.6rem 1.2rem; background: linear-gradient(135deg,#667eea,#764ba2); color: white; border: none; border-radius: 10px; cursor: pointer; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap: 1rem; margin-bottom: 1.2rem; }
.stat-card { padding: 1.2rem; border-radius: 16px; text-align: center; }
.stat-card h3 { color: #afbedf; font-size: 0.85rem; margin-bottom: 0.35rem; }
.stat-value { font-size: 2.3rem; font-weight: 800; color: #eaf1ff; margin: 0; }
.notes-section, .tags-section { padding: 1.3rem; border-radius: 18px; margin-bottom: 1.2rem; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.section-header h3, .tags-section h3 { margin: 0 0 1rem 0; color: #ecf2ff; font-size: 1.05rem; }
.btn-new { padding: 0.5rem 1.2rem; background: linear-gradient(135deg,#667eea,#764ba2); color: white; border-radius: 10px; text-decoration: none; font-size: 0.9rem; }
.loading, .empty-state { text-align: center; padding: 2rem; color: #adb9d6; }
.empty-state a { color: #8fb1ff; text-decoration: none; }
.notes-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(260px,1fr)); gap: 0.9rem; }
.note-card { background: rgba(7, 13, 30, 0.78); padding: 1rem; border-radius: 14px; cursor: pointer; transition: all 0.25s; border: 1px solid rgba(141, 169, 255, 0.12); }
.note-card:hover { box-shadow: 0 8px 24px rgba(102,126,234,0.2); transform: translateY(-2px); }
.note-card h4 { margin: 0 0 0.45rem 0; color: #eff4ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.note-card p { margin: 0 0 0.9rem 0; color: #b9c6e7; font-size: 0.86rem; line-height: 1.5; }
.note-meta { display: flex; justify-content: space-between; align-items: center; }
.date { color: #95a7cd; font-size: 0.78rem; }
.tags { display: flex; gap: 0.25rem; flex-wrap: wrap; }
.tag { background: #667eea; color: white; padding: 0.15rem 0.45rem; border-radius: 6px; font-size: 0.72rem; }
.tags-list { display: flex; flex-wrap: wrap; gap: 0.6rem; }
.tag-item { background: rgba(102,126,234,0.16); color: #dce8ff; padding: 0.4rem 1rem; border-radius: 999px; font-size: 0.88rem; cursor: pointer; border: 1px solid rgba(141, 169, 255, 0.14); transition: all 0.2s; }
.tag-item:hover, .tag-item.active { background: #667eea; color: white; }
.empty-tags { color: #9db0d8; font-size: 0.9rem; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 900px) {
  .hero { flex-direction: column; align-items: stretch; }
}
</style>
`

fs.writeFileSync('d:/cursor/cursor_programe1/zhilianweiji/frontend/src/pages/Dashboard.vue', content, 'utf8')
console.log('Dashboard.vue updated')
