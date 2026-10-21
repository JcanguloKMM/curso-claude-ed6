import { describe, it, expect, vi } from 'vitest'
import { errorHandler } from './errorHandler.js'
import { OrderNotFoundError, ForbiddenError, InvalidOrderStatusError } from '@errors/DomainErrors.js'

const manejar = (err: unknown) => {
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    errorHandler(err, {} as any, res, vi.fn())
    return res
}

describe('errorHandler', () => {
    it('mapea OrderNotFoundError a 404', () => {
        expect(manejar(new OrderNotFoundError()).status).toHaveBeenCalledWith(404)
    })

    it('mapea ForbiddenError a 403', () => {
        expect(manejar(new ForbiddenError()).status).toHaveBeenCalledWith(403)
    })

    it('mapea InvalidOrderStatusError a 400', () => {
        expect(manejar(new InvalidOrderStatusError('malo')).status).toHaveBeenCalledWith(400)
    })

    it('devuelve un 500 genérico sin filtrar el mensaje de un error interno', () => {
        const res = manejar(new Error('SQLITE_ERROR: no such table secretos'))
        expect(res.status).toHaveBeenCalledWith(500)
        expect(JSON.stringify(res.json.mock.calls[0])).not.toContain('SQLITE')
    })
})
