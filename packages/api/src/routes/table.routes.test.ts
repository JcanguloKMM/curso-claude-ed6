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
const managerA = token({ id: 'manager-a', role: 'manager', restaurantId: 'rest-a' })
const camareroA = token({ id: 'camarero-a', role: 'camarero', restaurantId: 'rest-a' })
const cocineroA = token({ id: 'cocinero-a', role: 'cocinero', restaurantId: 'rest-a' })
const cocineroB = token({ id: 'cocinero-b', role: 'cocinero', restaurantId: 'rest-b' })
const cliente = token({ id: 'cliente-1', role: 'cliente', restaurantId: null })

const PROHIBIDO = { error: 'Forbidden: Insufficient permissions' }

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

describe('CRUD de mesas: /api/v1/restaurants/:restaurantId/tables', () => {
    const url = '/api/v1/restaurants/rest-a/tables'

    describe('lectura', () => {
        it.each([
            ['manager', managerA],
            ['camarero', camareroA],
            ['cocinero', cocineroA]
        ])('el %s del restaurante lista las mesas ordenadas por número', async (_rol, t) => {
            const res = await request(app).get(url).set(auth(t))
            expect(res.status).toBe(200)
            expect(res.body.map((m: any) => m.number)).toEqual([1, 2, 3, 4])
        })

        it('el cocinero de otro restaurante recibe 403 en GET', async () => {
            const res = await request(app).get(url).set(auth(cocineroB))
            expect(res.status).toBe(403)
            expect(res.body).toEqual(PROHIBIDO)
        })

        it('un cliente recibe 403 en GET', async () => {
            const res = await request(app).get(url).set(auth(cliente))
            expect(res.status).toBe(403)
        })

        it('el detalle devuelve la mesa con el formato del contrato', async () => {
            const res = await request(app).get(`${url}/a-1`).set(auth(camareroA))
            expect(res.status).toBe(200)
            expect(res.body).toEqual({
                id: 'a-1',
                restaurantId: 'rest-a',
                number: 1,
                description: 'Ventana',
                capacity: 2,
                status: 'ocupada',
                createdAt: ahora,
                updatedAt: ahora
            })
        })

        it('el detalle de una mesa de otro restaurante devuelve 404 TableNotFoundError', async () => {
            const res = await request(app).get(`${url}/b-1`).set(auth(admin))
            expect(res.status).toBe(404)
            expect(res.body).toEqual({ error: 'TableNotFoundError', message: 'Mesa no encontrada' })
        })
    })

    describe('alta, edición y borrado', () => {
        it('un cliente recibe 403 en POST', async () => {
            const res = await request(app).post(url).set(auth(cliente)).send({ number: 50, capacity: 2 })
            expect(res.status).toBe(403)
            expect(res.body).toEqual(PROHIBIDO)
        })

        it.each([
            ['manager', managerA],
            ['camarero', camareroA]
        ])('el %s recibe 403 en POST, PUT y DELETE', async (_rol, t) => {
            expect((await request(app).post(url).set(auth(t)).send({ number: 50, capacity: 2 })).status).toBe(403)
            expect((await request(app).put(`${url}/a-2`).set(auth(t)).send({ number: 2, capacity: 4 })).status).toBe(403)
            expect((await request(app).delete(`${url}/a-2`).set(auth(t))).status).toBe(403)
        })

        it('el admin crea una mesa (201) y un número repetido da 409 DuplicatedTableNumberError', async () => {
            const alta = await request(app).post(url).set(auth(admin)).send({ number: 20, description: 'Terraza', capacity: 6 })
            expect(alta.status).toBe(201)
            expect(alta.body).toMatchObject({ restaurantId: 'rest-a', number: 20, description: 'Terraza', capacity: 6, status: 'libre' })

            const repetida = await request(app).post(url).set(auth(admin)).send({ number: 20, capacity: 2 })
            expect(repetida.status).toBe(409)
            expect(repetida.body).toEqual({ error: 'DuplicatedTableNumberError', message: 'Ya existe una mesa con ese número en el restaurante' })
        })

        it('datos no válidos al crear dan 400 con el error de dominio', async () => {
            const capacidad = await request(app).post(url).set(auth(admin)).send({ number: 21, capacity: 0 })
            expect(capacidad.status).toBe(400)
            expect(capacidad.body.error).toBe('InvalidTableCapacityError')

            const numero = await request(app).post(url).set(auth(admin)).send({ number: 'a', capacity: 2 })
            expect(numero.status).toBe(400)
            expect(numero.body.error).toBe('InvalidTableNumberError')
        })

        it('un POST sin cuerpo JSON da 400 y no 500', async () => {
            const res = await request(app).post(url).set(auth(admin))
            expect(res.status).toBe(400)
            expect(res.body.error).toBe('InvalidTableNumberError')
        })

        it('el admin edita una mesa y conserva el estado si no lo envía', async () => {
            const res = await request(app).put(`${url}/a-1`).set(auth(admin)).send({ number: 1, description: 'Ventana grande', capacity: 3 })
            expect(res.status).toBe(200)
            expect(res.body).toMatchObject({ id: 'a-1', number: 1, description: 'Ventana grande', capacity: 3, status: 'ocupada' })
        })

        it('editar con el número de otra mesa da 409', async () => {
            const res = await request(app).put(`${url}/a-1`).set(auth(admin)).send({ number: 2, capacity: 3 })
            expect(res.status).toBe(409)
            expect(res.body.error).toBe('DuplicatedTableNumberError')
        })

        it('borrar una mesa ocupada da 409 TableOccupiedError', async () => {
            const res = await request(app).delete(`${url}/a-1`).set(auth(admin))
            expect(res.status).toBe(409)
            expect(res.body).toEqual({ error: 'TableOccupiedError', message: 'No se puede borrar una mesa ocupada' })
        })

        it('borrar una mesa reservada responde 204 sin cuerpo', async () => {
            await insertarMesa('a-9', 'rest-a', 9, 2, 'reservada')
            const res = await request(app).delete(`${url}/a-9`).set(auth(admin))
            expect(res.status).toBe(204)
            expect(res.text).toBe('')
            expect((await request(app).get(`${url}/a-9`).set(auth(admin))).status).toBe(404)
        })

        it('borrar una mesa de otro restaurante da 404', async () => {
            const res = await request(app).delete(`${url}/b-1`).set(auth(admin))
            expect(res.status).toBe(404)
        })
    })

    describe('cambio de estado', () => {
        it('el camarero del restaurante cambia el estado (200)', async () => {
            const res = await request(app).patch(`${url}/a-4/status`).set(auth(camareroA)).send({ status: 'libre' })
            expect(res.status).toBe(200)
            expect(res.body).toMatchObject({ id: 'a-4', status: 'libre' })
        })

        it('el cocinero del restaurante también puede cambiar el estado', async () => {
            const res = await request(app).patch(`${url}/a-4/status`).set(auth(cocineroA)).send({ status: 'reservada' })
            expect(res.status).toBe(200)
            expect(res.body.status).toBe('reservada')
        })

        it('un estado inválido da 400 InvalidTableStatusError', async () => {
            const res = await request(app).patch(`${url}/a-4/status`).set(auth(camareroA)).send({ status: 'rota' })
            expect(res.status).toBe(400)
            expect(res.body).toEqual({ error: 'InvalidTableStatusError', message: 'Estado inválido: rota. Debe ser uno de: libre, ocupada, reservada' })
        })

        it('el personal de otro restaurante recibe 403 y un cliente también', async () => {
            expect((await request(app).patch(`${url}/a-4/status`).set(auth(cocineroB)).send({ status: 'libre' })).status).toBe(403)
            expect((await request(app).patch(`${url}/a-4/status`).set(auth(cliente)).send({ status: 'libre' })).status).toBe(403)
        })

        it('una mesa de otro restaurante da 404', async () => {
            const res = await request(app).patch(`${url}/b-1/status`).set(auth(admin)).send({ status: 'libre' })
            expect(res.status).toBe(404)
        })
    })
})

