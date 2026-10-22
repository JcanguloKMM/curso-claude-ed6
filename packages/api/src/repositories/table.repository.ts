import { Database } from '@config/database.js'
import type { Table, TableStatusType } from '@models/table.model.js'
import { normalizeTableStatus } from '@models/table.model.js'

interface TableRow {
    id: string
    restaurantId: string
    number: number
    description: string | null
    capacity: number
    status: string
    createdAt: string
    updatedAt: string
}

const SELECT_TABLE = 'SELECT id, restaurant_id as restaurantId, number, description, capacity, status, created_at as createdAt, updated_at as updatedAt FROM restaurant_tables'

export interface TableRepository {
    findById(id: string): Promise<Table | null>
    findByRestaurantId(restaurantId: string): Promise<Table[]>
    findByNumber(restaurantId: string, number: number): Promise<Table | null>
    save(table: Table): Promise<void>
    delete(id: string): Promise<void>
    findAvailable(restaurantId: string, minCapacity: number): Promise<Table[]>
    updateStatus(id: string, status: TableStatusType, updatedAt: string): Promise<void>
    occupyIfFree(id: string, restaurantId: string, updatedAt: string): Promise<boolean>
}

export class SqliteTableRepository implements TableRepository {
    constructor(private db: Database) {}

    async findById(id: string): Promise<Table | null> {
        const row = await this.db.get<TableRow>(`${SELECT_TABLE} WHERE id = ?`, [id])
        if (!row) return null
        return this.mapToTable(row)
    }

    async findByRestaurantId(restaurantId: string): Promise<Table[]> {
        const rows = await this.db.all<TableRow>(`${SELECT_TABLE} WHERE restaurant_id = ? ORDER BY number`, [restaurantId])
        return rows.map(row => this.mapToTable(row))
    }

    async findByNumber(restaurantId: string, number: number): Promise<Table | null> {
        const row = await this.db.get<TableRow>(`${SELECT_TABLE} WHERE restaurant_id = ? AND number = ?`, [restaurantId, number])
        if (!row) return null
        return this.mapToTable(row)
    }

    async save(table: Table): Promise<void> {
        const existing = await this.findById(table.id)
        if (existing) {
            await this.db.run(
                'UPDATE restaurant_tables SET number = ?, description = ?, capacity = ?, status = ?, updated_at = ? WHERE id = ?',
                [table.number, table.description, table.capacity, table.status, table.updatedAt, table.id]
            )
        } else {
            await this.db.run(
                'INSERT INTO restaurant_tables (id, restaurant_id, number, description, capacity, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [table.id, table.restaurantId, table.number, table.description, table.capacity, table.status, table.createdAt, table.updatedAt]
            )
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.run('DELETE FROM restaurant_tables WHERE id = ?', [id])
    }

    async findAvailable(restaurantId: string, minCapacity: number): Promise<Table[]> {
        const rows = await this.db.all<TableRow>(
            `${SELECT_TABLE} WHERE restaurant_id = ? AND status = 'libre' AND capacity >= ? ORDER BY capacity, number`,
            [restaurantId, minCapacity]
        )
        return rows.map(row => this.mapToTable(row))
    }

    async updateStatus(id: string, status: TableStatusType, updatedAt: string): Promise<void> {
        await this.db.run('UPDATE restaurant_tables SET status = ?, updated_at = ? WHERE id = ?', [status, updatedAt, id])
    }

    // UPDATE condicional: si dos clientes ocupan la misma mesa a la vez, solo uno modifica la fila
    async occupyIfFree(id: string, restaurantId: string, updatedAt: string): Promise<boolean> {
        const result = await this.db.run(
            "UPDATE restaurant_tables SET status = 'ocupada', updated_at = ? WHERE id = ? AND restaurant_id = ? AND status = 'libre'",
            [updatedAt, id, restaurantId]
        )
        return result.changes > 0
    }

    private mapToTable(row: TableRow): Table {
        return {
            id: row.id,
            restaurantId: row.restaurantId,
            number: row.number,
            description: row.description,
            capacity: row.capacity,
            status: normalizeTableStatus(row.status),
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        }
    }
}
