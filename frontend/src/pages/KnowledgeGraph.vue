<template>
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
        <select v-model="filterBranch" class="sel">
          <option value="">全部分支</option>
          <option v-for="b in branchOptions" :key="b" :value="b">{{ b }}</option>
        </select>
        <button class="btn" @click="toggleMeteorMode">{{ meteorBurst ? '流星爆发：开' : '流星爆发：关' }}</button>
        <button class="btn danger" :disabled="!activeThemeId" @click="deleteCurrentTheme">删除当前主题</button>
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
        <div class="label-layer">
          <div
            v-for="lb in planetLabels"
            :key="lb.id"
            class="planet-label"
            :style="{ transform: `translate(${lb.x}px, ${lb.y}px)` }"
          >
            {{ lb.text }}
          </div>
        </div>
        <div v-if="loading" class="overlay">正在生成星系图...</div>
      </div>

      <div class="side panel">
        <div v-if="selectedNode">
          <h3>{{ selectedNode.title }}</h3>
          <p class="meta">主题：{{ selectedNode.themeName || '未归类' }}</p>
          <p class="meta">分支：{{ selectedNode.branchName || '未分支' }}</p>
          <p class="txt">{{ (selectedNode.content || '').slice(0, 220) }}</p>
          <img v-if="selectedNode.previewImage" :src="selectedNode.previewImage" class="img" alt="preview" />
          <div class="tags">
            <span v-for="t in (selectedNode.tags || [])" :key="t.id">{{ t.name }}</span>
          </div>
          <div class="act">
            <button class="btn primary" @click="goToNote(selectedNode.id)">打开笔记</button>
            <button class="btn" @click="expandNode(selectedNode.id)">展开关联</button>
            <button class="btn" @click="focusSameBranch(selectedNode)">同分支全部节点</button>
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
const filterBranch = ref('')
const selectedNode = ref(null)
const highlightId = ref(route.query.highlight || null)
const planetLabels = ref([])
const isDragging = ref(false)
const dragMoved = ref(false)
const meteorBurst = ref(false)
const focusThemeId = ref('')
const focusBranch = ref('')

const loading = computed(() => graphStore.loading)
const allTags = computed(() => noteStore.tags)
const nodes = computed(() => graphStore.nodes)
const relations = computed(() => graphStore.relations)

const visualNodes = computed(() => {
  const byTag = filterTag.value
    ? nodes.value.filter(n => (n.tags || []).some(t => t.id === filterTag.value))
    : nodes.value
  const mapped = byTag.map(n => ({
    ...n,
    themeId: n.tags?.[0]?.id || 'untagged',
    themeName: n.tags?.[0]?.name || '未归类',
    branchName: n.branch || extractBranchFromContent(n.content || '') || '未分支',
    previewImage: extractFirstImage(n.content || '')
  }))
  if (!filterBranch.value) return mapped
  return mapped.filter(n => n.branchName === filterBranch.value)
})

const branchOptions = computed(() => {
  const set = new Set()
  const byTag = filterTag.value
    ? nodes.value.filter(n => (n.tags || []).some(t => t.id === filterTag.value))
    : nodes.value
  byTag.forEach((n) => {
    const b = n.branch || extractBranchFromContent(n.content || '') || '未分支'
    set.add(b)
  })
  return Array.from(set)
})

const visualRelations = computed(() => {
  const ids = new Set(visualNodes.value.map(n => n.id))
  return relations.value.filter(r => ids.has(r.sourceId) && ids.has(r.targetId))
})

const highlightNote = computed(() => visualNodes.value.find(n => n.id === highlightId.value))
const activeThemeId = computed(() => filterTag.value || focusThemeId.value)

let THREE, GLTFLoader, scene, camera, renderer, raycaster, pointer, stars
let animationId = null
let nodeMeshes = []
let helperMeshes = []
let themeMeshes = []
let relationLinks = []
let meteorMeshes = []
let modelTemplates = { sun: null, planet: null, ringed: null }
let camA = 0
let userYaw = 0
let userPitch = 0
let camRadius = 390
let targetYaw = 0
let targetPitch = 0
let targetRadius = 390
let dragStart = { x: 0, y: 0 }
let nextMeteorAt = 0

