"""
Phase 2 Unit and Integration Tests for Private Legal Document Triage Agent.
Tests:
1. Document upload and immediate 6-card generation
2. GET /api/documents/{id}/cards with multi-language (en, ta, hi) & Jev digit/amount preservation
3. POST /api/ask with plain-language streaming SSE response & citations
4. Admin gating (ADMIN_ENABLED=false -> 404; ADMIN_ENABLED=true -> login & metrics)
"""

import os
import sys
import unittest
import json
from pathlib import Path
from fastapi.testclient import TestClient

# Add services/api to sys.path
SERVICES_DIR = Path(__file__).resolve().parent.parent / "services" / "api"
sys.path.insert(0, str(SERVICES_DIR))

from main import app
from config import settings
from database import get_connection, init_db
from translation_layer import jev_verify_number_preservation


class TestPhase2Backend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)
        cls.fixture_pdf = Path(__file__).resolve().parent / "fixtures" / "sample_rental_agreement.pdf"
        assert cls.fixture_pdf.exists(), f"Sample rental agreement fixture missing at {cls.fixture_pdf}"

    def setUp(self):
        # Clean test database
        conn = get_connection()
        c = conn.cursor()
        c.execute("DELETE FROM documents")
        c.execute("DELETE FROM chunks")
        c.execute("DELETE FROM session_turns")
        c.execute("DELETE FROM semantic_cache")
        conn.commit()
        conn.close()

    def test_01_upload_and_auto_card_generation(self):
        """Uploading a document must automatically generate the 6 triage cards."""
        with open(self.fixture_pdf, "rb") as f:
            resp = self.client.post(
                "/api/documents",
                files={"file": ("sample_rental_agreement.pdf", f, "application/pdf")}
            )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        doc_id = data["document_id"]
        self.assertIsNotNone(doc_id)
        self.assertGreater(len(doc_id), 4)
        self.assertIn("analysis_cards", data)
        cards = data["analysis_cards"]
        self.assertIsNotNone(cards)

        # 1. Summary
        self.assertTrue(len(cards["summary"]) > 20)

        # 2. Key details
        self.assertGreater(len(cards["key_details"]), 0)
        categories = [k["category"] for k in cards["key_details"]]
        self.assertTrue(any("Party" in c or "Amount" in c or "Date" in c for c in categories))

        # 3. Watch out for (risks sorted High first)
        self.assertGreater(len(cards["watch_out_risks"]), 0)
        severities = [w["level"] for w in cards["watch_out_risks"]]
        if "High" in severities and "Low" in severities:
            first_high = severities.index("High")
            first_low = severities.index("Low")
            self.assertLess(first_high, first_low, "High severity risks must precede Low severity risks")

        # 4. What you must do (obligations)
        self.assertGreater(len(cards["what_you_must_do"]), 0)

        # 5. Important dates (sorted chronologically)
        self.assertGreater(len(cards["important_dates"]), 0)

        # 6. Lawyer advice
        self.assertIn("should_see_lawyer", cards["lawyer_advice"])
        self.assertIn("reason", cards["lawyer_advice"])
        self.assertIn("what_to_ask", cards["lawyer_advice"])

        # 7. Suggested questions
        self.assertGreater(len(cards["suggested_questions"]), 0)

    def test_02_get_cards_multilingual_and_number_preservation(self):
        """GET /api/documents/{id}/cards in different languages must preserve exact numbers/amounts."""
        with open(self.fixture_pdf, "rb") as f:
            upload_resp = self.client.post(
                "/api/documents",
                files={"file": ("sample_rental_agreement.pdf", f, "application/pdf")}
            )
        doc_id = upload_resp.json()["document_id"]

        # English cards
        resp_en = self.client.get(f"/api/documents/{doc_id}/cards?language=en")
        self.assertEqual(resp_en.status_code, 200)
        cards_en = resp_en.json()

        # Tamil cards
        resp_ta = self.client.get(f"/api/documents/{doc_id}/cards?language=ta")
        self.assertEqual(resp_ta.status_code, 200)
        cards_ta = resp_ta.json()

        # Hindi cards
        resp_hi = self.client.get(f"/api/documents/{doc_id}/cards?language=hi")
        self.assertEqual(resp_hi.status_code, 200)
        cards_hi = resp_hi.json()

        # Verify Jev number/date preservation between English and Tamil summaries
        en_summary = cards_en["summary"]
        ta_summary = cards_ta["summary"]
        passed = jev_verify_number_preservation(en_summary, ta_summary)
        self.assertTrue(passed, "Tamil summary must preserve Western digits and numbers")

        # Check that amounts with currency symbol are present
        en_amounts = [k["value"] for k in cards_en["key_details"] if "₹" in k["value"]]
        ta_amounts = [k["value"] for k in cards_ta["key_details"] if "₹" in k["value"]]
        self.assertEqual(len(en_amounts), len(ta_amounts), "Currency details must be preserved")

    def test_03_ask_question_streaming_and_citations(self):
        """POST /api/ask returns SSE event stream with citations grounded in document."""
        with open(self.fixture_pdf, "rb") as f:
            upload_resp = self.client.post(
                "/api/documents",
                files={"file": ("sample_rental_agreement.pdf", f, "application/pdf")}
            )
        doc_id = upload_resp.json()["document_id"]

        ask_payload = {
            "document_id": doc_id,
            "session_id": "test_sess_01",
            "question": "What is the monthly rent and deposit?",
            "language": "en"
        }
        resp = self.client.post("/api/ask", json=ask_payload)
        self.assertEqual(resp.status_code, 200)
        self.assertIn("text/event-stream", resp.headers["content-type"])

        # Collect SSE lines
        events = []
        for line in resp.iter_lines():
            if line.startswith("data: "):
                data_str = line[len("data: "):]
                try:
                    events.append(json.loads(data_str))
                except Exception:
                    pass

        self.assertGreater(len(events), 1, "Expected progress events and final response")
        final_event = events[-1]
        self.assertIn("answer", final_event)
        self.assertIn("evidence", final_event)
        self.assertGreater(len(final_event["evidence"]), 0, "Must provide citation evidence")
        self.assertIn("18,000", final_event["answer"])

    def test_04_admin_gating(self):
        """Admin routes must return 404 when ADMIN_ENABLED=False; require login when True."""
        orig_setting = settings.ADMIN_ENABLED
        try:
            # 1. When ADMIN_ENABLED is False (default for normal users)
            settings.ADMIN_ENABLED = False
            resp = self.client.get("/api/admin/metrics")
            self.assertEqual(resp.status_code, 404)
            resp_login = self.client.post("/api/admin/login", json={"password": "any"})
            self.assertEqual(resp_login.status_code, 404)

            # 2. When ADMIN_ENABLED is True
            settings.ADMIN_ENABLED = True
            resp_unauth = self.client.get("/api/admin/metrics")
            self.assertEqual(resp_unauth.status_code, 401)

            # Incorrect password
            resp_wrong = self.client.post("/api/admin/login", json={"password": "wrongpassword"})
            self.assertEqual(resp_wrong.status_code, 401)

            # Correct password
            resp_ok = self.client.post("/api/admin/login", json={"password": settings.ADMIN_PASSWORD})
            self.assertEqual(resp_ok.status_code, 200)
            token = resp_ok.json()["token"]

            # Query metrics with Bearer token
            resp_metrics = self.client.get(
                "/api/admin/metrics",
                headers={"Authorization": f"Bearer {token}"}
            )
            self.assertEqual(resp_metrics.status_code, 200)
            metrics_data = resp_metrics.json()
            self.assertIn("total_queries", metrics_data)
            self.assertIn("avg_latency_ms", metrics_data)

        finally:
            settings.ADMIN_ENABLED = orig_setting


if __name__ == "__main__":
    unittest.main()
