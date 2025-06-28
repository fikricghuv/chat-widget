import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { UserHistoryResponseModel } from '../model/chat_history_response.model';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})

export class ChatHistoryService 
{
  private apiUrl = environment.backendApiUrl;
  
  private apiKey = environment.apiKey;

  constructor(private http: HttpClient) {}

  public loadChatHistory(
    userId: string, // Menerima userId sebagai string (representasi UUID)
    offset: number = 0,
    limit: number = 100
  ): Observable<UserHistoryResponseModel> // Mengembalikan Observable dari model respons baru
  {
    // 1. Siapkan Headers, termasuk API Key
    const headers = new HttpHeaders({
      'X-API-Key': this.apiKey // Tambahkan header API Key
    });

    // 2. Siapkan Parameter Query untuk Pagination
    const params = new HttpParams()
      .set('offset', offset.toString()) // Tambahkan offset
      .set('limit', limit.toString());   // Tambahkan limit

    // 3. Buat URL dengan Path Parameter
    // Gunakan room_id di path URL
    const url = `${this.apiUrl}/history/${userId}`;

    // 4. Lakukan permintaan GET dengan headers dan params
    return this.http.get<UserHistoryResponseModel>(url, { headers: headers, params: params })
      .pipe(
        // 5. Tambahkan penanganan error dasar
        catchError(this.handleError)
        // Anda bisa menambahkan operator 'map' di sini jika perlu memproses respons
        // sebelum dikirim ke subscriber, misalnya hanya mengambil array 'history'
        // Contoh: map(response => response.history)
      );
  }

  public loadChatHistoryByRoomId(
    roomId: string, // Menerima userId sebagai string (representasi UUID)
    offset: number = 0,
    limit: number = 100
  ): Observable<UserHistoryResponseModel> // Mengembalikan Observable dari model respons baru
  {
    // 1. Siapkan Headers, termasuk API Key
    const headers = new HttpHeaders({
      'X-API-Key': this.apiKey // Tambahkan header API Key
    });

    // 2. Siapkan Parameter Query untuk Pagination
    const params = new HttpParams()
      .set('offset', offset.toString()) // Tambahkan offset
      .set('limit', limit.toString());   // Tambahkan limit

    // 3. Buat URL dengan Path Parameter
    // Gunakan room_id di path URL
    const url = `${this.apiUrl}/history/room/${roomId}`;

    // 4. Lakukan permintaan GET dengan headers dan params
    return this.http.get<UserHistoryResponseModel>(url, { headers: headers, params: params })
      .pipe(
        // 5. Tambahkan penanganan error dasar
        catchError(this.handleError)
        // Anda bisa menambahkan operator 'map' di sini jika perlu memproses respons
        // sebelum dikirim ke subscriber, misalnya hanya mengambil array 'history'
        // Contoh: map(response => response.history)
      );
  }

   /**
   * Metode penanganan error untuk permintaan HTTP.
   * @param error Objek HttpErrorResponse.
   * @returns Observable yang memancarkan error.
   */
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred!';
    if (error.error instanceof ErrorEvent) {
      // Client-side errors
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side errors
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      if (error.error && typeof error.error === 'object' && error.error.detail) {
         errorMessage += `\nDetail: ${error.error.detail}`;
      } else if (error.error && typeof error.error === 'string') {
         errorMessage += `\nServer Response: ${error.error}`;
      }
    }
    console.error(errorMessage); // Log error ke console
    // Anda bisa menggunakan MessageService PrimeNG di sini untuk menampilkan pesan ke pengguna
    return throwError(() => new Error(errorMessage)); // Kembalikan Observable error
  }

  // Anda bisa menambahkan metode lain di sini
}