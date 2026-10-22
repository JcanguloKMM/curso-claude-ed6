import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'
import { dbConfig } from '@config/database.js'
import { env } from '@config/env.js'

const token = (payload: { id: string; role: string; restaurantId: string | null }) =>
    jwt.sign(payload, env.jwtSecret, { algorithm: 'HS256', expiresIn: '1h' })

const auth = (t: string) => ({ Authorization: `Bearer ${t}` })

const admin = token({ id: 'admin-1', role: 'admin', restaurantId: null })

const ahora = '2026-10-22T08:00:00.000Z'

const insertarMesa = (id: string, restaurantId: string, number: number, capacity: number, status = 'libre', description: string | null = null) =>
    dbConfig.run(
        'INSERT INTO restaurant_tables (id, restaurant_id, number, description, capacity, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, restaurantId, number, description, capacity, status, ahora, ahora]
    )

beforeAll(async () => {
    await dbConfig.initialize()
    for (const id of ['rest-a', 'rest-b']) {
        await dbConfig.run(
            'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, id, 'dir', `${id}@x.com`, '600000000', 'a', 'b', ahora, ahora]
        )
    }
    await insertarMesa('a-1', 'rest-a', 1, 2, 'ocupada', 'Ventana')
    await insertarMesa('a-2', 'rest-a', 2, 4)
    await insertarMesa('a-3', 'rest-a', 3, 6)
    await insertarMesa('a-4', 'rest-a', 4, 4, 'reservada')
    await insertarMesa('b-1', 'rest-b', 1, 4)
})

afterAll(async () => {
    await dbConfig.close()
})

describe('Montaje de las rutas de mesas', () => {
    it('la ruta pública de mesas disponibles responde 200 sin token', async () => {
        const res = await request(app).get('/api/v1/public/restaurants/rest-a/tables?people=2')
        expect(res.status).toBe(200)
        expect(Array.isArray(res.body)).toBe(true)
    })

    it('las rutas privadas de mesas exigen token', async () => {
        const res = await request(app).get('/api/v1/restaurants/rest-a/tables')
        expect(res.status).toBe(401)
        expect(res.body).toEqual({ error: 'Unauthorized: No token provided' })
    })

    it('el admin lista las mesas de un restaurante', async () => {
        const res = await request(app).get('/api/v1/restaurants/rest-a/tables').set(auth(admin))
        expect(res.status).toBe(200)
        expect(res.body.map((m: any) => m.id)).toEqual(['a-1', 'a-2', 'a-3', 'a-4'])
    })
})
