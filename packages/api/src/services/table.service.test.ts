import { describe, it, expect } from 'vitest'
import { normalizeTableStatus } from '@models/table.model.js'
import { InvalidTableStatusError } from '@errors/DomainErrors.js'

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
