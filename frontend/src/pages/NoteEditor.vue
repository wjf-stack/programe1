<template>
  <div class="editor-page">
    <div class="editor-header panel">
      <input v-model="title" class="title-input" placeholder="输入标题...">
      <div class="editor-actions">
        <button @click="saveNote" class="btn-save" :disabled="saving || uploadingImage">{{ saving ? '保存中...' : '保存' }}</button>
        <button @click="autoSave" class="btn-auto">自动保存</button>
        <button @click="triggerImagePicker" class="btn-image" :disabled="uploadingImage">{{ uploadingImage ? '上传图片中...' : '插入图片' }}</button>
        <router-link to="/dashboard" class="btn-back">返回</router-link>
      </div>
      <input ref="imageInputRef" type="file" accept="image/*" class="hidden-file-input" @change="handleFileSelect">
    </div>

    <div class="editor-body">
      <div class="editor-left">
        <div class="paste-tip panel-soft">
          支持 <strong>Ctrl+V 粘贴图片</strong> 与“插入图片”，图片会自动上传并插入正文。
        </div>

        <div v-if="contentImages.length" class="image-preview panel">
          <div class="preview-header">截图预览（{{ contentImages.length }}）</div>
          <div class="preview-grid">
            <img
              v-for="(img, idx) in contentImages"
              :key="img + idx"
              :src="img"
              class="preview-img"
              alt="截图预览"
              @click="openImagePreview(img)"
            />
          </div>
        </div>

        <textarea
          ref="contentRef"
          v-model="content"
          class="content-area panel"
          placeholder="开始记录你的知识...

支持文本记录、截图说明、图片粘贴上传。
快捷键 Ctrl+S 保存，Ctrl+V 可直接粘贴图片。"
          @paste="handlePaste"
        ></textarea>
      </div>

      <div class="editor-right">
        <div class="tags-panel panel">
          <h4>标签</h4>
          <div class="selected-tags">
            <span v-for="tag in selectedTags" :key="tag.id" class="tag-badge">
              {{ tag.name }}
              <button @click="removeTag(tag)" class="tag-remove" title="仅从当前笔记移除">×</button>
              <button @click="deleteTheme(tag)" class="tag-delete" title="删除该主题（全局）">🗑</button>
            </span>
          </div>
          <div class="tag-input-row">
            <input v-model="newTagName" placeholder="新建标签..." @keyup.enter="addTag" class="tag-input">
            <button @click="addTag" class="btn-add-tag">+</button>
          </div>
          <div class="tag-suggestions">
            <span v-for="tag in availableTags" :key="tag.id" class="tag-suggest" @click="selectTag(tag)">{{ tag.name }}</span>
          </div>
        </div>

        <div class="note-type-panel panel">
          <h4>记录类型</h4>
          <label v-for="type in noteTypes" :key="type.value" class="type-option">
            <input type="radio" v-model="noteType" :value="type.value">
            {{ type.label }}
          </label>
          <div class="branch-row">
            <input v-model="branch" class="branch-input" placeholder="分支（如：概念 / 方法 / 案例）" />
          </div>
          <p class="type-help" v-if="noteType === 'rich'">富文本记录：适合结构化内容（标题、分段、列表），当前可用 Markdown 语法组织。</p>
        </div>

        <div class="related-panel panel" v-if="relatedNotes.length > 0">
          <h4>关联笔记</h4>
          <div v-for="note in relatedNotes" :key="note.id" class="related-item" @click="openNote(note.id)">
            <p>{{ note.title }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="saveSuccess" class="save-toast">保存成功</div>
    <div v-if="uploadMessage" class="upload-toast">{{ uploadMessage }}</div>

    <div v-if="previewImageUrl" class="image-modal" @click="closeImagePreview">
      <img :src="previewImageUrl" class="image-modal-content" alt="大图预览" @click.stop>
      <button class="image-modal-close" @click="closeImagePreview">✕</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNoteStore } from '../stores/note'
