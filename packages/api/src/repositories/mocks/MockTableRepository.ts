import type { TableRepository } from '@repositories/table.repository.js'
import type { Table, TableStatusType } from '@models/table.model.js'

export class MockTableRepository implements TableRepository {
    private tables: Map<string, Table> = new Map()

    async findById(id: string): Promise<Table | null> {
        const table = this.tables.get(id)
        return table ? { ...table } : null
    }

    async findByRestaurantId(restaurantId: string): Promise<Table[]> {
        return Array.from(this.tables.values())
            .filter(t => t.restaurantId === restaurantId)
            .sort((a, b) => a.number - b.number)
            .map(t => ({ ...t }))
    }

    async findByNumber(restaurantId: string, number: number): Promise<Table | null> {
        const table = Array.from(this.tables.values())
            .find(t => t.restaurantId === restaurantId && t.number === number)
        return table ? { ...table } : null
    }

    async save(table: Table): Promise<void> {
        this.tables.set(table.id, { ...table })
    }

    async delete(id: string): Promise<void> {
        this.tables.delete(id)
    }

    async findAvailable(restaurantId: string, minCapacity: number): Promise<Table[]> {
        return Array.from(this.tables.values())
            .filter(t => t.restaurantId === restaurantId && t.status === 'libre' && t.capacity >= minCapacity)
            .sort((a, b) => a.capacity - b.capacity || a.number - b.number)
            .map(t => ({ ...t }))
    }

    async updateStatus(id: string, status: TableStatusType, updatedAt: string): Promise<void> {
        const table = this.tables.get(id)
        if (table) {
            this.tables.set(id, { ...table, status, updatedAt })
        }
    }

    async occupyIfFree(id: string, restaurantId: string, updatedAt: string): Promise<boolean> {
        const table = this.tables.get(id)
        if (!table || table.restaurantId !== restaurantId || table.status !== 'libre') {
            return false
        }
        this.tables.set(id, { ...table, status: 'ocupada', updatedAt })
        return true
    }
}
