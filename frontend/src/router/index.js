import { createRouter, createWebHashHistory } from 'vue-router'
import Login from '../pages/Login.vue'
import Register from '../pages/Register.vue'
import Dashboard from '../pages/Dashboard.vue'
import NoteEditor from '../pages/NoteEditor.vue'
import KnowledgeGraph from '../pages/KnowledgeGraph.vue'
import Profile from '../pages/Profile.vue'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/login', component: Login, meta: { guest: true } },
  { path: '/register', component: Register, meta: { guest: true } },
  { path: '/dashboard', component: Dashboard, meta: { requiresAuth: true } },
  { path: '/note/new', component: NoteEditor, meta: { requiresAuth: true } },
  { path: '/note/:id', component: NoteEditor, meta: { requiresAuth: true } },
  { path: '/graph', component: KnowledgeGraph, meta: { requiresAuth: true } },
  { path: '/profile', component: Profile, meta: { requiresAuth: true } }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.meta.requiresAuth && !token) {
    next('/login')
  } else if (to.meta.guest && token) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