import { fileAPI } from '../api'

const route = useRoute()
const router = useRouter()
const noteStore = useNoteStore()

const contentRef = ref(null)
const imageInputRef = ref(null)
const title = ref('')
const content = ref('')
const noteType = ref('quick')
const branch = ref('')
const newTagName = ref('')
const selectedTags = ref([])
const saving = ref(false)
const saveSuccess = ref(false)
const relatedNotes = ref([])
const uploadingImage = ref(false)
const uploadMessage = ref('')
const previewImageUrl = ref('')

const noteTypes = [
  { value: 'quick', label: '快速笔记' },
  { value: 'rich', label: '富文本记录' },
  { value: 'clip', label: '网页摘录' }
]

const availableTags = computed(() =>
  noteStore.tags.filter(t => !selectedTags.value.find(s => s.id === t.id))
)

const contentImages = computed(() => {
  const md = content.value || ''
  const regex = /!\[[^\]]*\]\(([^)]+)\)/g
  const imgs = []
  let m
  while ((m = regex.exec(md)) !== null) {
    if (m[1]) imgs.push(m[1])
  }
  return imgs
})

const isEdit = computed(() => route.params.id && route.params.id !== 'new')

onMounted(async () => {
  await noteStore.fetchTags()
  if (isEdit.value) {
    const note = await noteStore.fetchNote(route.params.id)
    title.value = note.title || ''
    content.value = note.content || ''
    noteType.value = note.type || 'quick'
    branch.value = note.branch || ''
    selectedTags.value = note.tags || []
  }
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})

const handleKeydown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    saveNote()
  }
}

const saveNote = async () => {
  saving.value = true
  try {
    const data = {
      title: title.value || '无标题',
      content: content.value,
      type: noteType.value,
      branch: branch.value,
      tagIds: selectedTags.value.map(t => t.id)
    }
    if (isEdit.value) {
      await noteStore.updateNote(route.params.id, data)
    } else {
      const note = await noteStore.createNote(data)
      router.replace('/note/' + note.id)
    }
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 2000)
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}

const autoSave = () => saveNote()

const addTag = async () => {
  if (!newTagName.value.trim()) return
  const tag = await noteStore.createTag(newTagName.value.trim())
  selectedTags.value.push(tag)
  newTagName.value = ''
}

const selectTag = (tag) => {
  if (!selectedTags.value.find(t => t.id === tag.id)) selectedTags.value.push(tag)
}

const removeTag = (tag) => {
  selectedTags.value = selectedTags.value.filter(t => t.id !== tag.id)
}

const deleteTheme = async (tag) => {
  if (!confirm(`确定删除主题「${tag.name}」吗？`)) return
  await noteStore.deleteTag(tag.id)
  selectedTags.value = selectedTags.value.filter(t => t.id !== tag.id)
}

const openNote = (id) => {
  router.push('/note/' + id)
}

const triggerImagePicker = () => {
  imageInputRef.value?.click()
}

const openImagePreview = (url) => {
  previewImageUrl.value = url
}

const closeImagePreview = () => {
  previewImageUrl.value = ''
}

const handleFileSelect = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  await insertImageFile(file)
  event.target.value = ''
}

const handlePaste = async (event) => {
  const items = Array.from(event.clipboardData?.items || [])
  const imageItem = items.find(item => item.type.startsWith('image/'))
  if (!imageItem) return
  event.preventDefault()
  const file = imageItem.getAsFile()
  if (file) await insertImageFile(file)
}

const insertImageFile = async (file) => {
  uploadingImage.value = true
  uploadMessage.value = '正在上传图片...'
  try {
    const res = await fileAPI.upload(file)
    const imageUrl = res.url || ''
    const markdown = `\n![${file.name || '图片'}](${imageUrl})\n`
    insertAtCursor(markdown)
    uploadMessage.value = '图片已插入正文'
    setTimeout(() => { uploadMessage.value = '' }, 1800)
  } catch (error) {
    console.error(error)
    uploadMessage.value = '图片上传失败'
    setTimeout(() => { uploadMessage.value = '' }, 2200)
  } finally {
    uploadingImage.value = false
  }
}

