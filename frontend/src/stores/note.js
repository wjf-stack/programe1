import { defineStore } from 'pinia'
import { ref } from 'vue'
import { noteAPI, tagAPI } from '../api'

export const useNoteStore = defineStore('note', () => {
  const notes = ref([])
  const tags = ref([])
  const currentNote = ref(null)
  const loading = ref(false)

  const fetchNotes = async (page = 1) => {
    loading.value = true
    try {
      const response = await noteAPI.list(page)
      notes.value = response.data
      return response
    } finally {
      loading.value = false
    }
  }

  const fetchNote = async (id) => {
    loading.value = true
    try {
      const response = await noteAPI.get(id)
      currentNote.value = response
      return response
    } finally {
      loading.value = false
    }
  }

  const createNote = async (data) => {
    const response = await noteAPI.create(data)
    notes.value.unshift(response)
    return response
  }

  const updateNote = async (id, data) => {
    const response = await noteAPI.update(id, data)
    const index = notes.value.findIndex(n => n.id === id)
    if (index !== -1) notes.value[index] = response
    currentNote.value = response
    return response
  }

  const deleteNote = async (id) => {
    await noteAPI.delete(id)
    notes.value = notes.value.filter(n => n.id !== id)
  }

  const searchNotes = async (keyword) => {
    loading.value = true
    try {
      const response = await noteAPI.search(keyword)
      return response
    } finally {
      loading.value = false
    }
  }

  const fetchTags = async () => {
    const response = await tagAPI.list()
    tags.value = response
    return response
  }

  const createTag = async (name) => {
    const response = await tagAPI.create(name)
    tags.value.push(response)
    return response
  }

  const deleteTag = async (id) => {
    await tagAPI.delete(id)
    tags.value = tags.value.filter(t => t.id !== id)
    notes.value = notes.value.map(n => ({
      ...n,
      tags: (n.tags || []).filter(t => t.id !== id)
    }))
    if (currentNote.value) {
      currentNote.value = {
        ...currentNote.value,
        tags: (currentNote.value.tags || []).filter(t => t.id !== id)
      }
    }
  }

  return {
    notes,
    tags,
    currentNote,
    loading,
    fetchNotes,
    fetchNote,
    createNote,
    updateNote,
    deleteNote,
    searchNotes,
    fetchTags,
    createTag,
    deleteTag
  }
})
