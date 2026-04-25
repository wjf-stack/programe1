import fs from 'fs'

const content = `<template>
  <div class="graph-page">
    <div class="graph-header">
      <h2>知识图谱</h2>
      <div class="graph-controls">
        <button @click="toggleMode" class="btn-toggle">{{ is3D ? '切换2D视图' : '切换3D视图' }}</button>
        <button @click="resetView" class="btn-reset">重置视图</button>
        <select v-model="filterTag" class="tag-filter">
          <option value="">全部标签</option>
          <option v-for="tag in allTags" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
        </select>
      </div>
    </div>
    <div v-if="highlightNote" class="highlight-banner">
      <span>✂ 来自摘录：<strong>{{ highlightNote.title }}</strong> 已在图谱中高亮显示</span>
      <button @click="highlightId = null" class="banner-close">✕</button>
    </div>
    <div class="graph-container">
      <div class="canvas-wrap">
        <canvas ref="canvasRef" class="graph-canvas"></canvas>
        <div v-if="loading" class="graph-loading"><div class="spinner"></div><p>加载知识图谱...</p></div>
        <div v-if="!loading && nodes.length === 0" class="graph-empty">
          <p>暂无节点，先去<router-link to="/note/new">创建笔记</router-link></p>
        </div>
      </div>
      <div class="graph-sidebar">
        <div v-if="selectedNode" class="node-detail">
          <h3>{{ selectedNode.title }}</h3>
          <p class="node-type">类型：{{ selectedNode.type }}</p>
          <p class="node-content">{{ (selectedNode.content || '').substring(0, 200) }}</p>
          <div class="node-tags">
            <span v-for="tag in (selectedNode.tags||[])" :key="tag.id" class="tag">{{ tag.name }}</span>
          </div>
          <div class="node-actions">
            <button @click="goToNote(selectedNode.id)" class="btn-open">打开笔记</button>
            <button @click="expandNode(selectedNode.id)" class="btn-expand">展开关联</button>
          </div>
        </div>
        <div v-else class="node-hint">
          <p>点击节点查看详情</p>
          <div class="legend">
            <div class="legend-item"><span class="dot" style="background:#667eea"></span>快速笔记</div>
            <div class="legend-item"><span class="dot" style="background:#f59e0b"></span>富文本</div>
            <div class="legend-item"><span class="dot" style="background:#10b981"></span>网页摘录</div>
            <div class="legend-item"><span class="dot" style="background:#ef4444"></span>知识扩展</div>
          </div>
          <div class="stats">
            <p>节点总数：<strong>{{ nodes.length }}</strong></p>
            <p>关联总数：<strong>{{ relations.length }}</strong></p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGraphStore } from '../stores/graph'
import { useNoteStore } from '../stores/note'

const router = useRouter()
const route = useRoute()
const graphStore = useGraphStore()
const noteStore = useNoteStore()

const canvasRef = ref(null)
const is3D = ref(false)
const filterTag = ref('')
const selectedNode = ref(null)
const highlightId = ref(route.query.highlight || null)
const loading = computed(() => graphStore.loading)
const nodes = computed(() => graphStore.nodes)
const relations = computed(() => graphStore.relations)
const allTags = computed(() => noteStore.tags)
const highlightNote = computed(() =>
  highlightId.value ? nodes.value.find(n => n.id === highlightId.value) : null
)

let animationId = null
let ctx = null
let zoom2d = 1
let offset2d = { x: 0, y: 0 }

onMounted(async () => {
  await graphStore.fetchGraphData()
  await noteStore.fetchTags()
  initCanvas()
  if (highlightId.value) {
    const node = nodes.value.find(n => n.id === highlightId.value)
    if (node) selectedNode.value = node
  }
})

onBeforeUnmount(() => { if (animationId) cancelAnimationFrame(animationId) })

watch(highlightId, () => { if (!is3D.value) draw2D() })

const initCanvas = () => { if (!canvasRef.value) return; if (is3D.value) init3D(); else init2D() }

const getNodeColor = (type, nodeId) => {
  if (nodeId && nodeId === highlightId.value) return '#ff4757'
  const map = { quick: '#667eea', rich: '#f59e0b', clip: '#10b981', expand: '#ef4444' }
  return map[type] || '#667eea'
}

const getPositions = () => {
  const c = canvasRef.value
  const cx = c.width / 2, cy = c.height / 2
  const pos = {}
  const n = nodes.value.length
  nodes.value.forEach((node, i) => {
    const angle = (i / n) * Math.PI * 2
    const r = Math.min(cx, cy) * 0.65
    pos[node.id] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), node }
  })
  return pos
}

const init2D = () => {
  if (animationId) cancelAnimationFrame(animationId)
  const canvas = canvasRef.value
  canvas.width = canvas.parentElement.clientWidth || 800
  canvas.height = canvas.parentElement.clientHeight || 550
  ctx = canvas.getContext('2d')
  canvas.addEventListener('click', on2DClick)
  canvas.addEventListener('wheel', (e) => { zoom2d *= e.deltaY > 0 ? 0.9 : 1.1; draw2D() })
  draw2D()
}

const draw2D = () => {
  if (!ctx || !canvasRef.value) return
  const canvas = canvasRef.value
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  ctx.translate(offset2d.x, offset2d.y)
  ctx.scale(zoom2d, zoom2d)
  const pos = getPositions()
  relations.value.forEach(rel => {
    const a = pos[rel.sourceId], b = pos[rel.targetId]
    if (!a || !b) return
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y)
    ctx.strokeStyle = 'rgba(102,126,234,0.2)'; ctx.lineWidth = 1.5; ctx.stroke()
  })
  Object.values(pos).forEach(({ x, y, node }) => {
    const hl = node.id === highlightId.value
    const radius = hl ? 28 : 22
    if (hl) { ctx.beginPath(); ctx.arc(x, y, radius+8, 0, Math.PI*2); ctx.fillStyle='rgba(255,71,87,0.18)'; ctx.fill() }
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI*2)
    ctx.fillStyle = getNodeColor(node.type, node.id); ctx.fill()
    ctx.strokeStyle = 'white'; ctx.lineWidth = hl ? 3 : 2.5; ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText((node.title||'').substring(0,4), x, y)
    ctx.fillStyle = hl ? '#ff4757' : '#555'
    ctx.font = (hl ? 'bold ' : '') + '11px sans-serif'
    ctx.textBaseline = 'top'
    ctx.fillText((node.title||'').substring(0,8), x, y+radius+4)
  })
  ctx.restore()
}

const on2DClick = (e) => {
  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()
  const mx = (e.clientX - rect.left - offset2d.x) / zoom2d
  const my = (e.clientY - rect.top - offset2d.y) / zoom2d
  const pos = getPositions()
  for (const { x, y, node } of Object.values(pos)) {
    if (Math.hypot(mx-x, my-y) < 28) { selectedNode.value = node; return }
  }
  selectedNode.value = null
}

const init3D = async () => {
  if (animationId) cancelAnimationFrame(animationId)
  let THREE
  try { THREE = await import('three') } catch { is3D.value = false; init2D(); return }
  const canvas = canvasRef.value
  const w = canvas.parentElement.clientWidth || 800
  const h = canvas.parentElement.clientHeight || 550
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f0ff)
  const camera = new THREE.PerspectiveCamera(60, w/h, 0.1, 1000)
  camera.position.set(0, 0, 180)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(w, h)
  scene.add(new THREE.AmbientLight(0xffffff, 0.9))
  const dir = new THREE.DirectionalLight(0xffffff, 0.5)
  dir.position.set(100, 100, 100); scene.add(dir)
  const meshes = []
  nodes.value.forEach((node, i) => {
    const angle = (i / nodes.value.length) * Math.PI * 2
    const hl = node.id === highlightId.value
    const geo = new THREE.SphereGeometry(hl ? 10 : 7, 16, 16)
    const color = parseInt(getNodeColor(node.type, node.id).replace('#',''), 16)
    const mat = new THREE.MeshPhongMaterial({ color })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(80*Math.cos(angle), (Math.random()-0.5)*50, 80*Math.sin(angle))
    mesh.userData = node; scene.add(mesh); meshes.push(mesh)
  })
  relations.value.forEach(rel => {
    const a = meshes.find(m => m.userData.id === rel.sourceId)
    const b = meshes.find(m => m.userData.id === rel.targetId)
    if (!a || !b) return
    const geo = new THREE.BufferGeometry().setFromPoints([a.position.clone(), b.position.clone()])
    scene.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x667eea, transparent: true, opacity: 0.25 })))
  })
  let camAngle = 0
  const loop = () => {
    animationId = requestAnimationFrame(loop)
    camAngle += 0.003
    camera.position.x = 180*Math.sin(camAngle)
    camera.position.z = 180*Math.cos(camAngle)
    camera.lookAt(0, 0, 0)
    renderer.render(scene, camera)
  }
  loop()
}

const toggleMode = () => { is3D.value = !is3D.value; setTimeout(initCanvas, 50) }
const resetView = () => { zoom2d = 1; offset2d = { x:0, y:0 }; if (!is3D.value) draw2D() }
const expandNode = async (id) => { await graphStore.expandNode(id); initCanvas() }
const goToNote = (id) => router.push('/note/' + id)
<\/script>

<style scoped>
.graph-page { animation: fadeIn 0.3s ease; }
.graph-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.graph-header h2 { font-size: 2rem; color: #333; margin: 0; }
.graph-controls { display: flex; gap: 0.75rem; align-items: center; }
.btn-toggle { padding: 0.5rem 1.2rem; background: linear-gradient(135deg,#667eea,#764ba2); color: white; border: none; border-radius: 6px; cursor: pointer; }
.btn-reset { padding: 0.5rem 1rem; background: #f0f0ff; color: #667eea; border: 1px solid #c5ceff; border-radius: 6px; cursor: pointer; }
.tag-filter { padding: 0.5rem 0.8rem; border: 1px solid #ddd; border-radius: 6px; outline: none; }
.highlight-banner { display: flex; align-items: center; justify-content: space-between; background: #fff3f3; border: 1px solid #ffcdd2; border-radius: 8px; padding: 0.6rem 1rem; margin-bottom: 1rem; color: #c62828; font-size: 0.9rem; }
.banner-close { background: none; border: none; color: #c62828; cursor: pointer; font-size: 1rem; padding: 0; }
.graph-container { display: grid; grid-template-columns: 1fr 260px; gap: 1.5rem; height: 600px; }
.canvas-wrap { position: relative; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(102,126,234,0.1); }
.graph-canvas { width: 100%; height: 100%; }
.graph-loading, .graph-empty { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #aaa; }
.spinner { width: 40px; height: 40px; border: 4px solid #f0f0ff; border-top-color: #667eea; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 1rem; }
.graph-sidebar { background: white; border-radius: 10px; padding: 1.5rem; box-shadow: 0 2px 12px rgba(102,126,234,0.08); overflow-y: auto; }
.node-detail h3 { color: #333; margin: 0 0 0.5rem 0; font-size: 1.1rem; }
.node-type { color: #888; font-size: 0.85rem; margin-bottom: 0.5rem; }
.node-content { color: #555; font-size: 0.9rem; line-height: 1.6; margin-bottom: 1rem; }
.node-tags { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 1rem; }
.tag { background: #667eea; color: white; padding: 0.2rem 0.5rem; border-radius: 3px; font-size: 0.78rem; }
.node-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.btn-open { padding: 0.5rem 1rem; background: linear-gradient(135deg,#667eea,#764ba2); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
.btn-expand { padding: 0.5rem 1rem; background: #f0f0ff; color: #667eea; border: 1px solid #c5ceff; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
.node-hint p { color: #aaa; text-align: center; margin-bottom: 1.5rem; }
.legend { margin-bottom: 1.5rem; }
.legend-item { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; font-size: 0.88rem; color: #555; }
.dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.stats p { color: #666; font-size: 0.9rem; margin-bottom: 0.4rem; }
.stats strong { color: #667eea; }
@keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
`

fs.writeFileSync('d:/cursor/cursor_programe1/zhilianweiji/frontend/src/pages/KnowledgeGraph.vue', content, 'utf8')
console.log('KnowledgeGraph.vue written')
