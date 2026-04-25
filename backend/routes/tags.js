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
