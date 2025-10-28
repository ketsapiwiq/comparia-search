export interface ConversationMessage {
  role: string;
  content: string;
  metadata?: {
    output_tokens?: number;
    [key: string]: any;
  };
}

export interface Conversation {
  id: number;
  timestamp: number;
  model_a_name: string;
  model_b_name: string;
  conversation_a: ConversationMessage[];
  conversation_b: ConversationMessage[];
  conv_turns: number;
  system_prompt_a?: string | null;
  system_prompt_b?: string | null;
  conversation_pair_id: string;
  conv_a_id: string;
  conv_b_id: string;
  session_hash: string;
  visitor_id?: string | null;
  ip?: string | null;
  model_pair_name: string;
  opening_msg: string;
  archived: boolean;
  mode?: string | null;
  custom_models_selection?: Record<string, any> | null;
  short_summary?: string | null;
  keywords?: string[] | null;
  categories?: string[] | null;
  languages?: string[] | null;
  pii_analyzed: boolean;
  contains_pii?: boolean | null;
  total_conv_a_output_tokens?: number | null;
  total_conv_b_output_tokens?: number | null;
  ip_map?: string | null;
  postprocess_failed: boolean;
}

export interface SearchResult {
  id: number;
  model_a_name: string;
  model_b_name: string;
  short_summary: string;
  keywords: string[];
  categories: string[];
  languages: string[];
  timestamp: number;
  score?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  totalPages: number;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
}