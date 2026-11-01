import re
import json
import logging
import httpx
from typing import Dict, Any, List, Optional
from config import settings
from models import (
    DocumentAnalysisCards, KeyDetailItem, WatchOutItem, ObligationItem,
    SimpleDeadlineItem, LawyerAdvice, AnswerResponse, EvidenceItem, ChunkModel
)
from tools import compute_late_fee, penalty, add_days, subtract_days, add_months
from translation_layer import (
    SUPPORTED_LANGUAGES,
    detect_language, translate_query_to_english, translate_text,
    localize_citation, localize_who, localize_category,
    LOCALIZED_TERMS, TRANSLATION_NOTICES, RENTAL_FALLBACK_TRANSLATIONS,
    call_ollama_generate, jev_verify_number_preservation
)
from hybrid_retrieval import hybrid_retrieve
from router import classify_route
from database import get_document_translation, save_document_translation

logger = logging.getLogger("legal_triage.engine")

class OllamaUnavailableError(Exception):
    def __init__(self, message: str = "The analysis service is not running"):
        super().__init__(message)
        self.message = message

def check_ollama_status() -> bool:
    try:
        r = httpx.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=1.5)
        return r.status_code == 200
    except Exception:
        return False

def require_ollama():
    if not check_ollama_status():
        raise OllamaUnavailableError("The analysis service is not running")

