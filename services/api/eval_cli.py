import sys
import json
from pathlib import Path
from main import app
from fastapi.testclient import TestClient

def main():
    print("=" * 60)
    print("Private Legal Document Triage Agent - CLI Evaluation Runner")
    print("=" * 60)
    
    client = TestClient(app)
    print("[1/2] Loading sample document into local Chroma & BM25 index...")
    sample_res = client.post("/api/documents/sample")
    if sample_res.status_code != 200:
        print(f"Error loading sample: {sample_res.text}")
        sys.exit(1)
        
    print("[2/2] Running 12-question evaluation benchmark suite...")
    eval_res = client.post("/api/evals/run")
    if eval_res.status_code != 200:
        print(f"Error executing evals: {eval_res.text}")
        sys.exit(1)
        
    data = eval_res.json()
    print("-" * 60)
    print(f"Total Cases: {data['total']} | Passed: {data['passed']} | Failed: {data['failed']}")
    print(f"Overall Pass Rate: {data['score_percentage']}%")
    print(f"Zero Unverified Claims Guarantee: {'PASSED (0 unverified)' if data['zero_unverified_claims'] else 'FAILED'}")
    print("-" * 60)
    for r in data["results"]:
        status = "[PASS]" if r["passed"] else "[FAIL]"
        print(f"{status} {r['id']}: {r['question']}")
        print(f"       {r['details']}")
    print("=" * 60)

if __name__ == "__main__":
    main()
