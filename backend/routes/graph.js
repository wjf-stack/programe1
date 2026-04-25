import { Router } from 'express'
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

// 根据关键词找相关笔记（供扩展使用）
router.get('/related', auth, async (req, res) => {
  await db.read()
  const kw = (req.query.keyword || '').toLowerCase()
  if (!kw) return res.json([])
  const notes = db.data.notes
    .filter(n => n.userId === req.userId)
    .map(n => getNoteWithTags(n, db.data))
  // 评分：标题匹配权重高，内容匹配次之，标签匹配加分
  const scored = notes.map(n => {
    let score = 0
    const title = (n.title || '').toLowerCase()
    const content = (n.content || '').toLowerCase()
    const tagNames = (n.tags || []).map(t => t.name.toLowerCase()).join(' ')
    if (title.includes(kw)) score += 10
    if (content.includes(kw)) score += 3
    if (tagNames.includes(kw)) score += 5
    // 部分词匹配
    const words = kw.split(/\s+/).filter(Boolean)
    words.forEach(w => {
      if (title.includes(w)) score += 4
      if (content.includes(w)) score += 1
      if (tagNames.includes(w)) score += 2
    })
    return { note: n, score }
  })
  .filter(x => x.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 10)
  .map(x => x.note)
  res.json(scored)
})

export default router
