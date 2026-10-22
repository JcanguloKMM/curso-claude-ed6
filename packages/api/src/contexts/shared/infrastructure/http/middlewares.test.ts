import { describe, it, expect, vi } from 'vitest'
import { authorizeRestaurant } from './middlewares.js'

const ejecutar = (user: any, restaurantId: string) => {
    const req: any = { user, params: { restaurantId } }
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    const next = vi.fn()
    authorizeRestaurant(req, res, next)
    return { res, next }
}

describe('authorizeRestaurant', () => {
    it('deja pasar a un admin a cualquier restaurante', () => {
        const { next, res } = ejecutar({ id: 'u1', role: 'admin', restaurantId: null }, 'B')
        expect(next).toHaveBeenCalled()
        expect(res.status).not.toHaveBeenCalled()
    })

    it('deja pasar a un usuario del mismo restaurante', () => {
        const { next } = ejecutar({ id: 'u2', role: 'manager', restaurantId: 'A' }, 'A')
        expect(next).toHaveBeenCalled()
    })

    it('devuelve 403 a un usuario de otro restaurante', () => {
        const { next, res } = ejecutar({ id: 'u2', role: 'manager', restaurantId: 'A' }, 'B')
        expect(next).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(403)
    })

    it('devuelve 403 si no hay usuario autenticado', () => {
        const { next, res } = ejecutar(undefined, 'A')
        expect(next).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(403)
    })
})
