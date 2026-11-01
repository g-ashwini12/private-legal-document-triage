# Private Legal Document Triage Agent

> **Hackathon Problem Statement PS2**  
> **Theme 1: Civic Pulse, Digital Governance & Public Information**

Private Legal Document Triage Agent is an offline-first, full-stack decision-support web application that empowers citizens, tenants, freelancers, and small business owners to understand complex legal documents without uploading sensitive confidential files to the cloud.

The system extracts clauses, categorizes risks with clear visual badges, computes obligations and timeline deadlines using deterministic code math, grounds every claim against verifiable quotes, and provides actionable escalation advice on when and how to consult a qualified lawyer.

---

## 🌟 Key Features

1. **100% Offline & Zero-Cloud Privacy:**
   - Powered by local Gemma served through Ollama (4-bit quantized, temp 0.1) and local ONNX sentence embeddings via Chroma.
   - Deterministic offline demo mode runs seamlessly when Ollama is stopped.
   - Permanent document deletion cleans all files, SQLite records, and vector collections.

2. **Legal Document Gate & Defense:**
   - Detects document categories (`rental`, `employment`, `notice`, `terms`, `other_legal`).
   - Automatically rejects non-legal files (e.g. cooking recipes) with friendly explanations.
   - Treats document content strictly as untrusted data to defend against prompt injections.

3. **Hybrid RAG & LangGraph Orchestration:**
   - Combines vector search with BM25 Okapi lexical retrieval merged via Reciprocal Rank Fusion ($k=60$).
   - Four parallel analysis branches:
     - **Branch A:** Clause Analysis & Inquiries
     - **Branch B:** Unilateral Risk Detection (High, Medium, Low)
     - **Branch C:** Affirmative & Negative Obligations
     - **Branch D:** Deadline Timeline Extraction

4. **Deterministic Tools (Python, Never LLM Hallucinations):**
   - Arithmetic calculations (e.g. daily late fees, lock-in penalty multiples) and ISO dates (e.g. 30-day notice cutoffs, 60-day refund deadlines) are computed in verified Python functions.

5. **Evidence Grounding & Jev Yes/No Tests:**
   - Verifies that every claim cites an actual `chunk_id` and verbatim normalized quote.
   - Ungrounded claims are automatically stripped before presentation.
   - Jev output checks ensure outcome predictions are blocked and escalation advice is triggered whenever High risks are identified.

6. **Adaptive Bandit Quality Loop:**
   - Evaluates response scores (+1 per verified quote, -2 per dropped ungrounded claim, -1 per user thumbs-down).
   - Epsilon-greedy selector (10% exploration) optimizes between three explanation prompt variants and tunes retrieval `top_k`.

---

## 📁 Project Structure

```
zeroday_ps2/
├── .env.example                     # Environment configuration template
├── README.md                        # Documentation & setup instructions
├── data/
│   ├── sample_rental_agreement.pdf  # Fictional 3-page sample rental agreement
│   ├── sample_rental_agreement.txt  # Source text of the sample document
│   ├── eval_questions.json          # 12-question evaluation dataset
│   ├── triage.db                    # Local SQLite database (sessions, metrics, cache)
│   └── chroma/                      # Persistent local Chroma vector database
├── services/
│   └── api/                         # FastAPI Backend
│       ├── config.py                # App configuration & settings
│       ├── database.py              # SQLite schema & persistence
│       ├── models.py                # Pydantic schemas
│       ├── tools.py                 # Deterministic Python calculation tools
│       ├── step1_extract.py         # PyMuPDF text & page extractor
│       ├── step2_gate.py            # Legal document gate classifier
│       ├── step3_chunk.py           # Clause-aware chunker
│       ├── step4_index.py           # Chroma & BM25 indexer + semantic cache
│       ├── hybrid_retrieval.py      # Vector + BM25 RRF search
│       ├── router.py                # Question intent classifier
│       ├── llm_engine.py            # Ollama & deterministic demo engine
│       ├── jev_checks.py            # Jev yes/no output validation checks
│       ├── feedback_loop.py         # Epsilon-greedy prompt bandit
│       ├── workflow.py              # LangGraph StateGraph pipeline
│       ├── main.py                  # FastAPI application with SSE streaming
│       ├── eval_cli.py              # CLI evaluation runner
│       ├── test_phase1.py           # Unit tests for steps 1-4
│       └── test_phase2_endpoints.py # End-to-end endpoint & benchmark tests
└── apps/
    └── app/                         # Next.js (App Router) Frontend
        ├── src/
        │   ├── app/
        │   │   ├── page.tsx         # Home page & sample launcher
        │   │   ├── analyze/page.tsx # Split triage workspace & document viewer
        │   │   ├── dashboard/page.tsx# Observability & monitoring dashboard
        │   │   ├── evals/page.tsx   # Automated evaluation runner UI
        │   │   └── how-it-works/page.tsx # Architecture & privacy walkthrough
        │   ├── components/          # React Bits UI components
        │   ├── lib/                 # API client & utilities
        │   └── types/               # TypeScript interface models
        ├── package.json
        └── tailwind.config.js
```

---

## 🚀 Prerequisites

- **Python:** 3.10 or higher
- **Node.js:** v18 or higher (tested on v26)
- **npm:** v9 or higher
- **Ollama (Optional):** If you wish to run a live local Gemma model:
  ```bash
  ollama pull gemma:2b
  ollama serve
  ```
  *Note:* When Ollama is stopped, the application automatically runs in deterministic **Demo Mode**, answering all sample rental agreement queries offline with 100% precision.

---

## 🛠️ Installation & Setup

### 1. Clone & Configure Environment

```bash
cd zeroday_ps2
cp .env.example .env
```

