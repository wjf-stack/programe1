const STORAGE_KEY = 'zhilianweiji_mock_db_v1'
const TOKEN_PREFIX = 'mock-token:'

const DEMO_USER = {
  id: 'demo-user-001',
  name: '演示用户',
  email: 'demo@example.com',
  password: '123456',
  createdAt: '2026-04-01T00:00:00.000Z'
}

const clone = (value) => JSON.parse(JSON.stringify(value))

const nowISO = () => new Date().toISOString()

const newId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'id_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const error = (message, status = 400) => {
  const err = new Error(message)
  err.response = { status, data: { message } }
  return err
}

const parseToken = (token) => {
  if (!token || !token.startsWith(TOKEN_PREFIX)) return null
  return token.slice(TOKEN_PREFIX.length)
}

const currentUserId = () => parseToken(localStorage.getItem('token'))

const toSafeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt
})

const withTags = (note, data) => {
  const tagIds = data.noteTags.filter((nt) => nt.noteId === note.id).map((nt) => nt.tagId)
  const tags = data.tags.filter((t) => tagIds.includes(t.id))
  return { ...note, tags }
}

const persistDB = (db) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

const buildSeed = async () => {
  let remoteSeed = null
  try {
    const seedUrl = `${import.meta.env.BASE_URL}db.seed.json`
    const response = await fetch(seedUrl)
    if (response.ok) remoteSeed = await response.json()
  } catch {
    remoteSeed = null
  }

  const notes = Array.isArray(remoteSeed?.notes) ? clone(remoteSeed.notes) : []
  const tags = Array.isArray(remoteSeed?.tags) ? clone(remoteSeed.tags) : []
  const noteTags = Array.isArray(remoteSeed?.noteTags) ? clone(remoteSeed.noteTags) : []
  const relations = Array.isArray(remoteSeed?.relations) ? clone(remoteSeed.relations) : []

  const migratedNotes = notes.map((n) => ({ ...n, userId: DEMO_USER.id }))
  const migratedTags = tags.map((t) => ({ ...t, userId: DEMO_USER.id }))

  return {
    users: [clone(DEMO_USER)],
    notes: migratedNotes,
    tags: migratedTags,
    noteTags,
    relations
  }
}

let dbCache = null

export const resetMockDB = async () => {
  dbCache = await buildSeed()
  persistDB(dbCache)
  return dbCache
}

const ensureDB = async () => {
  if (dbCache) return dbCache
  const local = localStorage.getItem(STORAGE_KEY)
  if (local) {
    try {
      dbCache = JSON.parse(local)
      const hasData = Array.isArray(dbCache?.notes) && dbCache.notes.length > 0
      const hasUsers = Array.isArray(dbCache?.users) && dbCache.users.length > 0
      if (!hasUsers || !hasData) {
        dbCache = await buildSeed()
        persistDB(dbCache)
      }
      return dbCache
    } catch {
      dbCache = await buildSeed()
      persistDB(dbCache)
      return dbCache
    }
  }
  dbCache = await buildSeed()
  persistDB(dbCache)
  return dbCache
}

const requireUserId = () => {
  const userId = currentUserId()
  if (!userId) throw error('未授权', 401)
  return userId
}

const delay = async () => new Promise((resolve) => setTimeout(resolve, 80))

export const userAPI = {
  login: async (email, password) => {
    await delay()
    const db = await ensureDB()
    const user = db.users.find((u) => u.email === email)
    if (!user || user.password !== password) throw error('邮箱或密码错误', 401)
    return { token: TOKEN_PREFIX + user.id, user: toSafeUser(user) }
  },
  register: async (email, password, name) => {
    await delay()
    const db = await ensureDB()
    if (!name || !email || !password) throw error('请填写完整信息', 400)
    if (db.users.find((u) => u.email === email)) throw error('邮箱已被注册', 400)
    const user = { id: newId(), name, email, password, createdAt: nowISO() }
    db.users.push(user)
    persistDB(db)
    return { token: TOKEN_PREFIX + user.id, user: toSafeUser(user) }
  },
  getProfile: async () => {
    await delay()
    const db = await ensureDB()
    const userId = requireUserId()
    const user = db.users.find((u) => u.id === userId)
    if (!user) throw error('用户不存在', 404)
    return toSafeUser(user)
  },
  updateProfile: async (payload) => {
    await delay()
    const db = await ensureDB()
    const userId = requireUserId()
    const idx = db.users.findIndex((u) => u.id === userId)
    if (idx === -1) throw error('用户不存在', 404)
    const { name, email, password } = payload || {}
    if (name) db.users[idx].name = name
    if (email) db.users[idx].email = email
    if (password) db.users[idx].password = password
    persistDB(db)
    return toSafeUser(db.users[idx])
  }
}

