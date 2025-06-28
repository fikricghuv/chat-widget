
// src/app/components/playground/playground.component.ts
import { Component, ViewChild, ElementRef, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common'; 
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { SessionService } from '../service/session.service'; // Sesuaikan path
import { Subject, Observable, timer, Subscription } from 'rxjs';
import { takeUntil, filter, finalize, catchError, tap } from 'rxjs/operators';
import { ENUM_SENDER } from '../constants/enum.constant'; // Sesuaikan path
import { MessageModel } from '../model/message.model'; // Sesuaikan path
import { RoomConversationModel } from '../model/room.model'; // Sesuaikan path
import { ChatCoreService } from '../service/user-chat-core.service'; // Sesuaikan path
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule, DatePipe], // Tambahkan DatePipe ke imports
  templateUrl: './chat-widget.component.html',
  styleUrls: ['./chat-widget.component.scss'],
})
export class ChatWidgetComponent implements OnInit, OnDestroy {
  @ViewChild('userInput') userInput!: ElementRef<HTMLInputElement>;
  @ViewChild('chatScroll') chatScroll!: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  public _objChatMessages: Record<string, MessageModel[]> = {};
  public _modelSelectedRoom: RoomConversationModel | null = null;
  public _arrayModelFilteredMessage: MessageModel[] = [];
  public currentMessageText: string = '';

  public _enumSender = ENUM_SENDER;
  private _stringUserId: string | null = null;

  public isLoadingHistory: boolean = false;
  private destroy$ = new Subject<void>();

  public isRecording: boolean = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  public recordingTime: number = 0;
  private recordingTimerSubscription: Subscription | null = null;
  private currentStream: MediaStream | null = null;

  public previewImageUrl: string | null = null;

