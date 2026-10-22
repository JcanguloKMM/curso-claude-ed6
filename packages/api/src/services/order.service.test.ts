import { describe, it, expect, beforeEach } from 'vitest'
import { OrderService } from './order.service.js'
import { MockOrderRepository } from '@repositories/mocks/MockOrderRepository.js'
import type { Order } from '@models/order.model.js'
import type { AuthenticatedUser } from './order.service.js'
import { OrderNotFoundError, InvalidOrderStatusError, ForbiddenError } from '@errors/DomainErrors.js'

const admin: AuthenticatedUser = { id: 'admin-1', role: 'admin', restaurantId: null }
const cocinero: AuthenticatedUser = { id: 'coc-1', role: 'cocinero', restaurantId: 'rest-1' }
const cocineroOtro: AuthenticatedUser = { id: 'coc-2', role: 'cocinero', restaurantId: 'rest-2' }
const clienteDueno: AuthenticatedUser = { id: 'cli-1', role: 'cliente', restaurantId: null }
const clienteAjeno: AuthenticatedUser = { id: 'cli-2', role: 'cliente', restaurantId: null }

describe('OrderService.updateItemStatus', () => {
    let repo: MockOrderRepository
    let service: OrderService
    let testOrder: Order

    beforeEach(async () => {
        repo = new MockOrderRepository()
        service = new OrderService(repo)

        testOrder = {
            id: 'order-1',
            restaurantId: 'rest-1',
            tableId: null,
            clientId: 'cli-1',
            createdAt: new Date(),
            items: [
                { id: 'item-1', dishId: 'dish-1', quantity: 1, notes: null, status: 'pendiente' }
            ]
        }
        await repo.create(testOrder)
    })

    it('should update the status of an item successfully', async () => {
        await service.updateItemStatus('order-1', 'item-1', 'preparando', cocinero)
        const updatedItem = testOrder.items[0]!
        expect(updatedItem.status).toBe('preparando')
    })

    it('should throw an error if the order does not exist', async () => {
        await expect(service.updateItemStatus('order-bad', 'item-1', 'preparando', cocinero))
            .rejects.toThrow(OrderNotFoundError)
    })

    it('should throw an error if the item does not exist inside the order', async () => {
        await expect(service.updateItemStatus('order-1', 'item-bad', 'preparando', cocinero))
            .rejects.toThrow(OrderNotFoundError)
    })

    it('should throw DomainError if status is invalid', async () => {
        await expect(service.updateItemStatus('order-1', 'item-1', 'invalid-status', cocinero))
            .rejects.toThrow(InvalidOrderStatusError)
    })
})

describe('OrderService: autorización por restaurante y dueño', () => {
    let repo: MockOrderRepository
    let service: OrderService

    beforeEach(async () => {
        repo = new MockOrderRepository()
        service = new OrderService(repo)
        await repo.create({
            id: 'order-1', restaurantId: 'rest-1', tableId: null, clientId: 'cli-1', createdAt: new Date(),
            items: [{ id: 'item-1', dishId: 'dish-1', quantity: 1, notes: null, status: 'pendiente' }]
        })
        await repo.create({
            id: 'order-2', restaurantId: 'rest-2', tableId: null, clientId: 'cli-9', createdAt: new Date(),
            items: [{ id: 'item-2', dishId: 'dish-2', quantity: 1, notes: null, status: 'pendiente' }]
        })
    })

    describe('getById', () => {
        it('permite al dueño del pedido', async () => {
            await expect(service.getById('order-1', clienteDueno)).resolves.toMatchObject({ id: 'order-1' })
        })

        it('permite al personal del mismo restaurante y al admin', async () => {
            await expect(service.getById('order-1', cocinero)).resolves.toBeDefined()
            await expect(service.getById('order-1', admin)).resolves.toBeDefined()
        })

        it('prohíbe a un cliente ajeno', async () => {
            await expect(service.getById('order-1', clienteAjeno)).rejects.toThrow(ForbiddenError)
        })

        it('prohíbe al personal de otro restaurante', async () => {
            await expect(service.getById('order-1', cocineroOtro)).rejects.toThrow(ForbiddenError)
        })

        it('lanza OrderNotFoundError si no existe', async () => {
            await expect(service.getById('nada', admin)).rejects.toThrow(OrderNotFoundError)
        })
    })

    describe('updateItemStatus', () => {
        it('prohíbe al personal de otro restaurante', async () => {
            await expect(service.updateItemStatus('order-1', 'item-1', 'listo', cocineroOtro)).rejects.toThrow(ForbiddenError)
        })

        it('prohíbe a un cliente, aunque sea el dueño', async () => {
            await expect(service.updateItemStatus('order-1', 'item-1', 'listo', clienteDueno)).rejects.toThrow(ForbiddenError)
        })

        it('permite a un admin', async () => {
            await expect(service.updateItemStatus('order-1', 'item-1', 'listo', admin)).resolves.toBeUndefined()
        })
    })

    describe('listActive', () => {
        it('el personal usa el restaurante de su token e ignora el solicitado', async () => {
            const pedidos = await service.listActive(cocinero, 'rest-2')
            expect(pedidos.map(o => o.id)).toEqual(['order-1'])
        })

        it('el admin usa el restaurante solicitado', async () => {
            const pedidos = await service.listActive(admin, 'rest-2')
            expect(pedidos.map(o => o.id)).toEqual(['order-2'])
        })

        it('prohíbe a un usuario sin restaurante que no es admin', async () => {
            await expect(service.listActive(clienteDueno, 'rest-1')).rejects.toThrow(ForbiddenError)
        })
    })
})