const extractFirstImage = (text) => text.match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1] || ''
const extractBranchFromContent = (text) => text.match(/(?:^|\n)分支[:：]\s*([^\n]+)/)?.[1]?.trim() || ''

const themeColor = (id, index = 0) => {
  const palette = ['#ff4d8d', '#28f0ff', '#ffd166', '#8f61ff', '#3dff9f', '#ff8f3d', '#54a0ff', '#ff4df0']
  const pick = palette[index % palette.length]
  const base = new THREE.Color(pick)
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const delta = ((h % 23) - 11) / 360
  return base.offsetHSL(delta, 0.08, 0)
}

const createPlanetTexture = (baseColor, seed = 0) => {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')

  const c1 = baseColor.clone().offsetHSL(0.02, 0.12, 0.16).getStyle()
  const c2 = baseColor.clone().offsetHSL(-0.04, 0.18, -0.08).getStyle()
  const c3 = baseColor.clone().offsetHSL(0.09, 0.1, 0.04).getStyle()

  const g = ctx.createLinearGradient(0, 0, 256, 256)
  g.addColorStop(0, c1)
  g.addColorStop(0.55, c2)
  g.addColorStop(1, c3)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)

  for (let i = 0; i < 14; i++) {
    const y = ((i + seed) * 18) % 256
    ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,0.28)' : 'rgba(20,24,68,0.25)'
    ctx.lineWidth = 6 + (i % 4)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(72, y - 18, 180, y + 18, 256, y - 4)
    ctx.stroke()
  }

  for (let i = 0; i < 24; i++) {
    const x = (seed * 37 + i * 19) % 256
    const y = (seed * 11 + i * 29) % 256
    const r = 4 + (i % 8)
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.2)' : 'rgba(12,20,44,0.25)'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

const tintModel = (obj, color) => {
  obj.traverse((child) => {
    if (!child.isMesh) return
    const mat = child.material?.clone?.() || child.material
    if (mat?.color) mat.color = mat.color.clone().lerp(color, 0.65)
    if (mat?.emissive) mat.emissive = color.clone().multiplyScalar(0.18)
    child.material = mat
    child.castShadow = false
    child.receiveShadow = false
  })
}

const loadModel = (loader, url) => new Promise((resolve) => {
  loader.load(url, (gltf) => resolve(gltf.scene), undefined, () => resolve(null))
})

const loadModelTemplates = async () => {
  const loader = new GLTFLoader()
  const [sun, planet, ringed] = await Promise.all([
    loadModel(loader, '/models/planet-core.glb'),
    loadModel(loader, '/models/planet.glb'),
    loadModel(loader, '/models/planet-ring.glb')
  ])
  modelTemplates = { sun, planet, ringed }
}

const getCarrierObject = (obj) => {
  let cur = obj
  while (cur) {
    if (cur.userData?.kind === 'planet' || cur.userData?.kind === 'theme') return cur
    cur = cur.parent
  }
  return null
}

onMounted(async () => {
  await Promise.all([graphStore.fetchGraphData(), noteStore.fetchTags()])
  await init3D()
})

watch([visualNodes, visualRelations], async () => {
  if (THREE && scene) rebuild()
})

watch(filterTag, (v) => {
  focusThemeId.value = v || ''
  if (filterBranch.value && !branchOptions.value.includes(filterBranch.value)) {
    filterBranch.value = ''
  }
  applyThemeFocus()
})

watch(filterBranch, (v) => {
  focusBranch.value = v || ''
  applyThemeFocus()
})

onBeforeUnmount(() => {
  if (animationId) cancelAnimationFrame(animationId)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('click', onPick)
  canvasRef.value?.removeEventListener('mousedown', onDragStart)
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
  canvasRef.value?.removeEventListener('wheel', onWheelZoom)
  canvasRef.value?.removeEventListener('dblclick', onDoubleClickNode)
  clearMesh(meteorMeshes)
  clearMesh(themeMeshes)
  clearMesh(relationLinks)
  renderer?.dispose()
})

