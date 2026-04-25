<template>
  <div class="login-container">
    <div class="login-card">
      <h1>智联微记</h1>
      <p class="subtitle">创建你的账户</p>
      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <label>姓名</label>
          <input v-model="form.name" type="text" class="input-field" placeholder="请输入姓名" required>
        </div>
        <div class="form-group">
          <label>邮箱</label>
          <input v-model="form.email" type="email" class="input-field" placeholder="请输入邮箱" required>
        </div>
        <div class="form-group">
          <label>密码</label>
          <input v-model="form.password" type="password" class="input-field" placeholder="请输入密码（至少6位）" required minlength="6">
        </div>
        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? '注册中...' : '注册' }}
        </button>
      </form>
      <p class="register-link">已有账户？<router-link to="/login">立即登录</router-link></p>
      <div v-if="error" class="error-message">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'

const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)
const error = ref('')
const form = ref({ name: '', email: '', password: '' })

const handleRegister = async () => {
  loading.value = true
  error.value = ''
  try {
    await userStore.register(form.value.email, form.value.password, form.value.name)
    router.push('/dashboard')
  } catch (err) {
    error.value = err.response?.data?.message || '注册失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.login-card { background: white; padding: 3rem; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); width: 100%; max-width: 400px; }
.login-card h1 { text-align: center; color: #667eea; margin-bottom: 0.5rem; font-size: 2rem; }
.subtitle { text-align: center; color: #666; margin-bottom: 2rem; font-size: 0.9rem; }
.form-group { margin-bottom: 1.5rem; }
.form-group label { display: block; margin-bottom: 0.5rem; color: #333; font-weight: 500; }
.input-field { width: 100%; padding: 0.65rem 1rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.95rem; outline: none; transition: border 0.2s; box-sizing: border-box; }
.input-field:focus { border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
.btn-primary { width: 100%; padding: 0.75rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; transition: transform 0.2s; }
.btn-primary:hover:not(:disabled) { transform: translateY(-2px); }
.btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
.register-link { text-align: center; margin-top: 1.5rem; color: #666; }
.register-link a { color: #667eea; text-decoration: none; font-weight: 500; }
.error-message { margin-top: 1rem; padding: 0.75rem; background: #fee; color: #c33; border-radius: 6px; font-size: 0.9rem; }
</style>
