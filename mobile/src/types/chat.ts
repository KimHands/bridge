// Chat types — mirrors backend app/schemas/chat.py

export interface CrisisInfo {
  lines: string[];
  show_hospital_cta: boolean;
}

export interface ChatMessageRequest {
  message: string;
}

export interface ChatMessageResponse {
  reply: string;
  is_crisis: boolean;
  crisis_info: CrisisInfo | null;
}

export interface MemoryItem {
  content: string;
}

export interface MemoryListResponse {
  memories: MemoryItem[];
}

// 화면 로컬 말풍선 모델
export interface ChatBubble {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  isCrisis?: boolean;
  crisisInfo?: CrisisInfo | null;
}
