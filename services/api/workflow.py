import time
import json
from typing import Dict, Any, List, Optional, TypedDict
from langgraph.graph import StateGraph, START, END

from config import settings
from models import (
    AnalysisResponse, RiskItem, DeadlineItem, EvidenceItem,
    EscalationAdvice, VerificationResult, ChunkModel
)
from step4_index import (
    check_semantic_cache, store_semantic_cache, get_document_chunks
)
from router import classify_route
from hybrid_retrieval import hybrid_retrieve
from llm_engine import generate_sample_answer, norm_text
from jev_checks import run_jev_checks
from feedback_loop import select_prompt_variant, score_response, update_variant_reward
from database import get_connection

class GraphState(TypedDict):
    document_id: str
    session_id: str
    question: str
    route: str
    chunks: List[ChunkModel]
    retrieved_chunks: List[ChunkModel]
    prompt_variant: str
    top_k: int
    raw_response: Optional[AnalysisResponse]
    verified_response: Optional[AnalysisResponse]
    jev_results: Dict[str, bool]
    node_timings: Dict[str, float]
    cache_hit: bool
    error: Optional[str]

# Node 1: Cache Lookup
def node_cache_lookup(state: GraphState) -> Dict[str, Any]:
    t0 = time.time()
    cached = check_semantic_cache(state["document_id"], state["question"])
    duration = (time.time() - t0) * 1000
    
    timings = dict(state.get("node_timings", {}))
    timings["cache_lookup"] = round(duration, 2)

    if cached:
        response = AnalysisResponse(**cached)
        return {
            "cache_hit": True,
            "verified_response": response,
            "node_timings": timings
        }
    
    return {
        "cache_hit": False,
        "node_timings": timings
    }

# Node 2: Router
def node_router(state: GraphState) -> Dict[str, Any]:
    t0 = time.time()
    route = classify_route(state["question"])
    variant, top_k = select_prompt_variant()
    duration = (time.time() - t0) * 1000
    
    timings = dict(state.get("node_timings", {}))
    timings["router"] = round(duration, 2)
    
    return {
        "route": route,
        "prompt_variant": variant,
        "top_k": top_k,
        "node_timings": timings
    }

# Node 3: Hybrid Retrieval
def node_retrieval(state: GraphState) -> Dict[str, Any]:
    t0 = time.time()
    if state["route"] == "out_of_scope":
        chunks = []
    elif state["route"] == "summary":
        chunks = get_document_chunks(state["document_id"])
    else:
        chunks = hybrid_retrieve(
            document_id=state["document_id"],
            query=state["question"],
            top_k=state.get("top_k", 6)
        )
    
    duration = (time.time() - t0) * 1000
    timings = dict(state.get("node_timings", {}))
    timings["retrieval"] = round(duration, 2)
    
    return {
        "retrieved_chunks": chunks,
        "node_timings": timings
    }

# Node 4: Parallel Analysis Branches
def node_parallel_branches(state: GraphState) -> Dict[str, Any]:
    t0 = time.time()
    raw = generate_sample_answer(
        question=state["question"],
        route=state["route"],
        chunks=state.get("retrieved_chunks", []),
        document_id=state["document_id"]
    )
    duration = (time.time() - t0) * 1000
    timings = dict(state.get("node_timings", {}))
    timings["parallel_branches"] = round(duration, 2)
    
    return {
        "raw_response": raw,
        "node_timings": timings
    }

# Node 5: Evidence Verification (Code-based verification)
def node_evidence_verification(state: GraphState) -> Dict[str, Any]:
    t0 = time.time()
    raw = state["raw_response"]
    if not raw:
        return {}

    all_chunks = {c.chunk_id: norm_text(c.text) for c in get_document_chunks(state["document_id"])}
    
    verified_evidence: List[EvidenceItem] = []
    dropped_details: List[str] = []
    total_claims = len(raw.evidence) or 1
    dropped_count = 0

    for ev in raw.evidence:
        # Check if chunk_id exists or match by clause ref
        matched_chunk_text = None
        if ev.chunk_id in all_chunks:
            matched_chunk_text = all_chunks[ev.chunk_id]
        else:
            c_target = ev.clause.lower().replace("clause", "").strip()
            for cid, ctext in all_chunks.items():
                if f"_c{c_target}" in cid:
                    matched_chunk_text = ctext
                    ev.chunk_id = cid
                    break

        if matched_chunk_text:
            norm_quote = norm_text(ev.quote)
            # Check quote presence
            if norm_quote in matched_chunk_text or any(part in matched_chunk_text for part in norm_quote.split(". ") if len(part) > 20):
                verified_evidence.append(ev)
            else:
                dropped_count += 1
                dropped_details.append(f"Quote not found in chunk {ev.chunk_id}: '{ev.quote[:40]}...'")
        else:
            dropped_count += 1
            dropped_details.append(f"Invalid chunk_id cited: {ev.chunk_id}")

    # Confidence calculation
    verified_count = len(verified_evidence)
    confidence = round(verified_count / total_claims, 2) if total_claims > 0 else 1.0

    raw.evidence = verified_evidence
    raw.confidence = confidence
    raw.verification = VerificationResult(
        claims=total_claims,
        dropped=dropped_count,
        dropped_details=dropped_details
    )

    duration = (time.time() - t0) * 1000
    timings = dict(state.get("node_timings", {}))
    timings["evidence_verification"] = round(duration, 2)

    return {
        "raw_response": raw,
        "node_timings": timings
    }

