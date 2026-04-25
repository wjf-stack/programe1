import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDB } from './config/database.js'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/user.js'
import noteRoutes from './routes/notes.js'
import tagRoutes from './routes/tags.js'
import graphRoutes from './routes/graph.js'
import uploadRoutes from './routes/upload.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = 3000

app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.use('/auth', authRoutes)
app.use('/user', userRoutes)
app.use('/notes', noteRoutes)
app.use('/tags', tagRoutes)
app.use('/graph', graphRoutes)
app.use('/upload', uploadRoutes)

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }))

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: err.message })
})

const start = async () => {
  await initDB()
  console.log('数据库初始化完成')
  app.listen(PORT, () => console.log(`服务器运行在 http://localhost:${PORT}`))
}

start()
