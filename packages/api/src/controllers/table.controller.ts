import type { Request, Response, NextFunction } from 'express'
import type { TableService } from '@services/table.service.js'
import type { Table } from '@models/table.model.js'

// En Express 5 req.body es undefined si la petición no trae JSON; así el servicio responde con su 400
const bodyOf = (req: Request): Record<string, any> => req.body ?? {}

// ?people llega como texto: solo se convierte si son dígitos; cualquier otro valor lo rechaza el servicio
const parsePeopleQuery = (value: unknown): unknown =>
    typeof value === 'string' && /^[0-9]+$/.test(value) ? Number(value) : value

export class TableController {
    constructor(private readonly tableService: TableService) {}

    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const body = bodyOf(req)
            const table = await this.tableService.create({
                restaurantId: req.params.restaurantId as string,
                number: body.number,
                capacity: body.capacity,
                description: body.description,
                status: body.status
            })
            res.status(201).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const tables = await this.tableService.listByRestaurant(req.params.restaurantId as string)
            res.status(200).json(tables.map(t => this.toJSON(t)))
        } catch (error) {
            next(error)
        }
    }

    getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.getById(req.params.restaurantId as string, req.params.id as string)
            res.status(200).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const body = bodyOf(req)
            const table = await this.tableService.update(req.params.restaurantId as string, req.params.id as string, {
                number: body.number,
                capacity: body.capacity,
                description: body.description,
                status: body.status
            })
            res.status(200).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await this.tableService.delete(req.params.restaurantId as string, req.params.id as string)
            res.status(204).send()
        } catch (error) {
            next(error)
        }
    }

    changeStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.changeStatus(
                req.params.restaurantId as string,
                req.params.id as string,
                bodyOf(req).status
            )
            res.status(200).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    getAvailable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const tables = await this.tableService.listAvailable(
                req.params.restaurantId as string,
                parsePeopleQuery(req.query.people)
            )
            res.status(200).json(tables.map(t => this.toJSON(t)))
        } catch (error) {
            next(error)
        }
    }

    occupy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.occupy(
                req.params.restaurantId as string,
                req.params.id as string,
                bodyOf(req).people
            )
            res.status(200).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    private toJSON(table: Table) {
        return {
            id: table.id,
            restaurantId: table.restaurantId,
            number: table.number,
            description: table.description,
            capacity: table.capacity,
            status: table.status,
            createdAt: table.createdAt,
            updatedAt: table.updatedAt
        }
    }
}
