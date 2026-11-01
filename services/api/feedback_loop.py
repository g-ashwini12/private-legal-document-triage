import random
from typing import Dict, Any, List, Tuple
from database import get_connection
from models import AnalysisResponse

VARIANTS = ["variant_balanced", "variant_strict_grounding", "variant_plain_clarity"]

def select_prompt_variant(epsilon: float = 0.1) -> Tuple[str, int]:
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT variant_name, pulls, avg_score FROM prompt_variants")
    rows = c.fetchall()
    conn.close()

    variant_scores = {r["variant_name"]: r["avg_score"] for r in rows}
    
    # Epsilon exploration
    if random.random() < epsilon or not variant_scores:
        chosen = random.choice(VARIANTS)
    else:
        # Exploit highest average score
        chosen = max(variant_scores.keys(), key=lambda k: variant_scores[k])

    # Tune top_k based on variant
    if chosen == "variant_strict_grounding":
        top_k = 8
    elif chosen == "variant_plain_clarity":
        top_k = 5
    else:
        top_k = 6

    return chosen, top_k

def score_response(response: AnalysisResponse, thumbs_down: bool = False) -> float:
    score = 0.0
    
    # +1 per verified claim
    score += response.verification.claims * 1.0
    
    # -2 per unsupported claim dropped
    score -= response.verification.dropped * 2.0
    
    # -1 for missing escalation when high risk exists
    has_high = any(r.level.lower() == "high" for r in response.risks)
    if has_high and not response.escalation_advice.needed:
        score -= 1.0
        
    # -1 for overconfident wording
    forbidden = ["you will win", "guaranteed", "100% illegal"]
    if any(f in response.answer.lower() for f in forbidden):
        score -= 1.0
        
    # -1 per thumbs-down
    if thumbs_down:
        score -= 1.0
        
    return score

def update_variant_reward(variant_name: str, reward: float):
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT pulls, total_score FROM prompt_variants WHERE variant_name = ?", (variant_name,))
    row = c.fetchone()
    if row:
        pulls = row["pulls"] + 1
        total_score = row["total_score"] + reward
        avg_score = total_score / pulls
        c.execute("""
        UPDATE prompt_variants
        SET pulls = ?, total_score = ?, avg_score = ?
        WHERE variant_name = ?
        """, (pulls, total_score, avg_score, variant_name))
    else:
        c.execute("""
        INSERT INTO prompt_variants (variant_name, pulls, total_score, avg_score)
        VALUES (?, 1, ?, ?)
        """, (variant_name, reward, reward))
    conn.commit()
    conn.close()