  constructor(
    private sessionService: SessionService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    public chatCoreService: ChatCoreService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.currentMessageText = '';
    this.sessionService.initializationStatus$
      .pipe(
        filter(isInitialized => isInitialized === true),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this._stringUserId = this.sessionService.getUserId();
        if (this._stringUserId) {
          this.setupChatListeners();
        } else {
          console.error('Playground: User ID is null. Chat cannot be initialized.');
        }
      });
  }

  private setupChatListeners(): void {
    this.subscribeToIncomingMessages();
    this.loadInitialHistory();
    // this.subscribeToConnectionStatus(); // Jika diperlukan
  }

  private subscribeToIncomingMessages(): void {
    this.chatCoreService.incomingMessages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(message => {
        this.ngZone.run(() => this.addOrUpdateMessage(message));
      });
  }

  private addOrUpdateMessage(newMessage: MessageModel): void {
    const messageKey = this._modelSelectedRoom?.name ?? this._stringUserId;
    if (!messageKey) return;

    if (!this._objChatMessages[messageKey]) {
      this._objChatMessages[messageKey] = [];
    }
    const messagesInView = this._objChatMessages[messageKey];

    // Try to find an existing optimistic message to update
    // Heuristic: if it's from user, doesn't have a server ID, and matches file/voice note name OR initial text
    let existingMsgIndex = -1;
    if (newMessage.sender === ENUM_SENDER.User && newMessage.id) { // Server confirmation usually has an ID
        existingMsgIndex = messagesInView.findIndex(m =>
            m.sender === ENUM_SENDER.User &&
            !m.id && // Optimistic messages don't have server ID yet
            (
              (m.fileName && m.fileName === newMessage.fileName) || // Match by filename for files/voice
              (!m.fileName && !newMessage.fileName && m.message === newMessage.message) // Basic match for text
            )
        );
    }


    if (existingMsgIndex > -1) {
      // Update existing optimistic message with server data
      const optimisticMessage = messagesInView[existingMsgIndex];
      // Revoke old blob URLs if new server URLs are provided
      if (optimisticMessage.audioUrl?.startsWith('blob:') && newMessage.audioUrl && !newMessage.audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(optimisticMessage.audioUrl);
      }
      if (optimisticMessage.fileUrl?.startsWith('blob:') && newMessage.fileUrl && !newMessage.fileUrl.startsWith('blob:')) {
        URL.revokeObjectURL(optimisticMessage.fileUrl);
      }
      messagesInView[existingMsgIndex] = { ...optimisticMessage, ...newMessage };
       // Clear temporary "Uploading..." message if a proper URL is now available
       if ((newMessage.audioUrl || newMessage.fileUrl) && messagesInView[existingMsgIndex].message?.startsWith('Uploading')) {
        messagesInView[existingMsgIndex].message = newMessage.message || undefined; // Use server caption or clear
      }
    } else {
      // Add as new message, check for duplicates by server ID if message has one
      if (newMessage.id && messagesInView.some(m => m.id === newMessage.id)) {
        // console.log('Duplicate message from server avoided by ID:', newMessage.id);
      } else {
        messagesInView.push(newMessage);
      }
    }

    this.updateFilteredMessages();
    this.scrollToBottom();
    this.cdr.detectChanges();
  }


  private loadInitialHistory(): void {
    if (!this._stringUserId) return;
    this.isLoadingHistory = true;
    this.chatCoreService.loadHistory()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoadingHistory = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: historyMessages => {
          if (this._stringUserId) {
            // Clean up any potential stale blob URLs from history if they were ever stored
            this._objChatMessages[this._stringUserId] = historyMessages.map(msg => {
                if (msg.audioUrl?.startsWith('blob:')) msg.audioUrl = undefined;
                if (msg.fileUrl?.startsWith('blob:')) msg.fileUrl = undefined;
                return msg;
            });
            this.updateFilteredMessages();
            this.scrollToBottom();
          }
        },
        error: err => console.error('Playground: Error loading history:', err)
      });
  }

  updateFilteredMessages(): void {
    const key = this._modelSelectedRoom?.name ?? this._stringUserId ?? '';
    this._arrayModelFilteredMessage = [...(this._objChatMessages[key] || [])];
    // Ensure change detection if array reference itself doesn't change but content does
    this.cdr.detectChanges();
  }

  sendMessageOrStopRecording(): void {
    if (this.isRecording) {
      this.stopRecordingAndSend();
    } else {
      this.sendMessage();
    }
  }

  sendMessage(): void {
    const text = this.currentMessageText.trim();
    if (!text || !this._stringUserId) return;

    const optimisticMessage: MessageModel = {
      sender: ENUM_SENDER.User,
      message: text,
      time: new Date().toISOString(),
    };
    this.addOptimisticMessageToUI(optimisticMessage);
    this.chatCoreService.sendMessage(text);
    this.currentMessageText = '';
    this.userInput.nativeElement.focus();
  }

  private addOptimisticMessageToUI(message: MessageModel): void {
    const messageKey = this._modelSelectedRoom?.name ?? this._stringUserId;
    if (!messageKey) return;
    if (!this._objChatMessages[messageKey]) {
      this._objChatMessages[messageKey] = [];
    }
    this._objChatMessages[messageKey].push(message);
    this.updateFilteredMessages();
    this.scrollToBottom();
    this.cdr.detectChanges();
  }

  onUploadFileClick(): void {
    if (this.isRecording) return;
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this._stringUserId) return;

    const tempFileUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    const optimisticMessage: MessageModel = {
      sender: ENUM_SENDER.User,
      message: `Uploading: ${file.name}...`,
      time: new Date().toISOString(),
      fileName: file.name,
      fileType: file.type,
      fileUrl: tempFileUrl,
    };
    this.addOptimisticMessageToUI(optimisticMessage);

    this.chatCoreService.sendFile(file)
      .catch(error => {
        console.error('Playground: Failed to send file:', error);
        this.updateOptimisticMessageStatusOnError(file.name, `Failed to upload "${file.name}"`);
        if (tempFileUrl) URL.revokeObjectURL(tempFileUrl);
      });
    this.fileInput.nativeElement.value = ''; // Reset input
  }

  async toggleRecording(): Promise<void> {
    if (this.isRecording) {
      this.stopRecordingAndSend();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording(): Promise<void> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Your browser does not support audio recording.'); return;
    }
    try {
      this.currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.isRecording = true;
      this.audioChunks = [];
      this.cdr.detectChanges();

      const options = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.currentStream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.audioChunks.push(event.data);
      };
      this.mediaRecorder.onstop = () => this.handleRecordingStop(options);
      this.mediaRecorder.start();
      this.startRecordingTimer();
    } catch (err) {
      console.error('Playground: Error accessing microphone:', err);
      alert('Could not access microphone. Please check permissions.');
      this.isRecording = false; this.cdr.detectChanges();
    }
  }

  private handleRecordingStop(options?: { mimeType: string, extension: string }): void {
    this.isRecording = false;
    this.stopRecordingTimer();
    const recordedDuration = this.recordingTime;
    this.recordingTime = 0;
    this.cdr.detectChanges();

    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }

    if (this.audioChunks.length === 0) { console.warn('No audio data recorded.'); return; }

    const mimeType = options?.mimeType || 'audio/webm';
    const extension = options?.extension || 'webm';
    const audioBlob = new Blob(this.audioChunks, { type: mimeType });
    this.audioChunks = [];

    if (audioBlob.size === 0) { console.warn('Recorded audio blob is empty.'); return; }

    this.sendRecordedVoiceNote(audioBlob, recordedDuration, extension);
  }


  private getSupportedMimeType(): { mimeType: string, extension: string } | undefined {
    const types = [
      { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
      { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
      { mimeType: 'audio/aac', extension: 'aac' },
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type.mimeType)) return type;
    }
    if (MediaRecorder.isTypeSupported('audio/webm')) return { mimeType: 'audio/webm', extension: 'webm' };
    return undefined; // Browser default
  }

  stopRecordingAndSend(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }
  }

  private sendRecordedVoiceNote(audioBlob: Blob, duration: number, extension: string): void {
    if (!this._stringUserId) return;
    const fileName = `voicenote_${Date.now()}.${extension}`;
    const tempAudioUrl = URL.createObjectURL(audioBlob);

    const optimisticMessage: MessageModel = {
      sender: ENUM_SENDER.User,
      time: new Date().toISOString(),
      isVoiceNote: true,
      audioUrl: tempAudioUrl,
      audioDuration: this.formatRecordingTime(duration),
      fileName: fileName,
      fileType: audioBlob.type,
      message: 'Sending voice note...', // Temporary message
    };
    this.addOptimisticMessageToUI(optimisticMessage);

    this.chatCoreService.sendVoiceNote(audioBlob, fileName, audioBlob.type, duration)
      .catch(error => {
        console.error('Playground: Failed to send voice note:', error);
        this.updateOptimisticMessageStatusOnError(fileName, `Failed to send voice note "${fileName}"`);
        URL.revokeObjectURL(tempAudioUrl); // Revoke if sending failed
      });
  }

  private updateOptimisticMessageStatusOnError(fileName: string, errorMessageText: string): void {
    const messageKey = this._modelSelectedRoom?.name ?? this._stringUserId;
    if (!messageKey || !this._objChatMessages[messageKey]) return;

    const msgIndex = this._objChatMessages[messageKey].findIndex(
      m => m.fileName === fileName && m.sender === ENUM_SENDER.User && !m.id
    );
    if (msgIndex > -1) {
      this.ngZone.run(() => {
        const msgToUpdate = this._objChatMessages[messageKey][msgIndex];
        msgToUpdate.message = errorMessageText;
        if (msgToUpdate.audioUrl?.startsWith('blob:')) { // If it was a voice note
          URL.revokeObjectURL(msgToUpdate.audioUrl);
          msgToUpdate.audioUrl = undefined;
          msgToUpdate.isVoiceNote = false; // No longer a valid playable voice note
          msgToUpdate.audioDuration = undefined;
        }
        if (msgToUpdate.fileUrl?.startsWith('blob:')) { // If it was a file
           URL.revokeObjectURL(msgToUpdate.fileUrl);
           msgToUpdate.fileUrl = undefined;
        }
        this.updateFilteredMessages();
      });
    }
  }

  private startRecordingTimer(): void {
    this.recordingTime = 0;
    this.recordingTimerSubscription = timer(0, 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isRecording) { this.recordingTime++; this.cdr.detectChanges(); }
      });
  }

  private stopRecordingTimer(): void {
    this.recordingTimerSubscription?.unsubscribe();
    this.recordingTimerSubscription = null;
  }

  public formatRecordingTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  getSafeUrl(url?: string): SafeUrl | null {
    return url ? this.sanitizer.bypassSecurityTrustUrl(url) : null;
  }

  previewImage(url?: string): void {
    if (url) this.previewImageUrl = url;
  }

  closeImagePreview(): void {
    this.previewImageUrl = null;
  }

  scrollToBottom(): void {
    if (!this.chatScroll || !this.chatScroll.nativeElement) return;
    try {
      this.ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          this.chatScroll.nativeElement.scrollTop = this.chatScroll.nativeElement.scrollHeight;
        }, 50); // Small delay for DOM updates
      });
    } catch (err) { console.error("Error scrolling:", err); }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopRecordingTimer();
    if (this.mediaRecorder && this.isRecording) this.mediaRecorder.stop();
    if (this.currentStream) this.currentStream.getTracks().forEach(track => track.stop());

    // Clean up any remaining object URLs
    Object.values(this._objChatMessages).flat().forEach(msg => {
      if (msg.audioUrl?.startsWith('blob:')) URL.revokeObjectURL(msg.audioUrl);
      if (msg.fileUrl?.startsWith('blob:')) URL.revokeObjectURL(msg.fileUrl);
    });
  }
}