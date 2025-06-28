
export interface RoomConversationModel {
  id: string; // UUID biasanya direpresentasikan sebagai string di TS
  name: string | null; // string(255), bisa null
  description: string | null; // string, bisa null
  status: string; // string(20), not nullable, default 'open'
  created_at: string; // DateTime, biasanya string (ISO 8601) dari API
  updated_at: string | null; // DateTime, bisa null
  agent_active: boolean; // Boolean, not nullable, default true

  lastMessage?: string;
  lastTimeMessage?: string; 
}
