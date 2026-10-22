import 'dotenv/config'

const LONGITUD_MINIMA_SECRETO = 32
const SECRETO_DE_TEST = 'secreto-solo-para-tests-resttek-0123456789'

export interface Env {
    jwtSecret: string
}

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
    const secreto = source.JWT_SECRET

    if (!secreto) {
        if (source.NODE_ENV === 'test') {
            return { jwtSecret: SECRETO_DE_TEST }
        }
        throw new Error('La variable de entorno JWT_SECRET es obligatoria')
    }

    if (secreto.length < LONGITUD_MINIMA_SECRETO) {
        throw new Error(`JWT_SECRET debe tener al menos ${LONGITUD_MINIMA_SECRETO} caracteres`)
    }

    return { jwtSecret: secreto }
}

export const env: Env = loadEnv()
