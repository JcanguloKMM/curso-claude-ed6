import { Component, inject, OnInit, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { LucideAngularModule } from 'lucide-angular'
import { firstValueFrom } from 'rxjs'
import { TableStore } from '../../store/table.store'
import { TableService } from '../../services/table.service'
import { getTableErrorMessage } from '../../utils/table-error'
import type { TableStatus } from '../../models/table.model'

// `number` y `capacity` son null cuando el usuario deja vacío el campo numérico (ngModel).
interface TableFormValue {
  number: number | null
  description: string
  capacity: number | null
  status: TableStatus
}

@Component({
  selector: 'app-table-form',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './table-form.component.html',
  styleUrl: './table-form.component.css'
})
export class TableFormComponent implements OnInit {
  private readonly store = inject(TableStore)
  private readonly service = inject(TableService)
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)

  isEditing = false
  tableId: string | null = null
  restaurantId: string = ''
  loading = signal(false)
  error = signal<string | null>(null)

  statuses: TableStatus[] = ['libre', 'ocupada', 'reservada']

  form: TableFormValue = {
    number: null,
    description: '',
    capacity: null,
    status: 'libre'
  }

  // Estado con el que se cargó la mesa: solo se envía `status` en la edición si el admin lo ha cambiado,
  // para no pisar un cambio de estado hecho por un empleado mientras el formulario estaba abierto.
  private originalStatus: TableStatus | null = null

  get pageTitle(): string {
    return this.isEditing ? 'Editar mesa' : 'Nueva mesa'
  }

  get listUrl(): string {
    return `/restaurants/${this.restaurantId}/tables`
  }

  ngOnInit(): void {
    this.restaurantId = this.route.parent?.snapshot.params['restaurantId'] ?? ''
    const id = this.route.snapshot.paramMap.get('id')

    if (id && this.restaurantId) {
      this.isEditing = true
      this.tableId = id
      this.loadTable()
    }
  }

  private async loadTable(): Promise<void> {
    this.loading.set(true)
    try {
      const table = await firstValueFrom(this.service.getById(this.restaurantId, this.tableId!))
      this.form = {
        number: table.number,
        description: table.description ?? '',
        capacity: table.capacity,
        status: table.status
      }
      this.originalStatus = table.status
    } catch (err) {
      this.error.set(getTableErrorMessage(err, 'No se pudo cargar la mesa.'))
    } finally {
      this.loading.set(false)
    }
  }

  async onSubmit(): Promise<void> {
    this.error.set(null)
    this.loading.set(true)
    try {
      // number y capacity se envían tal cual: si están vacíos (null), la API responde 400 con su mensaje.
      const number = this.form.number as number
      const capacity = this.form.capacity as number

      if (this.isEditing && this.tableId) {
        await this.store.update(this.restaurantId, this.tableId, {
          number,
          description: this.form.description,
          capacity,
          ...(this.form.status !== this.originalStatus && { status: this.form.status })
        })
      } else {
        await this.store.create(this.restaurantId, {
          number,
          description: this.form.description,
          capacity,
          status: this.form.status
        })
      }
      this.router.navigate(['/restaurants', this.restaurantId, 'tables'])
    } catch (err) {
      this.error.set(getTableErrorMessage(err, 'Error al guardar la mesa.'))
    } finally {
      this.loading.set(false)
    }
  }
}
