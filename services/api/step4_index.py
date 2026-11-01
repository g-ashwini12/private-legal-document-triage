import os
import re
import math
import json
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import chromadb
from chromadb.config import Settings as ChromaSettings
from rank_bm25 import BM25Okapi

from config import settings
from database import get_connection
from models import ChunkModel

# Chroma client with local persistent storage
_chroma_client = None

def get_chroma_client() -> chromadb.Client:
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(path=str(settings.CHROMA_DIR))
    return _chroma_client

# In-memory registry of BM25 models per document
_bm25_registry: Dict[str, Tuple[BM25Okapi, List[ChunkModel]]] = {}

def tokenize(text: str) -> List[str]:
    return [w for w in re.findall(r'\b\w+\b', text.lower()) if len(w) > 1]

def index_document_chunks(document_id: str, chunks: List[ChunkModel]):
    # 1. Store chunks in SQLite
    conn = get_connection()
    c = conn.cursor()
    # Clean previous chunks if re-indexing
    c.execute("DELETE FROM chunks WHERE document_id = ?", (document_id,))
    for chunk in chunks:
        c.execute("""
        INSERT INTO chunks (chunk_id, document_id, page, clause_number, heading, text)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (chunk.chunk_id, chunk.document_id, chunk.page, chunk.clause_number, chunk.heading, chunk.text))
    conn.commit()
    conn.close()

    # 2. Store in Chroma Vector DB
    client = get_chroma_client()
    collection_name = f"doc_{document_id.replace('-', '_')}"
    
    # Reset collection if exists
    try:
        client.delete_collection(collection_name)
    except Exception:
        pass

    collection = client.create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"}
    )

    if chunks:
        docs = [c.text for c in chunks]
        ids = [c.chunk_id for c in chunks]
        metadatas = [{
            "chunk_id": c.chunk_id,
            "page": c.page,
            "clause_number": c.clause_number or "",
            "heading": c.heading or ""
        } for c in chunks]

        collection.add(
            documents=docs,
            ids=ids,
            metadatas=metadatas
        )

    # 3. Store BM25 index in memory
    tokenized_corpus = [tokenize(c.text) for c in chunks]
    bm25 = BM25Okapi(tokenized_corpus) if tokenized_corpus else None
    _bm25_registry[document_id] = (bm25, chunks)

def get_document_chunks(document_id: str) -> List[ChunkModel]:
    # Check BM25 registry first
    if document_id in _bm25_registry:
        return _bm25_registry[document_id][1]
    
    # Load from SQLite
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT chunk_id, document_id, page, clause_number, heading, text FROM chunks WHERE document_id = ? ORDER BY page ASC", (document_id,))
    rows = c.fetchall()
    conn.close()

    chunks = [
        ChunkModel(
            chunk_id=r["chunk_id"],
            document_id=r["document_id"],
            page=r["page"],
            clause_number=r["clause_number"],
            heading=r["heading"],
            text=r["text"]
        ) for r in rows
    ]

    if chunks:
        tokenized_corpus = [tokenize(c.text) for c in chunks]
        _bm25_registry[document_id] = (BM25Okapi(tokenized_corpus), chunks)

    return chunks

def get_bm25_index(document_id: str) -> Tuple[Optional[BM25Okapi], List[ChunkModel]]:
    if document_id not in _bm25_registry:
        chunks = get_document_chunks(document_id)
        if not chunks:
            return None, []
    return _bm25_registry[document_id]

# Semantic cache helper functions
def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)

# Singleton embedding function
_embedding_function = None

def get_embedding_function():
    global _embedding_function
    if _embedding_function is None:
        from chromadb.utils import embedding_functions
        _embedding_function = embedding_functions.DefaultEmbeddingFunction()
    return _embedding_function

# Quick offline embedding for semantic cache
def compute_quick_embedding(text: str) -> List[float]:
    try:
        fn = get_embedding_function()
        embeddings = fn([text])
        return [float(x) for x in embeddings[0]]
    except Exception:
        # Fallback word-hash vector if chromadb embedding fails
        vector = [0.0] * 64
        words = tokenize(text)
        for w in words:
            h = hash(w) % 64
            vector[h] += 1.0
        norm = math.sqrt(sum(x * x for x in vector)) or 1.0
        return [x / norm for x in vector]

def check_semantic_cache(document_id: str, question: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT question, answer_json FROM semantic_cache WHERE document_id = ?", (document_id,))
    rows = c.fetchall()
    conn.close()

    if not rows:
        return None

    # Exact normalized match check
    q_norm = " ".join(tokenize(question))
    for r in rows:
        stored_norm = " ".join(tokenize(r["question"]))
        if q_norm == stored_norm:
            cached_data = json.loads(r["answer_json"])
            cached_data["cache_hit"] = True
            return cached_data

    # Embedding similarity check
    try:
        q_emb = compute_quick_embedding(question)
        for r in rows:
            stored_emb = compute_quick_embedding(r["question"])
            sim = cosine_similarity(q_emb, stored_emb)
            if sim >= settings.CACHE_SIMILARITY:
                cached_data = json.loads(r["answer_json"])
                cached_data["cache_hit"] = True
                return cached_data
    except Exception:
        pass

    return None

def store_semantic_cache(document_id: str, question: str, answer_data: Dict[str, Any]):
    conn = get_connection()
    c = conn.cursor()
    q_norm = " ".join(tokenize(question))
    answer_str = json.dumps(answer_data)
    c.execute("""
    INSERT INTO semantic_cache (document_id, question, question_norm, answer_json)
    VALUES (?, ?, ?, ?)
    """, (document_id, question, q_norm, answer_str))
    conn.commit()
    conn.close()

def delete_document_data(document_id: str):
    # 1. Delete Chroma collection
    client = get_chroma_client()
    col_name = f"doc_{document_id.replace('-', '_')}"
    try:
        client.delete_collection(col_name)
    except Exception:
        pass

    # 2. Clear BM25 cache
    if document_id in _bm25_registry:
        del _bm25_registry[document_id]

    # 3. Delete SQLite entries
    conn = get_connection()
    c = conn.cursor()
    c.execute("DELETE FROM documents WHERE document_id = ?", (document_id,))
    c.execute("DELETE FROM chunks WHERE document_id = ?", (document_id,))
    c.execute("DELETE FROM session_turns WHERE document_id = ?", (document_id,))
    c.execute("DELETE FROM semantic_cache WHERE document_id = ?", (document_id,))
    c.execute("DELETE FROM metrics WHERE document_id = ?", (document_id,))
    conn.commit()
    conn.close()

    # 4. Remove upload file if exists
    for f in settings.UPLOAD_DIR.glob(f"{document_id}*"):
        try:
            os.remove(f)
        except Exception:
            pass
