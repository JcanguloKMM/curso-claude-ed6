import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Database } from '@config/database.js'
import type { Table } from '@models/table.model.js'
import { SqliteTableRepository } from './table.repository.js'

const ahora = '2026-10-22T08:00:00.000Z'

const insertarRestaurante = (db: Database, id: string) =>
    db.run(
        'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, id, 'Calle Mayor 10', `${id}@x.com`, '600000000', 'Carlos', 'García', ahora, ahora]
    )

const insertarMesa = (db: Database, id: string, restaurantId: string, number: number) =>
    db.run(
        'INSERT INTO restaurant_tables (id, restaurant_id, number, description, capacity, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, restaurantId, number, null, 4, 'libre', ahora, ahora]
    )

describe('Migración de restaurant_tables', () => {
    let db: Database

    beforeAll(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        await insertarRestaurante(db, 'r1')
        await insertarRestaurante(db, 'r2')
    })

    afterAll(async () => {
        await db.close()
    })

    it('crea la tabla con estado libre por defecto', async () => {
        await db.run(
            'INSERT INTO restaurant_tables (id, restaurant_id, number, capacity, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            ['m0', 'r1', 99, 2, ahora, ahora]
        )
        const fila = await db.get<{ status: string; description: string | null }>('SELECT status, description FROM restaurant_tables WHERE id = ?', ['m0'])
        expect(fila).toEqual({ status: 'libre', description: null })
    })

    it('impide repetir el número de mesa dentro del mismo restaurante', async () => {
        await insertarMesa(db, 'm1', 'r1', 1)
        await expect(insertarMesa(db, 'm2', 'r1', 1)).rejects.toThrow(/UNIQUE/)
    })

    it('permite el mismo número en restaurantes distintos', async () => {
        await expect(insertarMesa(db, 'm3', 'r2', 1)).resolves.toBeDefined()
    })

    it('exige que el restaurante exista', async () => {
        await expect(insertarMesa(db, 'm4', 'no-existe', 1)).rejects.toThrow(/FOREIGN KEY/)
    })
})

const mesa = (props: Partial<Table> & Pick<Table, 'id' | 'number'>): Table => ({
    restaurantId: 'r1',
    description: null,
    capacity: 4,
    status: 'libre',
    createdAt: ahora,
    updatedAt: ahora,
    ...props
})

describe('SqliteTableRepository (integración)', () => {
    let db: Database
    let repo: SqliteTableRepository

    beforeAll(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        await insertarRestaurante(db, 'r1')
        await insertarRestaurante(db, 'r2')
        repo = new SqliteTableRepository(db)
    })

    afterAll(async () => {
        await db.close()
    })

    it('guarda una mesa y la encuentra por id', async () => {
        const nueva = mesa({ id: 't1', number: 3, description: 'Terraza', capacity: 6 })
        await repo.save(nueva)

        expect(await repo.findById('t1')).toEqual(nueva)
    })

    it('devuelve null si la mesa no existe', async () => {
        expect(await repo.findById('no-existe')).toBeNull()
    })

    it('lista las mesas de un restaurante ordenadas por número', async () => {
        await repo.save(mesa({ id: 't2', number: 1 }))
        await repo.save(mesa({ id: 't3', number: 2 }))
        await repo.save(mesa({ id: 'otra', number: 1, restaurantId: 'r2' }))

        const mesas = await repo.findByRestaurantId('r1')
        expect(mesas.map(m => m.number)).toEqual([1, 2, 3])
        expect(mesas.every(m => m.restaurantId === 'r1')).toBe(true)
    })

    it('busca una mesa por restaurante y número', async () => {
        expect((await repo.findByNumber('r1', 2))?.id).toBe('t3')
        expect((await repo.findByNumber('r2', 1))?.id).toBe('otra')
        expect(await repo.findByNumber('r2', 2)).toBeNull()
    })

    it('actualiza una mesa existente sin cambiar su restaurante ni su fecha de creación', async () => {
        const actualizada = mesa({
            id: 't1',
            number: 4,
            description: null,
            capacity: 8,
            status: 'reservada',
            updatedAt: '2026-10-22T09:00:00.000Z'
        })
        await repo.save(actualizada)

        expect(await repo.findById('t1')).toEqual(actualizada)
    })

    it('borra una mesa', async () => {
        await repo.delete('t2')
        expect(await repo.findById('t2')).toBeNull()
    })
})

describe('SqliteTableRepository: disponibilidad y estado (integración)', () => {
    let db: Database
    let repo: SqliteTableRepository

    beforeAll(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        await insertarRestaurante(db, 'r1')
        await insertarRestaurante(db, 'r2')
        repo = new SqliteTableRepository(db)

        await repo.save(mesa({ id: 'a1', number: 1, capacity: 2 }))
        await repo.save(mesa({ id: 'a2', number: 2, capacity: 6 }))
        await repo.save(mesa({ id: 'a3', number: 3, capacity: 4 }))
        await repo.save(mesa({ id: 'a4', number: 4, capacity: 4 }))
        await repo.save(mesa({ id: 'a5', number: 5, capacity: 8, status: 'ocupada' }))
        await repo.save(mesa({ id: 'a6', number: 6, capacity: 8, status: 'reservada' }))
        await repo.save(mesa({ id: 'b1', number: 1, capacity: 8, restaurantId: 'r2' }))
    })

    afterAll(async () => {
        await db.close()
    })

    it('findAvailable devuelve solo mesas libres con capacidad suficiente, por capacidad y número', async () => {
        const mesas = await repo.findAvailable('r1', 4)
        expect(mesas.map(m => m.id)).toEqual(['a3', 'a4', 'a2'])
    })

    it('findAvailable no devuelve mesas de otros restaurantes', async () => {
        const mesas = await repo.findAvailable('r1', 7)
        expect(mesas).toEqual([])
    })

    it('updateStatus cambia el estado y la fecha de actualización', async () => {
        await repo.updateStatus('a1', 'reservada', '2026-10-22T09:00:00.000Z')

        const mesaActualizada = await repo.findById('a1')
        expect(mesaActualizada?.status).toBe('reservada')
        expect(mesaActualizada?.updatedAt).toBe('2026-10-22T09:00:00.000Z')
    })

    it('occupyIfFree ocupa una mesa libre y devuelve true', async () => {
        expect(await repo.occupyIfFree('a3', 'r1', '2026-10-22T10:00:00.000Z')).toBe(true)

        const ocupada = await repo.findById('a3')
        expect(ocupada?.status).toBe('ocupada')
        expect(ocupada?.updatedAt).toBe('2026-10-22T10:00:00.000Z')
    })

    it('occupyIfFree devuelve false en una segunda llamada sobre la misma mesa', async () => {
        expect(await repo.occupyIfFree('a3', 'r1', '2026-10-22T10:01:00.000Z')).toBe(false)
        expect((await repo.findById('a3'))?.updatedAt).toBe('2026-10-22T10:00:00.000Z')
    })

    it('occupyIfFree devuelve false si la mesa está reservada o es de otro restaurante', async () => {
        expect(await repo.occupyIfFree('a6', 'r1', ahora)).toBe(false)
        expect(await repo.occupyIfFree('b1', 'r1', ahora)).toBe(false)
        expect((await repo.findById('b1'))?.status).toBe('libre')
    })
})
