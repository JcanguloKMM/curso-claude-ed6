import { Injectable, inject } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable } from 'rxjs'
import { API_URL } from '@resttek/web-shared'
import { Table } from '../models/table.model'

@Injectable({ providedIn: 'root' })
export class TableService {
  private readonly http = inject(HttpClient)
  private readonly apiUrl = inject(API_URL)

  getAvailable(restaurantId: string, people: number): Observable<Table[]> {
    return this.http.get<Table[]>(`${this.apiUrl}/public/restaurants/${restaurantId}/tables`, {
      params: { people }
    })
  }

  occupy(restaurantId: string, id: string, people: number): Observable<Table> {
    return this.http.post<Table>(`${this.apiUrl}/restaurants/${restaurantId}/tables/${id}/occupy`, { people })
  }
}
