# -*- coding: utf-8 -*-
import os

base = r'd:\cursor\cursor_programe1\zhilianweiji\backend\routes'
os.makedirs(base, exist_ok=True)

notes = """import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { db, newId } from '../config/database.js'

const router = Router()
const SECRET = 'zhilianweiji_secret_2024'

const auth = (req, res, next) => {
  const h = req.headers.authorization
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ message: '未授权' })
  try { req.userId = jwt.verify(h.split(' ')[1], SECRET).userId; next() }
  catch { res.status(401).json({ message: 'token无效' }) }
}

const getNoteWithTags = (note, data) => {
  const tagIds = data.noteTags.filter(nt => nt.noteId === note.id).map(nt => nt.tagId)
  const tags = data.tags.filter(t => tagIds.includes(t.id))
  return { ...note, tags }
}

router.get('/', auth, async (req, res) => {
  await db.read()
  const { page = 1, limit = 20 } = req.query
  const all = db.data.notes.filter(n => n.userId === req.userId).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
  const data = all.slice((page-1)*limit, page*limit).map(n => getNoteWithTags(n, db.data))
  res.json({ total: all.length, data, page: parseInt(page) })
})

router.get('/search', auth, async (req, res) => {
  await db.read()
  const kw = (req.query.keyword || '').toLowerCase()
  const results = db.data.notes
    .filter(n => n.userId === req.userId && (n.title?.toLowerCase().includes(kw) || n.content?.toLowerCase().includes(kw)))
    .slice(0, 20).map(n => getNoteWithTags(n, db.data))
  res.json(results)
})

router.get('/:id', auth, async (req, res) => {
  await db.read()
  const note = db.data.notes.find(n => n.id === req.params.id && n.userId === req.userId)
  if (!note) return res.status(404).json({ message: '笔记不存在' })
  res.json(getNoteWithTags(note, db.data))
})

router.post('/', auth, async (req, res) => {
  await db.read()
  const { title, content, type, source, tagIds } = req.body
  const note = { id: newId(), title: title || '无标题', content: content || '', type: type || 'quick', source: source || null, userId: req.userId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  db.data.notes.push(note)
  if (tagIds?.length) tagIds.forEach(tid => db.data.noteTags.push({ noteId: note.id, tagId: tid }))
  await db.write()
  res.status(201).json(getNoteWithTags(note, db.data))
})

router.put('/:id', auth, async (req, res) => {
  await db.read()
  const idx = db.data.notes.findIndex(n => n.id === req.params.id && n.userId === req.userId)
  if (idx === -1) return res.status(404).json({ message: '笔记不存在' })
  const { title, content, type, source, tagIds } = req.body
  if (title !== undefined) db.data.notes[idx].title = title
  if (content !== undefined) db.data.notes[idx].content = content
  if (type) db.data.notes[idx].type = type
  if (source !== undefined) db.data.notes[idx].source = source
  db.data.notes[idx].updatedAt = new Date().toISOString()
  if (tagIds) {
    db.data.noteTags = db.data.noteTags.filter(nt => nt.noteId !== req.params.id)
    tagIds.forEach(tid => db.data.noteTags.push({ noteId: req.params.id, tagId: tid }))
  }
  await db.write()
  res.json(getNoteWithTags(db.data.notes[idx], db.data))
})

router.delete('/:id', auth, async (req, res) => {
  await db.read()
  const idx = db.data.notes.findIndex(n => n.id === req.params.id && n.userId === req.userId)
  if (idx === -1) return res.status(404).json({ message: '笔记不存在' })
  db.data.notes.splice(idx, 1)
  db.data.noteTags = db.data.noteTags.filter(nt => nt.noteId !== req.params.id)
  await db.write()
  res.json({ message: '删除成功' })
})

export default router
"""

