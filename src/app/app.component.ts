import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { SessionService } from './service/session.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ChatWidgetComponent } from './chat-widget/chat-widget.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, ChatWidgetComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  public _booleanIsAppInitialized: boolean;
  public _stringLoadingMessage: string;
  public _stringErrorMessage: string;
  private _initializationSubscription: Subscription | undefined;

  constructor(
    private sessionService: SessionService,
    private router: Router
  ) 
  {
    this._booleanIsAppInitialized = false;
    this._stringLoadingMessage = 'Memuat aplikasi...';
    this._stringErrorMessage = 'Terjadi kesalahan saat menginisialisasi aplikasi.';
  }

  ngOnInit(): void {
    // Periksa apakah ID sudah ada di localStorage saat komponen diinisialisasi
    const userId = this.sessionService.getUserId();

    if (userId) {
      this._booleanIsAppInitialized = true;
      console.log('ID pengguna sudah ada di localStorage.');
      console.log('User ID:', userId);
    } else {
      console.log('ID pengguna belum ada, menunggu inisialisasi...');
      this._stringLoadingMessage = 'Menginisialisasi ID pengguna...';
      this._initializationSubscription = this.sessionService.initializationStatus$.subscribe(
        (isInitialized: boolean) => {
          this._booleanIsAppInitialized = isInitialized;
          if (this._booleanIsAppInitialized) {
            console.log('Inisialisasi ID pengguna selesai.');
            console.log('User ID:', this.sessionService.getUserId());
          } else {
            console.log('Inisialisasi ID pengguna sedang berlangsung...');
          }
        },
        (error: any) => {
          this._stringErrorMessage = 'Terjadi kesalahan saat menginisialisasi aplikasi.';
          console.error('Error selama inisialisasi:', error);
        }
      );
    }
  }

  ngOnDestroy(): void {
    if (this._initializationSubscription) {
      this._initializationSubscription.unsubscribe();
    }
  }
}