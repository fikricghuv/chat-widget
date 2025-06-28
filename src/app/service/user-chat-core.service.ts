// // src/app/services/chat-core.service.ts
// import { Injectable, OnDestroy } from '@angular/core';
// import { Subject, Observable, BehaviorSubject, throwError } from 'rxjs';
// import { takeUntil, filter, map, catchError } from 'rxjs/operators';
// import { WebSocketService } from './user-websocket.service';
// import { ChatHistoryService } from './chat-history.service';
// import { SessionService } from './session.service';
// // Import MessageModel
// import { MessageModel } from '../model/message.model';
// // Import UserHistoryResponseModel karena API history mengembalikan ini
// import { ChatHistoryResponseModel, UserHistoryResponseModel } from '../model/chat_history_response.model'; // Pastikan import ini benar
// import { ServerRole, ENUM_SENDER } from '../constants/enum.constant';

// @Injectable({
//   providedIn: 'root'
// })
// export class ChatCoreService implements OnDestroy {

//   private _userId: string | null = null;
//   private destroy$ = new Subject<void>();

//   private _incomingMessages = new Subject<MessageModel>();
//   public readonly incomingMessages$ = this._incomingMessages.asObservable();

//   private _isLoadingSending = new BehaviorSubject<boolean>(false);
//   public readonly isLoadingSending$ = this._isLoadingSending.asObservable();

//   public readonly wsConnectionStatus$: Observable<string>;

//   constructor(
//     private wsService: WebSocketService,
//     private historyService: ChatHistoryService,
//     private sessionService: SessionService
//   ) {
//     console.log('ChatCoreService initialized.');

//     this.wsConnectionStatus$ = this.wsService.getStatus();

//     this.sessionService.initializationStatus$
//       .pipe(
//         filter(isInitialized => isInitialized === true),
//         takeUntil(this.destroy$)
//       )
//       .subscribe(() => {
//         this._userId = this.sessionService.getUserId();
//         if (this._userId) {
//           console.log('ChatCoreService: Session ready, user ID:', this._userId, '. Connecting WebSocket.');
//           this.wsService.connect(this._userId, ServerRole.User)
//             .then(() => {
//               console.log('ChatCoreService: WebSocket connected. Subscribing to messages.');
//               this.wsService.getMessages()
//                 .pipe(takeUntil(this.destroy$)) // Cleanup langganan internal WS saat service dihancurkan
//                 .subscribe(
//                   data => this.handleRawWebSocketMessage(data),
//                   error => console.error('ChatCoreService: WebSocket message stream error:', error), // Tangani error stream
//                   () => console.log('ChatCoreService: WebSocket message stream completed.') // Tangani completion stream
//                 );
//             })
//             .catch(error => {
//               console.error('ChatCoreService: WebSocket connection failed:', error);
//               // Pertimbangkan untuk mengupdate status koneksi melalui BehaviorSubject jika ada
//             });
//         } else {
//           console.error('ChatCoreService: Session ready, but User ID is null.');
//           // Beri tahu komponen UI jika user ID tidak tersedia
//         }
//       });
//   }

//   sendMessage(text: string): void {
//     if (!this._userId) {
//       console.error('ChatCoreService: Cannot send message, User ID is not set.');
//       // Feedback ke user di UI
//       return;
//     }
//     const trimmedText = text.trim();
//     if (!trimmedText) {
//       console.warn('ChatCoreService: Cannot send empty message.');
//       // Feedback ke user di UI
//       return;
//     }

//     const payload = {
//       type: 'message',
//       user_id: this._userId,
//       role: ServerRole.User, // Role pengirim di payload
//       message: trimmedText, // Isi pesan user
//     };

//     console.log('ChatCoreService: Sending message:', payload);
//     this.wsService.sendMessage(payload);

//     // Aktifkan loading indicator kirim
//     this._isLoadingSending.next(true);

