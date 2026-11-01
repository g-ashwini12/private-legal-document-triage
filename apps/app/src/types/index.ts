export interface HealthStatus {
  status: string;
  ollama_reachable: boolean;
  model: string;
  active_document: string | null;
}

export interface Chunk {
  chunk_id: string;
  document_id: string;
  page: number;
  clause_number: string | null;
  heading: string | null;
  text: string;
}

export interface DocumentMetadata {
  document_id: string;
  filename: string;
  file_hash: string;
  page_count: number;
  doc_type: string;
  chunk_count: number;
  truncated: boolean;
  summary: string | null;
  created_at: string;
}

export interface DocumentListItem {
  document_id: string;
  filename: string;
  file_hash: string;
  page_count: number;
  doc_type: string;
  chunk_count: number;
  truncated: boolean;
  summary: string | null;
  created_at: string;
}

export interface KeyDetailItem {
  category: string;
  label: string;
  value: string;
  clause_ref?: string;
  page?: number;
  quote?: string;
}

export interface WatchOutItem {
  clause_ref: string;
  page: number;
  level: 'High' | 'Medium' | 'Low';
  headline: string;
  explanation: string;
  suggested_question: string;
  quote: string;
  headline_en?: string;
  explanation_en?: string;
  suggested_question_en?: string;
}

export interface ObligationItem {
  who: string;
  action: string;
  clause_ref: string;
  page: number;
  quote: string;
  action_en?: string;
}

export interface SimpleDeadlineItem {
  date_iso?: string | null;
  date_display: string;
  event: string;
  clause_ref: string;
  page: number;
  quote: string;
  event_en?: string;
}

export interface LawyerAdvice {
  should_see_lawyer: boolean;
  reason: string;
  what_to_ask: string;
  by_when: string;
  recommended_specialist: string;
  reason_en?: string;
  what_to_ask_en?: string;
  by_when_en?: string;
  recommended_specialist_en?: string;
}

export interface DocumentAnalysisCards {
  document_id: string;
  language: string;
  summary: string;
  summary_en?: string;
  key_details: KeyDetailItem[];
  watch_out_risks: WatchOutItem[];
  what_you_must_do: ObligationItem[];
  important_dates: SimpleDeadlineItem[];
  lawyer_advice: LawyerAdvice;
  suggested_questions: string[];
  suggested_questions_en?: string[];
  confidence_level: string;
  checked_against_document: boolean;
  translation_notice?: string;
}

export interface EvidenceItem {
  chunk_id: string;
  page: number;
  clause: string;
  quote: string;
}

export interface AnswerResponse {
  answer: string;
  answer_en?: string;
  language: string;
  clauses: string[];
  evidence: EvidenceItem[];
  watch_out_risks?: WatchOutItem[];
  lawyer_advice?: LawyerAdvice | null;
  confidence_level: string;
  checked_against_document: boolean;
  translation_notice?: string;
}

export interface NodeProgress {
  node?: string;
  message: string;
}

export interface MetricSummary {
  total_queries: number;
  cache_hits: number;
  cache_hit_rate: number;
  avg_latency_ms: number;
  avg_tokens: number;
  total_errors: number;
  feedback_positive: number;
  feedback_negative: number;
  avg_context_tokens: number;
  node_latencies: Record<string, number>;
  prompt_scores: Record<string, number>;
}

export interface EvalCaseResult {
  id: string;
  question: string;
  passed: boolean;
  route_matched: boolean;
  keywords_matched: boolean;
  evidence_verified: boolean;
  details: string;
}

export interface EvalSuiteResult {
  total: number;
  passed: number;
  failed: number;
  score_percentage: number;
  zero_unverified_claims: boolean;
  results: EvalCaseResult[];
  timestamp: string;
}
