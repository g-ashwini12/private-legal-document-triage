import os
import json
import uuid
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Response, Request, Depends, Cookie
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from pydantic import BaseModel
import httpx

from config import settings
from database import (
    init_db, get_connection, list_all_documents, get_document_by_id,
    delete_document_records, save_document_analysis, get_document_analysis
)
from models import (
    HealthResponse, DocumentMetadata, DocumentListItem, ChunkModel, AskRequest,
    FeedbackRequest, MetricSummary, EvalSuiteResult, EvalCaseResult,
    DocumentAnalysisCards, AnswerResponse, AdminAuthRequest
)
from step1_extract import extract_pdf, ExtractionError
from step2_gate import classify_document
from step3_chunk import chunk_document
from step4_index import (
    index_document_chunks, get_document_chunks, delete_document_data,
    check_semantic_cache, store_semantic_cache
)
from llm_engine import (
    check_ollama_status, analyze_document_content, answer_user_question,
    translate_analysis_cards
)
from translation_layer import STREAMING_STATUS_MESSAGES

app = FastAPI(
    title="Private Legal Document Triage Agent API",
    version="2.0.0",
    description="Offline-capable private legal document triage."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

# -------------------------------------------------------------
# Public Endpoints
# -------------------------------------------------------------
@app.get("/api/health", response_model=HealthResponse)
def get_health():
    """Health check without any demo flag."""
    ollama_ok = check_ollama_status()
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT document_id FROM documents ORDER BY created_at DESC LIMIT 1")
    row = c.fetchone()
    conn.close()
    active_doc = row["document_id"] if row else None

    return HealthResponse(
        status="ok",
        ollama_reachable=ollama_ok,
        model=settings.OLLAMA_MODEL,
        active_document=active_doc
    )

@app.get("/api/documents", response_model=List[DocumentListItem])
def get_documents_list():
    """List all uploaded documents."""
    docs = list_all_documents()
    return [
        DocumentListItem(
            document_id=d["document_id"],
            filename=d["filename"],
            file_hash=d["file_hash"],
            page_count=d["page_count"],
            doc_type=d["doc_type"],
            chunk_count=d["chunk_count"],
            truncated=bool(d["truncated"]),
            summary=d.get("summary"),
            created_at=str(d["created_at"])
        )
        for d in docs
    ]

class TTSRequest(BaseModel):
    text: str
    language: str = "en"
    speaker: Optional[str] = "meera"

@app.post("/api/tts")
async def text_to_speech(req: TTSRequest, request: Request):
    """
    Generate expressive, natural Indian Text-to-Speech using Sarvam.ai Bulbul API.
    Falls back gracefully to browser synthesis if key is not configured.
    """
    sarvam_key = request.headers.get("x-sarvam-key") or os.environ.get("SARVAM_API_KEY", "")
    if not sarvam_key:
        return {"status": "fallback", "message": "No Sarvam API key provided; falling back to browser synthesis."}

    lang_code_map = {
        "en": "en-IN",
        "hi": "hi-IN",
        "ta": "ta-IN",
        "te": "te-IN",
        "kn": "kn-IN",
        "ml": "ml-IN"
    }
    target_lang = lang_code_map.get(req.language, "en-IN")

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(
                "https://api.sarvam.ai/text-to-speech",
                headers={
                    "api-subscription-key": sarvam_key.strip(),
                    "Content-Type": "application/json"
                },
                json={
                    "inputs": [req.text[:500]],
                    "target_language_code": target_lang,
                    "speaker": req.speaker or "meera",
                    "pitch": 0,
                    "pace": 1.0,
                    "loudness": 1.5,
                    "speech_sample_rate": 22050,
                    "enable_preprocessing": True,
                    "model": "bulbul:v1"
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                audios = data.get("audios", [])
                if audios:
                    return {"status": "ok", "audio_base64": audios[0], "format": "audio/wav"}
    except Exception as e:
        pass

    return {"status": "fallback", "message": "Sarvam API request failed; falling back to browser synthesis."}

@app.post("/api/documents")
async def upload_document(file: UploadFile = File(...), language: str = "en"):
    """Upload legal PDF, validate with PyMuPDF, verify legal gate, chunk by clause, index, and auto-analyze."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(content) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum upload size of {settings.MAX_UPLOAD_MB} MB."
        )

    doc_id = str(uuid.uuid4())[:8]
    stored_path = settings.UPLOAD_DIR / f"{doc_id}_{file.filename}"
    with open(stored_path, "wb") as f:
        f.write(content)

    try:
        extracted = extract_pdf(stored_path, filename=file.filename)
    except ExtractionError as e:
        if stored_path.exists():
            os.remove(stored_path)
        raise HTTPException(status_code=e.status_code, detail=e.message)

    # Check deduplication by file hash
    conn = get_connection()
    c = conn.cursor()
    c.execute(
        "SELECT document_id, filename, file_hash, page_count, doc_type, chunk_count, truncated, summary, created_at FROM documents WHERE file_hash = ?",
        (extracted.file_hash,)
    )
    existing = c.fetchone()
    if existing:
        conn.close()
        if stored_path.exists():
            os.remove(stored_path)
        
        # Load pre-analyzed cards if available
        cards = get_document_analysis(existing["document_id"])
        if not cards:
            chunks = get_document_chunks(existing["document_id"])
            cards = analyze_document_content(chunks, existing["doc_type"], existing["document_id"], language).model_dump()
            save_document_analysis(existing["document_id"], cards)

        return {
            "document_id": existing["document_id"],
            "filename": existing["filename"],
            "file_hash": existing["file_hash"],
            "page_count": existing["page_count"],
            "doc_type": existing["doc_type"],
            "chunk_count": existing["chunk_count"],
            "truncated": bool(existing["truncated"]),
            "summary": existing["summary"],
            "created_at": str(existing["created_at"]),
            "analysis_cards": cards,
            "deduplicated": True,
            "message": "Identical document already indexed. Reusing existing document."
        }

    # Gate check
    gate = classify_document(extracted.total_readable_text)
    if not gate.is_legal:
        if stored_path.exists():
            os.remove(stored_path)
        conn.close()
        raise HTTPException(
            status_code=422,
            detail={
                "error": "Non-legal document detected",
                "detected_type": gate.doc_type,
                "reason": gate.reason
            }
        )

    # Chunk clauses
    chunks = chunk_document(extracted, doc_id)
    # Index in Chroma + BM25
    index_document_chunks(doc_id, chunks)

    # Auto-generate the 6 analysis cards immediately upon upload
    cards_obj = analyze_document_content(chunks, gate.doc_type, doc_id, language)
    cards_dict = cards_obj.model_dump()
    save_document_analysis(doc_id, cards_dict)

    summary = f"{gate.doc_type.capitalize()} document containing {len(chunks)} clauses across {extracted.page_count} pages."
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    c.execute("""
    INSERT INTO documents (document_id, filename, file_hash, page_count, doc_type, chunk_count, truncated, summary, analysis_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        doc_id,
        file.filename,
        extracted.file_hash,
        extracted.page_count,
        gate.doc_type,
        len(chunks),
        1 if extracted.truncated else 0,
        summary,
        json.dumps(cards_dict),
        now_str
    ))
    conn.commit()
    conn.close()

    return {
        "document_id": doc_id,
        "filename": file.filename,
        "file_hash": extracted.file_hash,
        "page_count": extracted.page_count,
        "doc_type": gate.doc_type,
        "chunk_count": len(chunks),
        "truncated": extracted.truncated,
        "summary": summary,
        "created_at": now_str,
        "analysis_cards": cards_dict,
        "deduplicated": False,
        "message": "Document uploaded and analyzed successfully."
    }

@app.get("/api/documents/{document_id}")
def get_document(document_id: str):
    """Get metadata, clauses, and analysis cards."""
    doc = get_document_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    chunks = get_document_chunks(document_id)
    cards = get_document_analysis(document_id)

    return {
        "metadata": {
            "document_id": doc["document_id"],
            "filename": doc["filename"],
            "file_hash": doc["file_hash"],
            "page_count": doc["page_count"],
            "doc_type": doc["doc_type"],
            "chunk_count": doc["chunk_count"],
            "truncated": bool(doc["truncated"]),
            "summary": doc["summary"],
            "created_at": str(doc["created_at"])
        },
        "chunks": [c.model_dump() for c in chunks],
        "analysis_cards": cards
    }

@app.get("/api/documents/{document_id}/cards", response_model=DocumentAnalysisCards)
def get_document_cards(document_id: str, language: str = "en"):
    """Get the 6 analysis cards for a document in the chosen language."""
    doc = get_document_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    chunks = get_document_chunks(document_id)
    cards_dict = get_document_analysis(document_id)
    if cards_dict:
        cards_obj = DocumentAnalysisCards(**cards_dict)
        if language != "en":
            cards_obj = translate_analysis_cards(cards_obj, language)
        return cards_obj

    # If not yet generated, analyze now
    cards_obj = analyze_document_content(chunks, doc["doc_type"], document_id, language)
    save_document_analysis(document_id, cards_obj.model_dump())
    return cards_obj

@app.get("/api/documents/{document_id}/file")
def get_document_file(document_id: str):
    """Serve the original uploaded PDF file for the in-browser document viewer."""
    doc = get_document_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    target_files = list(settings.UPLOAD_DIR.glob(f"{document_id}*"))
    if not target_files or not target_files[0].exists():
        raise HTTPException(status_code=404, detail="Document file not found on disk.")

    file_path = target_files[0]
    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=doc["filename"]
    )

@app.delete("/api/documents/{document_id}")
def delete_document(document_id: str):
    """Permanently delete a document, its PDF file, vector collections, BM25 index, chunks, sessions, and cache."""
    doc = get_document_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    delete_document_data(document_id)
    return {"message": f"Document '{doc['filename']}' ({document_id}) and all associated indexes deleted successfully."}

@app.post("/api/ask")
async def ask_question(req: AskRequest):
    """Ask plain-language question on the uploaded document with friendly streaming messages."""
    q = req.question.strip()
    if len(q) < 3 or len(q) > 1000:
        raise HTTPException(status_code=400, detail="Question must be between 3 and 1000 characters.")

    doc = get_document_by_id(req.document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    chunks = get_document_chunks(req.document_id)
    lang = req.language if req.language in ["en", "ta", "kn", "te", "hi", "ml"] else "en"

    # Friendly localized progress messages
    msg_read = STREAMING_STATUS_MESSAGES["reading"].get(lang, "Reading your document…")
    msg_check = STREAMING_STATUS_MESSAGES["checking"].get(lang, "Checking the details…")
    msg_verify = STREAMING_STATUS_MESSAGES["verifying"].get(lang, "Checking against your document…")
    msg_final = STREAMING_STATUS_MESSAGES["finalizing"].get(lang, "Writing your plain-language answer…")

    async def event_generator():
        # Step 1: Reading document
        yield f"event: node_progress\ndata: {json.dumps({'message': msg_read})}\n\n"
        await asyncio.sleep(0.06)

        # Step 2: Checking details
        yield f"event: node_progress\ndata: {json.dumps({'message': msg_check})}\n\n"
        await asyncio.sleep(0.06)

        # Step 3: Verifying evidence
        yield f"event: node_progress\ndata: {json.dumps({'message': msg_verify})}\n\n"
        await asyncio.sleep(0.06)

        # Step 4: Finalizing
        yield f"event: node_progress\ndata: {json.dumps({'message': msg_final})}\n\n"

        # Check semantic cache first
        cached = check_semantic_cache(req.document_id, q)
        if cached:
            cached_resp = AnswerResponse(**cached)
            yield f"event: final_response\ndata: {json.dumps(cached_resp.model_dump())}\n\n"
            return

        # Execute grounded answer
        resp = answer_user_question(req.document_id, q, chunks, lang)

        # Store in cache
        try:
            store_semantic_cache(req.document_id, q, resp.model_dump())
        except Exception:
            pass

        # Save session history
        conn = get_connection()
        c = conn.cursor()
        c.execute("""
        INSERT INTO session_turns (session_id, document_id, role, content)
        VALUES (?, ?, 'user', ?)
        """, (req.session_id, req.document_id, q))
        c.execute("""
        INSERT INTO session_turns (session_id, document_id, role, content)
        VALUES (?, ?, 'assistant', ?)
        """, (req.session_id, req.document_id, resp.answer))
        conn.commit()
        conn.close()

        yield f"event: final_response\ndata: {json.dumps(resp.model_dump())}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/sessions/{session_id}")
def get_session_history(session_id: str):
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
    SELECT role, content, created_at FROM session_turns
    WHERE session_id = ? ORDER BY id ASC LIMIT 20
    """, (session_id,))
    turns = [dict(r) for r in c.fetchall()]
    conn.close()
    return {"session_id": session_id, "turns": turns}

@app.post("/api/feedback")
def submit_feedback(req: FeedbackRequest):
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
    INSERT INTO feedback (session_id, question, rating, reason)
    VALUES (?, ?, ?, ?)
    """, (req.session_id, req.question, req.rating, req.reason))
    conn.commit()
    conn.close()
    return {"status": "ok", "message": "Feedback recorded."}