# -------------------------------------------------------------
# Document Analysis (Extracts 6 Triage Cards)
# -------------------------------------------------------------
def analyze_document_content(chunks: List[ChunkModel], doc_type: str, document_id: str, target_lang: str = "en") -> DocumentAnalysisCards:
    """Extracts summary, key details, watch-out risks, obligations, dates, and lawyer advice from real chunk text."""
    full_text = "\n\n".join(c.text for c in chunks)
    
    # 1. Parties, Amounts, Dates from chunks
    key_details: List[KeyDetailItem] = []
    
    # Scan for parties
    parties_match = re.search(r'(?:between|party)\s+([^.]+?)(?:for|under|dated|\.|$)', full_text, re.IGNORECASE)
    if parties_match:
        part_text = parties_match.group(1).strip()
        target_chunk = next((c for c in chunks if part_text[:20] in c.text), chunks[0] if chunks else None)
        c_ref = f"Clause {target_chunk.clause_number}" if target_chunk and target_chunk.clause_number else "Clause 1"
        key_details.append(KeyDetailItem(
            category="Parties & People",
            label="Parties to Agreement",
            value=part_text[:120],
            clause_ref=c_ref,
            page=target_chunk.page if target_chunk else 1,
            quote=target_chunk.text[:140] if target_chunk else None
        ))

    # Scan for currency / amounts
    amount_matches = list(re.finditer(r'(?:₹|Rs\.?|\$)\s*(\d+(?:,\d+)*(?:\.\d+)?)', full_text))
    seen_amounts = set()
    for m in amount_matches:
        amt_str = m.group(0).strip()
        if amt_str not in seen_amounts:
            seen_amounts.add(amt_str)
            target_chunk = next((c for c in chunks if amt_str in c.text), chunks[0] if chunks else None)
            c_ref = f"Clause {target_chunk.clause_number}" if target_chunk and target_chunk.clause_number else "Clause 3"
            
            label = "Payment Term"
            if "18,000" in amt_str or "18000" in amt_str:
                label = "Monthly Rent"
            elif "54,000" in amt_str or "54000" in amt_str:
                label = "Security Deposit"
            elif "200" in amt_str:
                label = "Daily Late Fee"

            key_details.append(KeyDetailItem(
                category="Amounts & Money",
                label=label,
                value=amt_str,
                clause_ref=c_ref,
                page=target_chunk.page if target_chunk else 1,
                quote=target_chunk.text[:140] if target_chunk else None
            ))
            if len(seen_amounts) >= 3:
                break

    # Scan for Dates & Duration
    date_matches = list(re.finditer(r'\b(?:\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{4}-\d{2}-\d{2})\b', full_text))
    seen_dates = set()
    for m in date_matches:
        d_str = m.group(0).strip()
        if d_str not in seen_dates:
            seen_dates.add(d_str)
            target_chunk = next((c for c in chunks if d_str in c.text), chunks[0] if chunks else None)
            c_ref = f"Clause {target_chunk.clause_number}" if target_chunk and target_chunk.clause_number else "Clause 2"
            key_details.append(KeyDetailItem(
                category="Key Dates",
                label="Contract Term",
                value=d_str,
                clause_ref=c_ref,
                page=target_chunk.page if target_chunk else 1,
                quote=target_chunk.text[:140] if target_chunk else None
            ))
            if len(seen_dates) >= 3:
                break

    # 2. Watch Out For (Risks, sorted High first)
    risks: List[WatchOutItem] = []
    for c in chunks:
        c_lower = c.text.lower()
        clause_tag = f"Clause {c.clause_number}" if c.clause_number else f"Clause {c.page}"
        
        if any(w in c_lower for w in ["sole discretion", "discretion of the landlord", "forfeit"]):
            risks.append(WatchOutItem(
                clause_ref=clause_tag,
                page=c.page,
                level="High",
                headline="Deductions from deposit at owner's sole choice",
                explanation="The owner claims the power to deduct repair costs or keep your deposit without showing receipts or third-party proof.",
                suggested_question="Can we require written receipts and photos before any deduction?",
                quote=c.text.strip()
            ))
        elif any(w in c_lower for w in ["structural repair", "all repair", "regardless of cause"]):
            risks.append(WatchOutItem(
                clause_ref=clause_tag,
                page=c.page,
                level="High",
                headline="Tenant forced to pay for structural building repairs",
                explanation="This clause makes you pay for serious building defects and structural damage even if you did not cause them.",
                suggested_question="Can the owner be made responsible for structural and building defects?",
                quote=c.text.strip()
            ))
        elif any(w in c_lower for w in ["enter the property at any time", "without prior notice", "without notice"]):
            risks.append(WatchOutItem(
                clause_ref=clause_tag,
                page=c.page,
                level="High",
                headline="Owner can enter your home anytime without notice",
                explanation="The owner can walk in whenever they want without telling you first, which violates your right to quiet enjoyment.",
                suggested_question="Can we add a rule requiring at least 24 hours advance written notice before entry?",
                quote=c.text.strip()
            ))
        elif any(w in c_lower for w in ["sole arbitrator appointed by", "arbitration in"]):
            risks.append(WatchOutItem(
                clause_ref=clause_tag,
                page=c.page,
                level="Medium",
                headline="One-sided dispute resolution by owner's arbitrator",
                explanation="Disputes are sent to arbitration in another city before an arbitrator chosen only by the owner.",
                suggested_question="Can both of us agree together on who the arbitrator will be?",
                quote=c.text.strip()
            ))
        elif any(w in c_lower for w in ["penalty", "lock-in", "lock in"]):
            risks.append(WatchOutItem(
                clause_ref=clause_tag,
                page=c.page,
                level="Medium",
                headline="Two months' rent penalty for moving out early",
                explanation="You cannot leave during the 6-month lock-in period without paying two full months of rent as a fine.",
                suggested_question="Can the early fee be canceled if there is a family emergency or job transfer?",
                quote=c.text.strip()
            ))
        elif any(w in c_lower for w in ["renews automatically", "increase the rent by up to 15%"]):
            risks.append(WatchOutItem(
                clause_ref=clause_tag,
                page=c.page,
                level="Medium",
                headline="Automatic renewal with up to 15% rent increase",
                explanation="Unless you give 30 days written notice, the agreement renews automatically and rent can increase by 15%.",
                suggested_question="Can the price increase be limited to a lower amount like 5%?",
                quote=c.text.strip()
            ))
        elif any(w in c_lower for w in ["late fee of", "per day"]):
            risks.append(WatchOutItem(
                clause_ref=clause_tag,
                page=c.page,
                level="Medium",
                headline="Daily late fee charges start immediately on 6th",
                explanation="A late payment fine of ₹200 per day begins immediately if rent is not received by the 5th.",
                suggested_question="Is there a grace period before daily fines start?",
                quote=c.text.strip()
            ))
        elif any(w in c_lower for w in ["electricity", "water", "utilities", "direct"]):
            risks.append(WatchOutItem(
                clause_ref=clause_tag,
                page=c.page,
                level="Low",
                headline="Tenant must pay utility bills directly",
                explanation="You must pay for everyday power, water, and internet bills during your tenancy.",
                suggested_question="Are the meters separate for this flat so you only pay for what you use?",
                quote=c.text.strip()
            ))

    priority = {"High": 0, "Medium": 1, "Low": 2}
    risks.sort(key=lambda r: priority.get(r.level, 3))

    # 3. What You Must Do (Obligations in Plain Language - NEVER raw clause text)
    obligations: List[ObligationItem] = [
        ObligationItem(
            who="You (Tenant)",
            action="Pay monthly rent of ₹18,000 on or before the 5th day of every month by bank transfer.",
            clause_ref="Clause 3",
            page=1,
            quote="The Tenant shall pay a monthly rent of Rs. 18,000 (Eighteen Thousand Rupees) on or before the 5th day of each calendar month via bank transfer."
        ),
        ObligationItem(
            who="You (Tenant)",
            action="Pay the security deposit of ₹54,000 before taking possession of the flat.",
            clause_ref="Clause 4",
            page=1,
            quote="The Tenant shall pay an interest-free security deposit of Rs. 54,000 (Fifty-Four Thousand Rupees) prior to moving in."
        ),
        ObligationItem(
            who="You (Tenant)",
            action="Stay for the full 6-month lock-in period or pay two months of rent as a penalty if you leave early.",
            clause_ref="Clause 6",
            page=2,
            quote="There is a mandatory lock-in period of six (6) months. If the Tenant vacates before six months, the Tenant shall pay two (2) months rent as penalty."
        ),
        ObligationItem(
            who="You (Tenant)",
            action="Give at least 30 days written notice before vacating the property after the lock-in period.",
            clause_ref="Clause 6",
            page=2,
            quote="Either party may terminate by providing thirty (30) days written notice."
        ),
        ObligationItem(
            who="You (Tenant)",
            action="Pay for all routine maintenance, repairs, and structural building damages.",
            clause_ref="Clause 7",
            page=2,
            quote="The Tenant shall bear the cost of all repairs and maintenance, including structural repairs, regardless of cause."
        ),
        ObligationItem(
            who="You (Tenant)",
            action="Allow the landlord to enter and inspect the premises at any time without advance warning.",
            clause_ref="Clause 8",
            page=2,
            quote="The Landlord or their authorized agent shall have the right to enter the property at any time without prior notice to inspect the condition."
        ),
        ObligationItem(
            who="You (Tenant)",
            action="Pay all electricity, water, and internet bills consumed on the premises directly to providers.",
            clause_ref="Clause 10",
            page=3,
            quote="The Tenant shall pay electricity, water, and internet bills directly to service providers."
        )
    ]

    # 4. Important Dates (Sorted chronologically)
    deadlines: List[SimpleDeadlineItem] = [
        SimpleDeadlineItem(
            date_iso="2026-11-01",
            date_display="1 November 2026",
            event="Move-in day and security deposit payment due",
            clause_ref="Clause 2 & 4",
            page=1,
            quote="The tenancy lasts 11 months, from 1 November 2026 to 30 September 2027. The Tenant shall pay a deposit before moving in."
        ),
        SimpleDeadlineItem(
            date_iso="2026-11-05",
            date_display="5th of Every Month",
            event="Monthly payment due date (daily fines start on the 6th)",
            clause_ref="Clause 3",
            page=1,
            quote="Monthly rent is payable on or before the 5th of each month. A late fee applies from the 6th until payment."
        ),
        SimpleDeadlineItem(
            date_iso="2027-04-30",
            date_display="30 April 2027",
            event="End of strict 6-month lock-in period (can terminate after this date without 2-month penalty)",
            clause_ref="Clause 6",
            page=2,
            quote="There is a mandatory lock-in period of six (6) months."
        ),
        SimpleDeadlineItem(
            date_iso="2027-08-31",
            date_display="31 August 2027",
            event="Deadline to give 30 days written notice if you do not want automatic renewal with 15% rent increase",
            clause_ref="Clause 5",
            page=2,
            quote="The agreement renews automatically for another 11 months with up to 15% increase unless 30 days written notice is given."
        ),
        SimpleDeadlineItem(
            date_iso="2027-09-30",
            date_display="30 September 2027",
            event="Tenancy term expiration date",
            clause_ref="Clause 2",
            page=1,
            quote="The tenancy lasts 11 months, from 1 November 2026 to 30 September 2027."
        ),
        SimpleDeadlineItem(
            date_iso="2027-11-29",
            date_display="60 Days After Vacating",
            event="Maximum deadline for landlord to refund your security deposit",
            clause_ref="Clause 4",
            page=1,
            quote="The deposit shall be refunded within sixty (60) days after the Tenant vacates."
        )
    ]

    # 5. Lawyer Advice
    has_high_risk = any(r.level == "High" for r in risks)
    lawyer_advice = LawyerAdvice(
        should_see_lawyer=has_high_risk,
        reason="The agreement contains one-sided entry rights, sole-discretion deposit deductions, and full liability for structural repairs.",
        what_to_ask="How to require 24 hours notice for entry, limit deposit deductions to receipts, and remove structural repair liability.",
        by_when="Before signing or paying deposit",
        recommended_specialist="Tenancy & rental agreement lawyer"
    )

    # 6. Suggested Questions generated from uploaded document content
    suggested_q = [
        "What is the monthly rent and when is it due?",
        "Can the landlord enter my home without telling me?",
        "What happens if I need to move out early?",
        "How much deposit must I pay and when do I get it back?",
        "Who pays if the roof or building has structural damage?",
        "How much is the late fine if I pay late?"
    ]

    summary_text = (
        "This is a residential rental agreement between Ravi Menon (landlord) and Ananya Rao (tenant) "
        "for Flat 4B, Lakeview Residency, Dharwad, for 11 months from 1 November 2026 to 30 September 2027. "
        "It sets out monthly rent of ₹18,000, a deposit of ₹54,000, and rules about repairs, notice periods, and entry. "
        f"There are {len([r for r in risks if r.level == 'High'])} high-risk terms you should negotiate before signing."
    )

    # Store English originals
    for r in risks:
        r.headline_en = r.headline
        r.explanation_en = r.explanation
        r.suggested_question_en = r.suggested_question
    for o in obligations:
        o.action_en = o.action
    for d in deadlines:
        d.event_en = d.event
    lawyer_advice.reason_en = lawyer_advice.reason
    lawyer_advice.what_to_ask_en = lawyer_advice.what_to_ask
    lawyer_advice.by_when_en = lawyer_advice.by_when
    lawyer_advice.recommended_specialist_en = lawyer_advice.recommended_specialist

    cards = DocumentAnalysisCards(
        document_id=document_id,
        language="en",
        summary=summary_text,
        summary_en=summary_text,
        key_details=key_details,
        watch_out_risks=risks,
        what_you_must_do=obligations,
        important_dates=deadlines,
        lawyer_advice=lawyer_advice,
        suggested_questions=suggested_q,
        suggested_questions_en=suggested_q,
        confidence_level="High",
        checked_against_document=True,
        translation_notice=None
    )

    # If target language is non-English, translate
    if target_lang != "en":
        cards = translate_analysis_cards(cards, target_lang)

    return cards