//     // Catatan: Optimistic UI update (menambahkan pesan user langsung di UI)
//     // sebaiknya dilakukan di komponen UI setelah memanggil sendMessage.
//     // Service ini hanya bertanggung jawab mengirim dan menerima balasan.
//   }

//   sendFile(file: File): Promise<void> {
//     if (!this._userId) {
//       console.error('ChatCoreService: Cannot send file, User ID is not set.');
//       return Promise.reject('User ID is not set.');
//     }

//     // Aktifkan loading indicator kirim
//     this._isLoadingSending.next(true);

//     return new Promise((resolve, reject) => {
//       const reader = new FileReader();

//       reader.onload = (event: ProgressEvent<FileReader>) => {
//         if (event.target && typeof event.target.result === 'string') {
//           const base64Data = event.target.result.split(',')[1]; // Ambil hanya data Base64
//           const payload = {
//             type: 'file', // Tipe pesan baru untuk file
//             user_id: this._userId,
//             role: ServerRole.User,
//             file_name: file.name,
//             file_type: file.type,
//             file_size: file.size,
//             file_data: base64Data, // Data file dalam Base64
//           };

//           console.log('ChatCoreService: Sending file payload:', payload);
//           this.wsService.sendMessage(payload);
//           resolve();
//         } else {
//           console.error('ChatCoreService: Failed to read file as Base64.');
//           this._isLoadingSending.next(false); // Nonaktifkan loading jika gagal
//           reject('Failed to read file.');
//         }
//       };

//       reader.onerror = (error) => {
//         console.error('ChatCoreService: Error reading file:', error);
//         this._isLoadingSending.next(false); // Nonaktifkan loading jika error
//         reject(error);
//       };

//       reader.readAsDataURL(file); // Baca file sebagai Data URL (Base64)
//     });
//   }

//   private handleRawWebSocketMessage(data: any): void {
//     console.log('ChatCoreService: Processing raw message:', data);

//     let processedMessage: MessageModel | null = null;
//     let stopLoading = false; // Flag untuk menentukan apakah loading kirim harus berhenti

//     // --- Logika memproses format pesan yang berbeda dari server ---

//     // Format: {success: true, data: '...', from: '...', room_id: '...'} (Balasan Bot/Admin)
//     // Ini adalah balasan utama terhadap pesan user
//     if (data.success === true && typeof data.data === 'string' && data.from !== undefined) {
//       const content = data.data.trim();
//       if (content) {
//         const formattedTime = new Date().toISOString();
//         let senderType: ENUM_SENDER = ENUM_SENDER.Chatbot; // Default Chatbot/Support

//         // Mapping role server ke sender UI. Asumsi Admin dan Chatbot tampil sama di UI.
//         if (data.from === ServerRole.Admin || data.from === ServerRole.Chatbot) {
//           senderType = ENUM_SENDER.Chatbot;
//         }
//         // Jika from === ServerRole.User, ini mungkin konfirmasi pesan sendiri,
//         // yang biasanya tidak perlu ditampilkan lagi jika sudah ada optimistic update.
//         // if (data.from === ServerRole.User) { /* Do nothing, handled by optimistic update */ }

//         if (data.from !== ServerRole.User) { // Hanya proses pesan dari Bot/Admin
//             processedMessage = {
//               sender: senderType,
//               message: content, // Gunakan 'message' sesuai MessageModel
//               time: formattedTime,
//               // rawData: data // Opsional
//             };
//             stopLoading = true; // Hentikan loading karena ini balasan sukses
//         } else {
//              console.log('ChatCoreService: Ignoring success message from self (User role).', data);
//              // Untuk pesan dari user sendiri, kita mungkin tidak menghentikan loading di sini
//              // kecuali server secara eksplisit mengirim sinyal 'pesan diterima'
//              // Jika server tidak mengirim sinyal terpisah dan hanya konfirmasi sukses,
//              // Anda mungkin perlu menghentikan loading di sini juga.
//              // Mari kita hentikan loading juga jika server mengkonfirmasi sukses, bahkan dari user.
//              stopLoading = true; // Hentikan loading jika server mengkonfirmasi sukses
//         }


