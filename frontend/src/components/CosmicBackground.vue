<template>
  <div class="cosmic-shell" aria-hidden="true">
    <canvas ref="canvasRef" class="cosmic-canvas"></canvas>
    <div class="cosmic-vignette"></div>
    <div class="cosmic-grid"></div>
    <div class="cosmic-orbit"></div>
    <div class="cosmic-nebula cosmic-nebula-a"></div>
    <div class="cosmic-nebula cosmic-nebula-b"></div>
    <div class="cosmic-nebula cosmic-nebula-c"></div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'

const canvasRef = ref(null)
let animationId = null
let ctx = null
let width = 0
let height = 0
let particles = []
let stars = []
let mouse = { x: 0.5, y: 0.5, active: false }

const createStar = () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.35, a: Math.random() * 0.7 + 0.18, tw: Math.random() * Math.PI * 2 })
const createParticle = () => ({ x: Math.random() * width, y: Math.random() * height, z: Math.random() * 1.2 + 0.2, vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22, size: Math.random() * 2.8 + 0.8, hue: 185 + Math.random() * 95, alpha: Math.random() * 0.6 + 0.22 })

const resize = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  width = window.innerWidth
  height = window.innerHeight
  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
  ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const particleCount = Math.max(100, Math.min(220, Math.floor(width / 10)))
  const starCount = Math.max(140, Math.min(280, Math.floor(width / 7)))
  particles = Array.from({ length: particleCount }, createParticle)
  stars = Array.from({ length: starCount }, createStar)
}

const drawBackground = () => {
  const g = ctx.createLinearGradient(0, 0, width, height)
  g.addColorStop(0, '#02040b')
  g.addColorStop(0.32, '#091228')
  g.addColorStop(0.64, '#140f2f')
  g.addColorStop(1, '#02050b')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, width, height)
}

const drawStars = (time) => {
  for (const s of stars) {
    const pulse = (Math.sin(time * 0.0012 + s.tw) + 1) * 0.18
    ctx.beginPath()
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, s.a + pulse)})`
    ctx.arc(s.x * width, s.y * height, s.r + pulse, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawConnections = () => {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const a = particles[i]
      const b = particles[j]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (dist > 125) continue
      const alpha = (1 - dist / 125) * 0.18 * Math.min(a.z, b.z)
      ctx.beginPath()
      ctx.strokeStyle = `rgba(120,170,255,${alpha})`
      ctx.lineWidth = 1
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
  }
}

const drawParticles = (time) => {
  const driftX = mouse.active ? (mouse.x - 0.5) * 0.55 : 0.04
  const driftY = mouse.active ? (mouse.y - 0.5) * 0.34 : -0.02
  for (const p of particles) {
    p.x += p.vx + driftX * p.z
    p.y += p.vy + driftY * p.z
    if (p.x < -40) p.x = width + 40
    if (p.x > width + 40) p.x = -40
    if (p.y < -40) p.y = height + 40
    if (p.y > height + 40) p.y = -40
    const flicker = (Math.sin(time * 0.002 + p.x * 0.01 + p.y * 0.01) + 1) * 0.1
    ctx.beginPath()
    ctx.fillStyle = `hsla(${p.hue}, 95%, 72%, ${p.alpha + flicker})`
    ctx.shadowBlur = 22 * p.z
    ctx.shadowColor = `hsla(${p.hue}, 100%, 70%, 0.52)`
    ctx.arc(p.x, p.y, p.size * p.z, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.shadowBlur = 0
}

const animate = (time = 0) => {
  if (!ctx) return
  drawBackground()
  drawStars(time)
  drawConnections()
  drawParticles(time)
  animationId = requestAnimationFrame(animate)
}

const handleMouseMove = (e) => {
  mouse = { x: e.clientX / Math.max(window.innerWidth, 1), y: e.clientY / Math.max(window.innerHeight, 1), active: true }
}
const handleLeave = () => { mouse.active = false }

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseleave', handleLeave)
  animate()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseleave', handleLeave)
  if (animationId) cancelAnimationFrame(animationId)
})
</script>

<style scoped>
.cosmic-shell { position: fixed; inset: 0; overflow: hidden; z-index: 0; pointer-events: none; background: radial-gradient(circle at 20% 18%, rgba(78, 134, 255, 0.24), transparent 30%), radial-gradient(circle at 78% 20%, rgba(159, 79, 255, 0.22), transparent 28%), radial-gradient(circle at 48% 82%, rgba(0, 228, 255, 0.16), transparent 24%); }
.cosmic-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.cosmic-vignette { position: absolute; inset: 0; background: radial-gradient(circle at center, transparent 32%, rgba(0,0,0,0.34) 100%); }
.cosmic-grid { position: absolute; inset: 0; opacity: 0.1; background-image: linear-gradient(rgba(120, 160, 255, 0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(120, 160, 255, 0.18) 1px, transparent 1px); background-size: 44px 44px; transform: perspective(1000px) rotateX(76deg) scale(1.8) translateY(28%); transform-origin: center bottom; }
.cosmic-orbit { position: absolute; inset: 0; background: radial-gradient(circle at 50% 50%, transparent 0 36%, rgba(122, 149, 255, 0.08) 36.5%, transparent 37%), radial-gradient(circle at 50% 50%, transparent 0 48%, rgba(122, 149, 255, 0.05) 48.5%, transparent 49%); opacity: 0.65; }
.cosmic-nebula { position: absolute; width: 46vw; height: 46vw; filter: blur(46px); opacity: 0.22; border-radius: 50%; animation: drift 18s ease-in-out infinite alternate; }
.cosmic-nebula-a { left: -10vw; top: 8vh; background: radial-gradient(circle, rgba(0, 210, 255, 0.62), transparent 64%); }
.cosmic-nebula-b { right: -8vw; bottom: -8vh; background: radial-gradient(circle, rgba(164, 92, 255, 0.58), transparent 60%); animation-duration: 24s; }
.cosmic-nebula-c { left: 24vw; bottom: -16vh; background: radial-gradient(circle, rgba(59, 130, 246, 0.3), transparent 62%); animation-duration: 20s; }
@keyframes drift { from { transform: translate3d(0, 0, 0) scale(1); } to { transform: translate3d(6vw, -2vh, 0) scale(1.16); } }
</style>