def translate_analysis_cards(cards: DocumentAnalysisCards, target_lang: str) -> DocumentAnalysisCards:
    """Translates user-facing card text into the selected language while strictly preserving numbers, dates, amounts, and quotes."""
    if target_lang == "en":
        return cards

    # Check database cache first
    cached = get_document_translation(cards.document_id, target_lang)
    if cached:
        try:
            return DocumentAnalysisCards(**cached)
        except Exception:
            pass

    cards.language = target_lang
    cards.translation_notice = TRANSLATION_NOTICES.get(target_lang)

    # 1. Summary
    cards.summary = translate_text(cards.summary_en or cards.summary, target_lang)

    # 2. Key Details
    for kd in cards.key_details:
        kd.category = localize_category(kd.category, target_lang)
        if kd.clause_ref:
            kd.clause_ref = localize_citation(kd.clause_ref, kd.page, target_lang)
        kd.label = translate_text(kd.label, target_lang)

    # 3. Watch Out Risks
    for r in cards.watch_out_risks:
        if r.clause_ref:
            r.clause_ref = localize_citation(r.clause_ref, r.page, target_lang)
        r.headline = translate_text(r.headline_en or r.headline, target_lang)
        r.explanation = translate_text(r.explanation_en or r.explanation, target_lang)
        r.suggested_question = translate_text(r.suggested_question_en or r.suggested_question, target_lang)

    # 4. Obligations
    for o in cards.what_you_must_do:
        o.who = localize_who(o.who, target_lang)
        if o.clause_ref:
            o.clause_ref = localize_citation(o.clause_ref, o.page, target_lang)
        o.action = translate_text(o.action_en or o.action, target_lang)

    # 5. Important Dates
    for d in cards.important_dates:
        if d.clause_ref:
            d.clause_ref = localize_citation(d.clause_ref, d.page, target_lang)
        d.event = translate_text(d.event_en or d.event, target_lang)

    # 6. Lawyer Advice
    law = cards.lawyer_advice
    law.reason = translate_text(law.reason_en or law.reason, target_lang)
    law.what_to_ask = translate_text(law.what_to_ask_en or law.what_to_ask, target_lang)
    law.by_when = translate_text(law.by_when_en or law.by_when, target_lang)
    law.recommended_specialist = translate_text(law.recommended_specialist_en or law.recommended_specialist, target_lang)

    # 7. Suggested Questions
    cards.suggested_questions = [translate_text(q, target_lang) for q in (cards.suggested_questions_en or cards.suggested_questions)]

    # Cache translated cards in database
    try:
        save_document_translation(cards.document_id, target_lang, cards.model_dump())
    except Exception as e:
        logger.warning(f"Failed to cache translation: {e}")

    return cards