//       } else {
//         console.log('ChatCoreService: Received success message with no content.', data);
//         stopLoading = true; // Hentikan loading jika sukses tanpa konten (misal: server hanya konfirmasi terima)
//       }

//     }
//     // Format: {type: 'error', error: '...'}
//     // Ini juga balasan terhadap pesan user jika terjadi error
//     else if (data.type === 'error' && typeof data.error === 'string') {
//         console.error('ChatCoreService: Received error message:', data.error);
//          processedMessage = {
//               sender: ENUM_SENDER.Chatbot, // Tampilkan error sebagai dari "Support" atau Chatbot
//               message: `Error: ${data.error}`, // Gunakan 'message'
//               time: new Date().toISOString(),
//               // rawData: data // Opsional
//           };
//           stopLoading = true; // Hentikan loading setelah error
//     }
//     // Format: {type: 'info', message: '...'}
//     // Pesan info, tidak selalu terkait balasan pesan user, biasanya tidak menghentikan loading kirim
//     else if (data.type === 'info' && typeof data.message === 'string') {
//          console.log('ChatCoreService: Received info message:', data.message);
//           processedMessage = {
//                sender: ENUM_SENDER.Chatbot, // Tampilkan info sebagai dari "Support" atau sender khusus
//                message: `[INFO] ${data.message}`, // Gunakan 'message'. Prefiks info
//                time: new Date().toISOString(),
//                // rawData: data // Opsional
//            };
//            // stopLoading = false; // Info messages usually don't stop the main sending loading state.
//     }
//      // --- Handle tipe pesan lain dari server yang mungkin relevan untuk UI user ---
//      // Tambahkan else if untuk tipe-tipe lain yang relevan dan ubah ke MessageModel jika perlu.
//      // Contoh: status agen berubah, dll.
//      // else if (data.type === 'agent_status_update') { ... }

//     // --- Abaikan tipe pesan yang tidak relevan untuk UI user ---
//     // Tipe pesan admin/internal akan diabaikan di sini.
//     else if (data.type && ['room_message', 'chat_history', 'active_rooms_update', 'admin_room_joined', 'admin_room_left', 'admin_take_over_status', 'admin_hand_back_status'].includes(data.type)) {
//         console.log(`ChatCoreService: Ignoring message type "${data.type}" for user widget.`);
//         // Jangan lakukan apa-apa, jangan emit ke komponen user.
//     }
//     // Format lain yang tidak dikenali
//     else {
//         // Abaikan pesan sukses tanpa data atau from (mungkin hanya ACK?)
//         if (!(data.success === true && (data.data === undefined || data.from === undefined))) {
//              console.warn('ChatCoreService: Received unhandled raw message format:', data);
//               // Opsional: Emit pesan error parse atau pesan tidak dikenali
//              // processedMessage = { sender: ENUM_SENDER.Chatbot, message: 'Received unhandled message.', time: new Date().toISOString() };
//         }
//         // stopLoading = false; // Tidak menghentikan loading untuk format tidak dikenal
//     }


//     // Emit pesan yang sudah diproses jika ada
//     if (processedMessage) {
//       this._incomingMessages.next(processedMessage);
//     }

//     // Nonaktifkan loading hanya jika flag stopLoading true
//     if (stopLoading) {
//         this._isLoadingSending.next(false);
//     }
//   }

//   // Metode ini dipanggil oleh komponen untuk memuat riwayat chat
//   // loadHistory tidak butuh userId sebagai parameter karena service sudah punya _userId
//   loadHistory(): Observable<MessageModel[]> {
//     if (!this._userId) {
//       console.error('ChatCoreService: Cannot load history, User ID is not set.');
//       // Kembalikan Observable dengan error agar komponen bisa menanganinya
//       return throwError(() => new Error("User ID not set for history load"));
//     }