const init3D = async () => {
  THREE = await import('three')
  ;({ GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js'))
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
  await loadModelTemplates()
  rebuild()

  window.addEventListener('resize', onResize)
  window.addEventListener('click', onPick)
  c.addEventListener('mousedown', onDragStart)
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)
  c.addEventListener('wheel', onWheelZoom)
  c.addEventListener('dblclick', onDoubleClickNode)
  animate()
}

const buildStars = () => {
  const n = 2600
  const pos = new Float32Array(n * 3)
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const r = 1400 * Math.pow(Math.random(), 0.62)
    const t = Math.random() * Math.PI * 2
    const p = Math.acos(2 * Math.random() - 1)
    pos[i * 3] = r * Math.sin(p) * Math.cos(t)
    pos[i * 3 + 1] = r * Math.cos(p)
    pos[i * 3 + 2] = r * Math.sin(p) * Math.sin(t)

    const c = new THREE.Color(['#9cd4ff', '#ffd6a5', '#7ef9ff', '#c0b6ff'][i % 4])
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  stars = new THREE.Points(g, new THREE.PointsMaterial({ vertexColors: true, size: 1.9, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending }))
  scene.add(stars)
}

const clearMesh = (arr) => {
  arr.forEach(m => {
    scene.remove(m)
    if (m.userData?.tail) {
      scene.remove(m.userData.tail)
      m.userData.tail.geometry?.dispose?.()
      m.userData.tail.material?.dispose?.()
    }

    m.traverse?.((child) => {
      if (!child.isMesh) return
      child.geometry?.dispose?.()
      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => {
          mat.map?.dispose?.()
          mat.dispose?.()
        })
      } else {
        child.material?.map?.dispose?.()
        child.material?.dispose?.()
      }
    })

    m.geometry?.dispose?.()
    if (Array.isArray(m.material)) {
      m.material.forEach(x => {
        x.map?.dispose?.()
        x.dispose?.()
      })
    } else {
      m.material?.map?.dispose?.()
      m.material?.dispose?.()
    }
  })
  arr.length = 0
}

const buildGalaxies = (nodeList, relationList) => {
  const byId = new Map(nodeList.map(n => [n.id, n]))
  const adj = new Map(nodeList.map(n => [n.id, new Set()]))

  relationList.forEach((r) => {
    if (!adj.has(r.sourceId) || !adj.has(r.targetId)) return
    adj.get(r.sourceId).add(r.targetId)
    adj.get(r.targetId).add(r.sourceId)
  })

  const visited = new Set()
  const components = []

  nodeList.forEach((n) => {
    if (visited.has(n.id)) return
    const queue = [n.id]
    visited.add(n.id)
    const ids = []
    while (queue.length) {
      const cur = queue.shift()
      ids.push(cur)
      adj.get(cur)?.forEach((next) => {
        if (!visited.has(next)) {
          visited.add(next)
          queue.push(next)
        }
      })
    }
    const nodes = ids.map(id => byId.get(id)).filter(Boolean)
    components.push(nodes)
  })

  return components
    .sort((a, b) => b.length - a.length)
    .map((nodes, idx) => {
      const themes = new Map()
      nodes.forEach((n) => {
        if (!themes.has(n.themeId)) themes.set(n.themeId, [])
        themes.get(n.themeId).push(n)
      })
      return {
        id: `galaxy_${idx}`,
        nodes,
        themes: Array.from(themes.entries())
      }
    })
}

