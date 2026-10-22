import { randomUUID } from 'crypto'
import type { Order, OrderItem } from '@models/order.model.js'
import { normalizeOrderStatus } from '@models/order.model.js'
import type { OrderRepository } from '@repositories/order.repository.js'
import { RestaurantIdRequiredError, OrderNotFoundError, ForbiddenError } from '@errors/DomainErrors.js'

export interface CreateOrderRequest {
    restaurantId: string
    tableId: string | null
    clientId: string | null
    items: {
        dishId: string
        quantity: number
        notes: string | null
    }[]
}

export interface AuthenticatedUser {
    id: string
    role: string
    restaurantId: string | null
}

const esAdmin = (user: AuthenticatedUser): boolean => user.role === 'admin'

const esPersonalDelRestaurante = (user: AuthenticatedUser, restaurantId: string): boolean =>
    user.role !== 'cliente' && user.restaurantId !== null && user.restaurantId === restaurantId

export class OrderService {
    constructor(private readonly orderRepository: OrderRepository) {}

    async create(request: CreateOrderRequest): Promise<Order> {
        if (!request.restaurantId || request.restaurantId.trim() === '') {
            throw new RestaurantIdRequiredError()
        }

        const items: OrderItem[] = []
        for (const item of request.items) {
            for (let i = 0; i < item.quantity; i++) {
                items.push({
                    id: randomUUID(),
                    dishId: item.dishId,
                    quantity: 1,
                    notes: item.notes,
                    status: 'pendiente'
                })
            }
        }

        const order: Order = {
            id: randomUUID(),
            restaurantId: request.restaurantId,
            tableId: request.tableId,
            clientId: request.clientId,
            createdAt: new Date(),
            items
        }

        await this.orderRepository.create(order)

        return order
    }

    async listActive(user: AuthenticatedUser, requestedRestaurantId: string): Promise<Order[]> {
        const restaurantId = esAdmin(user) ? requestedRestaurantId : user.restaurantId
        if (!restaurantId) {
            throw new ForbiddenError()
        }
        return this.orderRepository.findActiveByRestaurant(restaurantId)
    }

    async getById(orderId: string, user: AuthenticatedUser): Promise<Order> {
        const order = await this.orderRepository.findById(orderId)
        if (!order) {
            throw new OrderNotFoundError()
        }
        const esDueno = order.clientId !== null && order.clientId === user.id
        if (!esAdmin(user) && !esDueno && !esPersonalDelRestaurante(user, order.restaurantId)) {
            throw new ForbiddenError()
        }
        return order
    }

    async getByClientId(clientId: string): Promise<Order[]> {
        return this.orderRepository.findByClientId(clientId)
    }

    async updateItemStatus(orderId: string, itemId: string, status: string, user: AuthenticatedUser): Promise<void> {
        const order = await this.orderRepository.findById(orderId)
        if (!order) {
            throw new OrderNotFoundError()
        }
        if (!esAdmin(user) && !esPersonalDelRestaurante(user, order.restaurantId)) {
            throw new ForbiddenError()
        }

        const item = order.items.find(i => i.id === itemId)
        if (!item) {
            throw new OrderNotFoundError() // Or ItemNotFoundError
        }

        const normalizedStatus = normalizeOrderStatus(status)
        item.status = normalizedStatus

        await this.orderRepository.updateItemStatus(orderId, itemId, normalizedStatus)
    }
}
