import type { Request, Response } from 'express'
import type { AuthenticatedUser, OrderService } from '@services/order.service.js'

const sinPermiso = (error: unknown): boolean => error instanceof Error && error.name === 'ForbiddenError'

export class OrderController {
    constructor(private readonly orderService: OrderService) {}

    async createOrder(req: Request, res: Response): Promise<void> {
        try {
            const { restaurantId, tableId, items } = req.body
            const user = (req as any).user
            const clientId = user?.id ?? null
            const order = await this.orderService.create({
                restaurantId,
                tableId: tableId ?? null,
                clientId,
                items
            })
            res.status(201).json(order)
        } catch (error) {
            if (error instanceof Error) {
                res.status(400).json({ error: error.message })
            } else {
                res.status(500).json({ error: 'Internal Server Error' })
            }
        }
    }

    async getActiveOrders(req: Request, res: Response): Promise<void> {
        try {
            const user = (req as any).user as AuthenticatedUser
            const { restaurantId } = req.query
            if (user.role === 'admin' && (!restaurantId || typeof restaurantId !== 'string')) {
                res.status(400).json({ error: 'restaurantId is required' })
                return
            }

            const orders = await this.orderService.listActive(user, String(restaurantId ?? ''))
            res.status(200).json(orders)
        } catch (error) {
            if (sinPermiso(error)) {
                res.status(403).json({ error: 'Forbidden: Insufficient permissions' })
                return
            }
            res.status(500).json({ error: 'Internal Server Error' })
        }
    }

    async getMyOrders(req: Request, res: Response): Promise<void> {
        try {
            const user = (req as any).user
            if (!user?.id) {
                res.status(401).json({ error: 'Unauthorized' })
                return
            }
            const orders = await this.orderService.getByClientId(user.id)
            res.status(200).json(orders)
        } catch (error) {
            res.status(500).json({ error: 'Internal Server Error' })
        }
    }

    async getById(req: Request, res: Response): Promise<void> {
        try {
            const order = await this.orderService.getById(req.params.id as string, (req as any).user)
            res.status(200).json(order)
        } catch (error) {
            if (sinPermiso(error)) {
                res.status(403).json({ error: 'Forbidden: Insufficient permissions' })
                return
            }
            if (error instanceof Error && error.name === 'OrderNotFoundError') {
                res.status(404).json({ error: error.message })
            } else {
                res.status(500).json({ error: 'Internal Server Error' })
            }
        }
    }

    async updateItemStatus(req: Request, res: Response): Promise<void> {
        try {
            const orderId = req.params.orderId as string
            const itemId = req.params.itemId as string
            const { status } = req.body

            await this.orderService.updateItemStatus(orderId, itemId, status, (req as any).user)
            res.status(204).send()
        } catch (error) {
            if (sinPermiso(error)) {
                res.status(403).json({ error: 'Forbidden: Insufficient permissions' })
                return
            }
            if (error instanceof Error && (error.name === 'OrderNotFoundError' || error.name === 'InvalidOrderStatusError')) {
                res.status(400).json({ error: error.message })
            } else {
                res.status(500).json({ error: 'Internal Server Error' })
            }
        }
    }
}
