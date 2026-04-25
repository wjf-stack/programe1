import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db, newId } from '../config/database.js'

const router = Router()
const SECRET = 'zhilianweiji_secret_2024'

router.post('/register', async (req, res) => {
  try {
    await db.read()
    const { name, email, password } = req.body
    if (!name || !email || !password) return res.status(400).json({ message: '请填写完整信息' })
    if (db.data.users.find(u => u.email === email)) return res.status(400).json({ message: '邮箱已被注册' })
    const hashed = await bcrypt.hash(password, 10)
    const user = { id: newId(), name, email, password: hashed, createdAt: new Date().toISOString() }
    db.data.users.push(user)
    await db.write()
    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '7d' })
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.post('/login', async (req, res) => {
  try {
    await db.read()
    const { email, password } = req.body
    const user = db.data.users.find(u => u.email === email)
    if (!user) return res.status(401).json({ message: '邮箱或密码错误' })
    const match = await bcrypt.compare(password, user.password)
    if (!match) return res.status(401).json({ message: '邮箱或密码错误' })
    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '7d' })
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

export default router