const rebuild = () => {
  clearMesh(nodeMeshes)
  clearMesh(helperMeshes)
  clearMesh(themeMeshes)
  clearMesh(relationLinks)

  const galaxies = buildGalaxies(visualNodes.value, visualRelations.value)
  const galaxyRadius = Math.max(220, 160 * Math.sqrt(galaxies.length + 1))

  galaxies.forEach((galaxy, gIdx) => {
    const ga = (gIdx / Math.max(1, galaxies.length)) * Math.PI * 2
    const gx = galaxyRadius * Math.cos(ga)
    const gz = galaxyRadius * Math.sin(ga)
    const gy = Math.sin(ga * 1.7) * 60

    const galaxyRing = new THREE.Mesh(
      new THREE.RingGeometry(48, 70 + galaxy.nodes.length * 2.2, 120),
      new THREE.MeshBasicMaterial({ color: themeColor(galaxy.id, gIdx), transparent: true, opacity: 0.12, side: THREE.DoubleSide })
    )
    galaxyRing.position.set(gx, gy, gz)
    galaxyRing.rotation.x = Math.PI / 2
    galaxyRing.userData = { kind: 'galaxy-ring' }
    scene.add(galaxyRing)
    helperMeshes.push(galaxyRing)

    const themeSpread = Math.max(60, 38 * Math.sqrt(galaxy.themes.length + 1))

    galaxy.themes.forEach(([themeId, list], i) => {
      const a = (i / Math.max(1, galaxy.themes.length)) * Math.PI * 2
      const tx = gx + themeSpread * Math.cos(a)
      const tz = gz + themeSpread * Math.sin(a)
      const ty = gy + Math.sin(a * 2.4) * 22
      const c = themeColor(themeId, gIdx * 13 + i)

      const sunTex = createPlanetTexture(c.clone().offsetHSL(0.02, 0.08, 0.12), i + 11)
      let sun
      if (modelTemplates.sun) {
        sun = modelTemplates.sun.clone(true)
        sun.scale.setScalar(11)
        tintModel(sun, c)
      } else {
        sun = new THREE.Mesh(
          new THREE.SphereGeometry(11, 24, 24),
          new THREE.MeshPhongMaterial({ map: sunTex, color: c, emissive: c.clone().multiplyScalar(0.45), shininess: 140, specular: new THREE.Color('#d9f3ff') })
        )
      }
      sun.position.set(tx, ty, tz)
      sun.userData = { kind: 'theme', themeId, themeName: list[0]?.themeName || '未归类' }
      scene.add(sun)
      themeMeshes.push(sun)

      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(16, 28, 28),
        new THREE.MeshBasicMaterial({ color: c.clone().offsetHSL(0.06, 0.04, 0.06), transparent: true, opacity: 0.16 })
      )
      shell.position.copy(sun.position)
      shell.userData = { kind: 'theme-shell', themeId }
      scene.add(shell)
      helperMeshes.push(shell)

      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(20 + list.length * 0.8, 0.7, 14, 100),
        new THREE.MeshBasicMaterial({ color: c.clone().offsetHSL(-0.08, 0.12, 0.12), transparent: true, opacity: 0.62 })
      )
      halo.position.copy(sun.position)
      halo.rotation.x = Math.PI * (0.32 + (i % 3) * 0.1)
      halo.rotation.y = (i % 5) * 0.42
      halo.userData = { kind: 'theme-halo', themeId }
      scene.add(halo)
      helperMeshes.push(halo)

      const orbit = new THREE.Mesh(
        new THREE.RingGeometry(20, 20 + list.length * 1.5, 80),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
      )
      orbit.position.set(tx, ty, tz)
      orbit.rotation.x = Math.PI / 2
      orbit.userData = { kind: 'orbit', themeId }
      scene.add(orbit)
      helperMeshes.push(orbit)

      const branches = new Map()
      list.forEach((n) => {
        const b = n.branchName || '未分支'
        if (!branches.has(b)) branches.set(b, [])
        branches.get(b).push(n)
      })
      const branchEntries = Array.from(branches.entries())

      branchEntries.forEach(([branchName, branchNotes], bIdx) => {
        const ba = (bIdx / Math.max(1, branchEntries.length)) * Math.PI * 2
        const br = 22 + branchEntries.length * 8
        const bx = tx + br * Math.cos(ba)
        const bz = tz + br * Math.sin(ba)
        const by = ty + Math.sin(ba * 2.2) * 6

        const branchOrbit = new THREE.Mesh(
          new THREE.RingGeometry(8, 8 + branchNotes.length * 1.4, 72),
          new THREE.MeshBasicMaterial({ color: c.clone().offsetHSL((bIdx % 5) * 0.03, 0.05, 0.08), transparent: true, opacity: 0.18, side: THREE.DoubleSide })
        )
        branchOrbit.position.set(bx, by, bz)
        branchOrbit.rotation.x = Math.PI / 2
        branchOrbit.userData = { kind: 'branch-orbit', themeId, branchName }
        scene.add(branchOrbit)
        helperMeshes.push(branchOrbit)

        branchNotes.forEach((n, j) => {
          const an = (j / Math.max(1, branchNotes.length)) * Math.PI * 2
          const rr = 10 + branchNotes.length * 2.6
          const nx = bx + rr * Math.cos(an)
          const nz = bz + rr * Math.sin(an)
          const ny = by + Math.sin(an * 2.1) * 5
          const hl = n.id === highlightId.value
          const col = hl ? new THREE.Color('#ff5d78') : c.clone().offsetHSL(0.03 + bIdx * 0.01, 0.03, -0.08)

          const size = hl ? 8 : 4.8 + ((j % 4) * 0.9)
          const planetTex = createPlanetTexture(col.clone(), j + i * 7 + bIdx * 13)
          let p
          const modelSource = j % 2 === 0 ? (modelTemplates.ringed || modelTemplates.planet) : modelTemplates.planet
          if (modelSource) {
            p = modelSource.clone(true)
            p.scale.setScalar(size)
            tintModel(p, col)
          } else {
            p = new THREE.Mesh(
              new THREE.SphereGeometry(size, 20, 20),
              new THREE.MeshPhongMaterial({ map: planetTex, color: col, emissive: col.clone().multiplyScalar(hl ? 0.55 : 0.28), shininess: 120, specular: new THREE.Color('#d7ecff') })
            )
          }
          p.position.set(nx, ny, nz)
          p.userData = { ...n, kind: 'planet', themeId, branchName, baseColor: col.clone(), galaxyId: galaxy.id }
          scene.add(p)
          nodeMeshes.push(p)

          if (!modelTemplates.ringed && j % 2 === 0) {
            const ring = new THREE.Mesh(
              new THREE.TorusGeometry(size * 1.55, 0.22 + size * 0.05, 10, 80),
              new THREE.MeshBasicMaterial({ color: c.clone().offsetHSL(0.04, 0.08, 0.12), transparent: true, opacity: 0.55 })
            )
            ring.position.copy(p.position)
            ring.rotation.x = Math.PI * 0.45
            ring.rotation.y = an
            ring.userData = { kind: 'planet-ring', themeId, branchName }
            scene.add(ring)
            helperMeshes.push(ring)
          }

          const link = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(bx, by, bz), new THREE.Vector3(nx, ny, nz)]),
            new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.22 })
          )
          link.userData = { kind: 'branch-link', themeId, branchName }
          scene.add(link)
          helperMeshes.push(link)
        })

        const centerLink = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(tx, ty, tz), new THREE.Vector3(bx, by, bz)]),
          new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.18 })
        )
        centerLink.userData = { kind: 'theme-branch-link', themeId, branchName }
        scene.add(centerLink)
        helperMeshes.push(centerLink)
      })
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
    rel.userData = { kind: 'relation', sourceThemeId: a.userData.themeId, targetThemeId: b.userData.themeId }
    scene.add(rel)
    relationLinks.push(rel)
  })

  applyThemeFocus()
}

