import { describe, it, expect } from 'vitest'
import * as errores from './DomainErrors.js'
import { AppError } from './AppError.js'

describe('Errores de dominio de mesas', () => {
    const casos: [string, string][] = [
        ['TableNotFoundError', 'Mesa no encontrada'],
        ['InvalidTableNumberError', 'El número de mesa debe ser un entero mayor o igual que 1'],
        ['InvalidTableCapacityError', 'La capacidad de la mesa debe ser un entero mayor o igual que 1'],
        ['InvalidTableDescriptionError', 'La descripción de la mesa debe ser un texto'],
        ['DuplicatedTableNumberError', 'Ya existe una mesa con ese número en el restaurante'],
        ['TableOccupiedError', 'No se puede borrar una mesa ocupada'],
        ['TableNotAvailableError', 'La mesa no está libre'],
        ['InvalidPeopleCountError', 'El número de personas debe ser un entero mayor o igual que 1'],
        ['TableCapacityExceededError', 'El número de personas supera la capacidad de la mesa']
    ]

    it.each(casos)('%s es un AppError con su nombre y el mensaje del contrato', (nombre, mensaje) => {
        const Clase = (errores as Record<string, unknown>)[nombre] as (new () => AppError) | undefined
        expect(Clase).toBeDefined()
        const error = new Clase!()
        expect(error).toBeInstanceOf(AppError)
        expect(error.name).toBe(nombre)
        expect(error.message).toBe(mensaje)
    })
})