# Node 6: Safety Validation & Escalation
def node_safety_validation(state: GraphState) -> Dict[str, Any]:
    t0 = time.time()
    raw = state["raw_response"]
    
    # Run Jev yes/no tests
    jev_results = run_jev_checks(raw, {"document_id": state["document_id"], "question": state["question"]})

    # Ensure disclaimer
    raw.disclaimer = "This is not legal advice. For specific legal issues, consult a qualified lawyer."

    # Escalation rules check:
    # Escalate if high risk, court question, low confidence (< 0.6)
    has_high = any(r.level.lower() == "high" for r in raw.risks)
    is_court_q = any(w in state["question"].lower() for w in ["court", "win", "illegal", "rights", "arbitrat"])
    if (has_high or is_court_q or raw.confidence < 0.6) and not raw.escalation_advice.needed:
        raw.escalation_advice = EscalationAdvice(
            needed=True,
            reason="High risk or contentious dispute clause detected.",
            who="Property / Tenancy dispute lawyer",
            bring="Rental agreement and all related notices/receipts",
            ask="Clarification on rights under local tenancy legislation",
            by_when="Before taking formal steps or signing"
        )

    duration = (time.time() - t0) * 1000
    timings = dict(state.get("node_timings", {}))
    timings["safety_validation"] = round(duration, 2)

    return {
        "verified_response": raw,
        "jev_results": jev_results,
        "node_timings": timings
    }

# Node 7: Respond & Log
def node_respond(state: GraphState) -> Dict[str, Any]:
    t0 = time.time()
    response = state["verified_response"]
    
    # 1. Update semantic cache if not already from cache
    if not state.get("cache_hit") and response.route != "out_of_scope":
        try:
            store_semantic_cache(state["document_id"], state["question"], response.model_dump())
        except Exception:
            pass

    # 2. Record turning in session history & metrics
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
    INSERT INTO session_turns (session_id, document_id, role, content)
    VALUES (?, ?, 'user', ?)
    """, (state["session_id"], state["document_id"], state["question"]))
    
    c.execute("""
    INSERT INTO session_turns (session_id, document_id, role, content)
    VALUES (?, ?, 'assistant', ?)
    """, (state["session_id"], state["document_id"], response.answer))

    # Save metrics
    duration_total = sum(state.get("node_timings", {}).values())
    tokens_est = len(response.answer.split()) * 2
    context_tokens = len(state["question"].split()) * 2 + 500
    
    c.execute("""
    INSERT INTO metrics (document_id, session_id, route, cache_hit, latency_ms, tokens_used, context_tokens, error_occurred, node_timings_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    """, (
        state["document_id"],
        state["session_id"],
        response.route,
        1 if state.get("cache_hit") else 0,
        duration_total,
        tokens_est,
        context_tokens,
        json.dumps(state.get("node_timings", {}))
    ))
    conn.commit()
    conn.close()

    # 3. Score variant and update reward
    variant = state.get("prompt_variant", "variant_balanced")
    reward = score_response(response)
    update_variant_reward(variant, reward)

    duration = (time.time() - t0) * 1000
    timings = dict(state.get("node_timings", {}))
    timings["respond"] = round(duration, 2)

    return {"node_timings": timings}

# Routing conditional edge
def route_cache_or_proceed(state: GraphState) -> str:
    if state.get("cache_hit"):
        return "respond"
    return "router"

def create_triage_graph():
    builder = StateGraph(GraphState)
    builder.add_node("cache_lookup", node_cache_lookup)
    builder.add_node("router", node_router)
    builder.add_node("retrieval", node_retrieval)
    builder.add_node("parallel_branches", node_parallel_branches)
    builder.add_node("evidence_verification", node_evidence_verification)
    builder.add_node("safety_validation", node_safety_validation)
    builder.add_node("respond", node_respond)

    builder.add_edge(START, "cache_lookup")
    builder.add_conditional_edges("cache_lookup", route_cache_or_proceed, {
        "respond": "respond",
        "router": "router"
    })
    builder.add_edge("router", "retrieval")
    builder.add_edge("retrieval", "parallel_branches")
    builder.add_edge("parallel_branches", "evidence_verification")
    builder.add_edge("evidence_verification", "safety_validation")
    builder.add_edge("safety_validation", "respond")
    builder.add_edge("respond", END)

    return builder.compile()

# Global compiled graph instance
triage_graph = create_triage_graph()
