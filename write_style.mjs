import fs from 'fs'
const content = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
  --bg-0: #030611;
  --bg-1: #081127;
  --bg-2: #120f2b;
  --text-main: #eef3ff;
  --text-soft: #a9b4d0;
  --panel-bg: rgba(9, 16, 36, 0.76);
  --panel-line: rgba(141, 169, 255, 0.14);
  --panel-glow: 0 20px 60px rgba(0, 0, 0, 0.35);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  min-height: 100%;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, var(--bg-0) 0%, var(--bg-1) 42%, var(--bg-2) 100%);
  color: var(--text-main);
  overflow-x: hidden;
  text-rendering: optimizeLegibility;
}

body::selection,
textarea::selection,
input::selection {
  background: rgba(109, 140, 255, 0.35);
  color: #ffffff;
}

a {
  color: inherit;
}

input, textarea, select, button {
  font: inherit;
}

input, textarea, select {
  caret-color: #8eb3ff;
}

.card {
  @apply rounded-2xl p-6 transition-all duration-300;
  background: var(--panel-bg);
  border: 1px solid var(--panel-line);
  box-shadow: var(--panel-glow);
  backdrop-filter: blur(14px);
}

.btn-primary {
  @apply px-4 py-2 rounded-lg transition-colors;
  background: linear-gradient(135deg, #5f7cff, #8d52ff);
  color: white;
}

.btn-secondary {
  @apply px-4 py-2 rounded-lg transition-colors;
  background: rgba(111, 128, 184, 0.2);
  color: #eef3ff;
  border: 1px solid rgba(150, 170, 255, 0.2);
}

.input-field {
  @apply w-full px-4 py-2 rounded-lg focus:outline-none;
  border: 1px solid rgba(155, 176, 255, 0.26);
  background: rgba(6, 12, 28, 0.84);
  color: #f5f8ff;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 30px rgba(0,0,0,0.12);
}

.input-field:focus {
  border-color: rgba(114, 150, 255, 0.55);
  box-shadow: 0 0 0 4px rgba(91, 122, 255, 0.14), inset 0 1px 0 rgba(255,255,255,0.05);
}

.input-field::placeholder,
textarea::placeholder {
  color: #9fb0d6;
}

.modal-overlay {
  @apply fixed inset-0 flex items-center justify-center z-50;
  background: rgba(1, 4, 14, 0.65);
  backdrop-filter: blur(8px);
}

.modal-content {
  @apply rounded-2xl p-8 max-w-2xl w-full mx-4;
  background: rgba(10, 18, 39, 0.84);
  border: 1px solid rgba(151, 176, 255, 0.14);
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.42);
}

.canvas-container {
  @apply w-full h-96 rounded-lg overflow-hidden;
  box-shadow: var(--panel-glow);
}

.graph-node {
  @apply cursor-pointer transition-all duration-200;
}

.graph-node:hover {
  @apply scale-110;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes slideIn {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

.slide-in {
  animation: slideIn 0.3s ease-in-out;
}
`
fs.writeFileSync('d:/cursor/cursor_programe1/zhilianweiji/frontend/src/style.css', content, 'utf8')
console.log('style.css updated')