const spawnMeteor = () => {
  if (!scene) return
  const colors = [0xff67b3, 0x50f5ff, 0xffd166, 0x7d8bff, 0x7bffaf, 0xffa954]
  const color = colors[Math.floor(Math.random() * colors.length)]

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(1.2 + Math.random() * 1.1, 10, 10),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
  )
  head.position.set(-540 + Math.random() * 180, 130 + Math.random() * 280, -220 + Math.random() * 440)

  const tailGeo = new THREE.BufferGeometry().setFromPoints([
    head.position.clone(),
    head.position.clone().add(new THREE.Vector3(-16, 5, 0))
  ])
  const tail = new THREE.Line(
    tailGeo,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 })
  )

  head.userData = {
    vx: 4.5 + Math.random() * 3.8,
    vy: -1.4 - Math.random() * 2,
    vz: (Math.random() - 0.5) * 1.6,
    life: 120 + Math.random() * 90,
    tail
  }

  scene.add(head)
  scene.add(tail)
  meteorMeshes.push(head)
}

const updateMeteors = () => {
  const now = performance.now()
  if (now > nextMeteorAt) {
    const probability = meteorBurst.value ? 0.42 : 0.07
    const meteorCount = meteorBurst.value ? 2 + Math.floor(Math.random() * 2) : 1
    if (Math.random() < probability) {
      for (let i = 0; i < meteorCount; i++) spawnMeteor()
    }
    nextMeteorAt = now + (meteorBurst.value ? 90 : 240)
  }
  for (let i = meteorMeshes.length - 1; i >= 0; i--) {
    const m = meteorMeshes[i]
    m.position.x += m.userData.vx
    m.position.y += m.userData.vy
    m.position.z += m.userData.vz
    m.userData.life -= 1
    m.material.opacity = Math.max(0, m.userData.life / 180)

    const tail = m.userData.tail
    const pts = [m.position.clone(), m.position.clone().add(new THREE.Vector3(-20, 6, -m.userData.vz * 8))]
    tail.geometry.setFromPoints(pts)
    tail.material.opacity = Math.max(0, m.userData.life / 240)

    if (m.userData.life <= 0 || m.position.x > 620 || m.position.y < -140) {
      scene.remove(m)
      scene.remove(tail)
      m.geometry?.dispose?.()
      m.material?.dispose?.()
      tail.geometry?.dispose?.()
      tail.material?.dispose?.()
      meteorMeshes.splice(i, 1)
    }
  }
}

