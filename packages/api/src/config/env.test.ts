import { describe, it, expect } from 'vitest'
import { loadEnv } from './env.js'

describe('loadEnv', () => {
    it('lanza un error si JWT_SECRET no está definido fuera de test', () => {
        expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/)
    })

    it('lanza un error si JWT_SECRET tiene menos de 32 caracteres', () => {
        expect(() => loadEnv({ NODE_ENV: 'development', JWT_SECRET: 'corto' })).toThrow(/32/)
    })

    it('acepta un JWT_SECRET de 32 o más caracteres', () => {
        const secreto = 'a'.repeat(32)
        expect(loadEnv({ NODE_ENV: 'production', JWT_SECRET: secreto }).jwtSecret).toBe(secreto)
    })

    it('usa un valor fijo de test cuando NODE_ENV=test y no hay secreto', () => {
        const { jwtSecret } = loadEnv({ NODE_ENV: 'test' })
        expect(jwtSecret.length).toBeGreaterThanOrEqual(32)
        expect(jwtSecret).not.toBe('super-secret-resttek-key')
    })
})
