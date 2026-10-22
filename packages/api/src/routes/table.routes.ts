import { Router } from 'express'
import { TableController } from '@controllers/table.controller.js'
import { dbConfig } from '@config/database.js'
import { SqliteTableRepository } from '@repositories/table.repository.js'
import { TableService } from '@services/table.service.js'
import { authenticate, authorize, authorizeRestaurant } from '@shared/infrastructure/http/middlewares.js'

const tableRepository = new SqliteTableRepository(dbConfig)
const tableService = new TableService(tableRepository)
const tableController = new TableController(tableService)

const PERSONAL = ['admin', 'manager', 'camarero', 'cocinero']

const router = Router({ mergeParams: true })

router.get('/', authenticate, authorize(PERSONAL), authorizeRestaurant, tableController.getAll)
router.get('/:id', authenticate, authorize(PERSONAL), authorizeRestaurant, tableController.getById)
router.post('/', authenticate, authorize(['admin']), tableController.create)
router.put('/:id', authenticate, authorize(['admin']), tableController.update)
router.delete('/:id', authenticate, authorize(['admin']), tableController.delete)
router.patch('/:id/status', authenticate, authorize(PERSONAL), authorizeRestaurant, tableController.changeStatus)
// Los clientes no tienen restaurante asignado: no se aplica authorizeRestaurant
router.post('/:id/occupy', authenticate, authorize(['cliente']), tableController.occupy)

export default router