const animate = () => {
  animationId = requestAnimationFrame(animate)
  camA += 0.0018
  userYaw += (targetYaw - userYaw) * 0.12
  userPitch += (targetPitch - userPitch) * 0.12
  camRadius += (targetRadius - camRadius) * 0.1
  const autoX = camRadius * Math.sin(camA)
  const autoZ = camRadius * Math.cos(camA)
  const autoY = 120 + Math.sin(camA * 1.4) * 18

  const dragX = camRadius * Math.sin(userYaw) * Math.cos(userPitch)
  const dragZ = camRadius * Math.cos(userYaw) * Math.cos(userPitch)
  const dragY = camRadius * Math.sin(userPitch)

  camera.position.x = autoX + dragX * 0.65
  camera.position.z = autoZ + dragZ * 0.65
  camera.position.y = autoY + dragY * 0.55
  camera.lookAt(0, 0, 0)
  nodeMeshes.forEach((m) => {
    m.rotation.y += 0.005
  })
  helperMeshes.forEach((m) => {
    if (!m.userData?.kind) return
    if (m.userData.kind === 'theme-halo') m.rotation.z += 0.003
    if (m.userData.kind === 'planet-ring') m.rotation.z += 0.006
  })
  stars.rotation.y += 0.0002
  updatePlanetLabels()
  updateMeteors()
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
  if (dragMoved.value) {
    dragMoved.value = false
    return
  }
  if (!raycaster || !pointer || !camera) return
  const r = canvasRef.value.getBoundingClientRect()
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)

  const planetHit = raycaster.intersectObjects(nodeMeshes, true)
  if (planetHit.length) {
    const carrier = getCarrierObject(planetHit[0].object)
    if (!carrier) return
    selectedNode.value = carrier.userData
    focusThemeId.value = carrier.userData.themeId || ''
    focusBranch.value = carrier.userData.branchName || ''
    filterTag.value = carrier.userData.themeId || ''
    filterBranch.value = carrier.userData.branchName || ''
    applyThemeFocus()
    return
  }

  const themeHit = raycaster.intersectObjects(themeMeshes, true)
  if (themeHit.length) {
    const carrier = getCarrierObject(themeHit[0].object)
    if (!carrier) return
    const tid = carrier.userData.themeId || ''
    focusThemeId.value = tid
    filterTag.value = tid
    const options = branchOptions.value
    if (!options.length) {
      filterBranch.value = ''
      focusBranch.value = ''
    } else if (!options.includes(filterBranch.value)) {
      filterBranch.value = options[0]
      focusBranch.value = options[0]
    }
    applyThemeFocus()
    return
  }

  selectedNode.value = null
  focusThemeId.value = ''
  focusBranch.value = ''
  applyThemeFocus()
}

