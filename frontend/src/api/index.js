import axios from 'axios'
import {
  userAPI as mockUserAPI,
  noteAPI as mockNoteAPI,
  tagAPI as mockTagAPI,
  graphAPI as mockGraphAPI,
  fileAPI as mockFileAPI,
  resetMockDB
} from './mock'

const API_BASE = '/api'
const useMock = import.meta.env.VITE_USE_MOCK !== 'false'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000
})

// 请求拦截器
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器
api.interceptors.response.use(
  response => response.data,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// 用户接口
export const userAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (email, password, name) => api.post('/auth/register', { email, password, name }),
  getProfile: () => api.get('/user/profile'),
  updateProfile: (data) => api.put('/user/profile', data)
}

// 笔记接口
export const noteAPI = {
  list: (page = 1, limit = 20) => api.get(`/notes?page=${page}&limit=${limit}`),
  get: (id) => api.get(`/notes/${id}`),
  create: (data) => api.post('/notes', data),
  update: (id, data) => api.put(`/notes/${id}`, data),
  delete: (id) => api.delete(`/notes/${id}`),
  search: (keyword) => api.get(`/notes/search?keyword=${keyword}`)
}

// 标签接口
export const tagAPI = {
  list: () => api.get('/tags'),
  create: (name) => api.post('/tags', { name }),
  delete: (id) => api.delete(`/tags/${id}`)
}

// 知识图谱接口
export const graphAPI = {
  getNodes: () => api.get('/graph/nodes'),
  getRelations: () => api.get('/graph/relations'),
  getExpanded: (nodeId) => api.get(`/graph/expand/${nodeId}`)
}

// 文件上传接口
export const fileAPI = {
  upload: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}

if (useMock) {
  Object.assign(userAPI, mockUserAPI)
  Object.assign(noteAPI, mockNoteAPI)
  Object.assign(tagAPI, mockTagAPI)
  Object.assign(graphAPI, mockGraphAPI)
  Object.assign(fileAPI, mockFileAPI)
}

export const isMockMode = useMock
export const resetDemoData = async () => {
  if (!useMock) return null
  return await resetMockDB()
}
export default api