const insertAtCursor = (text) => {
  const textarea = contentRef.value
  if (!textarea) {
    content.value += text
    return
  }
  const start = textarea.selectionStart ?? content.value.length
  const end = textarea.selectionEnd ?? content.value.length
  content.value = content.value.slice(0, start) + text + content.value.slice(end)
  requestAnimationFrame(() => {
    textarea.focus()
    const next = start + text.length
    textarea.setSelectionRange(next, next)
  })
}
</script>

<style scoped>
.editor-page { min-height: calc(100vh - 80px); display: flex; flex-direction: column; animation: fadeIn 0.35s ease; }
.panel { background: rgba(9, 16, 36, 0.84); border: 1px solid rgba(141, 169, 255, 0.14); box-shadow: 0 18px 50px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.03); backdrop-filter: blur(18px); }
.panel-soft { margin-bottom: 1rem; padding: 0.9rem 1rem; border-radius: 14px; color: #d9e5ff; font-size: 0.92rem; background: linear-gradient(135deg, rgba(40,64,130,0.58), rgba(69,31,126,0.4)); border: 1px solid rgba(140,170,255,0.16); }
.editor-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; padding: 1rem 1.2rem; border-radius: 18px; }
.title-input { flex: 1; font-size: 1.35rem; font-weight: 700; border: none; outline: none; color: #f4f7ff; background: rgba(255,255,255,0.04); border-radius: 12px; padding: 0.9rem 1rem; }
.title-input::placeholder { color: #c1cceb; }
.editor-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.btn-save,.btn-auto,.btn-back,.btn-image { padding: 0.68rem 1rem; border-radius: 10px; cursor: pointer; text-decoration: none; font-size: 0.92rem; border: 1px solid transparent; }
.btn-save { background: linear-gradient(135deg,#5f7cff,#8d52ff); color: white; font-weight: 700; }
.btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-auto,.btn-back { background: rgba(112,131,199,0.14); color: #eef3ff; border-color: rgba(149,170,255,0.16); }
.btn-image { background: linear-gradient(135deg, rgba(0,202,255,0.22), rgba(112,68,255,0.22)); color: #f2f7ff; border-color: rgba(123,184,255,0.22); }
.hidden-file-input { display: none; }
.editor-body { display: grid; grid-template-columns: 1fr 300px; gap: 1.5rem; flex: 1; }
.editor-left { display: flex; flex-direction: column; }
.image-preview { border-radius: 14px; padding: 0.9rem; margin-bottom: 0.8rem; }
.preview-header { font-size: 0.84rem; color: #c8d7ff; margin-bottom: 0.6rem; }
.preview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 0.55rem; }
.preview-img { width: 100%; height: 78px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(146, 170, 255, 0.22); background: #050a16; cursor: zoom-in; }
.content-area { flex: 1; min-height: 540px; padding: 1.4rem; border-radius: 18px; font-size: 1rem; line-height: 1.8; resize: vertical; outline: none; font-family: inherit; color: #f2f6ff; background: rgba(7, 12, 26, 0.84); }
.content-area::placeholder { color: #a4b3d8; }
.content-area:focus { border-color: rgba(115,150,255,0.28); box-shadow: 0 0 0 4px rgba(91,122,255,0.14), 0 20px 50px rgba(0,0,0,0.35); }
.editor-right { display: flex; flex-direction: column; gap: 1rem; }
.tags-panel,.note-type-panel,.related-panel { padding: 1.2rem; border-radius: 18px; }
.tags-panel h4,.note-type-panel h4,.related-panel h4 { margin: 0 0 0.8rem 0; color: #f1f5ff; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.08em; }
.selected-tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.8rem; min-height: 1.5rem; }
.tag-badge { background: linear-gradient(135deg,#5f7cff,#8d52ff); color: white; padding: 0.25rem 0.6rem; border-radius: 999px; font-size: 0.8rem; display: flex; align-items: center; gap: 0.25rem; }
.tag-remove { background: none; border: none; color: white; cursor: pointer; font-size: 0.95rem; padding: 0; line-height: 1; }
.tag-delete { background: none; border: none; color: #ffd8d8; cursor: pointer; font-size: 0.78rem; padding: 0; margin-left: 2px; }
.tag-delete:hover { color: #ff8f8f; }
.tag-input-row { display: flex; gap: 0.4rem; margin-bottom: 0.6rem; }
.tag-input { flex: 1; padding: 0.75rem 0.85rem; border: 1px solid rgba(156,176,255,0.18); border-radius: 10px; font-size: 0.9rem; outline: none; color: #f0f5ff; background: rgba(255,255,255,0.05); }
.tag-input::placeholder { color: #a2b1d5; }
.tag-input:focus { border-color: #7a98ff; box-shadow: 0 0 0 3px rgba(122,152,255,0.12); }
.btn-add-tag { padding: 0.4rem 0.9rem; background: linear-gradient(135deg,#5f7cff,#8d52ff); color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 1rem; }
.tag-suggestions { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.tag-suggest { background: rgba(111,131,199,0.12); color: #d9e7ff; padding: 0.35rem 0.7rem; border-radius: 999px; font-size: 0.8rem; cursor: pointer; border: 1px solid rgba(155,176,255,0.14); transition: all 0.2s; }
.tag-suggest:hover { background: #667eea; color: white; }
.type-option { display: flex; align-items: center; gap: 0.55rem; margin-bottom: 0.65rem; cursor: pointer; color: #eef3ff; font-size: 0.95rem; }
.type-help { margin: 0.4rem 0 0; color: #a9bbe6; font-size: 0.82rem; line-height: 1.5; }
.branch-row { margin-top: .35rem; }
.branch-input { width:100%; padding:.62rem .75rem; border-radius:10px; border:1px solid rgba(156,176,255,.18); background:rgba(255,255,255,.05); color:#f0f5ff; outline:none; }
.branch-input::placeholder { color:#a2b1d5; }
.branch-input:focus { border-color:#7a98ff; box-shadow:0 0 0 3px rgba(122,152,255,.12); }
.related-item { padding: 0.75rem; border-radius: 12px; cursor: pointer; border: 1px solid rgba(149,170,255,0.12); margin-bottom: 0.5rem; background: rgba(255,255,255,0.03); }
.related-item:hover { border-color: #667eea; background: rgba(102,126,234,0.12); }
.related-item p { margin: 0; font-size: 0.88rem; color: #eef3ff; }
.save-toast,.upload-toast { position: fixed; bottom: 2rem; right: 2rem; color: white; padding: 0.9rem 1.4rem; border-radius: 12px; box-shadow: 0 12px 30px rgba(0,0,0,0.25); animation: fadeIn 0.3s ease; z-index: 10; }
.image-modal { position: fixed; inset: 0; background: rgba(5, 10, 22, 0.86); display: flex; align-items: center; justify-content: center; z-index: 30; }
.image-modal-content { max-width: min(92vw, 1200px); max-height: 88vh; border-radius: 12px; border: 1px solid rgba(150, 178, 255, 0.35); box-shadow: 0 18px 48px rgba(0,0,0,0.5); }
.image-modal-close { position: absolute; top: 16px; right: 20px; border: none; background: rgba(255,255,255,0.12); color: #fff; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-size: 16px; }
.save-toast { background: linear-gradient(135deg,#22c55e,#0f9f73); }
.upload-toast { background: linear-gradient(135deg,#2563eb,#7c3aed); bottom: 5.5rem; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 980px) { .editor-body { grid-template-columns: 1fr; } }
</style>
