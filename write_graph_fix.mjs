import fs from 'fs'

const content = `<template>
  <div class="graph-page">
    <div class="head panel">
      <div>
        <h2>宇宙知识图谱</h2>
        <p>每个主题是恒星系，每条笔记是该主题下的行星</p>
      </div>
      <div class="ctrl">
        <select v-model="filterTag" class="sel">
          <option value="">全部主题</option>
          <option v-for="t in allTags" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <button class="btn" @click="resetCamera">重置视角</button>
      </div>
    </div>

    <div v-if="highlightNote" class="banner">
      <span>已高亮：{{ highlightNote.title }}</span>
      <button @click="highlightId = null">✕</button>
    </div>

    <div class="layout">
      <div class="stage panel">
        <canvas ref="canvasRef" class="canvas"></canvas>
        <div v-if="loading" class="overlay">正在生成星系图...</div>
      </div>

      <div class="side panel">
        <div v-if="selectedNode">
          <h3>{{ selectedNode.title }}</h3>
          <p class="meta">主题：{{ selectedNode.themeName || '未归类' }}</p>
          <p class="txt">{{ (selectedNode.content || '').slice(0, 220) }}</p>
          <img v-if="selectedNode.previewImage" :src="selectedNode.previewImage" class="img" alt="preview" />
          <div class="tags">
            <span v-for="t in (selectedNode.tags || [])" :key="t.id">{{ t.name }}</span>
          </div>
          <div class="act">
            <button class="btn primary" @click="goToNote(selectedNode.id)">打开笔记</button>
            <button class="btn" @click="expandNode(selectedNode.id)">展开关联</button>
          </div>
        </div>
        <div v-else>
          <p>点击星球查看详情</p>
          <p>主题数：{{ allTags.length }}</p>
          <p>节点数：{{ visualNodes.length }}</p>
          <p>关系数：{{ visualRelations.length }}</p>
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
const filterTag = ref('')
const selectedNode = ref(null)
const highlightId = ref(route.query.highlight || null)

const loading = computed(() => graphStore.loading)
const allTags = computed(() => noteStore.tags)
const nodes = computed(() => graphStore.nodes)
const relations = computed(() => graphStore.relations)

const visualNodes = computed(() => {
  const list = filterTag.value
    ? nodes.value.filter(n => (n.tags || []).some(t => t.id === filterTag.value))
    : nodes.value
  return list.map(n => ({
    ...n,
    themeId: n.tags?.[0]?.id || 'untagged',
    themeName: n.tags?.[0]?.name || '未归类',
    previewImage: extractFirstImage(n.content || '')
  }))
})

const visualRelations = computed(() => {
  const ids = new Set(visualNodes.value.map(n => n.id))
  return relations.value.filter(r => ids.has(r.sourceId) && ids.has(r.targetId))
})

const highlightNote = computed(() => visualNodes.value.find(n => n.id === highlightId.value))

let THREE, scene, camera, renderer, raycaster, pointer, stars
let animationId = null
let nodeMeshes = []
let helperMeshes = []
let camA = 0

const extractFirstImage = (text) => text.match(/!\\[[^\\]]*\\]\\(([^)]+)\\)/)?.[1] || ''

const themeColor = (id) => {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return new THREE.Color(\`hsl(\${h % 360}, 86%, 58%)\`)
}

onMounted(async () => {
  await Promise.all([graphStore.fetchGraphData(), noteStore.fetchTags()])
  await init3D()
})

watch([visualNodes, visualRelations], async () => {
  if (THREE && scene) rebuild()
})

onBeforeUnmount(() => {
  if (animationId) cancelAnimationFrame(animationId)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('click', onPick)
  renderer?.dispose()
})

const init3D = async () => {
  THREE = await import('three')
  const c = canvasRef.value
  const w = c.parentElement.clientWidth || 900
  const h = c.parentElement.clientHeight || 620

  scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x030712, 0.0018)

  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 2400)
  camera.position.set(0, 140, 360)

  renderer = new THREE.WebGLRenderer({ canvas: c, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(w, h)

  scene.add(new THREE.AmbientLight(0x8ea4ff, 0.8))
  const light = new THREE.PointLight(0x9bb8ff, 1.1, 1800)
  light.position.set(220, 220, 160)
  scene.add(light)

  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()

  buildStars()
  rebuild()

  window.addEventListener('resize', onResize)
  window.addEventListener('click', onPick)
  animate()
}

const buildStars = () => {
  const n = 1800
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const r = 1200 * Math.pow(Math.random(), 0.65)
    const t = Math.random() * Math.PI * 2
    const p = Math.acos(2 * Math.random() - 1)
    arr[i * 3] = r * Math.sin(p) * Math.cos(t)
    arr[i * 3 + 1] = r * Math.cos(p)
    arr[i * 3 + 2] = r * Math.sin(p) * Math.sin(t)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xb7cbff, size: 1.7, transparent: true, opacity: 0.85 }))
  scene.add(stars)
}

const clearMesh = (arr) => {
  arr.forEach(m => {
    scene.remove(m)
    m.geometry?.dispose?.()
    if (Array.isArray(m.material)) m.material.forEach(x => x.dispose?.())
    else m.material?.dispose?.()
  })
  arr.length = 0
}

const rebuild = () => {
  clearMesh(nodeMeshes)
  clearMesh(helperMeshes)

  const groups = new Map()
  visualNodes.value.forEach(n => {
    if (!groups.has(n.themeId)) groups.set(n.themeId, [])
    groups.get(n.themeId).push(n)
  })

  const entries = Array.from(groups.entries())
  const R = Math.max(120, 70 * Math.sqrt(entries.length + 1))

  entries.forEach(([themeId, list], i) => {
    const a = (i / Math.max(1, entries.length)) * Math.PI * 2
    const tx = R * Math.cos(a), tz = R * Math.sin(a), ty = Math.sin(a * 2.4) * 22
    const c = themeColor(themeId)

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(11, 24, 24),
      new THREE.MeshPhongMaterial({ color: c, emissive: c.clone().multiplyScalar(0.45), shininess: 130 })
    )
    sun.position.set(tx, ty, tz)
    scene.add(sun)
    helperMeshes.push(sun)

    const orbit = new THREE.Mesh(
      new THREE.RingGeometry(20, 20 + list.length * 1.5, 80),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
    )
    orbit.position.set(tx, ty, tz)
    orbit.rotation.x = Math.PI / 2
    scene.add(orbit)
    helperMeshes.push(orbit)

    list.forEach((n, j) => {
      const an = (j / Math.max(1, list.length)) * Math.PI * 2
      const rr = 26 + list.length * 2
      const nx = tx + rr * Math.cos(an)
      const nz = tz + rr * Math.sin(an)
      const ny = ty + Math.sin(an * 2.1) * 8
      const hl = n.id === highlightId.value
      const col = hl ? new THREE.Color('#ff5d78') : c.clone().offsetHSL(0.03, 0.02, -0.08)

      const p = new THREE.Mesh(
        new THREE.SphereGeometry(hl ? 7.3 : 5.1, 18, 18),
        new THREE.MeshPhongMaterial({ color: col, emissive: col.clone().multiplyScalar(hl ? 0.55 : 0.24), shininess: 90 })
      )
      p.position.set(nx, ny, nz)
      p.userData = n
      scene.add(p)
      nodeMeshes.push(p)

      const link = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(tx, ty, tz), new THREE.Vector3(nx, ny, nz)]),
        new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.24 })
      )
      scene.add(link)
      helperMeshes.push(link)
    })
  })

  visualRelations.value.forEach(r => {
    const a = nodeMeshes.find(m => m.userData.id === r.sourceId)
    const b = nodeMeshes.find(m => m.userData.id === r.targetId)
    if (!a || !b) return
    const rel = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([a.position.clone(), b.position.clone()]),
      new THREE.LineBasicMaterial({ color: 0x8aa3ff, transparent: true, opacity: 0.18 })
    )
    scene.add(rel)
    helperMeshes.push(rel)
  })
}

const animate = () => {
  animationId = requestAnimationFrame(animate)
  camA += 0.0018
  camera.position.x = 390 * Math.sin(camA)
  camera.position.z = 390 * Math.cos(camA)
  camera.position.y = 120 + Math.sin(camA * 1.4) * 18
  camera.lookAt(0, 0, 0)
  nodeMeshes.forEach((m, i) => {
    m.rotation.y += 0.005
    m.position.y += Math.sin(Date.now() * 0.001 + i) * 0.02
  })
  stars.rotation.y += 0.0002
  renderer.render(scene, camera)
}

const onResize = () => {
  if (!renderer || !camera) return
  const c = canvasRef.value
  const w = c.parentElement.clientWidth || 900
  const h = c.parentElement.clientHeight || 620
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

const onPick = (e) => {
  if (!raycaster || !pointer || !camera) return
  const r = canvasRef.value.getBoundingClientRect()
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(nodeMeshes)
  selectedNode.value = hit.length ? hit[0].object.userData : null
}

const resetCamera = () => { camA = 0 }
const expandNode = async (id) => { await graphStore.expandNode(id) }
const goToNote = (id) => router.push('/note/' + id)
<\/script>

<style scoped>
.graph-page{animation:fade .3s ease}.panel{background:rgba(8,14,32,.78);border:1px solid rgba(142,170,255,.16);box-shadow:0 18px 48px rgba(0,0,0,.35);backdrop-filter:blur(14px)}
.head{border-radius:14px;padding:1rem 1.1rem;margin-bottom:1rem;display:flex;justify-content:space-between;gap:1rem;align-items:center}.head h2{margin:0;color:#eef4ff}.head p{margin:.3rem 0 0;color:#b9c8ea;font-size:.9rem}
.ctrl{display:flex;gap:.6rem}.sel{padding:.55rem .8rem;border:1px solid rgba(149,170,255,.2);border-radius:10px;background:rgba(8,14,30,.8);color:#eff3ff}.btn{padding:.52rem .9rem;border-radius:9px;border:1px solid rgba(149,170,255,.16);background:rgba(112,131,199,.16);color:#e9f1ff;cursor:pointer}.primary{background:linear-gradient(135deg,#5f7cff,#8d52ff);border:none}
.banner{display:flex;justify-content:space-between;align-items:center;background:rgba(255,98,124,.15);border:1px solid rgba(255,129,149,.4);border-radius:10px;padding:.58rem .9rem;margin-bottom:.9rem;color:#ffd9e0}
.banner button{background:none;border:none;color:#ffd9e0;cursor:pointer}
.layout{display:grid;grid-template-columns:1fr 280px;gap:1rem;height:650px}.stage{position:relative;border-radius:14px;overflow:hidden}.canvas{width:100%;height:100%}.overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#d0dcfb}
.side{border-radius:14px;padding:1rem;overflow:auto;color:#d2def6}.side h3{margin:0 0 .45rem;color:#eef4ff}.meta{font-size:.85rem;color:#b7c7ec}.txt{font-size:.9rem;line-height:1.55}.img{width:100%;border-radius:10px;border:1px solid rgba(149,170,255,.2);margin:.7rem 0}
.tags{display:flex;flex-wrap:wrap;gap:.28rem;margin-bottom:.7rem}.tags span{background:rgba(103,126,234,.85);color:#fff;padding:.18rem .45rem;border-radius:6px;font-size:.75rem}.act{display:flex;gap:.45rem;flex-wrap:wrap}
@keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:980px){.layout{grid-template-columns:1fr;height:auto}.stage{height:520px}}
<\/style>
`

fs.writeFileSync('d:/cursor/cursor_programe1/zhilianweiji/frontend/src/pages/KnowledgeGraph.vue', content, 'utf8')
console.log('KnowledgeGraph.vue rewritten')