const onDragStart = (e) => {
  isDragging.value = true
  dragMoved.value = false
  dragStart = { x: e.clientX, y: e.clientY }
}

const onDragMove = (e) => {
  if (!isDragging.value) return
  const dx = e.clientX - dragStart.x
  const dy = e.clientY - dragStart.y
  if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved.value = true
  userYaw += dx * 0.005
  userPitch += dy * 0.003
  userPitch = Math.max(-0.9, Math.min(0.9, userPitch))
  targetYaw = userYaw
  targetPitch = userPitch
  dragStart = { x: e.clientX, y: e.clientY }
}

const onDragEnd = () => {
  isDragging.value = false
}

const onWheelZoom = (e) => {
  e.preventDefault()
  targetRadius += e.deltaY * 0.18
  targetRadius = Math.max(180, Math.min(700, targetRadius))
}

const updatePlanetLabels = () => {
  if (!camera || !canvasRef.value) return
  const w = canvasRef.value.clientWidth
  const h = canvasRef.value.clientHeight
  const list = []
  nodeMeshes.forEach((m) => {
    const p = m.position.clone().project(camera)
    if (p.z < -1 || p.z > 1) return
    const x = ((p.x + 1) / 2) * w
    const y = ((-p.y + 1) / 2) * h
    if (x < 0 || x > w || y < 0 || y > h) return
    list.push({ id: m.userData.id, text: `${m.userData.themeName || '未归类'} · ${m.userData.branchName || '未分支'}`, x, y: y - 24 })
  })
  planetLabels.value = list
}

const applyThemeFocus = () => {
  const tid = focusThemeId.value
  const bid = focusBranch.value
  nodeMeshes.forEach((m) => {
    const activeTheme = !tid || m.userData.themeId === tid
    const activeBranch = !bid || m.userData.branchName === bid
    const active = activeTheme && activeBranch
    m.scale.setScalar(active ? 1.08 : 0.86)
    m.traverse?.((child) => {
      if (!child.isMesh || !child.material) return
      child.material.opacity = active ? 1 : 0.22
      child.material.transparent = !active
    })
    if (m.material) {
      m.material.opacity = active ? 1 : 0.22
      m.material.transparent = !active
    }
  })
  helperMeshes.forEach((l) => {
    if (!l.userData?.themeId) return
    const activeTheme = !tid || l.userData.themeId === tid
    const activeBranch = !bid || !l.userData.branchName || l.userData.branchName === bid
    const active = activeTheme && activeBranch
    l.material.opacity = active ? 0.42 : 0.06
  })
  relationLinks.forEach((l) => {
    const activeTheme = !tid || l.userData.sourceThemeId === tid || l.userData.targetThemeId === tid
    l.material.opacity = activeTheme ? 0.22 : 0.04
  })
  themeMeshes.forEach((m) => {
    const active = !tid || m.userData.themeId === tid
    m.scale.setScalar(active ? 1.12 : 0.9)
  })
}

const onDoubleClickNode = (e) => {
  if (!raycaster || !pointer || !camera) return
  const r = canvasRef.value.getBoundingClientRect()
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(nodeMeshes, true)
  if (!hit.length) return
  const carrier = getCarrierObject(hit[0].object)
  if (!carrier) return
  const target = carrier.position
  targetRadius = Math.max(180, Math.min(280, target.length() + 120))
  targetYaw = Math.atan2(target.x, target.z)
  targetPitch = Math.atan2(target.y, Math.sqrt(target.x * target.x + target.z * target.z))
  selectedNode.value = carrier.userData
  focusThemeId.value = carrier.userData.themeId || ''
  focusBranch.value = carrier.userData.branchName || ''
  filterTag.value = carrier.userData.themeId || ''
  filterBranch.value = carrier.userData.branchName || ''
  applyThemeFocus()
}

const toggleMeteorMode = () => {
  meteorBurst.value = !meteorBurst.value
}

const deleteCurrentTheme = async () => {
  const themeId = activeThemeId.value
  if (!themeId) return
  const tag = allTags.value.find(t => t.id === themeId)
  if (!tag) return
  if (!confirm(`确定删除主题「${tag.name}」吗？`)) return
  await noteStore.deleteTag(tag.id)
  await graphStore.fetchGraphData()
  await noteStore.fetchTags()
  filterTag.value = ''
  focusThemeId.value = ''
  selectedNode.value = null
}

