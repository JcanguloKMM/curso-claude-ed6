import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TableController } from './table.controller.js'
import type { TableService } from '@services/table.service.js'
import type { Table } from '@models/table.model.js'
import { TableNotFoundError } from '@errors/DomainErrors.js'

const mesa: Table = {
    id: 'mesa-rest-1-3',
    restaurantId: 'rest-1',
    number: 3,
    description: null,
    capacity: 4,
    status: 'libre',
    createdAt: '2026-10-22T08:00:00.000Z',
    updatedAt: '2026-10-22T08:00:00.000Z'
}

const crearRes = () => {
    const res: any = {}
    res.status = vi.fn().mockReturnValue(res)
    res.json = vi.fn().mockReturnValue(res)
    res.send = vi.fn().mockReturnValue(res)
    return res
}

describe('TableController', () => {
    let service: Record<string, ReturnType<typeof vi.fn>>
    let controller: TableController
    let next: ReturnType<typeof vi.fn>

    beforeEach(() => {
        service = {
            create: vi.fn().mockResolvedValue(mesa),
            listByRestaurant: vi.fn().mockResolvedValue([mesa]),
            getById: vi.fn().mockResolvedValue(mesa),
            update: vi.fn().mockResolvedValue(mesa),
            delete: vi.fn().mockResolvedValue(undefined),
            changeStatus: vi.fn().mockResolvedValue({ ...mesa, status: 'reservada' }),
            listAvailable: vi.fn().mockResolvedValue([mesa]),
            occupy: vi.fn().mockResolvedValue({ ...mesa, status: 'ocupada' })
        }
        controller = new TableController(service as unknown as TableService)
        next = vi.fn()
    })

    it('create responde 201 con la mesa en el formato del contrato e ignora restaurantId del cuerpo', async () => {
        const res = crearRes()
        const body = { number: 3, capacity: 4, description: 'Terraza', status: 'libre', restaurantId: 'otro', extra: 1 }
        await controller.create({ params: { restaurantId: 'rest-1' }, body } as any, res, next)

        expect(service.create).toHaveBeenCalledWith({ restaurantId: 'rest-1', number: 3, capacity: 4, description: 'Terraza', status: 'libre' })
        expect(res.status).toHaveBeenCalledWith(201)
        expect(res.json).toHaveBeenCalledWith(mesa)
        expect(Object.keys(res.json.mock.calls[0][0])).toEqual(['id', 'restaurantId', 'number', 'description', 'capacity', 'status', 'createdAt', 'updatedAt'])
    })

    it('create sin cuerpo pasa los campos como undefined para que valide el servicio', async () => {
        const res = crearRes()
        await controller.create({ params: { restaurantId: 'rest-1' } } as any, res, next)

        expect(service.create).toHaveBeenCalledWith({ restaurantId: 'rest-1', number: undefined, capacity: undefined, description: undefined, status: undefined })
        expect(next).not.toHaveBeenCalled()
    })

    it('getAll responde 200 con un array plano', async () => {
        const res = crearRes()
        await controller.getAll({ params: { restaurantId: 'rest-1' } } as any, res, next)

        expect(service.listByRestaurant).toHaveBeenCalledWith('rest-1')
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith([mesa])
    })

    it('getById, update y delete usan el restaurante y el id de la URL', async () => {
        const params = { restaurantId: 'rest-1', id: 'mesa-rest-1-3' }

        const resGet = crearRes()
        await controller.getById({ params } as any, resGet, next)
        expect(service.getById).toHaveBeenCalledWith('rest-1', 'mesa-rest-1-3')
        expect(resGet.status).toHaveBeenCalledWith(200)

        const resPut = crearRes()
        await controller.update({ params, body: { number: 3, capacity: 5 } } as any, resPut, next)
        expect(service.update).toHaveBeenCalledWith('rest-1', 'mesa-rest-1-3', { number: 3, capacity: 5, description: undefined, status: undefined })
        expect(resPut.status).toHaveBeenCalledWith(200)

        const resDelete = crearRes()
        await controller.delete({ params } as any, resDelete, next)
        expect(service.delete).toHaveBeenCalledWith('rest-1', 'mesa-rest-1-3')
        expect(resDelete.status).toHaveBeenCalledWith(204)
        expect(resDelete.send).toHaveBeenCalledWith()
    })

    it('changeStatus pasa body.status y responde 200 con la mesa', async () => {
        const res = crearRes()
        await controller.changeStatus({ params: { restaurantId: 'rest-1', id: 'mesa-rest-1-3' }, body: { status: 'reservada' } } as any, res, next)

        expect(service.changeStatus).toHaveBeenCalledWith('rest-1', 'mesa-rest-1-3', 'reservada')
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith({ ...mesa, status: 'reservada' })
    })

    it('occupy pasa body.people y responde 200 con la mesa ocupada', async () => {
        const res = crearRes()
        await controller.occupy({ params: { restaurantId: 'rest-1', id: 'mesa-rest-1-3' }, body: { people: 4 } } as any, res, next)

        expect(service.occupy).toHaveBeenCalledWith('rest-1', 'mesa-rest-1-3', 4)
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith({ ...mesa, status: 'ocupada' })
    })

    it.each([
        ['4', 4],
        ['0', 0],
        ['2.5', '2.5'],
        ['abc', 'abc'],
        [undefined, undefined],
        [['2', '3'], ['2', '3']]
    ])('getAvailable convierte ?people=%s en %s antes de pasarlo al servicio', async (query, esperado) => {
        const res = crearRes()
        await controller.getAvailable({ params: { restaurantId: 'rest-1' }, query: { people: query } } as any, res, next)

        expect(service.listAvailable).toHaveBeenCalledWith('rest-1', esperado)
    })

    it('getAvailable responde 200 con un array plano', async () => {
        const res = crearRes()
        await controller.getAvailable({ params: { restaurantId: 'rest-1' }, query: { people: '2' } } as any, res, next)

        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith([mesa])
    })

    it('delega los errores en next', async () => {
        const error = new TableNotFoundError()
        service.getById!.mockRejectedValue(error)
        const res = crearRes()
        await controller.getById({ params: { restaurantId: 'rest-1', id: 'x' } } as any, res, next)

        expect(next).toHaveBeenCalledWith(error)
        expect(res.status).not.toHaveBeenCalled()
    })
})
