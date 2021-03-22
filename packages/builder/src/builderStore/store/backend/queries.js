import { writable } from "svelte/store"
import { datasources, integrations } from "./"
import api from "../../api"

function createQueriesStore() {
  const { subscribe, set, update } = writable({list: [], selected: null})

  return {
    subscribe,
    set,
    update,
    fetch: async () => {
      const response = await api.get(`/api/queries`)
      const json = await response.json()
      update(state => ({...state, list: json}))
      return json
    },
    save: async (datasourceId, query) => {
      const _integrations = get(integrations)
      const dataSource = get(datasources).list.filter(
        ds => ds._id === datasourceId
      )
      // check if readable attribute is found
      if (dataSource.length !== 0) {
        const integration = _integrations[dataSource[0].source]
        const readable = integration.query[query.queryVerb].readable
        if (readable) {
          query.readable = readable
        }
      }
      query.datasourceId = datasourceId
      const response = await api.post(`/api/queries`, query)
      if (response.status !== 200) {
        throw new Error("Failed saving query.")
      }
      const json = await response.json()
      update(state => {
        const currentIdx = state.list.findIndex(query => query._id === json._id)

        const queries = state.list

        if (currentIdx >= 0) {
          queries.splice(currentIdx, 1, json)
        } else {
          queries.push(json)
        }
        return { list: queries, selected: json._id}
      })
      return json
    },
    select: query => {
      datasources.update(state => ({ ...state, selected: query.datasourceId }))
    },
    delete: async query => {
      await api.delete(`/api/queries/${query._id}/${query._rev}`)
      update(state => {
        state.list = state.list.filter(
          existing => existing._id !== query._id
        )
        if (state.selected === query._id) {
          state.selected = null
        }

        return state
      })
    },
  }
}

export const queries = createQueriesStore()