//     console.log(`ChatCoreService: Loading chat history for user ID: ${this._userId}`);

//     // Panggil service history, lalu map hasilnya (UserHistoryResponseModel)
//     // ke format MessageModel[]
//     return this.historyService.loadChatHistory(this._userId).pipe(
//       // Response API adalah UserHistoryResponseModel, bukan array langsung
//       map((response: UserHistoryResponseModel) => {
//         console.log('ChatCoreService: Mapping history data:', response);

//         // Pastikan respons dan array history ada
//         if (!response || !response.history || response.history.length === 0) {
//             console.log('ChatCoreService: No history data received.');
//             return [];
//         }

//         const chats = response.history; // Ambil array history

//         // Sort history by created_at
//         chats.sort((a, b) => {
//             const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
//             const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
//             return timeA - timeB;
//         });

//         // Map ke array MessageModel
//         const historyMessages: MessageModel[] = chats
//             .map(chat => { // Map setiap item ChatHistoryResponseModel
//               // Gunakan created_at untuk waktu
//               const formattedTime = chat.created_at?.slice(0, 16).replace('T', ' ') ?? '';
//               let senderType: ENUM_SENDER;

//               // Map server role ke ENUM_SENDER
//               if (chat.role === ServerRole.User) {
//                   senderType = ENUM_SENDER.User;
//               } else if (chat.role === ServerRole.Admin || chat.role === ServerRole.Chatbot) {
//                   // Asumsi Admin dan Chatbot ditampilkan sama di UI user
//                   senderType = ENUM_SENDER.Chatbot; // Atau ENUM_SENDER.Support jika ada
//               } else {
//                  console.warn(`ChatCoreService: Unhandled role in history: ${chat.role}. Defaulting to Chatbot.`);
//                  senderType = ENUM_SENDER.Chatbot;
//               }

//               // Buat MessageModel dari data history
//               const message: MessageModel = {
//                   sender: senderType,
//                   message: chat.message || '', // Gunakan 'message' field
//                   time: formattedTime,
//                   // rawData: chat // Opsional
//               };

//               return message;
//             })
//             .filter(msg => msg.message); // Filter pesan dengan konten kosong

//         console.log('ChatCoreService: Mapped history messages:', historyMessages);
//         return historyMessages; // Mengembalikan array MessageModel
//       }),
//       catchError(err => {
//          // Menangani error dari service history sebelum Observable dikirim ke komponen
//          console.error('ChatCoreService: Failed to load or map history:', err);
//          // Lempar kembali error agar komponen yang subscribe bisa menangkapnya
//          return throwError(() => new Error('Failed to load chat history'));
//       })
//     );
//   }

//   ngOnDestroy(): void {
//     console.log('ChatCoreService destroyed. Disconnecting WebSocket.');
//     this.destroy$.next();
//     this.destroy$.complete();
//     this.wsService.disconnect(); // Pastikan koneksi WS terputus
//     this._incomingMessages.complete();
//     this._isLoadingSending.complete();
//   }
// }

// src/app/services/chat-core.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable, BehaviorSubject, throwError } from 'rxjs';
import { takeUntil, filter, map, catchError, finalize } from 'rxjs/operators';
import { WebSocketService } from './user-websocket.service'; // Sesuaikan path
import { ChatHistoryService } from './chat-history.service'; // Sesuaikan path
import { SessionService } from './session.service';           // Sesuaikan path
import { MessageModel } from '../model/message.model'; // Sesuaikan path
// Menggunakan model yang Anda berikan:
import { UserHistoryResponseModel, ChatHistoryResponseModel } from '../model/chat_history_response.model'; // Sesuaikan path
import { ServerRole, ENUM_SENDER } from '../constants/enum.constant'; // Sesuaikan path

