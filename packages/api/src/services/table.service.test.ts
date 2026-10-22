import { describe, it, expect, beforeEach } from 'vitest'
import { normalizeTableStatus } from '@models/table.model.js'
import type { Table } from '@models/table.model.js'
import {
    InvalidTableStatusError,
    InvalidTableNumberError,
    InvalidTableCapacityError,
    InvalidTableDescriptionError,
    DuplicatedTableNumberError,
    TableNotFoundError,
    TableOccupiedError
} from '@errors/DomainErrors.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import { TableService } from './table.service.js'

describe('normalizeTableStatus', () => {
    it('acepta los tres estados válidos', () => {
        for (const estado of ['libre', 'ocupada', 'reservada']) {
            expect(normalizeTableStatus(estado)).toBe(estado)
        }
    })

    it('normaliza mayúsculas y espacios', () => {
        expect(normalizeTableStatus('  Libre ')).toBe('libre')
        expect(normalizeTableStatus('OCUPADA')).toBe('ocupada')
    })

    it('lanza InvalidTableStatusError con un estado desconocido', () => {
        expect(() => normalizeTableStatus('rota')).toThrow(InvalidTableStatusError)
        expect(() => normalizeTableStatus('rota')).toThrow('Estado inválido: rota. Debe ser uno de: libre, ocupada, reservada')
    })

    it('lanza InvalidTableStatusError si el valor no es un texto', () => {
        expect(() => normalizeTableStatus(undefined)).toThrow(InvalidTableStatusError)
        expect(() => normalizeTableStatus(3)).toThrow(InvalidTableStatusError)
        expect(() => normalizeTableStatus('')).toThrow(InvalidTableStatusError)
    })
})

const ahora = '2026-10-22T08:00:00.000Z'

const mesa = (props: Partial<Table> & Pick<Table, 'id' | 'number'>): Table => ({
    restaurantId: 'r1',
    description: null,
    capacity: 4,
    status: 'libre',
    createdAt: ahora,
    updatedAt: ahora,
    ...props
})