export const noteAPI = {
  list: async (page = 1, limit = 20) => {
    await delay()
    const db = await ensureDB()
    const userId = requireUserId()
    const p = Number(page) || 1
    const l = Number(limit) || 20
    const all = db.notes
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    const data = all.slice((p - 1) * l, p * l).map((n) => withTags(n, db))
    return { total: all.length, data, page: p }
  },
  get: async (id) => {
    await delay()
    const db = await ensureDB()
    const userId = requireUserId()
    const note = db.notes.find((n) => n.id === id && n.userId === userId)
    if (!note) throw error('笔记不存在', 404)
    return withTags(note, db)
  },
  create: async (payload) => {
    await delay()
    const db = await ensureDB()
    const userId = requireUserId()
    const { title, content, type, source, branch, tagIds } = payload || {}
    const note = {
      id: newId(),
      title: title || '无标题',
      content: content || '',
      type: type || 'quick',
      source: source || null,
      branch: branch || '',
      userId,
      createdAt: nowISO(),
      updatedAt: nowISO()
    }
    db.notes.push(note)
    if (Array.isArray(tagIds) && tagIds.length) {
      tagIds.forEach((tagId) => db.noteTags.push({ noteId: note.id, tagId }))
    }
    persistDB(db)
    return withTags(note, db)
  },
  update: async (id, payload) => {
    await delay()
    const db = await ensureDB()
    const userId = requireUserId()
    const idx = db.notes.findIndex((n) => n.id === id && n.userId === userId)
    if (idx === -1) throw error('笔记不存在', 404)
    const { title, content, type, source, branch, tagIds } = payload || {}
    if (title !== undefined) db.notes[idx].title = title
    if (content !== undefined) db.notes[idx].content = content
    if (type !== undefined) db.notes[idx].type = type
    if (source !== undefined) db.notes[idx].source = source
    if (branch !== undefined) db.notes[idx].branch = branch
    db.notes[idx].updatedAt = nowISO()
    if (Array.isArray(tagIds)) {
      db.noteTags = db.noteTags.filter((nt) => nt.noteId !== id)
      tagIds.forEach((tagId) => db.noteTags.push({ noteId: id, tagId }))
    }
    persistDB(db)
    return withTags(db.notes[idx], db)
  },
  delete: async (id) => {
    await delay()
    const db = await ensureDB()
    const userId = requireUserId()
    const idx = db.notes.findIndex((n) => n.id === id && n.userId === userId)
    if (idx === -1) throw error('笔记不存在', 404)
    db.notes.splice(idx, 1)
    db.noteTags = db.noteTags.filter((nt) => nt.noteId !== id)
    persistDB(db)
    return { message: '删除成功' }
  },
  search: async (keyword) => {
    await delay()
    const db = await ensureDB()
    const userId = requireUserId()
    const kw = (keyword || '').toLowerCase()
    return db.notes
      .filter((n) => n.userId === userId)
      .filter((n) => (n.title || '').toLowerCase().includes(kw) || (n.content || '').toLowerCase().includes(kw))
      .slice(0, 20)
      .map((n) => withTags(n, db))
  }
}

export const tagAPI = {
  list: async () => {
    await delay()
    const db = await ensureDB()
    const userId = requireUserId()
    return db.tags.filter((t) => t.userId === userId).sort((a, b) => a.name.localeCompare(b.name))
  },
  create: async (name) => {
    await delay()
    const db = await ensureDB()
    const userId = requireUserId()
    if (!name) throw error('标签名不能为空', 400)
    let tag = db.tags.find((t) => t.userId === userId && t.name === name)
    if (!tag) {
      tag = { id: newId(), name, userId, createdAt: nowISO() }
      db.tags.push(tag)
      persistDB(db)
    }
    return tag
  },
  delete: async (id) => {
    await delay()
    const db = await ensureDB()
    const userId = requireUserId()
    const idx = db.tags.findIndex((t) => t.id === id && t.userId === userId)
    if (idx === -1) throw error('标签不存在', 404)
    db.tags.splice(idx, 1)
    db.noteTags = db.noteTags.filter((nt) => nt.tagId !== id)
    persistDB(db)
    return { message: '删除成功' }
  }
}

const makeRelations = (notes) => {
  const out = []
  for (let i = 0; i < notes.length; i += 1) {
    for (let j = i + 1; j < notes.length; j += 1) {
      const a = (notes[i].tags || []).map((t) => t.id)
      const b = (notes[j].tags || []).map((t) => t.id)
      const shared = a.filter((id) => b.includes(id))
      if (shared.length > 0) {
        out.push({
          id: `auto_${notes[i].id}_${notes[j].id}`,
          sourceId: notes[i].id,
          targetId: notes[j].id,
          strength: Math.min(100, shared.length * 30)
        })
      }
    }
  }
  return out
}

export const graphAPI = {
  getNodes: async () => {
    await delay()
    const db = await ensureDB()
    const userId = requireUserId()
    return db.notes.filter((n) => n.userId === userId).map((n) => withTags(n, db))
  },
  getRelations: async () => {
    await delay()
    const db = await ensureDB()
    const userId = requireUserId()
    const saved = db.relations.filter((r) => r.userId === userId)
    if (saved.length) return saved
    const notes = db.notes.filter((n) => n.userId === userId).map((n) => withTags(n, db))
    return makeRelations(notes)
  },
  getExpanded: async (nodeId) => {
    await delay()
    const db = await ensureDB()
    const userId = requireUserId()
    const note = db.notes.find((n) => n.id === nodeId && n.userId === userId)
    if (!note) throw error('节点不存在', 404)
    const myTagIds = db.noteTags.filter((nt) => nt.noteId === note.id).map((nt) => nt.tagId)
    const relatedIds = db.noteTags
      .filter((nt) => myTagIds.includes(nt.tagId) && nt.noteId !== note.id)
      .map((nt) => nt.noteId)
    const uniqueIds = [...new Set(relatedIds)]
    const nodes = db.notes
      .filter((n) => uniqueIds.includes(n.id) && n.userId === userId)
      .map((n) => withTags(n, db))
    const relations = nodes.map((n) => ({
      id: `exp_${note.id}_${n.id}`,
      sourceId: note.id,
      targetId: n.id,
      strength: 60
    }))
    return { nodes, relations }
  }
}

export const fileAPI = {
  upload: async (file) => {
    await delay()
    if (!file) throw error('请选择文件', 400)
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve({ url: reader.result })
      reader.onerror = () => reject(error('图片上传失败', 500))
      reader.readAsDataURL(file)
    })
  }
}

