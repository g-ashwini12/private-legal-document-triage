import os
import sys
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

# Add services/api to sys.path
SERVICES_DIR = Path(__file__).resolve().parent.parent / "services" / "api"
sys.path.insert(0, str(SERVICES_DIR))

from main import app
from config import settings
from database import init_db, get_connection
from step1_extract import extract_pdf, ExtractionError
from step2_gate import classify_document
from step3_chunk import chunk_document
from step4_index import get_document_chunks, get_bm25_index

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"

class TestPhase1Backend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        conn = get_connection()
        c = conn.cursor()
        c.execute("DELETE FROM documents")
        c.execute("DELETE FROM chunks")
        c.execute("DELETE FROM session_turns")
        c.execute("DELETE FROM semantic_cache")
        c.execute("DELETE FROM metrics")
        conn.commit()
        conn.close()

        cls.client = TestClient(app)
        cls.rental_pdf = FIXTURES_DIR / "sample_rental_agreement.pdf"
        cls.employment_pdf = FIXTURES_DIR / "sample_employment_contract.pdf"
        cls.recipe_pdf = FIXTURES_DIR / "sample_recipe.pdf"
        cls.uploaded_doc_id = None

        assert cls.rental_pdf.exists(), f"Fixture missing: {cls.rental_pdf}"
        assert cls.employment_pdf.exists(), f"Fixture missing: {cls.employment_pdf}"
        assert cls.recipe_pdf.exists(), f"Fixture missing: {cls.recipe_pdf}"

    def test_01_health_check_no_demo(self):
        """Verify health check returns status ok and contains NO demo_mode flag."""
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("ollama_reachable", data)
        self.assertIn("model", data)
        # Verify requirement A: demo_mode is removed
        self.assertNotIn("demo_mode", data)

    def test_02_demo_endpoints_removed(self):
        """Verify requirement A: /api/sample is completely removed (404)."""
        res_sample = self.client.get("/api/sample")
        self.assertEqual(res_sample.status_code, 404)

        # GET /api/sample/download should return 404
        res_download = self.client.get("/api/sample/download")
        self.assertEqual(res_download.status_code, 404)

    def test_03_upload_legal_pdf(self):
        """Verify POST /api/documents extracts, classifies, chunks, and indexes a real legal PDF."""
        with open(self.rental_pdf, "rb") as f:
            res = self.client.post(
                "/api/documents",
                files={"file": ("rental_agreement_2026.pdf", f, "application/pdf")}
            )

        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("document_id", data)
        self.assertEqual(data["filename"], "rental_agreement_2026.pdf")
        self.assertEqual(data["page_count"], 3)
        self.assertEqual(data["doc_type"], "rental")
        self.assertEqual(data["chunk_count"], 10)
        self.assertFalse(data["truncated"])
        self.assertIn("summary", data)

        # Store doc_id for subsequent tests
        self.__class__.uploaded_doc_id = data["document_id"]

    def test_04_file_serving_endpoint(self):
        """Verify GET /api/documents/{id}/file serves the exact PDF file."""
        doc_id = self.__class__.uploaded_doc_id
        res = self.client.get(f"/api/documents/{doc_id}/file")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers["content-type"], "application/pdf")
        self.assertGreater(len(res.content), 100000)

        # Non-existent doc file returns 404
        res_404 = self.client.get("/api/documents/non_existent_id/file")
        self.assertEqual(res_404.status_code, 404)

    def test_05_list_documents(self):
        """Verify GET /api/documents lists all uploaded documents."""
        res = self.client.get("/api/documents")
        self.assertEqual(res.status_code, 200)
        docs = res.json()
        self.assertIsInstance(docs, list)
        self.assertGreater(len(docs), 0)
        
        found = any(d["document_id"] == self.__class__.uploaded_doc_id for d in docs)
        self.assertTrue(found, "Uploaded document must appear in document list")

    def test_06_get_document_details(self):
        """Verify GET /api/documents/{id} returns metadata and all extracted chunks."""
        doc_id = self.__class__.uploaded_doc_id
        res = self.client.get(f"/api/documents/{doc_id}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        
        self.assertEqual(data["metadata"]["document_id"], doc_id)
        self.assertEqual(len(data["chunks"]), 10)
        
        # Verify chunk fields
        chunk0 = data["chunks"][0]
        self.assertIn("chunk_id", chunk0)
        self.assertEqual(chunk0["page"], 1)
        self.assertIn("text", chunk0)

    def test_07_upload_second_document_employment(self):
        """Verify uploading another document succeeds without losing earlier documents."""
        with open(self.employment_pdf, "rb") as f:
            res = self.client.post(
                "/api/documents",
                files={"file": ("employment_contract_vikram.pdf", f, "application/pdf")}
            )

        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["doc_type"], "employment")
        self.assertEqual(data["page_count"], 2)
        self.assertEqual(data["chunk_count"], 7)
        emp_doc_id = data["document_id"]

        # Verify list now contains both documents
        res_list = self.client.get("/api/documents")
        docs = res_list.json()
        doc_ids = [d["document_id"] for d in docs]
        self.assertIn(self.__class__.uploaded_doc_id, doc_ids)
        self.assertIn(emp_doc_id, doc_ids)

        # Clean up second document
        self.client.delete(f"/api/documents/{emp_doc_id}")

    def test_08_legal_gate_rejection(self):
        """Verify non-legal files (e.g. recipes) are rejected with HTTP 422."""
        with open(self.recipe_pdf, "rb") as f:
            res = self.client.post(
                "/api/documents",
                files={"file": ("chocolate_chip_recipe.pdf", f, "application/pdf")}
            )

        self.assertEqual(res.status_code, 422)
        err = res.json()
        self.assertIn("Non-legal document detected", str(err))

    def test_09_invalid_upload_handling(self):
        """Verify invalid file types and empty files are rejected with HTTP 400."""
        # Non-PDF
        res_txt = self.client.post(
            "/api/documents",
            files={"file": ("notes.txt", b"Hello world", "text/plain")}
        )
        self.assertEqual(res_txt.status_code, 400)

        # Empty PDF
        res_empty = self.client.post(
            "/api/documents",
            files={"file": ("empty.pdf", b"", "application/pdf")}
        )
        self.assertEqual(res_empty.status_code, 400)

    def test_10_deduplication(self):
        """Verify uploading identical document reuses index with deduplicated flag."""
        with open(self.rental_pdf, "rb") as f:
            res = self.client.post(
                "/api/documents",
                files={"file": ("rental_copy.pdf", f, "application/pdf")}
            )

        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("deduplicated"))
        self.assertEqual(data["document_id"], self.__class__.uploaded_doc_id)

    def test_11_delete_document(self):
        """Verify DELETE /api/documents/{id} completely purges document, file, chunks, and index."""
        doc_id = self.__class__.uploaded_doc_id
        res_del = self.client.delete(f"/api/documents/{doc_id}")
        self.assertEqual(res_del.status_code, 200)

        # Subsequent GET should return 404
        res_get = self.client.get(f"/api/documents/{doc_id}")
        self.assertEqual(res_get.status_code, 404)

        # File serving should return 404
        res_file = self.client.get(f"/api/documents/{doc_id}/file")
        self.assertEqual(res_file.status_code, 404)

        # Not in document list
        res_list = self.client.get("/api/documents")
        doc_ids = [d["document_id"] for d in res_list.json()]
        self.assertNotIn(doc_id, doc_ids)

if __name__ == "__main__":
    unittest.main()