@Injectable({
  providedIn: 'root'
})
export class ChatCoreService implements OnDestroy {

  private _userId: string | null = null;
  private destroy$ = new Subject<void>();

  private _incomingMessages = new Subject<MessageModel>();
  public readonly incomingMessages$ = this._incomingMessages.asObservable();

  private _isLoadingSending = new BehaviorSubject<boolean>(false);
  public readonly isLoadingSending$ = this._isLoadingSending.asObservable();

  public readonly wsConnectionStatus$: Observable<string>;

  constructor(
    private wsService: WebSocketService,
    private historyService: ChatHistoryService,
    private sessionService: SessionService
  ) {
    this.wsConnectionStatus$ = this.wsService.getStatus();
    this.sessionService.initializationStatus$
      .pipe(
        filter(isInitialized => isInitialized === true),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this._userId = this.sessionService.getUserId();
        if (this._userId) {
          this.connectAndSubscribe();
        } else {
          console.error('ChatCoreService: User ID is null. Cannot connect WebSocket.');
        }
      });
  }

  private connectAndSubscribe(): void {
    if (!this._userId) return; // Guard tambahan
    this.wsService.connect(this._userId, ServerRole.User)
      .then(() => {
        this.wsService.getMessages()
          .pipe(takeUntil(this.destroy$))
          .subscribe(
            data => this.handleRawWebSocketMessage(data),
            error => console.error('ChatCoreService: WebSocket message stream error:', error)
          );
      })
      .catch(error => console.error('ChatCoreService: WebSocket connection failed:', error));
  }

  sendMessage(text: string): void {
    if (!this._userId) return;
    const payload = { type: 'message', user_id: this._userId, role: ServerRole.User, message: text.trim() };
    this.wsService.sendMessage(payload);
    this._isLoadingSending.next(true);
  }

  private readFileAsBase64(fileOrBlob: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event: ProgressEvent<FileReader>) => {
        if (event.target && typeof event.target.result === 'string') {
          resolve(event.target.result.split(',')[1]); // Base64 part
        } else {
          reject('Failed to read file/blob as Base64 string.');
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(fileOrBlob);
    });
  }

  sendFile(file: File): Promise<void> {
    if (!this._userId) return Promise.reject('User ID not set.');
    this._isLoadingSending.next(true);
    return this.readFileAsBase64(file).then(base64Data => {
      const payload = {
        type: 'file', user_id: this._userId!, role: ServerRole.User,
        file_name: file.name, file_type: file.type, file_size: file.size, file_data: base64Data,
      };
      this.wsService.sendMessage(payload);
    }).catch(err => {
      this._isLoadingSending.next(false);
      console.error('ChatCoreService Error sending file:', err);
      throw err; // Re-throw untuk ditangani oleh komponen jika perlu
    });
  }

  sendVoiceNote(audioBlob: Blob, fileName: string, mimeType: string, durationSeconds: number): Promise<void> {
    if (!this._userId) return Promise.reject('User ID not set.');
    this._isLoadingSending.next(true);
    return this.readFileAsBase64(audioBlob).then(base64AudioData => {
      const payload = {
        type: 'voice_note', user_id: this._userId!, role: ServerRole.User,
        file_name: fileName, mime_type: mimeType, duration: Math.round(durationSeconds), file_data: base64AudioData,
      };
      this.wsService.sendMessage(payload);
    }).catch(err => {
      this._isLoadingSending.next(false);
      console.error('ChatCoreService Error sending voice note:', err);
      throw err; // Re-throw untuk ditangani oleh komponen jika perlu
    });
  }

  // ASUMSI UNTUK PESAN LIVE DARI SERVER:
  // Server akan mengirimkan field seperti:
  // message_id, timestamp, from_user_id (ID pengirim aktual), from (role pengirim),
  // message_type ('text', 'file', 'voice_note'),
  // Untuk file: file_url, file_name, mime_type, caption (opsional)
  // Untuk voice_note: audio_url, file_name, mime_type, duration, caption (opsional)
  // Untuk text: data (berisi teks pesan)
  private handleRawWebSocketMessage(serverData: any): void {
    // console.log('ChatCoreService: Raw WS Data:', serverData);
    let processedMessage: MessageModel | null = null;
    let stopLoading = false;

    const senderId = serverData.from_user_id || (serverData.from === ServerRole.User ? this._userId : undefined);
    // Tentukan sender berdasarkan `serverData.from` (role) jika `from_user_id` tidak ada atau bukan user saat ini
    let senderEnum: ENUM_SENDER;
    if (serverData.from === ServerRole.User) {
        senderEnum = senderId === this._userId ? ENUM_SENDER.User : ENUM_SENDER.Chatbot; // Jika from_user_id dari user lain, anggap sbg agent/bot
    } else if (serverData.from === ServerRole.Admin || serverData.from === ServerRole.Chatbot) {
        senderEnum = ENUM_SENDER.Chatbot;
    } else {
        // Default jika 'from' tidak dikenali, atau jika senderId adalah user saat ini
        senderEnum = senderId === this._userId ? ENUM_SENDER.User : ENUM_SENDER.Chatbot;
    }


    if (serverData.success === true || serverData.type === 'new_message' || serverData.type === 'message_ack') { // Perluas tipe sukses
        const messageType = serverData.message_type;
        const messageId = serverData.message_id || `srv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const timestamp = serverData.timestamp || new Date().toISOString();
        const caption = serverData.caption || serverData.message; // Caption bisa juga ada di field message

        if (messageType === 'voice_note' && serverData.audio_url) {
            processedMessage = {
                id: messageId, sender: senderEnum, time: timestamp, isVoiceNote: true,
                audioUrl: serverData.audio_url, fileName: serverData.file_name,
                fileType: serverData.mime_type, audioDuration: this.formatDurationFromServer(serverData.duration),
                message: caption,
            };
            stopLoading = true;
        } else if (messageType === 'file' && serverData.file_url) {
            processedMessage = {
                id: messageId, sender: senderEnum, time: timestamp,
                fileUrl: serverData.file_url, fileName: serverData.file_name,
                fileType: serverData.mime_type,
                message: caption,
            };
            stopLoading = true;
        } else if (serverData.data && typeof serverData.data === 'string') { // Pesan teks dari field 'data'
            processedMessage = {
                id: messageId, sender: senderEnum, time: timestamp,
                message: serverData.data.trim(),
            };
            stopLoading = true;
        } else if (serverData.message && typeof serverData.message === 'string' && !messageType) { // Pesan teks dari field 'message' (jika tidak ada message_type)
             processedMessage = {
                id: messageId, sender: senderEnum, time: timestamp,
                message: serverData.message.trim(),
            };
            stopLoading = true;
        }
         else if (serverData.success === true && senderEnum === ENUM_SENDER.User) {
            // Konfirmasi umum untuk pesan user, hentikan loading.
            // Pesan optimis mungkin sudah di UI, jadi tidak perlu membuat processedMessage baru
            // kecuali server mengirim ID atau timestamp yang diperbarui.
            // Jika server mengirim ID, komponen akan update pesan optimis.
            console.log('ChatCoreService: Generic success for user message received, stopping loading.');
            stopLoading = true;
            // Jika server mengirim kembali detail pesan yang dikirim user (echo dengan ID), biarkan logika di atas menanganinya.
            // Jika ini hanya ACK kosong, cukup stop loading.
             if (!processedMessage && serverData.original_message_payload) { // Jika server echo payload asli
                // coba rekonstruksi pesan user jika perlu
             }
        }

    } else if (serverData.type === 'error' && serverData.error) {
        processedMessage = { id:`err-${Date.now()}`, sender: ENUM_SENDER.Chatbot, message: `Error: ${serverData.error}`, time: new Date().toISOString() };
        stopLoading = true;
    } else if (serverData.type === 'info' && serverData.message) {
        processedMessage = { id:`info-${Date.now()}`, sender: ENUM_SENDER.Chatbot, message: `[INFO] ${serverData.message}`, time: new Date().toISOString() };
    } else if (['room_message', 'chat_history', 'active_rooms_update'].includes(serverData.type)) {
        // Abaikan
    } else {
        console.warn('ChatCoreService: Unhandled WS message format:', serverData);
    }

    if (processedMessage) {
        this._incomingMessages.next(processedMessage);
    }
    if (stopLoading) {
        this._isLoadingSending.next(false);
    }
  }

  private formatDurationFromServer(totalSeconds?: number): string | undefined {
    if (totalSeconds === undefined || totalSeconds === null || isNaN(totalSeconds)) return undefined;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  loadHistory(): Observable<MessageModel[]> {
    if (!this._userId) return throwError(() => new Error("User ID not set for history load"));

    return this.historyService.loadChatHistory(this._userId).pipe(
      map((response: UserHistoryResponseModel): MessageModel[] => {
        if (!response?.history?.length) {
          console.log('ChatCoreService: No history items found.');
          return [];
        }
        // console.log('ChatCoreService: Raw history response:', response.history);

        return response.history
          .sort((a, b) => (new Date(a.created_at).getTime()) - (new Date(b.created_at).getTime()))
          .map((historyItem: ChatHistoryResponseModel): MessageModel | null => {
            let senderType: ENUM_SENDER;
            // Gunakan `historyItem.role` untuk menentukan sender dari pesan historis ini.
            if (historyItem.role === ServerRole.User) {
              senderType = ENUM_SENDER.User;
            } else if (historyItem.role === ServerRole.Admin || historyItem.role === ServerRole.Chatbot) {
              senderType = ENUM_SENDER.Chatbot;
            } else {
              console.warn(`ChatCoreService: Unknown role in history item: ${historyItem.role}. Defaulting to Chatbot.`);
              senderType = ENUM_SENDER.Chatbot;
            }

            // Dengan struktur ChatHistoryResponseModel saat ini, kita hanya bisa mengambil `message` sebagai teks.
            // Tidak ada informasi untuk fileUrl, audioUrl, isVoiceNote, dll. dari histori.
            // Jika informasi tersebut ada di dalam string `historyItem.message` (misalnya JSON atau link),
            // Anda perlu menambahkan logika parsing di sini.
            if (!historyItem.message || historyItem.message.trim() === "") {
                // Jika Anda ingin mengabaikan pesan history yang kosong sama sekali
                // return null;
            }

            const message: MessageModel = {
              id: historyItem.id || `hist-${historyItem.created_at}`, // Gunakan ID dari histori jika ada
              sender: senderType,
              message: historyItem.message, // Ini akan selalu menjadi string teks
              time: historyItem.created_at, // Biarkan sebagai ISO string, format di template dengan pipe
              room_id: historyItem.room_conversation_id,

              // Properti berikut tidak bisa diisi dari ChatHistoryResponseModel yang diberikan:
              // fileUrl: undefined,
              // fileName: undefined,
              // fileType: undefined,
              // isVoiceNote: false,
              // audioUrl: undefined,
              // audioDuration: undefined,
            };
            // console.log("Mapped history item:", message);
            return message;
          }).filter(msg => msg !== null && (msg.message !== undefined && msg.message.trim() !== '')) as MessageModel[]; // Filter pesan null atau yang message-nya kosong
      }),
      catchError(err => {
        console.error('ChatCoreService: Failed to load/map history:', err);
        return throwError(() => new Error('Failed to load chat history'));
      })
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.wsService) { // Pastikan wsService ada sebelum memanggil disconnect
        this.wsService.disconnect();
    }
    this._incomingMessages.complete();
    this._isLoadingSending.complete();
  }
}