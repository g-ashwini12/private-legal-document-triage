import re
from typing import Dict, Any, Tuple
from pydantic import BaseModel

class GateResult(BaseModel):
    is_legal: bool
    doc_type: str
    confidence: float
    reason: str

# Signature indicators for each document category
LEGAL_KEYWORDS = {
    "rental": [
        "rental agreement", "lease agreement", "tenancy", "landlord", "tenant",
        "premises", "security deposit", "rent", "vacating", "sublet", "lock-in"
    ],
    "employment": [
        "employment agreement", "offer letter", "employee", "employer", "salary",
        "probation", "termination of employment", "non-compete", "confidentiality agreement",
        "job title", "duties and responsibilities"
    ],
    "notice": [
        "legal notice", "eviction notice", "notice to quit", "demand notice",
        "default notice", "show cause notice", "hereby give notice", "cease and desist"
    ],
    "terms": [
        "terms of service", "terms and conditions", "terms of use", "privacy policy",
        "acceptable use policy", "user agreement", "disclaimer of warranties"
    ],
    "other_legal": [
        "agreement", "contract", "parties hereto", "indemnification", "jurisdiction",
        "governing law", "arbitration", "severability", "in witness whereof",
        "force majeure", "breach of contract", "covenants", "statutory"
    ]
}

NON_LEGAL_INDICATORS = [
    "ingredients", "tablespoon", "teaspoon", "preheat oven", "recipe",
    "chapter 1", "once upon a time", "novel", "fiction",
    "shopping list", "grocery list", "buy milk", "tutorial", "homework"
]

def classify_document(text: str) -> GateResult:
    # Normalize text for checking
    # Defend against prompt injections by simply treating text as untrusted content
    cleaned = text.lower()
    
    # Check non-legal indicators first
    non_legal_hits = [word for word in NON_LEGAL_INDICATORS if re.search(r'\b' + re.escape(word) + r'\b', cleaned)]
    if len(non_legal_hits) >= 2 and not any(kw in cleaned for kw in ["agreement", "contract", "lease", "landlord", "employee"]):
        return GateResult(
            is_legal=False,
            doc_type="not_legal",
            confidence=0.95,
            reason=f"Document appears to be a recipe, story or general note ({', '.join(non_legal_hits[:3])}). Please upload a legal contract, notice, or policy."
        )

    # Score each legal type
    scores: Dict[str, int] = {}
    for dtype, keywords in LEGAL_KEYWORDS.items():
        score = 0
        for kw in keywords:
            matches = len(re.findall(r'\b' + re.escape(kw) + r'\b', cleaned))
            if matches > 0:
                score += matches * (3 if len(kw.split()) > 1 else 1)
        scores[dtype] = score

    # Determine highest scoring legal type
    best_type, best_score = max(scores.items(), key=lambda item: item[1])
    
    # Structural legal markers (e.g. numbered clauses, numbered sections, definitions)
    has_clause_structure = bool(re.search(r'(?:clause|section|article|\b\d+\.)\s+[a-z]', cleaned))
    
    if best_score == 0 and not has_clause_structure:
        return GateResult(
            is_legal=False,
            doc_type="not_legal",
            confidence=0.85,
            reason="No legal terminology, clauses, or contractual obligations detected. Please upload a legal document such as a rental agreement, employment contract, or notice."
        )

    # Calculate confidence based on score density
    total_score = sum(scores.values())
    confidence = min(0.99, max(0.65, best_score / (total_score + 1.0) if total_score > 0 else 0.70))

    type_reasons = {
        "rental": "Detected residential or commercial tenancy/rental agreement terms.",
        "employment": "Detected employment contract or offer letter terms.",
        "notice": "Detected formal legal or eviction notice language.",
        "terms": "Detected website terms of service or user policy clauses.",
        "other_legal": "Detected binding contractual provisions and general legal structure."
    }

    return GateResult(
        is_legal=True,
        doc_type=best_type,
        confidence=round(confidence, 2),
        reason=type_reasons.get(best_type, "Legal document detected.")
    )