describe('Flujo del cliente: mesas disponibles y ocupación', () => {
    const publica = '/api/v1/public/restaurants/rest-c/tables'
    const privada = '/api/v1/restaurants/rest-c/tables'

    beforeAll(async () => {
        await dbConfig.run(
            'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            ['rest-c', 'rest-c', 'dir', 'rest-c@x.com', '600000000', 'a', 'b', ahora, ahora]
        )
        await insertarMesa('c-1', 'rest-c', 1, 2)
        await insertarMesa('c-2', 'rest-c', 2, 6)
        await insertarMesa('c-3', 'rest-c', 3, 4)
        await insertarMesa('c-4', 'rest-c', 4, 4)
        await insertarMesa('c-5', 'rest-c', 5, 8, 'ocupada')
        await insertarMesa('c-6', 'rest-c', 6, 8, 'reservada')
    })

    describe('GET público de mesas disponibles', () => {
        it('filtra por personas y ordena por capacidad y número', async () => {
            const res = await request(app).get(`${publica}?people=4`)
            expect(res.status).toBe(200)
            expect(res.body.map((m: any) => m.id)).toEqual(['c-3', 'c-4', 'c-2'])
            expect(res.body.every((m: any) => m.status === 'libre')).toBe(true)
        })

        it('devuelve [] si ninguna mesa libre admite el grupo', async () => {
            const res = await request(app).get(`${publica}?people=7`)
            expect(res.status).toBe(200)
            expect(res.body).toEqual([])
        })

        it('ignora un token no válido', async () => {
            const res = await request(app).get(`${publica}?people=2`).set(auth('token-roto'))
            expect(res.status).toBe(200)
        })

        it.each(['?people=0', '?people=abc', '?people=2.5', '?people=-1', '', '?people=2&people=3'])(
            'responde 400 InvalidPeopleCountError con "%s"',
            async (query) => {
                const res = await request(app).get(`${publica}${query}`)
                expect(res.status).toBe(400)
                expect(res.body).toEqual({ error: 'InvalidPeopleCountError', message: 'El número de personas debe ser un entero mayor o igual que 1' })
            }
        )
    })

    describe('POST occupy', () => {
        it('sin token responde 401', async () => {
            const res = await request(app).post(`${privada}/c-1/occupy`).send({ people: 2 })
            expect(res.status).toBe(401)
        })

        it.each([
            ['camarero', token({ id: 'camarero-c', role: 'camarero', restaurantId: 'rest-c' })],
            ['admin', admin]
        ])('un %s recibe 403', async (_rol, t) => {
            const res = await request(app).post(`${privada}/c-1/occupy`).set(auth(t)).send({ people: 2 })
            expect(res.status).toBe(403)
            expect(res.body).toEqual(PROHIBIDO)
        })

        it('el cliente ocupa una mesa libre (200) y la mesa pasa a ocupada', async () => {
            const res = await request(app).post(`${privada}/c-3/occupy`).set(auth(cliente)).send({ people: 4 })
            expect(res.status).toBe(200)
            expect(res.body).toMatchObject({ id: 'c-3', restaurantId: 'rest-c', number: 3, capacity: 4, status: 'ocupada' })

            const disponibles = await request(app).get(`${publica}?people=1`)
            expect(disponibles.body.map((m: any) => m.id)).not.toContain('c-3')
        })

        it('una segunda ocupación de la misma mesa responde 409 TableNotAvailableError', async () => {
            const res = await request(app).post(`${privada}/c-3/occupy`).set(auth(cliente)).send({ people: 2 })
            expect(res.status).toBe(409)
            expect(res.body).toEqual({ error: 'TableNotAvailableError', message: 'La mesa no está libre' })
        })

        it('no deja ocupar una mesa reservada (409)', async () => {
            const res = await request(app).post(`${privada}/c-6/occupy`).set(auth(cliente)).send({ people: 2 })
            expect(res.status).toBe(409)
        })

        it('si el grupo supera la capacidad responde 400 TableCapacityExceededError', async () => {
            const res = await request(app).post(`${privada}/c-1/occupy`).set(auth(cliente)).send({ people: 3 })
            expect(res.status).toBe(400)
            expect(res.body.error).toBe('TableCapacityExceededError')
        })

        it.each([{ people: 0 }, { people: '2' }, {}])('people no válido (%o) responde 400 InvalidPeopleCountError', async (body) => {
            const res = await request(app).post(`${privada}/c-1/occupy`).set(auth(cliente)).send(body)
            expect(res.status).toBe(400)
            expect(res.body.error).toBe('InvalidPeopleCountError')
        })

        it('una mesa de otro restaurante en la URL responde 404', async () => {
            const res = await request(app).post(`${privada}/b-1/occupy`).set(auth(cliente)).send({ people: 2 })
            expect(res.status).toBe(404)
            expect(res.body.error).toBe('TableNotFoundError')
        })
    })
})
