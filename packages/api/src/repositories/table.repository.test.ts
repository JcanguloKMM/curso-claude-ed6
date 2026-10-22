import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Database } from '@config/database.js'

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
