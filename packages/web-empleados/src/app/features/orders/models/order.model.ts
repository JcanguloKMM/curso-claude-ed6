export type OrderStatus = 'pendiente' | 'preparando' | 'listo' | 'entregado'

export interface OrderItem {
  id: string
  dishId: string
  quantity: number
  notes: string | null
  status: OrderStatus
  // null si el plato ya no existe
  dishName?: string | null
  dishPrice?: number | null
  dishCategory?: string | null
}

export interface Order {
  id: string
  restaurantId: string
  tableId: string | null
  tableNumber?: number | null
  clientId: string | null
  createdAt: string
  items: OrderItem[]
}

export interface UpdateOrderItemStatusDto {
  status: OrderStatus
}
