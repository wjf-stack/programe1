import { defineStore } from 'pinia'
import { ref } from 'vue'
import { graphAPI } from '../api'

export const useGraphStore = defineStore('graph', () => {
  const nodes = ref([])
  const relations = ref([])
  const loading = ref(false)

  const fetchGraphData = async () => {
    loading.value = true
    try {
      const [nodesRes, relationsRes] = await Promise.all([
        graphAPI.getNodes(),
        graphAPI.getRelations()
      ])
      nodes.value = nodesRes
      relations.value = relationsRes
    } finally {
      loading.value = false
    }
  }

  const expandNode = async (nodeId) => {
    const response = await graphAPI.getExpanded(nodeId)
    nodes.value.push(...response.nodes)
    relations.value.push(...response.relations)
    return response
  }

  return {
    nodes,
    relations,
    loading,
    fetchGraphData,
    expandNode
  }
})
