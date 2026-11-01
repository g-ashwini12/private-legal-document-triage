import re
import logging
from typing import List, Dict, Any, Tuple
from config import settings
from models import ChunkModel
from step4_index import get_chroma_client, get_bm25_index, get_document_chunks, tokenize

logger = logging.getLogger("legal_triage.retrieval")

MONEY_KEYWORDS = {"pay", "rent", "fee", "deposit", "amount", "cost", "money", "price", "charges", "financial", "utilities", "bills", "electricity", "water"}
DATE_KEYWORDS = {"when", "deadline", "due", "notice", "end", "start", "period", "duration", "date", "lock-in", "month", "year", "day"}

def hybrid_retrieve(document_id: str, query: str, top_k: int = 6) -> Tuple[List[ChunkModel], Dict[str, Any]]:
    """
    Executes hybrid retrieval using Chroma vector search (top 8) + BM25 search (top 8)
    combined via Reciprocal Rank Fusion (k=60) with keyword boosting.
    Returns (chunks, debug_info).
    """
    all_chunks = get_document_chunks(document_id)
    if not all_chunks:
        return [], {"error": "No chunks found for document"}

    chunk_map: Dict[str, ChunkModel] = {c.chunk_id: c for c in all_chunks}
    q_lower = query.lower()
    q_tokens = set(tokenize(query))

    debug_info: Dict[str, Any] = {
        "query": query,
        "vector_results": [],
        "bm25_results": [],
        "fused_scores": {},
        "keyword_boosts": {},
    }

    # 1. Vector Search (top 8)
    vector_ranks: Dict[str, int] = {}
    try:
        client = get_chroma_client()
        col_name = f"doc_{document_id.replace('-', '_')}"
        col = client.get_collection(col_name)
        res = col.query(query_texts=[query], n_results=min(8, len(all_chunks)))
        if res and res.get("ids") and res["ids"][0]:
            for rank, cid in enumerate(res["ids"][0]):
                vector_ranks[cid] = rank + 1
                debug_info["vector_results"].append({
                    "rank": rank + 1,
                    "chunk_id": cid,
                    "clause": chunk_map[cid].clause_number if cid in chunk_map else None,
                    "page": chunk_map[cid].page if cid in chunk_map else None
                })
    except Exception as e:
        logger.warning(f"Chroma vector search exception: {e}")

    # 2. BM25 Search (top 8)
    bm25_ranks: Dict[str, int] = {}
    bm25, registered_chunks = get_bm25_index(document_id)
    if bm25 and registered_chunks:
        token_list = tokenize(query)
        if token_list:
            scores = bm25.get_scores(token_list)
            scored_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
            rank = 1
            for idx in scored_indices[:8]:
                score = float(scores[idx])
                if score > 0.0:
                    cid = registered_chunks[idx].chunk_id
                    bm25_ranks[cid] = rank
                    debug_info["bm25_results"].append({
                        "rank": rank,
                        "chunk_id": cid,
                        "bm25_score": round(score, 4),
                        "clause": chunk_map[cid].clause_number if cid in chunk_map else None,
                        "page": chunk_map[cid].page if cid in chunk_map else None
                    })
                    rank += 1

    # 3. Reciprocal Rank Fusion (k=60)
    k = 60
    rrf_scores: Dict[str, float] = {}
    candidate_cids = set(vector_ranks.keys()).union(set(bm25_ranks.keys()))

    # Check for direct clause mentions e.g. "clause 3"
    direct_clause_match = re.search(r'\bclause\s*(\d+)\b', q_lower)
    target_clause_cid = None
    if direct_clause_match:
        target_num = direct_clause_match.group(1)
        for c in all_chunks:
            if c.clause_number == target_num:
                target_clause_cid = c.chunk_id
                candidate_cids.add(c.chunk_id)

    if not candidate_cids:
        # Fallback to all chunks
        logger.info(f"Hybrid retrieval: no vector or BM25 candidates, returning first {top_k} chunks")
        return all_chunks[:top_k], debug_info

    # Determine keyword boost intent
    has_money_query = bool(q_tokens.intersection(MONEY_KEYWORDS))
    has_date_query = bool(q_tokens.intersection(DATE_KEYWORDS))

    for cid in candidate_cids:
        score = 0.0
        if cid in vector_ranks:
            score += 1.0 / (k + vector_ranks[cid])
        if cid in bm25_ranks:
            score += 1.0 / (k + bm25_ranks[cid])

        # Direct clause match boost
        if cid == target_clause_cid:
            score += 0.50

        # Keyword Boosts
        boost = 0.0
        c_obj = chunk_map.get(cid)
        if c_obj:
            c_text = c_obj.text
            if has_money_query and re.search(r'(?:₹|Rs\.?|INR|\$|\brent\b|\bdeposit\b|\bfee\b)', c_text, re.IGNORECASE):
                boost += 0.04
            if has_date_query and re.search(r'(?:\b\d{1,2}(?:st|nd|rd|th)?\s+(?:day|month|year)?\b|\bnotice\b|\bdue\b|\bmonths\b|\bdays\b)', c_text, re.IGNORECASE):
                boost += 0.03

        score += boost
        rrf_scores[cid] = round(score, 5)
        debug_info["fused_scores"][cid] = rrf_scores[cid]
        if boost > 0:
            debug_info["keyword_boosts"][cid] = round(boost, 4)

    # Sort candidates by boosted RRF score descending
    sorted_cids = sorted(candidate_cids, key=lambda cid: rrf_scores[cid], reverse=True)
    results = [chunk_map[cid] for cid in sorted_cids if cid in chunk_map][:top_k]

    debug_info["top_chunk_ids"] = [c.chunk_id for c in results]
    debug_info["top_clauses"] = [c.clause_number for c in results]

    logger.info(f"Hybrid retrieval for '{query}': returned {len(results)} chunks. RRF scores: {debug_info['fused_scores']}")
    return results, debug_info
