import os
import sys
import unittest
import json
import re
from pathlib import Path
from fastapi.testclient import TestClient

# Add services/api to sys.path
SERVICES_DIR = Path(__file__).resolve().parent.parent / "services" / "api"
sys.path.insert(0, str(SERVICES_DIR))

from main import app
from config import settings
from database import init_db, get_connection
from translation_layer import jev_verify_number_preservation, LOCALIZED_TERMS


class TestFixQAAndTranslations(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)
        cls.fixture_pdf = Path(__file__).resolve().parent / "fixtures" / "sample_rental_agreement.pdf"
        assert cls.fixture_pdf.exists(), f"Sample rental agreement fixture missing at {cls.fixture_pdf}"

        # Clean test tables
        conn = get_connection()
        c = conn.cursor()
        c.execute("DELETE FROM documents")
        c.execute("DELETE FROM chunks")
        c.execute("DELETE FROM document_translations")
        c.execute("DELETE FROM session_turns")
        c.execute("DELETE FROM semantic_cache")
        conn.commit()
        conn.close()

        # Upload fixture PDF once for all tests
        with open(cls.fixture_pdf, "rb") as f:
            resp = cls.client.post(
                "/api/documents",
                files={"file": ("sample_rental_agreement.pdf", f, "application/pdf")}
            )
        assert resp.status_code == 200, f"Upload failed: {resp.text}"
        cls.doc_id = resp.json()["document_id"]

    def _ask(self, question: str, lang: str = "en") -> dict:
        resp = self.client.post("/api/ask", json={
            "document_id": self.doc_id,
            "session_id": "test_session_qa",
            "question": question,
            "language": lang
        })
        self.assertEqual(resp.status_code, 200)
        
        events = []
        for line in resp.iter_lines():
            if line.startswith("data: "):
                try:
                    events.append(json.loads(line[6:]))
                except Exception:
                    pass
        self.assertGreater(len(events), 0, "No SSE events returned")
        return events[-1]

    def test_01_money_overview(self):
        """'what is about money in document' must cover rent, deposit, late fee, 15% renewal, 2-month penalty, utilities."""
        res = self._ask("what is about money in document", "en")
        answer = res["answer"]
        clauses = res["clauses"]

        # Check key financial terms
        self.assertIn("18,000", answer)
        self.assertIn("54,000", answer)
        self.assertIn("200", answer)
        self.assertIn("15%", answer)
        self.assertIn("two months", answer.lower())
        self.assertIn("utilities", answer.lower())

        # Check citations
        clause_str = " ".join(clauses)
        for expected in ["3", "4", "5", "6", "7", "10"]:
            self.assertTrue(any(expected in c for c in clauses), f"Clause {expected} should be cited in money overview")

    def test_02_payment_specific(self):
        """'how much should I pay?' must specify monthly rent of ₹18,000, deposit of ₹54,000, and utilities."""
        res = self._ask("how much should I pay?", "en")
        answer = res["answer"]
        clauses = res["clauses"]

        self.assertIn("18,000", answer)
        self.assertIn("54,000", answer)
        self.assertTrue(any("electricity" in answer.lower() or "utilities" in answer.lower() or "water" in answer.lower() for _ in [1]))
        
        # Must cite Clauses 3, 4, 10
        clause_str = " ".join(clauses)
        self.assertTrue(any("3" in c for c in clauses), "Clause 3 must be cited")
        self.assertTrue(any("4" in c for c in clauses), "Clause 4 must be cited")
        self.assertTrue(any("10" in c for c in clauses), "Clause 10 must be cited")

    def test_03_summary_route(self):
        """'what is this document about' must identify residential rental agreement between Ravi Menon and Ananya Rao for Flat 4B Lakeview Residency Dharwad."""
        res = self._ask("what is this document about", "en")
        answer = res["answer"]
        clauses = res["clauses"]

        self.assertIn("Ravi Menon", answer)
        self.assertIn("Ananya Rao", answer)
        self.assertIn("Flat 4B", answer)
        self.assertIn("Lakeview Residency", answer)
        self.assertIn("Dharwad", answer)
        self.assertIn("11 months", answer)
        self.assertIn("1 November 2026", answer)
        self.assertIn("30 September 2027", answer)

        # Cites Clause 1 & 2
        self.assertTrue(any("1" in c for c in clauses), "Clause 1 must be cited")
        self.assertTrue(any("2" in c for c in clauses), "Clause 2 must be cited")

    def test_04_different_answers_guarantee(self):
        """The three questions must return three distinct, substantive answers, never identical fallback text."""
        ans_money = self._ask("what is about money in document", "en")["answer"]
        ans_pay = self._ask("how much should I pay?", "en")["answer"]
        ans_summary = self._ask("what is this document about", "en")["answer"]

        self.assertNotEqual(ans_money, ans_pay, "Money overview and payment answers must be distinct")
        self.assertNotEqual(ans_money, ans_summary, "Money overview and summary answers must be distinct")
        self.assertNotEqual(ans_pay, ans_summary, "Payment and summary answers must be distinct")

        # None of them should ever start with 'According to Clause X, the agreement states:'
        for ans in [ans_money, ans_pay, ans_summary]:
            self.assertFalse(ans.startswith("According to Clause"), f"Answer should not start with fake fallback: {ans}")

    def test_05_type_b_not_mentioned(self):
        """'does it mention pets?' should return Type B: not mentioned in document."""
        res = self._ask("does it mention pets?", "en")
        answer = res["answer"]
        self.assertIn("not mentioned in your document", answer.lower())
        self.assertIn("ask a lawyer", answer.lower())

    def test_06_type_c_unrelated(self):
        """'what is the capital of France?' should return Type C: I can only answer questions about the document."""
        res = self._ask("what is the capital of France?", "en")
        answer = res["answer"]
        self.assertIn("only answer questions about the document", answer.lower())
        self.assertEqual(len(res.get("clauses", [])), 0, "No clauses should be cited for unrelated query")

    def test_07_type_d_legal_prediction(self):
        """'will I win if I go to court?' must explain Clause 9 dispute terms, decline to predict, and suggest a lawyer."""
        res = self._ask("will I win if I go to court?", "en")
        answer = res["answer"]
        self.assertIn("Clause 9", answer)
        self.assertIn("arbitration", answer.lower())
        self.assertIn("lawyer can tell you this", answer.lower())
        self.assertIsNotNone(res.get("lawyer_advice"))
        self.assertTrue(res["lawyer_advice"]["should_see_lawyer"])

    def test_08_hindi_translation_no_english_leak(self):
        """With Hindi selected, all cards, obligations, risks, citations, and answers must be in Hindi without English leaks."""
        resp = self.client.get(f"/api/documents/{self.doc_id}/cards?language=hi")
        self.assertEqual(resp.status_code, 200)
        cards = resp.json()

        # Check summary in Hindi
        self.assertIn("किराया", cards["summary"])
        self.assertIn("रवि मेनन", cards["summary"])

        # Check obligations: 'who' must be localized, action in plain words
        for ob in cards["what_you_must_do"]:
            self.assertFalse(ob["who"] == "You", f"Obligation who should be localized, got: {ob['who']}")
            self.assertFalse(ob["who"] == "Tenant", f"Obligation who should be localized, got: {ob['who']}")
            self.assertIn("किराएदार", ob["who"])
            # Citations should use 'धारा' not 'Clause'
            self.assertIn("धारा", ob["clause_ref"])
            self.assertFalse(ob["clause_ref"].startswith("Clause "))

        # Check risks: headline and explanation must be in Hindi
        for r in cards["watch_out_risks"]:
            self.assertIn("धारा", r["clause_ref"])
            # Check presence of Devanagari characters
            has_devanagari = any(0x0900 <= ord(ch) <= 0x097F for ch in r["headline"])
            self.assertTrue(has_devanagari, f"Risk headline must be in Hindi: {r['headline']}")

        # Check lawyer advice in Hindi
        law = cards["lawyer_advice"]
        self.assertTrue(any(0x0900 <= ord(ch) <= 0x097F for ch in law["reason"]))
        self.assertTrue(any(0x0900 <= ord(ch) <= 0x097F for ch in law["what_to_ask"]))

        # Verify Jev check: numbers 18000, 54000, 2026, 2027 preserved as Western digits 0-9
        self.assertTrue(jev_verify_number_preservation(cards["summary_en"], cards["summary"]))

    def test_09_multilingual_all_languages(self):
        """Verify cards for Tamil, Kannada, Telugu, and Malayalam all properly localize citations and content."""
        lang_checks = {
            "ta": {"clause_word": "கூறு", "who_word": "வாடகைதாரர்"},
            "kn": {"clause_word": "ಷರತ್ತು", "who_word": "ಬಾಡಿಗೆದಾರರು"},
            "te": {"clause_word": "నిబంధన", "who_word": "అద్దెదారు"},
            "ml": {"clause_word": "വ്യവസ്ഥ", "who_word": "വാടകക്കാരൻ"}
        }

        for l_code, check in lang_checks.items():
            resp = self.client.get(f"/api/documents/{self.doc_id}/cards?language={l_code}")
            self.assertEqual(resp.status_code, 200)
            cards = resp.json()

            # Verify citation in obligations
            ob0 = cards["what_you_must_do"][0]
            self.assertIn(check["clause_word"], ob0["clause_ref"], f"Clause word {check['clause_word']} expected in {l_code}")
            self.assertIn(check["who_word"], ob0["who"], f"Who word {check['who_word']} expected in {l_code}")

            # Verify Jev preservation
            self.assertTrue(jev_verify_number_preservation(cards["summary_en"], cards["summary"]))


if __name__ == "__main__":
    unittest.main()
