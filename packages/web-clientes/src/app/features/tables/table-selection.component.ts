import { Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { HttpErrorResponse } from '@angular/common/http'
import { CartStore } from '../../core/store/cart.store'
import { TableService } from '../../core/services/table.service'
import { Table } from '../../core/models/table.model'

@Component({
  selector: 'app-table-selection',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container">
      <div class="page-header">
        <a routerLink="/restaurants" class="back-link">← Volver a restaurantes</a>
        <h1>Elige tu mesa</h1>
        <p>Indica cuántas personas sois y selecciona una mesa libre</p>
      </div>

      <form class="search-box card" (submit)="$event.preventDefault(); search()">
        <div class="form-group">
          <label for="people">Número de personas</label>
          <input
            id="people"
            class="form-control"
            type="number"
            min="1"
            step="1"
            [value]="people()"
            (input)="onPeopleInput($event)"
          />
        </div>
        <button type="submit" class="btn btn-primary" [disabled]="loading() || occupying()">
          Buscar mesas
        </button>
      </form>

      @if (error()) {
        <div class="alert-error">{{ error() }}</div>
      }
      @if (notice()) {
        <div class="alert-notice">{{ notice() }}</div>
      }

      @if (loading()) {
        <div class="spinner"></div>
      } @else if (tables() !== null) {
        @if (tables()!.length === 0) {
          <div class="empty-state card">
            <p>No hay mesas libres para {{ searchedPeople() }} personas en este momento</p>
          </div>
        } @else {
          <div class="tables-grid">
            @for (table of tables(); track table.id) {
              <button
                type="button"
                class="table-card card"
                [class.selected]="selectedId() === table.id"
                [disabled]="occupying()"
                (click)="selectedId.set(table.id)"
              >
                <span class="table-number">Mesa {{ table.number }}</span>
                <span class="table-capacity">Hasta {{ table.capacity }} personas</span>
                @if (table.description) {
                  <span class="table-description">{{ table.description }}</span>
                }
              </button>
            }
          </div>

          <div class="actions">
            <button
              type="button"
              class="btn btn-primary"
              [disabled]="!selectedId() || occupying()"
              (click)="confirmTable()"
            >
              @if (occupying()) {
                Reservando mesa...
              } @else {
                Continuar
              }
            </button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .back-link {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 8px;
      display: inline-block;
    }
    .search-box {
      display: flex;
      align-items: flex-end;
      gap: 16px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .search-box .form-group {
      flex: 1;
      margin-bottom: 0;
    }
    .alert-notice {
      background: var(--bg-hover);
      border: 1px solid var(--yellow);
      color: var(--yellow);
      border-radius: var(--radius-sm);
      padding: 12px 16px;
      margin-bottom: 16px;
      font-size: 14px;
    }
    .tables-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }
    .table-card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 16px 20px;
      text-align: left;
      cursor: pointer;
      color: var(--text-primary);
      transition: all var(--transition);
    }
    .table-card:hover:not(:disabled) {
      border-color: var(--green-medium);
    }
    .table-card.selected {
      border-color: var(--green-light);
      box-shadow: var(--shadow-glow);
      background: var(--bg-hover);
    }
    .table-card:disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }
    .table-number {
      font-size: 16px;
      font-weight: 600;
    }
    .table-capacity {
      font-size: 13px;
      color: var(--text-secondary);
    }
    .table-description {
      font-size: 13px;
      color: var(--text-muted);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 20px;
    }
    @media (max-width: 600px) {
      .search-box {
        flex-direction: column;
        align-items: stretch;
      }
    }
  `]
})
export class TableSelectionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly tableService = inject(TableService)
  private readonly cartStore = inject(CartStore)

  private restaurantId = ''

  readonly people = signal('2')
  readonly searchedPeople = signal<number | null>(null)
  readonly tables = signal<Table[] | null>(null)
  readonly selectedId = signal<string | null>(null)
  readonly loading = signal(false)
  readonly occupying = signal(false)
  readonly error = signal<string | null>(null)
  readonly notice = signal<string | null>(null)

  ngOnInit(): void {
    this.restaurantId = this.route.snapshot.paramMap.get('id')!

    // Si ya tiene mesa en este restaurante, no se ocupa otra: directo a la carta
    if (this.cartStore.restaurantId() === this.restaurantId && this.cartStore.tableId()) {
      this.router.navigate(['/restaurants', this.restaurantId], { replaceUrl: true })
    }
  }

  onPeopleInput(event: Event): void {
    this.people.set((event.target as HTMLInputElement).value)
  }

  search(): void {
    const people = Number(this.people())
    if (this.people().trim() === '' || !Number.isInteger(people) || people < 1) {
      this.error.set('Indica un número de personas válido (entero, mínimo 1)')
      return
    }
    this.error.set(null)
    this.notice.set(null)
    this.loadTables(people)
  }

  confirmTable(): void {
    const tableId = this.selectedId()
    const people = this.searchedPeople()
    if (!tableId || people === null) return

    this.occupying.set(true)
    this.error.set(null)
    this.notice.set(null)

    this.tableService.occupy(this.restaurantId, tableId, people).subscribe({
      next: (table) => {
        this.cartStore.selectTable(this.restaurantId, table)
        this.router.navigate(['/restaurants', this.restaurantId])
      },
      error: (err: HttpErrorResponse) => {
        this.occupying.set(false)
        if (err.status === 409 || err.status === 404) {
          this.notice.set('Esa mesa acaba de ocuparse. Elige otra de la lista actualizada.')
          this.loadTables(people)
        } else if (err.status === 400) {
          this.error.set(err.error?.message ?? 'El número de personas no es válido para esta mesa')
        } else if (err.status === 403) {
          this.error.set('Solo los clientes pueden ocupar una mesa')
        } else {
          this.error.set('Error al reservar la mesa. Inténtalo de nuevo.')
        }
      }
    })
  }

  private loadTables(people: number): void {
    this.loading.set(true)
    this.selectedId.set(null)

    this.tableService.getAvailable(this.restaurantId, people).subscribe({
      next: (tables) => {
        this.searchedPeople.set(people)
        this.tables.set(tables)
        this.loading.set(false)
      },
      error: (err: HttpErrorResponse) => {
        this.tables.set(null)
        this.error.set(
          err.status === 400
            ? err.error?.message ?? 'Indica un número de personas válido'
            : 'Error al cargar las mesas'
        )
        this.loading.set(false)
      }
    })
  }
}
