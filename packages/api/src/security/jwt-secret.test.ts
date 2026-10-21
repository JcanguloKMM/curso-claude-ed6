import { describe, it, expect } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'

const SECRETO_ANTIGUO = 'super-secret-resttek-key'

describe('Secreto JWT hardcodeado (H-02)', () => {
    it('rechaza con 401 un token de admin firmado con el secreto por defecto antiguo', async () => {
        const tokenForjado = jwt.sign(
            { id: 'atacante', role: 'admin', restaurantId: null },
            SECRETO_ANTIGUO,
            { expiresIn: '1h' }
        )

        const res = await request(app)
            .get('/api/v1/employees')
            .set('Authorization', `Bearer ${tokenForjado}`)

        expect(res.status).toBe(401)
    })

    it('rechaza un token con algoritmo "none"', async () => {
        const cabecera = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
        const cuerpo = Buffer.from(JSON.stringify({ id: 'x', role: 'admin' })).toString('base64url')

        const res = await request(app)
            .get('/api/v1/employees')
            .set('Authorization', `Bearer ${cabecera}.${cuerpo}.`)

        expect(res.status).toBe(401)
    })
})