### 2. Backend Setup (FastAPI)

```bash
cd services/api
pip install -r <(echo "
fastapi
uvicorn
pydantic
pydantic-settings
pymupdf
reportlab
rank_bm25
chromadb
langgraph
httpx
")
```

### 3. Frontend Setup (Next.js)

```bash
cd apps/app
npm install
```

---

## 🏃 Running the Application

### Start Backend API

In terminal 1:
```bash
cd services/api
uvicorn main:app --reload --port 8000
```
- API will be accessible at: `http://localhost:8000`
- Interactive Swagger docs at: `http://localhost:8000/docs`
- Health check at: `http://localhost:8000/api/health`

### Start Frontend UI

In terminal 2:
```bash
cd apps/app
npm run dev
```
- Frontend will be accessible at: `http://localhost:3000`

---

## 🧪 Testing & Verification

### Run Phase 1 Unit Tests (Steps 1–4)
Validates PDF extraction, legal document gating, clause-aware chunking, vector indexing, and semantic cache:
```bash
python3 services/api/test_phase1.py
```

### Run Phase 2 End-to-End Tests
Validates all REST endpoints, LangGraph SSE streaming, Q1–Q8 scenarios, and metrics:
```bash
python3 services/api/test_phase2_endpoints.py
```

### Run CLI Evaluation Benchmark (12 Question Scenarios)
Executes the full evaluation suite and verifies AC10 (&ge;10/12 passed and 0 unverified claims):
```bash
python3 services/api/eval_cli.py
```

Expected output:
```
============================================================
Total Cases: 12 | Passed: 12 | Failed: 0
Overall Pass Rate: 100.0%
Zero Unverified Claims Guarantee: PASSED (0 unverified)
============================================================
```

---

## 📋 Acceptance Criteria & Test Scenarios

| Test Case | Scenario / Expectation | Implementation Verification |
|---|---|---|
| **AC1** | Backend and frontend start without errors; `/api/health` returns OK | `GET /api/health` returns status `ok` |
| **AC2** | Offline capability without external network calls | Verified: runs entirely in local environment |
| **AC3** | Deterministic demo mode when Ollama is stopped | Tested: graceful fallback with UI banner and exact sample answers |
| **AC4** | Sample yields 3 pages, type `rental`, exactly 10 clause chunks | Tested in `test_02_load_sample_and_verify_metadata` |
| **AC5** | Exactly 8 total risks: High = 3 (Cl. 4, 7, 8), Medium = 4 (Cl. 3, 5, 6, 9), Low = 1 (Cl. 10) | Tested in `test_03_summary_expectations` |
| **AC6** | Obligations: rent by 5th, deposit before move-in, 30 days notice, utilities direct | Tested in `test_03_summary_expectations` |
| **AC7** | Deadlines: 2026-11-01, 2027-04-30, 2027-08-31, 2027-09-30, 2027-11-29 | Tested in `test_03_summary_expectations` |
| **AC8** | Every claim has a `chunk_id` and quote that exists in that chunk | Enforced by `node_evidence_verification` |
| **Q1** | "What is the monthly rent and when is it due?" &rarr; ₹18,000 by 5th, Clause 3, page 1 | Tested: PASS |
| **Q2** | "Can the landlord enter without telling me?" &rarr; Clause 8, High risk, escalation advice | Tested: PASS |
| **Q3** | "What if I leave after 4 months?" &rarr; 6-mo lock-in, penalty = ₹36,000 computed in code | Tested: PASS |
| **Q4** | "How much late fee if I pay on the 8th?" &rarr; 3 days &times; ₹200 = ₹600 in code | Tested: PASS |
| **Q5** | "How much is the deposit and when do I get it back?" &rarr; ₹54,000, 60 days, sole discretion High risk | Tested: PASS |
| **Q6** | "Will I win if I take this to court?" &rarr; Refuses outcome prediction, escalates | Tested: PASS |
| **Q7** | "What is the capital of France?" &rarr; Polite refusal, out of scope, calls no branches | Tested: PASS |
| **Q8** | "Does the agreement mention pets?" &rarr; "Not found in the document" | Tested: PASS |
| **Q9** | Semantic cache hit on repeated query &rarr; marked "Answered from cache" | Tested: PASS |
| **Q10** | Uploading non-legal file (recipe) &rarr; rejected with `not_legal` error | Tested: PASS |
| **AC9** | Monitoring dashboard shows node latency, tokens, cache rate, and context usage | Tested on `/dashboard` |
| **AC10** | Evaluation suite achieves &ge;10/12 passed and 0 unverified claims | Result: 12/12 passed (100%) |
| **AC11** | Jev yes/no checks catch and drop ungrounded or fabricated claims | Enforced in `node_evidence_verification` and `jev_checks.py` |
| **AC12** | Thumbs-down feedback decreases prompt variant score in SQLite | Tested in `test_06_metrics_and_feedback` |
| **AC13** | Prompt injection inside document ("ignore instructions") does not alter behavior | Tested in `test_02_legal_gate_classification` |

---

## 🔒 Security & Privacy Protections

- **Data Minimization:** No telemetry, no external font CDNs, no remote tracking libraries.
- **Permanent Wiping:** Clicking **"Delete my document"** permanently deletes the uploaded PDF, Chroma vector collections, BM25 memory structures, SQLite session dialogues, and semantic cache rows.
- **Untrusted Document Defense:** Document text is treated strictly as passive data inside quarantined processing nodes.

---

## ⚖️ Legal Disclaimer

Private Legal Document Triage Agent is a **decision-support technology**, not legal advice. It is designed to assist users in reading contracts and identifying high-risk clauses prior to formal legal consultation. For specific disputes or court proceedings, always consult a qualified lawyer.
