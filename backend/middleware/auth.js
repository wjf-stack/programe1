import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'zhilianweiji_secret_2024'

export const auth = (req, res, next) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: '未授权，请先登录' })
  }
  const token = header.split(' ')[1]
  try {
    const payload = jwt.verify(token, SECRET)
    req.userId = payload.userId
    next()
  } catch {
    return res.status(401).json({ message: 'token 无效或已过期' })
  }
}

export const signToken = (userId) =>
  jwt.sign({ userId }, SECRET, { expiresIn: '7d' })

export default auth
