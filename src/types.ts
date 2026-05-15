export interface QueryRecord {
  id?: string;
  question: string;
  solution: string;
  category: string;
  tags: string[];
  productId?: string;
  createdAt: any;
  createdBy: string;
}

export interface KnowledgeArticle {
  id?: string;
  title: string;
  content: string;
  type: 'manual' | 'spec' | 'sop' | 'guide';
  createdAt: any;
  updatedBy: string;
}

export interface ChatSession {
  id?: string;
  userId: string;
  status: 'active' | 'resolved' | 'escalated';
  createdAt: any;
  lastMessage?: string;
}

export interface Message {
  id?: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'staff' | 'user';
  createdAt: any;
}