const resetCamera = () => {
  camA = 0
  targetRadius = 390
  targetYaw = 0
  targetPitch = 0
  focusThemeId.value = ''
  focusBranch.value = ''
  filterTag.value = ''
  filterBranch.value = ''
  applyThemeFocus()
}

const focusSameBranch = (node) => {
  if (!node) return
  filterTag.value = node.themeId || ''
  filterBranch.value = node.branchName || ''
  focusThemeId.value = node.themeId || ''
  focusBranch.value = node.branchName || ''
  applyThemeFocus()
}
const expandNode = async (id) => { await graphStore.expandNode(id) }
const goToNote = (id) => router.push('/note/' + id)
</script>

<style scoped>
.graph-page{animation:fade .3s ease}.panel{background:rgba(8,14,32,.78);border:1px solid rgba(142,170,255,.16);box-shadow:0 18px 48px rgba(0,0,0,.35);backdrop-filter:blur(14px)}
.head{border-radius:14px;padding:1rem 1.1rem;margin-bottom:1rem;display:flex;justify-content:space-between;gap:1rem;align-items:center}.head h2{margin:0;color:#eef4ff}.head p{margin:.3rem 0 0;color:#b9c8ea;font-size:.9rem}
.ctrl{display:flex;gap:.6rem}.sel{padding:.55rem .8rem;border:1px solid rgba(149,170,255,.2);border-radius:10px;background:rgba(8,14,30,.8);color:#eff3ff}.btn{padding:.52rem .9rem;border-radius:9px;border:1px solid rgba(149,170,255,.16);background:rgba(112,131,199,.16);color:#e9f1ff;cursor:pointer}.btn:disabled{opacity:.45;cursor:not-allowed}.btn.danger{background:rgba(255,90,115,.16);border-color:rgba(255,118,148,.34);color:#ffd9e2}.primary{background:linear-gradient(135deg,#5f7cff,#8d52ff);border:none}
.banner{display:flex;justify-content:space-between;align-items:center;background:rgba(255,98,124,.15);border:1px solid rgba(255,129,149,.4);border-radius:10px;padding:.58rem .9rem;margin-bottom:.9rem;color:#ffd9e0}
.banner button{background:none;border:none;color:#ffd9e0;cursor:pointer}
.layout{display:grid;grid-template-columns:1fr 280px;gap:1rem;height:650px}.stage{position:relative;border-radius:14px;overflow:hidden;cursor:grab;background:radial-gradient(circle at 20% 20%, rgba(83,136,255,0.16), transparent 35%),radial-gradient(circle at 80% 65%, rgba(255,120,180,0.14), transparent 38%),#020612}.stage:active{cursor:grabbing}.canvas{width:100%;height:100%}.label-layer{position:absolute;inset:0;pointer-events:none}.planet-label{position:absolute;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:700;color:#f8fcff;background:rgba(15,28,64,.66);border:1px solid rgba(173,201,255,.48);text-shadow:0 0 8px rgba(156,210,255,.75),0 0 18px rgba(255,103,179,.35);box-shadow:0 0 14px rgba(110,157,255,.28);white-space:nowrap;transform:translate(-50%,-50%)}.overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#d0dcfb}
.side{border-radius:14px;padding:1rem;overflow:auto;color:#d2def6}.side h3{margin:0 0 .45rem;color:#eef4ff}.meta{font-size:.85rem;color:#b7c7ec}.txt{font-size:.9rem;line-height:1.55}.img{width:100%;border-radius:10px;border:1px solid rgba(149,170,255,.2);margin:.7rem 0}
.tags{display:flex;flex-wrap:wrap;gap:.28rem;margin-bottom:.7rem}.tags span{background:rgba(103,126,234,.85);color:#fff;padding:.18rem .45rem;border-radius:6px;font-size:.75rem}.act{display:flex;gap:.45rem;flex-wrap:wrap}
@keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:980px){.layout{grid-template-columns:1fr;height:auto}.stage{height:520px}}
</style>