describe('TableService', () => {
    let repo: MockTableRepository
    let service: TableService

    beforeEach(() => {
        repo = new MockTableRepository()
        service = new TableService(repo)
    })

    describe('create', () => {
        const valida = { restaurantId: 'r1', number: 20, description: 'Terraza', capacity: 6 }

        it('crea y guarda una mesa libre por defecto', async () => {
            const creada = await service.create(valida)

            expect(creada).toMatchObject({ restaurantId: 'r1', number: 20, description: 'Terraza', capacity: 6, status: 'libre' })
            expect(creada.id).toEqual(expect.any(String))
            expect(creada.createdAt).toBe(creada.updatedAt)
            expect(new Date(creada.createdAt).toISOString()).toBe(creada.createdAt)
            expect(await repo.findById(creada.id)).toEqual(creada)
        })

        it('acepta un estado inicial y lo normaliza', async () => {
            const creada = await service.create({ ...valida, status: ' Reservada ' })
            expect(creada.status).toBe('reservada')
        })

        it('guarda null si la descripción se omite, es null o queda vacía tras el trim', async () => {
            expect((await service.create({ restaurantId: 'r1', number: 1, capacity: 2 })).description).toBeNull()
            expect((await service.create({ ...valida, number: 2, description: null })).description).toBeNull()
            expect((await service.create({ ...valida, number: 3, description: '   ' })).description).toBeNull()
            expect((await service.create({ ...valida, number: 4, description: '  Barra  ' })).description).toBe('Barra')
        })

        it.each([0, -1, 2.5, '3', null, undefined])('rechaza el número de mesa %s con InvalidTableNumberError', async (number) => {
            await expect(service.create({ ...valida, number })).rejects.toThrow(InvalidTableNumberError)
        })

        it.each([0, -2, 1.5, '4', null, undefined])('rechaza la capacidad %s con InvalidTableCapacityError', async (capacity) => {
            await expect(service.create({ ...valida, capacity })).rejects.toThrow(InvalidTableCapacityError)
        })

        it('rechaza una descripción que no es texto con InvalidTableDescriptionError', async () => {
            await expect(service.create({ ...valida, description: 7 })).rejects.toThrow(InvalidTableDescriptionError)
        })

        it('rechaza un estado inválido con InvalidTableStatusError', async () => {
            await expect(service.create({ ...valida, status: 'rota' })).rejects.toThrow(InvalidTableStatusError)
        })

        it('valida el número antes que la capacidad', async () => {
            await expect(service.create({ ...valida, number: 0, capacity: 0 })).rejects.toThrow(InvalidTableNumberError)
        })

        it('rechaza un número repetido en el mismo restaurante con DuplicatedTableNumberError', async () => {
            await service.create(valida)
            await expect(service.create({ ...valida, description: 'Otra' })).rejects.toThrow(DuplicatedTableNumberError)
        })

        it('permite el mismo número en otro restaurante', async () => {
            await service.create(valida)
            await expect(service.create({ ...valida, restaurantId: 'r2' })).resolves.toMatchObject({ restaurantId: 'r2', number: 20 })
        })
    })

    describe('update', () => {
        beforeEach(async () => {
            await repo.save(mesa({ id: 't1', number: 1, description: 'Ventana', capacity: 2, status: 'ocupada' }))
            await repo.save(mesa({ id: 't2', number: 2 }))
            await repo.save(mesa({ id: 'ajena', number: 1, restaurantId: 'r2' }))
        })

        it('actualiza número, descripción y capacidad y conserva el estado si se omite', async () => {
            const actualizada = await service.update('r1', 't1', { number: 5, description: 'Terraza', capacity: 6 })

            expect(actualizada).toMatchObject({ id: 't1', restaurantId: 'r1', number: 5, description: 'Terraza', capacity: 6, status: 'ocupada', createdAt: ahora })
            expect(actualizada.updatedAt).not.toBe(ahora)
            expect(await repo.findById('t1')).toEqual(actualizada)
        })

        it('aplica el estado si se envía', async () => {
            const actualizada = await service.update('r1', 't1', { number: 1, capacity: 2, status: 'LIBRE' })
            expect(actualizada.status).toBe('libre')
        })

        it('borra la descripción si se omite', async () => {
            const actualizada = await service.update('r1', 't1', { number: 1, capacity: 2 })
            expect(actualizada.description).toBeNull()
        })

        it('permite mantener el número propio', async () => {
            await expect(service.update('r1', 't1', { number: 1, capacity: 3 })).resolves.toMatchObject({ number: 1, capacity: 3 })
        })

        it('rechaza el número de otra mesa del restaurante con DuplicatedTableNumberError', async () => {
            await expect(service.update('r1', 't1', { number: 2, capacity: 2 })).rejects.toThrow(DuplicatedTableNumberError)
        })

        it('lanza TableNotFoundError si la mesa no existe', async () => {
            await expect(service.update('r1', 'no-existe', { number: 1, capacity: 2 })).rejects.toThrow(TableNotFoundError)
        })

        it('lanza TableNotFoundError si la mesa es de otro restaurante, antes de validar los datos', async () => {
            await expect(service.update('r1', 'ajena', { number: 0, capacity: 2 })).rejects.toThrow(TableNotFoundError)
            expect((await repo.findById('ajena'))?.restaurantId).toBe('r2')
        })

        it('valida los datos igual que al crear', async () => {
            await expect(service.update('r1', 't1', { number: 'a', capacity: 2 })).rejects.toThrow(InvalidTableNumberError)
            await expect(service.update('r1', 't1', { number: 1, capacity: 0 })).rejects.toThrow(InvalidTableCapacityError)
            await expect(service.update('r1', 't1', { number: 1, capacity: 2, description: [] })).rejects.toThrow(InvalidTableDescriptionError)
            await expect(service.update('r1', 't1', { number: 1, capacity: 2, status: 'rota' })).rejects.toThrow(InvalidTableStatusError)
        })
    })

    describe('listByRestaurant, getById y delete', () => {
        beforeEach(async () => {
            await repo.save(mesa({ id: 't3', number: 3 }))
            await repo.save(mesa({ id: 't1', number: 1, status: 'ocupada' }))
            await repo.save(mesa({ id: 't2', number: 2, status: 'reservada' }))
            await repo.save(mesa({ id: 'ajena', number: 1, restaurantId: 'r2' }))
        })

        it('lista las mesas del restaurante ordenadas por número', async () => {
            const mesas = await service.listByRestaurant('r1')
            expect(mesas.map(m => m.id)).toEqual(['t1', 't2', 't3'])
        })

        it('devuelve una lista vacía si el restaurante no tiene mesas', async () => {
            expect(await service.listByRestaurant('sin-mesas')).toEqual([])
        })

        it('obtiene una mesa del restaurante por id', async () => {
            expect((await service.getById('r1', 't2')).number).toBe(2)
        })

        it('lanza TableNotFoundError al obtener una mesa inexistente o de otro restaurante', async () => {
            await expect(service.getById('r1', 'no-existe')).rejects.toThrow(TableNotFoundError)
            await expect(service.getById('r1', 'ajena')).rejects.toThrow(TableNotFoundError)
        })

        it('borra una mesa libre o reservada', async () => {
            await service.delete('r1', 't3')
            await service.delete('r1', 't2')
            expect(await repo.findById('t3')).toBeNull()
            expect(await repo.findById('t2')).toBeNull()
        })

        it('lanza TableOccupiedError al borrar una mesa ocupada y no la borra', async () => {
            await expect(service.delete('r1', 't1')).rejects.toThrow(TableOccupiedError)
            expect(await repo.findById('t1')).not.toBeNull()
        })

        it('lanza TableNotFoundError al borrar una mesa inexistente o de otro restaurante', async () => {
            await expect(service.delete('r1', 'no-existe')).rejects.toThrow(TableNotFoundError)
            await expect(service.delete('r1', 'ajena')).rejects.toThrow(TableNotFoundError)
            expect(await repo.findById('ajena')).not.toBeNull()
        })
    })
})
