# 智联微记 - 知识关联记录平台

## 项目结构

zhilianweiji/
  frontend/   # Vue3 + Vite 前端
  backend/    # Node.js + Express + lowdb 后端

## 启动方式

### 后端（端口 3000）
  cd backend
  npm start

### 前端（端口 5173）
  cd frontend
  npm run dev

## 访问地址
  前端: http://localhost:5173
  后端健康检查: http://localhost:3000/health

## 技术栈
- 前端: Vue3 + Vite + Pinia + Vue Router + Three.js + Tailwind CSS
- 后端: Node.js + Express + lowdb (JSON文件数据库) + bcryptjs + JWT + multer

## 功能模块
1. 用户登录/注册
2. 仪表板（笔记概览、标签筛选、搜索）
3. 笔记编辑器（快速笔记/富文本/网页摘录）
4. 知识图谱（2D/3D Three.js 渲染）
5. 个人中心
