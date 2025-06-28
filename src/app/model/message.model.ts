import { ENUM_SENDER } from "../constants/enum.constant";

export interface MessageModel {
  id?: string; // ID unik dari server
  room_id?: string;
  sender: ENUM_SENDER;
  message?: string; // Untuk pesan teks atau caption file/voice note
  time: string; // ISO string atau format yang mudah di-display

  // Untuk lampiran file (gambar, dokumen)
  fileUrl?: string;
  fileName?: string;
  fileType?: string; // e.g., 'image/png', 'application/pdf'

  // Untuk Voice Note
  isVoiceNote?: boolean;    // Penanda bahwa ini adalah voice note
  audioUrl?: string;        // URL ke file audio (dari server atau blob URL lokal)
  audioDuration?: string;   
}