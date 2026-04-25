import { Router } from 'express'
import bcrypt from 'bcryptjs'
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

router.get('/profile', auth, async (req, res) => {
  await db.read()
  const user = db.data.users.find(u => u.id === req.userId)
  if (!user) return res.status(404).json({ message: '用户不存在' })
  const { password, ...safe } = user
  res.json(safe)
})

router.put('/profile', auth, async (req, res) => {
  await db.read()
  const idx = db.data.users.findIndex(u => u.id === req.userId)
  if (idx === -1) return res.status(404).json({ message: '用户不存在' })
  const { name, email, password } = req.body
  if (name) db.data.users[idx].name = name
  if (email) db.data.users[idx].email = email
  if (password) db.data.users[idx].password = await bcrypt.hash(password, 10)
  await db.write()
  const { password: _, ...safe } = db.data.users[idx]
  res.json(safe)
})

export default router
