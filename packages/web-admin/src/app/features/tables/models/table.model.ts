export type TableStatus = 'libre' | 'ocupada' | 'reservada'

export interface Table {
  id: string
  restaurantId: string
  number: number
  description: string | null
  capacity: number
  status: TableStatus
  createdAt: string
  updatedAt: string
}

export interface CreateTableDto {
  number: number
  description?: string | null
  capacity: number
  status?: TableStatus
}

// En la edición, `status` es opcional: si se omite, la API conserva el estado actual.
export interface UpdateTableDto {
  number: number
  description: string | null
  capacity: number
  status?: TableStatus
}
