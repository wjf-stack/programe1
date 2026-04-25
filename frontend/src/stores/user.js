import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { userAPI } from '../api'

export const useUserStore = defineStore('user', () => {
  const user = ref(null)
  const token = ref(localStorage.getItem('token'))
  const isLoggedIn = computed(() => !!token.value)

  const login = async (email, password) => {
    const response = await userAPI.login(email, password)
    token.value = response.token
    user.value = response.user
    localStorage.setItem('token', response.token)
    return response
  }

  const register = async (email, password, name) => {
    const response = await userAPI.register(email, password, name)
    token.value = response.token
    user.value = response.user
    localStorage.setItem('token', response.token)
    return response
  }

  const logout = () => {
    user.value = null
    token.value = null
    localStorage.removeItem('token')
  }

  const fetchProfile = async () => {
    const response = await userAPI.getProfile()
    user.value = response
    return response
  }

  const updateProfile = async (data) => {
    const response = await userAPI.updateProfile(data)
    user.value = response
    return response
  }

  return {
    user,
    token,
    isLoggedIn,
    login,
    register,
    logout,
    fetchProfile,
    updateProfile
  }
})