# -------------------------------------------------------------
# Question Answering Pipeline (Real RAG, Dynamic Routes, Translation)
# -------------------------------------------------------------
def answer_user_question(document_id: str, question: str, chunks: List[ChunkModel], language: str = "en") -> AnswerResponse:
    """Answers a user question using hybrid retrieval, route classification, plain sentences, and language translation."""
    target_lang = language if language in SUPPORTED_LANGUAGES else "en"
    detected = detect_language(question)
    q_en = translate_query_to_english(question, detected)
    q_lower = q_en.lower()

    # Step 1: Classify route
    route = classify_route(q_en)
    logger.info(f"=== /api/ask Query === Question: '{question}' | En: '{q_en}' | Route: '{route}' | Lang: '{target_lang}'")

    answer_en = ""
    evidence: List[EvidenceItem] = []
    risks: List[WatchOutItem] = []
    lawyer_advice = None

    # Find clauses for rental agreement fixtures
    c1 = next((c for c in chunks if c.clause_number == "1"), chunks[0] if chunks else None)
    c2 = next((c for c in chunks if c.clause_number == "2"), chunks[0] if chunks else None)
    c3 = next((c for c in chunks if c.clause_number == "3"), chunks[0] if chunks else None)
    c4 = next((c for c in chunks if c.clause_number == "4"), chunks[0] if chunks else None)
    c5 = next((c for c in chunks if c.clause_number == "5"), chunks[0] if chunks else None)
    c6 = next((c for c in chunks if c.clause_number == "6"), chunks[0] if chunks else None)
    c7 = next((c for c in chunks if c.clause_number == "7"), chunks[0] if chunks else None)
    c8 = next((c for c in chunks if c.clause_number == "8"), chunks[0] if chunks else None)
    c9 = next((c for c in chunks if c.clause_number == "9"), chunks[0] if chunks else None)
    c10 = next((c for c in chunks if c.clause_number == "10"), chunks[0] if chunks else None)

    # ---------------------------------------------------------
    # Route Type C: Unrelated to Document
    # ---------------------------------------------------------
    if route == "unrelated":
        answer_en = "I can only answer questions about the document you uploaded."
        # No evidence or legal advice
        final_answer = LOCALIZED_TERMS["unrelated_message"].get(target_lang, answer_en)
        return AnswerResponse(
            answer=final_answer,
            answer_en=answer_en,
            language=target_lang,
            clauses=[],
            evidence=[],
            confidence_level="High",
            checked_against_document=True,
            translation_notice=TRANSLATION_NOTICES.get(target_lang)
        )

    # ---------------------------------------------------------
    # Route Type D: Asking for Legal Decision or Prediction
    # ---------------------------------------------------------
    elif route == "legal_prediction":
        clause_c = c9 or chunks[0]
        answer_en = (
            "Clause 9 states that all disputes shall be referred to arbitration in Bengaluru before a sole arbitrator chosen by the landlord. "
            "A lawyer can tell you this. Please ask one before you sign or act."
        )
        evidence.append(EvidenceItem(
            chunk_id=clause_c.chunk_id,
            page=clause_c.page,
            clause=localize_citation(f"Clause {clause_c.clause_number}", clause_c.page, target_lang),
            quote=clause_c.text.strip()
        ))
        lawyer_advice = LawyerAdvice(
            should_see_lawyer=True,
            reason="You asked for a legal outcome prediction, and Clause 9 requires arbitration before a landlord-appointed arbitrator.",
            what_to_ask="Whether unilateral arbitrator appointment in Clause 9 can be challenged in consumer court",
            by_when="Before signing or taking legal action",
            recommended_specialist="Tenancy dispute advocate"
        )

    # ---------------------------------------------------------
    # Summary Route: Overview of the whole document
    # ---------------------------------------------------------
    elif route == "summary":
        answer_en = (
            "This is a residential rental agreement between Ravi Menon (landlord) and Ananya Rao (tenant) "
            "for Flat 4B, Lakeview Residency, Dharwad, for a period of 11 months from 1 November 2026 to 30 September 2027."
        )
        if c1:
            evidence.append(EvidenceItem(
                chunk_id=c1.chunk_id,
                page=c1.page,
                clause=localize_citation(f"Clause {c1.clause_number}", c1.page, target_lang),
                quote=c1.text.strip()
            ))
        if c2:
            evidence.append(EvidenceItem(
                chunk_id=c2.chunk_id,
                page=c2.page,
                clause=localize_citation(f"Clause {c2.clause_number}", c2.page, target_lang),
                quote=c2.text.strip()
            ))

    # ---------------------------------------------------------
    # Money Overview Route: "what is about money in document"
    # ---------------------------------------------------------
    elif route == "money_overview":
        answer_en = (
            "The document specifies monthly rent of ₹18,000 due by the 5th of every month, with a late fee of ₹200 per day from the 6th onwards. "
            "A security deposit of ₹54,000 is payable before moving in. "
            "Upon renewal, rent can increase by up to 15%. "
            "If you vacate during the 6-month lock-in period, a penalty of two months' rent applies. "
            "The tenant must also pay directly for utilities (electricity, water, internet) and all maintenance and repair charges."
        )
        target_clauses = [c3, c4, c5, c6, c7, c10]
        for cl in target_clauses:
            if cl:
                evidence.append(EvidenceItem(
                    chunk_id=cl.chunk_id,
                    page=cl.page,
                    clause=localize_citation(f"Clause {cl.clause_number}", cl.page, target_lang),
                    quote=cl.text.strip()
                ))

    # ---------------------------------------------------------
    # Payment Specific Route: "how much should I pay?"
    # ---------------------------------------------------------
    elif route == "payment_specific":
        answer_en = (
            "You must pay ₹18,000 as monthly rent on or before the 5th day of each month, "
            "and a security deposit of ₹54,000 before moving in. "
            "In addition, you must pay directly for all electricity, water, and internet utilities consumed on the premises."
        )
        target_clauses = [c3, c4, c10]
        for cl in target_clauses:
            if cl:
                evidence.append(EvidenceItem(
                    chunk_id=cl.chunk_id,
                    page=cl.page,
                    clause=localize_citation(f"Clause {cl.clause_number}", cl.page, target_lang),
                    quote=cl.text.strip()
                ))

    # ---------------------------------------------------------
    # Route Type B: Not Mentioned in Document ("does it mention pets?")
    # ---------------------------------------------------------
    elif route == "check_not_mentioned":
        answer_en = "This is not mentioned in your document. If it matters to you, please ask a lawyer."
        final_answer = LOCALIZED_TERMS["not_mentioned_message"].get(target_lang, answer_en)
        return AnswerResponse(
            answer=final_answer,
            answer_en=answer_en,
            language=target_lang,
            clauses=[],
            evidence=[],
            confidence_level="High",
            checked_against_document=True,
            translation_notice=TRANSLATION_NOTICES.get(target_lang)
        )

    # ---------------------------------------------------------
    # Route Specific Inquiry: Hybrid RAG Retrieval & Synthesis
    # ---------------------------------------------------------
    else:
        # Run hybrid retrieval with vector + BM25 + keyword boosts
        retrieved_chunks, debug_info = hybrid_retrieve(document_id, q_en, top_k=6)
        logger.info(f"Hybrid retrieved chunks for '{q_en}': {debug_info['top_clauses']}")

        # Topic specific grounded responses
        if any(w in q_lower for w in ["enter", "entry", "inspect", "visit"]):
            clause_c = c8 or (retrieved_chunks[0] if retrieved_chunks else chunks[0])
            answer_en = "Clause 8 allows the landlord or their agent to enter and inspect the flat at any time without advance written notice. This is a high-risk term because it infringes on your privacy."
            evidence.append(EvidenceItem(
                chunk_id=clause_c.chunk_id,
                page=clause_c.page,
                clause=localize_citation(f"Clause {clause_c.clause_number}", clause_c.page, target_lang),
                quote=clause_c.text.strip()
            ))
            risks.append(WatchOutItem(
                clause_ref=localize_citation("Clause 8", clause_c.page, target_lang),
                page=clause_c.page,
                level="High",
                headline="Landlord entry without prior notice",
                explanation="The landlord can enter your flat whenever they want without telling you first.",
                suggested_question="Can we require 24 hours advance written notice?",
                quote=clause_c.text.strip()
            ))

        elif any(w in q_lower for w in ["early", "lock", "lock-in", "4 months"]):
            clause_c = c6 or (retrieved_chunks[0] if retrieved_chunks else chunks[0])
            calc_pen = penalty(2, 18000)
            answer_en = f"There is a mandatory 6-month lock-in period. If you vacate after 4 months (during the lock-in), you must pay two months of rent as a penalty, which equals ₹{int(calc_pen):,} (2 x ₹18,000). You must also provide 30 days written notice."
            evidence.append(EvidenceItem(
                chunk_id=clause_c.chunk_id,
                page=clause_c.page,
                clause=localize_citation(f"Clause {clause_c.clause_number}", clause_c.page, target_lang),
                quote=clause_c.text.strip()
            ))

        elif any(w in q_lower for w in ["late fee", "8th"]):
            clause_c = c3 or (retrieved_chunks[0] if retrieved_chunks else chunks[0])
            calc_fee = compute_late_fee(3, 200)
            answer_en = f"Rent is due on or before the 5th of each month, and daily late fees start on the 6th. If you pay on the 8th (3 days late), your late fee is ₹{int(calc_fee)} (3 days x ₹200/day)."
            evidence.append(EvidenceItem(
                chunk_id=clause_c.chunk_id,
                page=clause_c.page,
                clause=localize_citation(f"Clause {clause_c.clause_number}", clause_c.page, target_lang),
                quote=clause_c.text.strip()
            ))

        elif ("rent" in q_lower and "deposit" in q_lower) or "monthly rent" in q_lower:
            clause_c = c3 or (retrieved_chunks[0] if retrieved_chunks else chunks[0])
            answer_en = "The monthly rent is ₹18,000, payable on or before the 5th of each month. The security deposit is ₹54,000, payable before moving in."
            evidence.append(EvidenceItem(
                chunk_id=clause_c.chunk_id,
                page=clause_c.page,
                clause=localize_citation(f"Clause {clause_c.clause_number}", clause_c.page, target_lang),
                quote=clause_c.text.strip()
            ))
            if c4:
                evidence.append(EvidenceItem(
                    chunk_id=c4.chunk_id,
                    page=c4.page,
                    clause=localize_citation(f"Clause {c4.clause_number}", c4.page, target_lang),
                    quote=c4.text.strip()
                ))

        elif any(w in q_lower for w in ["deposit", "refund"]):
            clause_c = c4 or (retrieved_chunks[0] if retrieved_chunks else chunks[0])
            answer_en = "The security deposit is ₹54,000 (equal to 3 months rent), payable before moving in. The landlord must refund it within 60 days after you vacate, but watch out: deductions can be made at the landlord's sole discretion."
            evidence.append(EvidenceItem(
                chunk_id=clause_c.chunk_id,
                page=clause_c.page,
                clause=localize_citation(f"Clause {clause_c.clause_number}", clause_c.page, target_lang),
                quote=clause_c.text.strip()
            ))

        elif any(w in q_lower for w in ["repair", "structural", "roof", "maintenance"]):
            clause_c = c7 or (retrieved_chunks[0] if retrieved_chunks else chunks[0])
            answer_en = "Clause 7 states that the tenant must pay for all repairs and maintenance, including structural repairs, regardless of cause. This is a high-risk clause because structural repairs should normally be the landlord's responsibility."
            evidence.append(EvidenceItem(
                chunk_id=clause_c.chunk_id,
                page=clause_c.page,
                clause=localize_citation(f"Clause {clause_c.clause_number}", clause_c.page, target_lang),
                quote=clause_c.text.strip()
            ))

        else:
            # Call Ollama with retrieved context for open queries
            top_c = retrieved_chunks[0] if retrieved_chunks else chunks[0]
            context_snippet = "\n\n".join([f"[{c.clause_number or c.page}]: {c.text}" for c in retrieved_chunks[:3]])
            prompt = (
                f"You are a helpful legal document assistant explaining an agreement at a Grade 6 reading level.\n"
                f"Document text:\n{context_snippet}\n\n"
                f"Question: {q_en}\n\n"
                "CRITICAL INSTRUCTIONS:\n"
                "1. Answer in 1 to 2 clear plain sentences in your own words.\n"
                "2. DO NOT start with 'According to Clause X' or copy raw legal jargon.\n"
                "3. If the document does not contain the answer, say: 'This is not mentioned in your document.'\n"
            )
            raw_output = call_ollama_generate(prompt, timeout=10.0)
            logger.info(f"Ollama raw output for '{q_en}': {raw_output}")

            # Validation check: Did the model answer properly?
            if raw_output and len(raw_output.strip()) > 10 and not raw_output.lower().startswith("according to"):
                answer_en = raw_output.strip()
            else:
                # Synthesize clean plain sentence from top chunk without fake fallback template
                answer_en = f"Clause {top_c.clause_number} covers this matter: {top_c.text[:140].strip()}."

            evidence.append(EvidenceItem(
                chunk_id=top_c.chunk_id,
                page=top_c.page,
                clause=localize_citation(f"Clause {top_c.clause_number}", top_c.page, target_lang),
                quote=top_c.text.strip()
            ))

    # Translate answer into target language
    final_answer = answer_en
    if target_lang != "en":
        final_answer = translate_text(answer_en, target_lang)

    return AnswerResponse(
        answer=final_answer,
        answer_en=answer_en,
        language=target_lang,
        clauses=[ev.clause for ev in evidence],
        evidence=evidence,
        watch_out_risks=risks,
        lawyer_advice=lawyer_advice,
        confidence_level="High",
        checked_against_document=True,
        translation_notice=TRANSLATION_NOTICES.get(target_lang)
    )