# -------------------------------------------------------------
# Protected Admin Endpoints (Require ADMIN_ENABLED=true and login)
# -------------------------------------------------------------
def verify_admin_access(request: Request, admin_token: Optional[str] = Cookie(None)):
    """Gatekeeper for admin routes: returns 404 if ADMIN_ENABLED is false; requires password if true."""
    if not settings.ADMIN_ENABLED:
        raise HTTPException(status_code=404, detail="Not found")

    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "").strip()
    elif admin_token:
        token = admin_token

    if token != settings.ADMIN_COOKIE_SECRET:
        raise HTTPException(status_code=401, detail="Admin password required")
    return True

@app.post("/api/admin/login")
def admin_login(body: AdminAuthRequest, response: Response):
    """Admin login endpoint."""
    if not settings.ADMIN_ENABLED:
        raise HTTPException(status_code=404, detail="Not found")

    if body.password != settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Incorrect admin password")

    # Set signed admin cookie
    response.set_cookie(
        key="admin_token",
        value=settings.ADMIN_COOKIE_SECRET,
        httponly=True,
        samesite="lax",
        max_age=86400
    )
    return {"status": "ok", "token": settings.ADMIN_COOKIE_SECRET}

@app.get("/api/admin/metrics", response_model=MetricSummary)
def get_admin_metrics(auth: bool = Depends(verify_admin_access)):
    """Admin-only monitoring metrics."""
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) as total, SUM(cache_hit) as hits, AVG(latency_ms) as avg_lat, AVG(tokens_used) as avg_tok, SUM(error_occurred) as errors, AVG(context_tokens) as avg_ctx FROM metrics")
    m = c.fetchone()
    
    total = m["total"] or 0
    hits = m["hits"] or 0
    cache_rate = round(hits / total if total > 0 else 0.0, 3)
    avg_lat = round(m["avg_lat"] or 0.0, 2)
    avg_tok = round(m["avg_tok"] or 0.0, 1)
    errors = m["errors"] or 0
    avg_ctx = int(m["avg_ctx"] or 0)

    c.execute("SELECT COUNT(*) FROM feedback WHERE rating > 0")
    pos_feed = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM feedback WHERE rating < 0")
    neg_feed = c.fetchone()[0]

    c.execute("SELECT variant_name, avg_score FROM prompt_variants")
    prompt_scores = {r["variant_name"]: round(r["avg_score"], 2) for r in c.fetchall()}

    c.execute("SELECT node_timings_json FROM metrics WHERE node_timings_json IS NOT NULL ORDER BY id DESC LIMIT 20")
    timing_rows = c.fetchall()
    node_sums: Dict[str, float] = {}
    node_counts: Dict[str, int] = {}
    for r in timing_rows:
        try:
            t_data = json.loads(r["node_timings_json"])
            for node, ms in t_data.items():
                node_sums[node] = node_sums.get(node, 0.0) + ms
                node_counts[node] = node_counts.get(node, 0) + 1
        except Exception:
            pass

    node_latencies = {n: round(node_sums[n] / node_counts[n], 2) for n in node_sums}
    conn.close()

    return MetricSummary(
        total_queries=total,
        cache_hits=hits,
        cache_hit_rate=cache_rate,
        avg_latency_ms=avg_lat,
        avg_tokens=avg_tok,
        total_errors=errors,
        feedback_positive=pos_feed,
        feedback_negative=neg_feed,
        avg_context_tokens=avg_ctx,
        node_latencies=node_latencies,
        prompt_scores=prompt_scores
    )

@app.get("/api/admin/evals", response_model=Optional[EvalSuiteResult])
def get_admin_evals(auth: bool = Depends(verify_admin_access)):
    """Admin-only latest evaluation benchmark results."""
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM eval_runs ORDER BY id DESC LIMIT 1")
    row = c.fetchone()
    conn.close()

    if not row:
        return None

    results = [EvalCaseResult(**r) for r in json.loads(row["results_json"])]
    return EvalSuiteResult(
        total=row["total"],
        passed=row["passed"],
        failed=row["failed"],
        score_percentage=row["score_percentage"],
        zero_unverified_claims=bool(row["zero_unverified_claims"]),
        results=results,
        timestamp=row["created_at"]
    )
