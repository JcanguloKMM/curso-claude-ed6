import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { AuthStore } from '@resttek/web-shared';
import { TableStore } from '../../store/table.store';
import { Table, TableStatus } from '../../models/table.model';

@Component({
  selector: 'app-mesas',
  standalone: true,
  templateUrl: './mesas.component.html',
  styleUrl: './mesas.component.css'
})
export class MesasComponent implements OnInit, OnDestroy {
  private readonly authStore = inject(AuthStore);
  readonly tableStore = inject(TableStore);

  readonly statuses: TableStatus[] = ['libre', 'ocupada', 'reservada'];

  // Id de la mesa cuyo estado se está cambiando (deshabilita su selector)
  private readonly _changingId = signal<string | null>(null);
  readonly changingId = this._changingId.asReadonly();

  private get restaurantId(): string | undefined {
    return this.authStore.user()?.restaurantId;
  }

  ngOnInit(): void {
    const restaurantId = this.restaurantId;
    if (restaurantId) {
      this.tableStore.startPolling(restaurantId);
    }
  }

  ngOnDestroy(): void {
    this.tableStore.stopPolling();
  }

  async onStatusChange(table: Table, event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const restaurantId = this.restaurantId;
    if (!restaurantId) return;

    this._changingId.set(table.id);
    await this.tableStore.changeStatus(restaurantId, table.id, select.value as TableStatus);
    this._changingId.set(null);

    // Si el cambio falló, el selector vuelve al estado real de la mesa
    const current = this.tableStore.tables().find(t => t.id === table.id);
    select.value = current?.status ?? table.status;
  }

  getStatusClass(status: TableStatus): string {
    return `status-badge status-${status}`;
  }
}
