import { getAppDB } from "@budibase/backend-core/context"
import { BudibaseInternalDB, getTableParams } from "../../../db/utils"
import {
  breakExternalTableId,
  isExternalTable,
  isSQL,
} from "../../../integrations/utils"
import { Table } from "@budibase/types"
import PouchDB from "pouchdb"

async function getAllInternalTables(db?: PouchDB.Database): Promise<Table[]> {
  if (!db) {
    db = getAppDB() as PouchDB.Database
  }
  const internalTables = await db.allDocs(
    getTableParams(null, {
      include_docs: true,
    })
  )
  return internalTables.rows.map((tableDoc: any) => ({
    ...tableDoc.doc,
    type: "internal",
    sourceId: BudibaseInternalDB._id,
  }))
}

async function getAllExternalTables(datasourceId: any): Promise<Table[]> {
  const db = getAppDB()
  const datasource = await db.get(datasourceId)
  if (!datasource || !datasource.entities) {
    throw "Datasource is not configured fully."
  }
  return datasource.entities
}

async function getExternalTable(
  datasourceId: any,
  tableName: any
): Promise<Table> {
  const entities = await getAllExternalTables(datasourceId)
  return entities[tableName]
}

async function getTable(tableId: any): Promise<Table> {
  const db = getAppDB()
  if (isExternalTable(tableId)) {
    let { datasourceId, tableName } = breakExternalTableId(tableId)
    const datasource = await db.get(datasourceId)
    const table = await getExternalTable(datasourceId, tableName)
    return { ...table, sql: isSQL(datasource) }
  } else {
    return db.get(tableId)
  }
}

export default {
  getAllInternalTables,
  getAllExternalTables,
  getExternalTable,
  getTable,
}
