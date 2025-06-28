export interface ChatHistoryResponseModel {
  id: string; // UUID dari server biasanya direpresentasikan sebagai string di TypeScript
  room_conversation_id: string; // UUID dari server biasanya direpresentasikan sebagai string di TypeScript
  sender_id: string; // UUID dari server biasanya direpresentasikan sebagai string di TypeScript
  message: string; // Kolom 'message' dari server
  created_at: string; // DateTime dari server biasanya string (ISO 8601) dari API
  agent_response_category: string | null; 
  agent_response_latency: string | null;
  agent_total_tokens: number | null; // Integer nullable dari server
  agent_input_tokens: number | null; // Integer nullable dari server
  agent_output_tokens: number | null; // Integer nullable dari server
  agent_other_metrics: { [key: string]: any } | null; // JSON dari server direpresentasikan sebagai objek di TypeScript
  agent_tools_call: string[] | null; // ARRAY(String) dari server direpresentasikan sebagai array string di TypeScript
  role: 'user' | 'admin' | 'chatbot'; // Role dari pengirim pesan
}

/**
 * Model untuk respons riwayat chat user dari server.
 * Sesuai dengan schema UserHistoryResponse dari FastAPI.
 */
export interface UserHistoryResponseModel {
  success: boolean;
  room_id: string; // Di Angular/TS, UUID biasanya direpresentasikan sebagai string
  user_id: string;
  history: ChatHistoryResponseModel[]; // Array dari model chat history
}
