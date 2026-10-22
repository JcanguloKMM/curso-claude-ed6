export interface OrderItem {
  id: string
  dishId: string
  quantity: number
  notes: string | null
  status: string
  dishName?: string | null
  dishPrice?: number | null
}

export interface Order {
  id: string
  restaurantId: string
  restaurantName?: string | null
  restaurantLogoUrl?: string | null
  tableId: string | null
  tableNumber?: number | null
  clientId: string | null
  createdAt: string
  items: OrderItem[]
}
