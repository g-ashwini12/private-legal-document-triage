import re
from typing import List, Dict, Any, Optional
from models import ChunkModel
from step1_extract import ExtractedDocument

# Pattern to detect clause starts:
# e.g., "1. Parties and Property."
# "2. Term."
# "Clause 3. Rent..."
# "Section 4: Deposit..."
CLAUSE_REGEX = re.compile(
    r'(?:^|\n)\s*(?:(?:Clause|Section|Article)\s+)?(\d+(?:\.\d+)*)[.)]\s*([^\n.]+)[.]?\s*',
    re.IGNORECASE
)

def chunk_document(doc: ExtractedDocument, document_id: str) -> List[ChunkModel]:
    chunks: List[ChunkModel] = []
    
    for page in doc.pages:
        if not page.readable:
            continue
        
        page_text = page.text.strip()
        if not page_text:
            continue

        # Find all clause headings in this page
        # We split text by headings
        # Match pattern: (start_index, end_index, clause_num, heading)
        matches = []
        for m in CLAUSE_REGEX.finditer(page_text):
            clause_num = m.group(1)
            raw_heading = m.group(2).strip()
            # Clean heading: avoid taking the entire paragraph as heading
            heading = raw_heading[:60].strip()
            matches.append((m.start(), m.end(), clause_num, heading))
        
        if matches:
            for i in range(len(matches)):
                start_idx, end_header_idx, clause_num, heading = matches[i]
                next_start = matches[i+1][0] if i + 1 < len(matches) else len(page_text)
                
                # Full clause text includes header + body
                clause_text = page_text[start_idx:next_start].strip()
                
                chunk_id = f"{document_id}_p{page.page_number}_c{clause_num}"
                chunks.append(ChunkModel(
                    chunk_id=chunk_id,
                    document_id=document_id,
                    page=page.page_number,
                    clause_number=clause_num,
                    heading=heading,
                    text=clause_text
                ))
        else:
            # Fallback chunking: 800 chars with 120 char overlap
            text_len = len(page_text)
            window = 800
            overlap = 120
            pos = 0
            chunk_idx = 1
            while pos < text_len:
                end_pos = min(pos + window, text_len)
                segment = page_text[pos:end_pos].strip()
                if segment:
                    chunk_id = f"{document_id}_p{page.page_number}_part{chunk_idx}"
                    chunks.append(ChunkModel(
                        chunk_id=chunk_id,
                        document_id=document_id,
                        page=page.page_number,
                        clause_number=None,
                        heading=f"Page {page.page_number} (Part {chunk_idx})",
                        text=segment
                    ))
                    chunk_idx += 1
                if end_pos >= text_len:
                    break
                pos += (window - overlap)

    return chunks
