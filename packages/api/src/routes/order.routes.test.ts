import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'
import { dbConfig } from '@config/database.js'
import { env } from '@config/env.js'

const token = (payload: { id: string; role: string; restaurantId: string | null }) =>
    jwt.sign(payload, env.jwtSecret, { algorithm: 'HS256', expiresIn: '1h' })

const admin = token({ id: 'admin-1', role: 'admin', restaurantId: null })
const cocineroA = token({ id: 'cocinero-a', role: 'cocinero', restaurantId: 'rest-a' })
const cocineroB = token({ id: 'cocinero-b', role: 'cocinero', restaurantId: 'rest-b' })
const clienteDueno = token({ id: 'cliente-1', role: 'cliente', restaurantId: null })
const clienteAjeno = token({ id: 'cliente-2', role: 'cliente', restaurantId: null })

const auth = (t: string) => ({ Authorization: `Bearer ${t}` })

describe('Autorización de rutas de pedidos (H-03)', () => {
    beforeAll(async () => {
        await dbConfig.initialize()
        const ahora = new Date().toISOString()
        for (const id of ['rest-a', 'rest-b']) {
            await dbConfig.run(
                'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, id, 'dir', `${id}@x.com`, '600000000', 'a', 'b', ahora, ahora]
            )
            await dbConfig.run(
                'INSERT INTO dishes (id, name, description, price, category, available, restaurant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)',
                [`dish-${id}`, 'plato', null, 10, 'principal', id, ahora, ahora]
            )
        }
        await dbConfig.run('INSERT INTO orders (id, restaurant_id, table_id, client_id, created_at) VALUES (?, ?, ?, ?, ?)', ['order-a', 'rest-a', null, 'cliente-1', ahora])
        await dbConfig.run('INSERT INTO order_items (id, order_id, dish_id, quantity, notes, status) VALUES (?, ?, ?, ?, ?, ?)', ['item-a', 'order-a', 'dish-rest-a', 1, null, 'pendiente'])
        await dbConfig.run('INSERT INTO orders (id, restaurant_id, table_id, client_id, created_at) VALUES (?, ?, ?, ?, ?)', ['order-b', 'rest-b', null, 'cliente-9', ahora])
        await dbConfig.run('INSERT INTO order_items (id, order_id, dish_id, quantity, notes, status) VALUES (?, ?, ?, ?, ?, ?)', ['item-b', 'order-b', 'dish-rest-b', 1, null, 'pendiente'])
    })

    afterAll(async () => {
        await dbConfig.close()
    })

    describe('POST /orders', () => {
        it('devuelve 500 genérico, sin filtrar el mensaje interno, ante un fallo inesperado', async () => {
            const res = await request(app)
                .post('/api/v1/orders')
                .set(auth(clienteDueno))
                .send({ restaurantId: 'rest-a', items: [{ dishId: 'plato-inexistente', quantity: 1, notes: null }] })
            expect(res.status).toBe(500)
            expect(JSON.stringify(res.body)).not.toMatch(/SQLITE|FOREIGN KEY/i)
        })
    })

    describe('GET /orders/active', () => {
        it('devuelve 403 a un cliente', async () => {
            const res = await request(app).get('/api/v1/orders/active?restaurantId=rest-a').set(auth(clienteDueno))
            expect(res.status).toBe(403)
        })

        it('un cocinero solo ve los pedidos de su restaurante e ignora el parámetro', async () => {
            const res = await request(app).get('/api/v1/orders/active?restaurantId=rest-b').set(auth(cocineroA))
            expect(res.status).toBe(200)
            expect(res.body.map((o: any) => o.id)).toEqual(['order-a'])
        })

        it('un admin puede consultar el restaurante indicado en el parámetro', async () => {
            const res = await request(app).get('/api/v1/orders/active?restaurantId=rest-b').set(auth(admin))
            expect(res.status).toBe(200)
            expect(res.body.map((o: any) => o.id)).toEqual(['order-b'])
        })
    })

    describe('PATCH /orders/:orderId/items/:itemId/status', () => {
        const url = '/api/v1/orders/order-a/items/item-a/status'

        it('devuelve 403 a un cliente', async () => {
            const res = await request(app).patch(url).set(auth(clienteDueno)).send({ status: 'listo' })
            expect(res.status).toBe(403)
        })

        it('devuelve 403 a un cocinero de otro restaurante', async () => {
            const res = await request(app).patch(url).set(auth(cocineroB)).send({ status: 'listo' })
            expect(res.status).toBe(403)
        })

        it('devuelve 404 si el pedido no existe', async () => {
            const res = await request(app).patch('/api/v1/orders/no-existe/items/x/status').set(auth(admin)).send({ status: 'listo' })
            expect(res.status).toBe(404)
        })

        it('devuelve 400 si el estado es inválido', async () => {
            const res = await request(app).patch(url).set(auth(cocineroA)).send({ status: 'volando' })
            expect(res.status).toBe(400)
        })

        it('permite a un cocinero del mismo restaurante', async () => {
            const res = await request(app).patch(url).set(auth(cocineroA)).send({ status: 'preparando' })
            expect(res.status).toBe(204)
        })
    })

    describe('GET /orders/:id', () => {
        it('devuelve 403 a un cliente que no es el dueño', async () => {
            const res = await request(app).get('/api/v1/orders/order-a').set(auth(clienteAjeno))
            expect(res.status).toBe(403)
        })

        it('devuelve 403 al personal de otro restaurante', async () => {
            const res = await request(app).get('/api/v1/orders/order-a').set(auth(cocineroB))
            expect(res.status).toBe(403)
        })

        it('devuelve 200 al dueño del pedido', async () => {
            const res = await request(app).get('/api/v1/orders/order-a').set(auth(clienteDueno))
            expect(res.status).toBe(200)
        })

        it('devuelve 200 al personal del mismo restaurante', async () => {
            const res = await request(app).get('/api/v1/orders/order-a').set(auth(cocineroA))
            expect(res.status).toBe(200)
        })

        it('devuelve 404 si el pedido no existe', async () => {
            const res = await request(app).get('/api/v1/orders/no-existe').set(auth(admin))
            expect(res.status).toBe(404)
        })
    })

    describe('Número de mesa (tableNumber) en los pedidos', () => {
        const clienteMesas = token({ id: 'cliente-mesas', role: 'cliente', restaurantId: null })

        const crearPedido = async (id: string, restaurantId: string, tableId: string | null) => {
            await dbConfig.run('INSERT INTO orders (id, restaurant_id, table_id, client_id, created_at) VALUES (?, ?, ?, ?, ?)', [id, restaurantId, tableId, 'cliente-mesas', new Date().toISOString()])
            await dbConfig.run('INSERT INTO order_items (id, order_id, dish_id, quantity, notes, status) VALUES (?, ?, ?, ?, ?, ?)', [`item-${id}`, id, `dish-${restaurantId}`, 1, null, 'pendiente'])
        }

        beforeAll(async () => {
            const ahora = new Date().toISOString()
            const mesas: [string, string, number][] = [['mesa-a-7', 'rest-a', 7], ['mesa-b-3', 'rest-b', 3]]
            for (const [id, restaurantId, number] of mesas) {
                await dbConfig.run(
                    'INSERT INTO restaurant_tables (id, restaurant_id, number, description, capacity, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [id, restaurantId, number, null, 4, 'ocupada', ahora, ahora]
                )
            }
            await crearPedido('order-mesa', 'rest-a', 'mesa-a-7')
            await crearPedido('order-antiguo', 'rest-a', '5')
            await crearPedido('order-mesa-ajena', 'rest-a', 'mesa-b-3')
        })

        const numeros = (pedidos: any[]) => Object.fromEntries(pedidos.map(p => [p.id, p.tableNumber]))

        it('GET /orders/:id devuelve el número de la mesa del pedido', async () => {
            const res = await request(app).get('/api/v1/orders/order-mesa').set(auth(cocineroA))
            expect(res.status).toBe(200)
            expect(res.body).toMatchObject({ tableId: 'mesa-a-7', tableNumber: 7, restaurantName: 'rest-a' })
        })

        it('GET /orders/:id devuelve tableNumber null si el pedido no tiene mesa', async () => {
            const res = await request(app).get('/api/v1/orders/order-a').set(auth(clienteDueno))
            expect(res.status).toBe(200)
            expect(res.body).toHaveProperty('tableNumber', null)
        })

        it('GET /orders/active incluye tableNumber en cada pedido', async () => {
            const res = await request(app).get('/api/v1/orders/active').set(auth(cocineroA))
            expect(res.status).toBe(200)
            expect(numeros(res.body)).toEqual({
                'order-a': null,
                'order-mesa': 7,
                'order-antiguo': null,
                'order-mesa-ajena': null
            })
        })

        it('GET /orders/mine incluye tableNumber en cada pedido', async () => {
            const res = await request(app).get('/api/v1/orders/mine').set(auth(clienteMesas))
            expect(res.status).toBe(200)
            expect(numeros(res.body)).toEqual({
                'order-mesa': 7,
                'order-antiguo': null,
                'order-mesa-ajena': null
            })
        })

        it('POST /orders guarda el tableId recibido y su detalle devuelve el número de mesa', async () => {
            const alta = await request(app)
                .post('/api/v1/orders')
                .set(auth(clienteMesas))
                .send({ restaurantId: 'rest-a', tableId: 'mesa-a-7', items: [{ dishId: 'dish-rest-a', quantity: 1, notes: null }] })
            expect(alta.status).toBe(201)
            expect(alta.body.tableId).toBe('mesa-a-7')
            expect(alta.body).not.toHaveProperty('tableNumber')

            const detalle = await request(app).get(`/api/v1/orders/${alta.body.id}`).set(auth(clienteMesas))
            expect(detalle.body.tableNumber).toBe(7)
        })
    })
})
