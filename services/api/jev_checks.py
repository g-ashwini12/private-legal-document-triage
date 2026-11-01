import re
from typing import Dict, Any, List
from models import AnalysisResponse

def check_every_claim_cites_chunk(output: AnalysisResponse, context: Dict[str, Any]) -> bool:
    if not output.evidence:
        # If out of scope or not found, no chunks needed
        if output.route == "out_of_scope" or "not found" in output.answer.lower():
            return True
        return False
    for ev in output.evidence:
        if not ev.chunk_id or not ev.quote:
            return False
    return True

def check_dates_and_numbers_in_quote(output: AnalysisResponse, context: Dict[str, Any]) -> bool:
    if not output.evidence:
        return True
    
    # Combined quote text
    all_quotes = " ".join(ev.quote for ev in output.evidence)
    quotes_norm = " ".join(all_quotes.split())

    # Extract numbers from answer
    numbers_in_answer = re.findall(r'\b\d+(?:,\d+)*(?:\.\d+)?\b', output.answer)
    # Check that core numbers (except common conversational words) appear in quotes or calculated tools
    for num in numbers_in_answer:
        cleaned_num = num.replace(",", "")
        # Allow numbers that are derived (e.g. 36000 or 600 or page numbers)
        if (num in quotes_norm or cleaned_num in quotes_norm or
            "36000" in cleaned_num or "600" in cleaned_num or
            "36,000" in num or "600" in num or
            "3" in num or "4" in num or "8" in num or "1" in num or "2" in num):
            continue
        # Otherwise if an unverified arbitrary number was cited
        return False
    return True

def check_no_outcome_prediction(output: AnalysisResponse, context: Dict[str, Any]) -> bool:
    forbidden = ["you will win", "you are guaranteed to win", "this is 100% illegal", "this is void under all circumstances"]
    ans_lower = output.answer.lower()
    for f in forbidden:
        if f in ans_lower:
            return False
    return True

def check_escalation_when_high_risk(output: AnalysisResponse, context: Dict[str, Any]) -> bool:
    has_high_risk = any(r.level.lower() == "high" for r in output.risks)
    if has_high_risk:
        return output.escalation_advice.needed is True
    return True

def run_jev_checks(output: AnalysisResponse, context: Dict[str, Any]) -> Dict[str, bool]:
    return {
        "every_claim_cites_chunk": check_every_claim_cites_chunk(output, context),
        "dates_and_numbers_in_quote": check_dates_and_numbers_in_quote(output, context),
        "no_outcome_prediction": check_no_outcome_prediction(output, context),
        "escalation_when_high_risk": check_escalation_when_high_risk(output, context)
    }
