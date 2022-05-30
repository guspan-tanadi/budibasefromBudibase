import { events } from "@budibase/backend-core"
import { getTableParams } from "../../../../db/utils"
import { Table } from "@budibase/types"

const getTables = async (appDb: any): Promise<Table[]> => {
  const response = await appDb.allDocs(
    getTableParams(null, {
      include_docs: true,
    })
  )
  return response.rows.map((row: any) => row.doc)
}

export const backfill = async (appDb: any, timestamp: string) => {
  const tables = await getTables(appDb)

  for (const table of tables) {
    await events.table.created(table, timestamp)

    if (table.views) {
      for (const view of Object.values(table.views)) {
        await events.view.created(view, timestamp)

        if (view.calculation) {
          await events.view.calculationCreated(view.calculation, timestamp)
        }

        if (view.filters?.length) {
          await events.view.filterCreated(timestamp)
        }
      }
    }
  }

  return tables.length
}
