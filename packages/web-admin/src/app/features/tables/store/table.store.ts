import { Injectable, inject, signal } from '@angular/core'
import { firstValueFrom } from 'rxjs'
import { TableService } from '../services/table.service'
import { getTableErrorMessage } from '../utils/table-error'
import type { Table, CreateTableDto, UpdateTableDto } from '../models/table.model'

@Injectable({ providedIn: 'root' })
export class TableStore {
  private readonly service = inject(TableService)

  private readonly _tables = signal<Table[]>([])
  private readonly _loading = signal(false)
  private readonly _error = signal<string | null>(null)

  readonly tables = this._tables.asReadonly()
  readonly loading = this._loading.asReadonly()
  readonly error = this._error.asReadonly()

  async loadByRestaurant(restaurantId: string): Promise<void> {
    this._loading.set(true)
    this._error.set(null)
    try {
      const data = await firstValueFrom(this.service.getAll(restaurantId))
      this._tables.set(data)
    } catch (err) {
      this._tables.set([])
      this._error.set(getTableErrorMessage(err, 'No se pudieron cargar las mesas.'))
    } finally {
      this._loading.set(false)
    }
  }

  async create(restaurantId: string, dto: CreateTableDto): Promise<void> {
    const table = await firstValueFrom(this.service.create(restaurantId, dto))
    this._tables.update(list => this.sortByNumber([...list, table]))
  }

  async update(restaurantId: string, id: string, dto: UpdateTableDto): Promise<void> {
    const updated = await firstValueFrom(this.service.update(restaurantId, id, dto))
    this._tables.update(list => this.sortByNumber(list.map(t => t.id === id ? updated : t)))
  }

  async delete(restaurantId: string, id: string): Promise<void> {
    await firstValueFrom(this.service.delete(restaurantId, id))
    this._tables.update(list => list.filter(t => t.id !== id))
  }

  // La API devuelve las mesas ordenadas por número; se mantiene el orden tras crear o editar.
  private sortByNumber(list: Table[]): Table[] {
    return [...list].sort((a, b) => a.number - b.number)
  }
}
