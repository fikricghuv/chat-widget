import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom, Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { environment } from '../environments/environment';

// --- Definisi Model Angular yang sesuai dengan schema Pydantic server ---

// Enum untuk peran user, sesuai dengan UserRole di server
export enum UserRole {
  User = 'user'
}

// Model untuk request body endpoint /auth/generate_user_id
// Sesuai dengan schema GenerateUserIdRequest dari server
export interface GenerateUserIdRequestModel {
  role: UserRole;
}

// Model untuk respons endpoint /auth/generate_user_id
// Sesuai dengan schema UserIdResponse dari server
export interface UserIdResponseModel {
  user_id: string;
  role: UserRole;
  created_at: string;
}

// --- Akhir Definisi Model ---


@Injectable({
  providedIn: 'root',
})
export class SessionService {
  private readonly USERID_LOCAL_STORAGE = 'userId';
  // private readonly ADMINID_LOCAL_STORAGE = 'adminId'; // Dihapus

  private apiKey = environment.apiKey;

  public initializationStatusSubject = new BehaviorSubject<boolean>(false);
  readonly initializationStatus$ = this.initializationStatusSubject.asObservable();

  constructor(private http: HttpClient) {
    this.initializeUserId(); // Ubah nama fungsi inisialisasi
  }

  /**
   * Menginisialisasi User ID dari local storage atau server jika belum ada.
   * Menggunakan metode POST baru untuk generate ID.
   */
  private async initializeUserId(): Promise<void> { // Ubah nama fungsi
    const storedUserId = localStorage.getItem(this.USERID_LOCAL_STORAGE);
    // const storedAdminId = localStorage.getItem(this.ADMINID_LOCAL_STORAGE); // Dihapus

    // Jika User ID sudah ada di local storage, set status dan keluar
    if (storedUserId) { // Hanya cek User ID
      console.log('SessionService: User ID ditemukan di local storage.');
      this.initializationStatusSubject.next(true);
      return;
    }

    console.log('SessionService: User ID tidak ditemukan, melakukan generate dari server.');

    const headers = new HttpHeaders({
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json'
    });

    const generateUrl = `${environment.backendApiUrl}/auth/generate_user_id`;

    try {
      // --- Generate User ID ---
      // Logika if (!storedUserId) bisa dihilangkan karena sudah di awal fungsi
      console.log('SessionService: Generating User ID...');
      const userPayload: GenerateUserIdRequestModel = { role: UserRole.User }; // Payload untuk user
      const userResponse = await firstValueFrom(
        this.http.post<UserIdResponseModel>(generateUrl, userPayload, { headers: headers })
          .pipe(
             catchError(this.handleError)
          )
      );
      localStorage.setItem(this.USERID_LOCAL_STORAGE, userResponse.user_id);
      console.log('SessionService: User ID berhasil digenerate dan disimpan:', userResponse.user_id);

      // Setelah berhasil mendapatkan User ID, set status inisialisasi
      this.initializationStatusSubject.next(true);
      console.log('SessionService: Inisialisasi User ID selesai.');

    } catch (error) {
      console.error('SessionService: Gagal mendapatkan User ID dari server:', error);
      this.initializationStatusSubject.next(false);
      // TODO: Implementasi penanganan error yang lebih baik di sini
    }
  }

  /**
   * Metode penanganan error untuk permintaan HTTP.
   * @param error Objek HttpErrorResponse.
   * @returns Observable yang memancarkan error.
   */
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred!';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      if (error.error && typeof error.error === 'object' && error.error.detail) {
         errorMessage += `\nDetail: ${error.error.detail}`;
      } else if (error.error && typeof error.error === 'string') {
         errorMessage += `\nServer Response: ${error.error}`;
      }
    }
    console.error('SessionService HTTP Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }


  /**
   * Mendapatkan User ID dari local storage.
   * @returns User ID atau null jika tidak ada.
   */
  public getUserId(): string | null {
    return localStorage.getItem(this.USERID_LOCAL_STORAGE);
  }

  public clearSession(): void {
    console.log('SessionService: Clearing session...');
    localStorage.removeItem(this.USERID_LOCAL_STORAGE);
    // localStorage.removeItem(this.ADMINID_LOCAL_STORAGE); // Dihapus
    this.initializationStatusSubject.next(false);
    this.initializeUserId(); // Inisialisasi ulang hanya untuk User ID
    console.log('SessionService: Session cleared and re-initialization started.');
  }
}