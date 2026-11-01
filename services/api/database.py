import sqlite3
import json
from typing import List, Optional, Dict, Any
from config import settings

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(settings.SQLITE_PATH), timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    c = conn.cursor()
    
    # Documents table
    c.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        document_id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        page_count INTEGER NOT NULL,
        doc_type TEXT NOT NULL,
        chunk_count INTEGER NOT NULL,
        truncated INTEGER NOT NULL DEFAULT 0,
        summary TEXT,
        analysis_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Check if analysis_json column exists; if not, add it
    c.execute("PRAGMA table_info(documents)")
    columns = [row["name"] for row in c.fetchall()]
    if "analysis_json" not in columns:
        try:
            c.execute("ALTER TABLE documents ADD COLUMN analysis_json TEXT")
        except Exception:
            pass

    # Document Translations table (cached per document & language)
    c.execute("""
    CREATE TABLE IF NOT EXISTS document_translations (
        document_id TEXT NOT NULL,
        language TEXT NOT NULL,
        cards_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (document_id, language)
    )
    """)
    
    # Chunks table
    c.execute("""
    CREATE TABLE IF NOT EXISTS chunks (
        chunk_id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        page INTEGER NOT NULL,
        clause_number TEXT,
        heading TEXT,
        text TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents (document_id) ON DELETE CASCADE
    )
    """)
    
    # Sessions / turns
    c.execute("""
    CREATE TABLE IF NOT EXISTS session_turns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Semantic cache
    c.execute("""
    CREATE TABLE IF NOT EXISTS semantic_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT NOT NULL,
        question TEXT NOT NULL,
        question_norm TEXT NOT NULL,
        answer_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Metrics
    c.execute("""
    CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT,
        session_id TEXT,
        route TEXT,
        cache_hit INTEGER DEFAULT 0,
        latency_ms REAL,
        tokens_used INTEGER,
        context_tokens INTEGER,
        error_occurred INTEGER DEFAULT 0,
        node_timings_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Feedback
    c.execute("""
    CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        question TEXT NOT NULL,
        rating INTEGER NOT NULL,
        reason TEXT,
        prompt_variant TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Prompt variants for bandit feedback loop
    c.execute("""
    CREATE TABLE IF NOT EXISTS prompt_variants (
        variant_name TEXT PRIMARY KEY,
        pulls INTEGER DEFAULT 0,
        total_score REAL DEFAULT 0.0,
        avg_score REAL DEFAULT 0.0
    )
    """)
    
    # Evaluations
    c.execute("""
    CREATE TABLE IF NOT EXISTS eval_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total INTEGER,
        passed INTEGER,
        failed INTEGER,
        score_percentage REAL,
        zero_unverified_claims INTEGER,
        results_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    variants = ["variant_balanced", "variant_strict_grounding", "variant_plain_clarity"]
    for v in variants:
        c.execute("""
        INSERT OR IGNORE INTO prompt_variants (variant_name, pulls, total_score, avg_score)
        VALUES (?, 0, 0.0, 0.0)
        """, (v,))
        
    conn.commit()
    conn.close()

def list_all_documents() -> List[Dict[str, Any]]:
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
    SELECT document_id, filename, file_hash, page_count, doc_type, chunk_count, truncated, summary, created_at
    FROM documents ORDER BY created_at DESC
    """)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def get_document_by_id(document_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM documents WHERE document_id = ?", (document_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def save_document_analysis(document_id: str, analysis_dict: Dict[str, Any]):
    conn = get_connection()
    c = conn.cursor()
    c.execute("UPDATE documents SET analysis_json = ? WHERE document_id = ?", (json.dumps(analysis_dict), document_id))
    conn.commit()
    conn.close()

def get_document_analysis(document_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT analysis_json FROM documents WHERE document_id = ?", (document_id,))
    row = c.fetchone()
    conn.close()
    if row and row["analysis_json"]:
        try:
            return json.loads(row["analysis_json"])
        except Exception:
            return None
    return None

def save_document_translation(document_id: str, language: str, cards_dict: Dict[str, Any]):
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
    INSERT INTO document_translations (document_id, language, cards_json)
    VALUES (?, ?, ?)
    ON CONFLICT(document_id, language) DO UPDATE SET cards_json = excluded.cards_json
    """, (document_id, language, json.dumps(cards_dict)))
    conn.commit()
    conn.close()

def get_document_translation(document_id: str, language: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT cards_json FROM document_translations WHERE document_id = ? AND language = ?", (document_id, language))
    row = c.fetchone()
    conn.close()
    if row and row["cards_json"]:
        try:
            return json.loads(row["cards_json"])
        except Exception:
            return None
    return None

def delete_document_records(document_id: str):
    conn = get_connection()
    c = conn.cursor()
    c.execute("DELETE FROM documents WHERE document_id = ?", (document_id,))
    c.execute("DELETE FROM chunks WHERE document_id = ?", (document_id,))
    c.execute("DELETE FROM document_translations WHERE document_id = ?", (document_id,))
    c.execute("DELETE FROM session_turns WHERE document_id = ?", (document_id,))
    c.execute("DELETE FROM semantic_cache WHERE document_id = ?", (document_id,))
    c.execute("DELETE FROM metrics WHERE document_id = ?", (document_id,))
    conn.commit()
    conn.close()

init_db()
