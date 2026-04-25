import assert from 'node:assert/strict'

const base = 'http://127.0.0.1:3000'
const email = `qa_${Date.now()}@test.com`
const password = '123456'

const j = (r) => r.json()

const register = await fetch(`${base}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'QA用户', email, password })
})
assert.equal(register.status, 201)
const regData = await j(register)
assert.ok(regData.token)
const token = regData.token
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

const createTag = await fetch(`${base}/tags`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ name: '宇宙主题' })
})
assert.equal(createTag.status, 201)
const tag = await j(createTag)

const noteContent = `这是一条测试\n\n![截图](${base}/uploads/demo.png)\n\n来源: http://localhost:5173/dashboard`
const createNote = await fetch(`${base}/notes`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ title: '宇宙知识', content: noteContent, type: 'clip', tagIds: [tag.id] })
})
assert.equal(createNote.status, 201)
const note = await j(createNote)
assert.equal(note.tags.length, 1)

const notesList = await fetch(`${base}/notes?page=1&limit=20`, { headers: { Authorization: `Bearer ${token}` } })
assert.equal(notesList.status, 200)
const notesData = await j(notesList)
assert.ok(Array.isArray(notesData.data))

const graphNodes = await fetch(`${base}/graph/nodes`, { headers: { Authorization: `Bearer ${token}` } })
assert.equal(graphNodes.status, 200)
const nodes = await j(graphNodes)
assert.ok(nodes.some(n => n.id === note.id))

const graphRelations = await fetch(`${base}/graph/relations`, { headers: { Authorization: `Bearer ${token}` } })
assert.equal(graphRelations.status, 200)
await j(graphRelations)

const deleteTag = await fetch(`${base}/tags/${tag.id}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${token}` }
})
assert.equal(deleteTag.status, 200)

const refetchNote = await fetch(`${base}/notes/${note.id}`, { headers: { Authorization: `Bearer ${token}` } })
assert.equal(refetchNote.status, 200)
const noteAfter = await j(refetchNote)
assert.equal(noteAfter.tags.length, 0)

console.log('API_VERIFY_OK', { email, noteId: note.id, tagDeleted: tag.id })
