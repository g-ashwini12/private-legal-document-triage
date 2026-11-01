import re
from typing import List, Optional

OUT_OF_SCOPE_PATTERNS = [
    r'\bcapital of\b',
    r'\bweather in\b',
    r'\brecipe for\b',
    r'\bwho won the\b',
    r'\bpython code\b',
    r'\bwrite an essay\b',
    r'\btell me a joke\b',
    r'\bfrance\b',
    r'\bparis\b',
    r'\bhow to cook\b',
    r'\bhow to bake\b',
    r'\bwrite code\b',
    r'\bwho is\b',
    r'\bwhat is the capital\b',
]

LEGAL_PREDICTION_PATTERNS = [
    r'\bwill i win\b',
    r'\bwin in court\b',
    r'\bwin if i\b',
    r'\bis this legal\b',
    r'\bshould i sign\b',
    r'\bcan i sue\b',
    r'\bguarantee\b',
    r'\btake (this )?to court\b',
]

SUMMARY_PATTERNS = [
    r'\bwhat is this document about\b',
    r'\bwhat is this document\b',
    r'\bwhat is this agreement about\b',
    r'\bwhat is this agreement\b',
    r'\bsummar(y|ize)\b',
    r'\boverview of (this )?(document|agreement|contract)\b',
    r'\bexplain this (agreement|document|contract)\b',
    r'\bwho are the parties\b',
]

MONEY_OVERVIEW_PATTERNS = [
    r'\bwhat is about money in document\b',
    r'\bwhat about money\b',
    r'\ball money\b',
    r'\bmoney in (this )?document\b',
    r'\bfinancial terms\b',
    r'\ball charges\b',
    r'\ball costs\b',
]

PAYMENT_SPECIFIC_PATTERNS = [
    r'\bhow much should i pay\b',
    r'\bhow much do i have to pay\b',
    r'\bhow much i should pay\b',
    r'\bwhat do i need to pay\b',
]

NOT_MENTIONED_PATTERNS = [
    r'\bpet(s)?\b',
    r'\bdog(s)?\b',
    r'\bcat(s)?\b',
    r'\bsmoking\b',
    r'\bsublet(ting)?\b',
    r'\bguest(s)?\b',
]

def classify_route(question: str) -> str:
    q = question.lower().strip()

    # 1. Type C: Out of scope / unrelated
    for p in OUT_OF_SCOPE_PATTERNS:
        if re.search(p, q):
            return "unrelated"

    # 2. Type D: Legal prediction / advice
    for p in LEGAL_PREDICTION_PATTERNS:
        if re.search(p, q):
            return "legal_prediction"

    # 3. Summary / Overview of document
    for p in SUMMARY_PATTERNS:
        if re.search(p, q):
            return "summary"

    # 4. Money Overview
    for p in MONEY_OVERVIEW_PATTERNS:
        if re.search(p, q):
            return "money_overview"

    # 5. Payment Specific
    for p in PAYMENT_SPECIFIC_PATTERNS:
        if re.search(p, q):
            return "payment_specific"

    # 6. Check common not-mentioned subjects
    for p in NOT_MENTIONED_PATTERNS:
        if re.search(p, q):
            return "check_not_mentioned"

    return "specific_inquiry"
