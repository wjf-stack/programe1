# -*- coding: utf-8 -*-
content = '''<template>
  <div class="profile-page">
    <div class="profile-header">
      <div class="avatar-wrap">
        <div class="avatar">{{ userInitial }}</div>
        <h2>{{ user?.name || '用户' }}</h2>
        <p>{{ user?.email }}</p>
      </div>
    </div>
    <div class="profile-body">
      <div class="profile-card">
        <h3>个人信息</h3>
        <form @submit.prevent="saveProfile">
          <div class="form-group">
            <label>姓名</label>
            <input v-model="form.name" class="inp" placeholder="请输入姓名">
          </div>
          <div class="form-group">
            <label>邮箱</label>
            <input v-model="form.email" type="email" class="inp" placeholder="请输入邮箱">
          </div>
          <div class="form-group">
            <label>新密码（留空不修改）</label>
            <input v-model="form.password" type="password" class="inp" placeholder="输入新密码">
          </div>
          <button type="submit" class="btn-save" :disabled="saving">{{ saving ? '保存中...' : '保存修改' }}</button>
        </form>
        <div v-if="saveMsg" class="save-msg" :class="saveMsg.type">{{ saveMsg.text }}</div>
      </div>
      <div class="profile-card">
        <h3>数据统计</h3>
        <div class="stats-row">
          <div class="stat-item"><p class="num">{{ stats.notes }}</p><p class="label">笔记数</p></div>
          <div class="stat-item"><p class="num">{{ stats.tags }}</p><p class="label">标签数</p></div>
          <div class="stat-item"><p class="num">{{ stats.relations }}</p><p class="label">知识关联</p></div>
        </div>
      </div>
      <div class="profile-card">
        <h3>账户操作</h3>
        <button @click="handleLogout" class="btn-logout">退出登录</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from \'vue\'
import { useRouter } from \'vue-router\'
import { useUserStore } from \'../stores/user\'
import { useNoteStore } from \'../stores/note\'
import { useGraphStore } from \'../stores/graph\'

const router = useRouter()
const userStore = useUserStore()
const noteStore = useNoteStore()
const graphStore = useGraphStore()
const saving = ref(false)
const saveMsg = ref(null)

const user = computed(() => userStore.user)
const userInitial = computed(() => (user.value?.name || \'U\')[0].toUpperCase())

const form = ref({ name: \'\', email: \'\', password: \'\' })

const stats = computed(() => ({
  notes: noteStore.notes.length,
  tags: noteStore.tags.length,
  relations: graphStore.relations.length
}))

onMounted(async () => {
  await noteStore.fetchNotes()
  await noteStore.fetchTags()
  await graphStore.fetchGraphData()
  if (user.value) {
    form.value.name = user.value.name || \'\'
    form.value.email = user.value.email || \'\'
  }
})

const saveProfile = async () => {
  saving.value = true
  try {
    const data = { name: form.value.name, email: form.value.email }
    if (form.value.password) data.password = form.value.password
    await userStore.updateProfile(data)
    saveMsg.value = { type: \'success\', text: \'保存成功\' }
    form.value.password = \'\'
  } catch (e) {
    saveMsg.value = { type: \'error\', text: e.response?.data?.message || \'保存失败\' }
  } finally {
    saving.value = false
    setTimeout(() => { saveMsg.value = null }, 3000)
  }
}

const handleLogout = () => {
  userStore.logout()
  router.push(\'/login\')
}
</script>

<style scoped>
.profile-page { animation: fadeIn 0.3s ease; max-width: 800px; margin: 0 auto; }
.profile-header { text-align: center; margin-bottom: 2rem; }
.avatar-wrap { display: inline-flex; flex-direction: column; align-items: center; gap: 0.5rem; }
.avatar { width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg,#667eea,#764ba2); color: white; font-size: 2rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.profile-header h2 { margin: 0; color: #333; font-size: 1.5rem; }
.profile-header p { margin: 0; color: #888; font-size: 0.9rem; }
.profile-body { display: flex; flex-direction: column; gap: 1.5rem; }
.profile-card { background: white; padding: 1.5rem; border-radius: 10px; box-shadow: 0 2px 12px rgba(102,126,234,0.08); }
.profile-card h3 { margin: 0 0 1.2rem 0; color: #333; font-size: 1rem; border-bottom: 1px solid #f0f0f0; padding-bottom: 0.75rem; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: 0.4rem; color: #555; font-size: 0.9rem; }
.inp { width: 100%; padding: 0.6rem 1rem; border: 1px solid #ddd; border-radius: 6px; outline: none; font-size: 0.95rem; transition: border 0.2s; }
.inp:focus { border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
.btn-save { padding: 0.6rem 1.5rem; background: linear-gradient(135deg,#667eea,#764ba2); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95rem; }
.btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
.save-msg { margin-top: 0.75rem; padding: 0.6rem 1rem; border-radius: 6px; font-size: 0.9rem; }
.save-msg.success { background: #e8f5e9; color: #2e7d32; }
.save-msg.error { background: #ffebee; color: #c62828; }
.stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.stat-item { text-align: center; padding: 1rem; background: #f8f8ff; border-radius: 8px; }
.stat-item .num { font-size: 2rem; font-weight: 700; color: #667eea; margin: 0 0 0.3rem 0; }
.stat-item .label { color: #888; font-size: 0.85rem; margin: 0; }
.btn-logout { padding: 0.6rem 1.5rem; background: #fff0f0; color: #e53935; border: 1px solid #ffcdd2; border-radius: 6px; cursor: pointer; font-size: 0.95rem; transition: all 0.2s; }
.btn-logout:hover { background: #e53935; color: white; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
'''

with open(r'd:\cursor\cursor_programe1\zhilianweiji\frontend\src\pages\Profile.vue', 'w', encoding='utf-8') as f:
    f.write(content)
print('Profile.vue written')
