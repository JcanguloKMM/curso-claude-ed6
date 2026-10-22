import { randomUUID } from 'crypto'
import type { Table } from '@models/table.model.js'
import { normalizeTableStatus } from '@models/table.model.js'
import type { TableRepository } from '@repositories/table.repository.js'
import {
    InvalidTableNumberError,
    InvalidTableCapacityError,
    InvalidTableDescriptionError,
    DuplicatedTableNumberError,
    TableNotFoundError,
    TableOccupiedError,
    InvalidPeopleCountError,
    TableCapacityExceededError,
    TableNotAvailableError
} from '@errors/DomainErrors.js'

// Los valores llegan sin tipar desde el cuerpo HTTP; la validación vive aquí
export interface CreateTableDTO {
    restaurantId: string
    number: unknown
    capacity: unknown
    description?: unknown
    status?: unknown
}

export interface UpdateTableDTO {
    number: unknown
    capacity: unknown
    description?: unknown
    status?: unknown
}

const isPositiveInteger = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 1

export class TableService {
    constructor(private readonly tableRepository: TableRepository) {}

    async create(dto: CreateTableDTO): Promise<Table> {
        const now = new Date().toISOString()
        const table = this.buildTable({
            id: randomUUID(),
            restaurantId: dto.restaurantId,
            number: dto.number,
            capacity: dto.capacity,
            description: dto.description,
            status: dto.status === undefined ? 'libre' : dto.status,
            createdAt: now,
            updatedAt: now
        })

        await this.ensureNumberIsFree(table)
        await this.tableRepository.save(table)
        return table
    }

    async update(restaurantId: string, id: string, dto: UpdateTableDTO): Promise<Table> {
        const existing = await this.findOwnTable(restaurantId, id)

        const updated = this.buildTable({
            id: existing.id,
            restaurantId: existing.restaurantId,
            number: dto.number,
            capacity: dto.capacity,
            description: dto.description,
            status: dto.status === undefined ? existing.status : dto.status,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString()
        })

        await this.ensureNumberIsFree(updated)
        await this.tableRepository.save(updated)
        return updated
    }

    async listByRestaurant(restaurantId: string): Promise<Table[]> {
        return this.tableRepository.findByRestaurantId(restaurantId)
    }

    async getById(restaurantId: string, id: string): Promise<Table> {
        return this.findOwnTable(restaurantId, id)
    }

    async delete(restaurantId: string, id: string): Promise<void> {
        const existing = await this.findOwnTable(restaurantId, id)
        if (existing.status === 'ocupada') {
            throw new TableOccupiedError()
        }
        await this.tableRepository.delete(id)
    }

    async changeStatus(restaurantId: string, id: string, status: unknown): Promise<Table> {
        const normalizedStatus = normalizeTableStatus(status)
        const existing = await this.findOwnTable(restaurantId, id)
        const updatedAt = new Date().toISOString()

        await this.tableRepository.updateStatus(existing.id, normalizedStatus, updatedAt)
        return { ...existing, status: normalizedStatus, updatedAt }
    }

    async listAvailable(restaurantId: string, people: unknown): Promise<Table[]> {
        const peopleCount = this.validatePeople(people)
        return this.tableRepository.findAvailable(restaurantId, peopleCount)
    }

    async occupy(restaurantId: string, id: string, people: unknown): Promise<Table> {
        const peopleCount = this.validatePeople(people)
        const existing = await this.findOwnTable(restaurantId, id)
        if (peopleCount > existing.capacity) {
            throw new TableCapacityExceededError()
        }

        const updatedAt = new Date().toISOString()
        const occupied = await this.tableRepository.occupyIfFree(existing.id, restaurantId, updatedAt)
        if (!occupied) {
            throw new TableNotAvailableError()
        }
        return { ...existing, status: 'ocupada', updatedAt }
    }

    private validatePeople(people: unknown): number {
        if (!isPositiveInteger(people)) {
            throw new InvalidPeopleCountError()
        }
        return people
    }

    private async findOwnTable(restaurantId: string, id: string): Promise<Table> {
        const table = await this.tableRepository.findById(id)
        if (!table || table.restaurantId !== restaurantId) {
            throw new TableNotFoundError()
        }
        return table
    }

    private async ensureNumberIsFree(table: Table): Promise<void> {
        const sameNumber = await this.tableRepository.findByNumber(table.restaurantId, table.number)
        if (sameNumber && sameNumber.id !== table.id) {
            throw new DuplicatedTableNumberError()
        }
    }

    private buildTable(props: {
        id: string
        restaurantId: string
        number: unknown
        capacity: unknown
        description: unknown
        status: unknown
        createdAt: string
        updatedAt: string
    }): Table {
        if (!isPositiveInteger(props.number)) {
            throw new InvalidTableNumberError()
        }
        if (!isPositiveInteger(props.capacity)) {
            throw new InvalidTableCapacityError()
        }

        return {
            id: props.id,
            restaurantId: props.restaurantId,
            number: props.number,
            description: this.normalizeDescription(props.description),
            capacity: props.capacity,
            status: normalizeTableStatus(props.status),
            createdAt: props.createdAt,
            updatedAt: props.updatedAt
        }
    }

    private normalizeDescription(value: unknown): string | null {
        if (value === undefined || value === null) {
            return null
        }
        if (typeof value !== 'string') {
            throw new InvalidTableDescriptionError()
        }
        const trimmed = value.trim()
        return trimmed === '' ? null : trimmed
    }
}
