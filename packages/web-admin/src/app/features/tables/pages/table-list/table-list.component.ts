import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { LucideAngularModule } from 'lucide-angular'
import { AuthStore } from '@resttek/web-shared'
import { TableStore } from '../../store/table.store'
import { getTableErrorMessage } from '../../utils/table-error'

@Component({
  selector: 'app-table-list',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './table-list.component.html',
  styleUrl: './table-list.component.css'
})
export class TableListComponent implements OnInit {
  readonly store = inject(TableStore)
  private readonly authStore = inject(AuthStore)
  private readonly route = inject(ActivatedRoute)
  private readonly destroyRef = inject(DestroyRef)
  restaurantId = ''

  // Solo el admin gestiona las mesas; el resto de roles (p. ej. manager) las ve en solo lectura.
  readonly canManage = computed(() => this.authStore.userRole() === 'admin')

  // Error de una acción puntual (borrado). No usa store.error(), que sustituye a toda la tabla.
  readonly actionError = signal<string | null>(null)

  ngOnInit(): void {
    this.route.parent?.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.restaurantId = params.get('restaurantId') ?? ''
        this.actionError.set(null)
        if (this.restaurantId) {
          this.store.loadByRestaurant(this.restaurantId)
        }
      })
  }

  async onDelete(id: string): Promise<void> {
    if (!this.restaurantId) return
    if (confirm('¿Estás seguro de eliminar esta mesa?')) {
      this.actionError.set(null)
      try {
        await this.store.delete(this.restaurantId, id)
      } catch (err) {
        this.actionError.set(getTableErrorMessage(err, 'Error al eliminar la mesa.'))
      }
    }
  }
}
