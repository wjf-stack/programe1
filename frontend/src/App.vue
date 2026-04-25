<template>
  <div class="app-container">
    <CosmicBackground />
    <div class="app-chrome">
      <nav v-if="isLoggedIn" class="navbar">
        <div class="nav-content">
          <div class="logo">
            <h1>智联微记</h1>
            <p>Cosmic knowledge capture</p>
          </div>
          <ul class="nav-links">
            <li><router-link to="/dashboard">仪表板</router-link></li>
            <li><router-link to="/note/new">新建笔记</router-link></li>
            <li><router-link to="/graph">知识图谱</router-link></li>
            <li><router-link to="/profile">个人中心</router-link></li>
            <li><a href="#" @click.prevent="logout">退出登录</a></li>
          </ul>
        </div>
      </nav>
      <main class="main-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from './stores/user'
import CosmicBackground from './components/CosmicBackground.vue'

const router = useRouter()
const userStore = useUserStore()
const isLoggedIn = computed(() => userStore.isLoggedIn)

const logout = () => {
  userStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  position: relative;
}

.app-chrome {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.navbar {
  position: sticky;
  top: 0;
  z-index: 5;
  backdrop-filter: blur(16px);
  background: linear-gradient(135deg, rgba(8, 14, 36, 0.78), rgba(31, 23, 78, 0.7));
  color: white;
  border-bottom: 1px solid rgba(140, 170, 255, 0.18);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.25);
}

.nav-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
}

.logo h1 {
  font-size: 1.55rem;
  font-weight: 800;
  margin: 0;
  letter-spacing: 0.03em;
}

.logo p {
  margin: 0.2rem 0 0;
  font-size: 0.75rem;
  color: rgba(214, 225, 255, 0.72);
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

.nav-links {
  list-style: none;
  display: flex;
  gap: 1.25rem;
  margin: 0;
  padding: 0;
  flex-wrap: wrap;
}

.nav-links a {
  color: rgba(244, 247, 255, 0.92);
  text-decoration: none;
  transition: 0.25s ease;
  padding: 0.55rem 0.8rem;
  border-radius: 999px;
  border: 1px solid transparent;
}

.nav-links a:hover,
.nav-links a.router-link-active {
  color: white;
  background: rgba(108, 130, 255, 0.18);
  border-color: rgba(151, 180, 255, 0.18);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02), 0 0 24px rgba(84, 118, 255, 0.15);
}

.main-content {
  flex: 1;
  max-width: 1280px;
  margin: 0 auto;
  width: 100%;
  padding: 2rem;
}

@media (max-width: 920px) {
  .nav-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .main-content {
    padding: 1rem;
  }
}
</style>
