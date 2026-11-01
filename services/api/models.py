from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

class HealthResponse(BaseModel):
    status: str = "ok"
    ollama_reachable: bool = False
    model: str = "gemma3:1b"
    active_document: Optional[str] = None

class ChunkModel(BaseModel):
    chunk_id: str
    document_id: str
    page: int
    clause_number: Optional[str] = None
    heading: Optional[str] = None
    text: str

class KeyDetailItem(BaseModel):
    category: str  # "Parties & People", "Amounts & Money", "Key Dates"
    label: str
    value: str
    clause_ref: Optional[str] = None
    page: Optional[int] = None
    quote: Optional[str] = None

class WatchOutItem(BaseModel):
    clause_ref: str
    page: int
    level: str  # "High", "Medium", "Low"
    headline: str
    explanation: str
    suggested_question: str
    quote: str
    headline_en: Optional[str] = None
    explanation_en: Optional[str] = None
    suggested_question_en: Optional[str] = None

class ObligationItem(BaseModel):
    who: str  # "You (Tenant)", "You (Employee)", "Other Party", etc.
    action: str
    clause_ref: str
    page: int
    quote: str
    action_en: Optional[str] = None

class SimpleDeadlineItem(BaseModel):
    date_iso: Optional[str] = None
    date_display: str
    event: str
    clause_ref: str
    page: int
    quote: str
    event_en: Optional[str] = None

class LawyerAdvice(BaseModel):
    should_see_lawyer: bool  # Clear Yes / No
    reason: str
    what_to_ask: str
    by_when: str
    recommended_specialist: str
    reason_en: Optional[str] = None
    what_to_ask_en: Optional[str] = None
    by_when_en: Optional[str] = None
    recommended_specialist_en: Optional[str] = None

class DocumentAnalysisCards(BaseModel):
    document_id: str
    language: str = "en"
    summary: str
    summary_en: Optional[str] = None
    key_details: List[KeyDetailItem] = Field(default_factory=list)
    watch_out_risks: List[WatchOutItem] = Field(default_factory=list)
    what_you_must_do: List[ObligationItem] = Field(default_factory=list)
    important_dates: List[SimpleDeadlineItem] = Field(default_factory=list)
    lawyer_advice: LawyerAdvice
    suggested_questions: List[str] = Field(default_factory=list)
    suggested_questions_en: List[str] = Field(default_factory=list)
    confidence_level: str = "High"  # "High", "Medium", "Low" in plain words
    checked_against_document: bool = True
    translation_notice: Optional[str] = None

class DocumentMetadata(BaseModel):
    document_id: str
    filename: str
    file_hash: str
    page_count: int
    doc_type: str
    chunk_count: int
    truncated: bool = False
    created_at: str
    summary: Optional[str] = None

class DocumentListItem(BaseModel):
    document_id: str
    filename: str
    file_hash: str
    page_count: int
    doc_type: str
    chunk_count: int
    truncated: bool = False
    summary: Optional[str] = None
    created_at: str

class EvidenceItem(BaseModel):
    chunk_id: str
    page: int
    clause: str
    quote: str

class AnswerResponse(BaseModel):
    answer: str
    answer_en: Optional[str] = None
    language: str = "en"
    clauses: List[str] = Field(default_factory=list)
    evidence: List[EvidenceItem] = Field(default_factory=list)
    watch_out_risks: List[WatchOutItem] = Field(default_factory=list)
    lawyer_advice: Optional[LawyerAdvice] = None
    confidence_level: str = "High"  # "High", "Medium", "Low"
    checked_against_document: bool = True
    translation_notice: Optional[str] = None

class AskRequest(BaseModel):
    document_id: str
    session_id: str
    question: str
    language: str = "en"

class FeedbackRequest(BaseModel):
    session_id: str
    question: str
    rating: int  # 1 for thumbs up, -1 for thumbs down
    reason: Optional[str] = None

class AdminAuthRequest(BaseModel):
    password: str

class MetricSummary(BaseModel):
    total_queries: int
    cache_hits: int
    cache_hit_rate: float
    avg_latency_ms: float
    avg_tokens: float
    total_errors: int
    feedback_positive: int
    feedback_negative: int
    avg_context_tokens: int
    node_latencies: Dict[str, float] = Field(default_factory=dict)
    prompt_scores: Dict[str, float] = Field(default_factory=dict)

class EvalCaseResult(BaseModel):
    id: str
    question: str
    passed: bool
    route_matched: bool
    keywords_matched: bool
    evidence_verified: bool
    details: str

class EvalSuiteResult(BaseModel):
    total: int
    passed: int
    failed: int
    score_percentage: float
    zero_unverified_claims: bool
    results: List[EvalCaseResult]
    timestamp: str