tags = """import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { db, newId } from '../config/database.js'

const router = Router()
const SECRET = 'zhilianweiji_secret_2024'

const auth = (req, res, next) => {
  const h = req.headers.authorization
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ message: '未授权' })
  try { req.userId = jwt.verify(h.split(' ')[1], SECRET).userId; next() }
  catch { res.status(401).json({ message: 'token无效' }) }
}

router.get('/', auth, async (req, res) => {
  await db.read()
  const tags = db.data.tags.filter(t => t.userId === req.userId).sort((a,b) => a.name.localeCompare(b.name))
  res.json(tags)
})

router.post('/', auth, async (req, res) => {
  await db.read()
  const { name } = req.body
  if (!name) return res.status(400).json({ message: '标签名不能为空' })
  let tag = db.data.tags.find(t => t.name === name && t.userId === req.userId)
  if (!tag) {
    tag = { id: newId(), name, userId: req.userId, createdAt: new Date().toISOString() }
    db.data.tags.push(tag)
    await db.write()
  }
  res.status(201).json(tag)
})

router.delete('/:id', auth, async (req, res) => {
  await db.read()
  const idx = db.data.tags.findIndex(t => t.id === req.params.id && t.userId === req.userId)
  if (idx === -1) return res.status(404).json({ message: '标签不存在' })
  db.data.tags.splice(idx, 1)
  db.data.noteTags = db.data.noteTags.filter(nt => nt.tagId !== req.params.id)
  await db.write()
  res.json({ message: '删除成功' })
})

export default router
"""

graph = """import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { db } from '../config/database.js'

const router = Router()
const SECRET = 'zhilianweiji_secret_2024'

const auth = (req, res, next) => {
  const h = req.headers.authorization
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ message: '未授权' })
  try { req.userId = jwt.verify(h.split(' ')[1], SECRET).userId; next() }
  catch { res.status(401).json({ message: 'token无效' }) }
}

const getNoteWithTags = (note, data) => {
  const tagIds = data.noteTags.filter(nt => nt.noteId === note.id).map(nt => nt.tagId)
  return { ...note, tags: data.tags.filter(t => tagIds.includes(t.id)) }
}

router.get('/nodes', auth, async (req, res) => {
  await db.read()
  const notes = db.data.notes.filter(n => n.userId === req.userId).map(n => getNoteWithTags(n, db.data))
  res.json(notes)
})

router.get('/relations', auth, async (req, res) => {
  await db.read()
  const saved = db.data.relations.filter(r => r.userId === req.userId)
  if (saved.length > 0) return res.json(saved)
  const notes = db.data.notes.filter(n => n.userId === req.userId).map(n => getNoteWithTags(n, db.data))
  const auto = []
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const a = notes[i].tags.map(t => t.id)
      const b = notes[j].tags.map(t => t.id)
      const shared = a.filter(t => b.includes(t))
      if (shared.length > 0) {
        auto.push({ id: 'auto_' + notes[i].id + '_' + notes[j].id, sourceId: notes[i].id, targetId: notes[j].id, strength: Math.min(100, shared.length * 30) })
      }
    }
  }
  res.json(auto)
})

router.get('/expand/:id', auth, async (req, res) => {
  await db.read()
  const note = db.data.notes.find(n => n.id === req.params.id && n.userId === req.userId)
  if (!note) return res.status(404).json({ message: '节点不存在' })
  const myTagIds = db.data.noteTags.filter(nt => nt.noteId === note.id).map(nt => nt.tagId)
  const relNoteIds = db.data.noteTags.filter(nt => myTagIds.includes(nt.tagId) && nt.noteId !== note.id).map(nt => nt.noteId)
  const unique = [...new Set(relNoteIds)]
  const relNotes = db.data.notes.filter(n => unique.includes(n.id) && n.userId === req.userId).map(n => getNoteWithTags(n, db.data))
  const relations = relNotes.map(n => ({ id: 'exp_' + note.id + '_' + n.id, sourceId: note.id, targetId: n.id, strength: 60 }))
  res.json({ nodes: relNotes, relations })
})

export default router
"""

upload = """import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import jwt from 'jsonwebtoken'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SECRET = 'zhilianweiji_secret_2024'
const uploadDir = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const auth = (req, res, next) => {
  const h = req.headers.authorization
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ message: '未授权' })
  try { req.userId = jwt.verify(h.split(' ')[1], SECRET).userId; next() }
  catch { res.status(401).json({ message: 'token无效' }) }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, Date.now() + '_' + Math.random().toString(36).slice(2) + ext)
  }
})

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } })
const router = Router()

router.post('/', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请选择文件' })
  res.json({ url: '/uploads/' + req.file.filename, filename: req.file.filename })
})

export default router
"""

for fname, content in [('notes.js', notes), ('tags.js', tags), ('graph.js', graph), ('upload.js', upload)]:
    with open(os.path.join(base, fname), 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Written {fname}')

print('All routes done')
