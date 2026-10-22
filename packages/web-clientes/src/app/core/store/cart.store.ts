import { Injectable, signal, computed } from '@angular/core'
import { Table } from '../models/table.model'

export interface Dish {
  id: string
  name: string
  description: string | null
  price: number
  category: string
  available: boolean
  restaurantId: string
  ingredients: { ingredientId: string; quantity: number }[]
}

export interface CartItem {
  dish: Dish
  quantity: number
  notes: string
}

@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly _items = signal<CartItem[]>([])
  private readonly _restaurantId = signal<string | null>(null)
  private readonly _tableId = signal<string | null>(null)
  private readonly _tableNumber = signal<number | null>(null)

  readonly items = this._items.asReadonly()
  readonly restaurantId = this._restaurantId.asReadonly()
  readonly tableId = this._tableId.asReadonly()
  readonly tableNumber = this._tableNumber.asReadonly()

  readonly total = computed(() =>
    this._items().reduce((sum, item) => sum + item.dish.price * item.quantity, 0)
  )

  readonly itemCount = computed(() =>
    this._items().reduce((count, item) => count + item.quantity, 0)
  )

  selectTable(restaurantId: string, table: Table): void {
    if (this._restaurantId() && this._restaurantId() !== restaurantId) {
      this._items.set([])
    }
    this._restaurantId.set(restaurantId)
    this._tableId.set(table.id)
    this._tableNumber.set(table.number)
  }

  addItem(dish: Dish, quantity: number = 1, notes: string = ''): void {
    if (this._restaurantId() && this._restaurantId() !== dish.restaurantId) {
      this._items.set([])
      this._tableId.set(null)
      this._tableNumber.set(null)
    }
    this._restaurantId.set(dish.restaurantId)

    const existingIndex = this._items().findIndex(
      item => item.dish.id === dish.id && item.notes === notes
    )

    if (existingIndex >= 0) {
      const items = [...this._items()]
      items[existingIndex] = {
        ...items[existingIndex],
        quantity: items[existingIndex].quantity + quantity
      }
      this._items.set(items)
    } else {
      this._items.update(items => [...items, { dish, quantity, notes }])
    }
  }

  removeItem(dishId: string): void {
    const items = this._items().filter(item => item.dish.id !== dishId)
    this._items.set(items)
    // Con mesa elegida el restaurante queda anclado a ella, aunque el carrito se vacíe
    if (items.length === 0 && !this._tableId()) {
      this._restaurantId.set(null)
    }
  }

  updateQuantity(dishId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(dishId)
      return
    }
    const items = this._items().map(item =>
      item.dish.id === dishId ? { ...item, quantity } : item
    )
    this._items.set(items)
  }

  clearItems(): void {
    this._items.set([])
  }

  clear(): void {
    this._items.set([])
    this._restaurantId.set(null)
    this._tableId.set(null)
    this._tableNumber.set(null)
  }
}
