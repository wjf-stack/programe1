import { Router } from 'express'
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
  const { title, content, type, source, tagIds, branch } = req.body
  const note = { id: newId(), title: title || '无标题', content: content || '', type: type || 'quick', source: source || null, branch: branch || '', userId: req.userId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  db.data.notes.push(note)
  if (tagIds?.length) tagIds.forEach(tid => db.data.noteTags.push({ noteId: note.id, tagId: tid }))
  await db.write()
  res.status(201).json(getNoteWithTags(note, db.data))
})

router.put('/:id', auth, async (req, res) => {
  await db.read()
  const idx = db.data.notes.findIndex(n => n.id === req.params.id && n.userId === req.userId)
  if (idx === -1) return res.status(404).json({ message: '笔记不存在' })
  const { title, content, type, source, tagIds, branch } = req.body
  if (title !== undefined) db.data.notes[idx].title = title
  if (content !== undefined) db.data.notes[idx].content = content
  if (type) db.data.notes[idx].type = type
  if (source !== undefined) db.data.notes[idx].source = source
  if (branch !== undefined) db.data.notes[idx].branch = branch
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
