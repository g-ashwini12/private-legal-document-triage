import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional
import pymupdf as fitz
from config import settings

class ExtractionError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code

class ExtractedPage:
    def __init__(self, page_number: int, text: str, readable: bool = True):
        self.page_number = page_number
        self.text = text
        self.readable = readable

    def to_dict(self) -> Dict[str, Any]:
        return {
            "page_number": self.page_number,
            "text": self.text,
            "readable": self.readable
        }

class ExtractedDocument:
    def __init__(self, filename: str, file_hash: str, page_count: int, pages: List[ExtractedPage], truncated: bool = False):
        self.filename = filename
        self.file_hash = file_hash
        self.page_count = page_count
        self.pages = pages
        self.truncated = truncated

    @property
    def total_readable_text(self) -> str:
        return "\n\n".join(p.text for p in self.pages if p.readable)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "filename": self.filename,
            "file_hash": self.file_hash,
            "page_count": self.page_count,
            "truncated": self.truncated,
            "pages": [p.to_dict() for p in self.pages]
        }

def compute_file_hash(content_or_path) -> str:
    hasher = hashlib.sha256()
    if isinstance(content_or_path, (str, Path)):
        with open(content_or_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
    else:
        hasher.update(content_or_path)
    return hasher.hexdigest()

def extract_pdf(file_path: Path, filename: Optional[str] = None) -> ExtractedDocument:
    path = Path(file_path)
    if not path.exists():
        raise ExtractionError(f"File not found: {path}", status_code=404)

    # Size check
    file_size_mb = path.stat().st_size / (1024 * 1024)
    if file_size_mb > settings.MAX_UPLOAD_MB:
        raise ExtractionError(f"File size exceeds {settings.MAX_UPLOAD_MB} MB limit ({file_size_mb:.2f} MB)", status_code=400)

    if path.stat().st_size == 0:
        raise ExtractionError("PDF file is empty", status_code=400)

    file_hash = compute_file_hash(path)
    actual_filename = filename or path.name

    try:
        doc = fitz.open(str(path))
    except Exception as e:
        raise ExtractionError("This PDF cannot be opened. The file may be corrupt or encrypted.", status_code=400)

    if doc.is_encrypted:
        try:
            # Attempt empty password decrypt
            if not doc.authenticate(""):
                raise ExtractionError("This PDF cannot be opened because it is password protected.", status_code=400)
        except Exception:
            raise ExtractionError("This PDF cannot be opened because it is password protected.", status_code=400)

    total_pages = len(doc)
    if total_pages == 0:
        raise ExtractionError("PDF has no pages.", status_code=400)

    truncated = False
    process_pages = total_pages
    if total_pages > settings.MAX_PAGES:
        process_pages = settings.MAX_PAGES
        truncated = True

    pages: List[ExtractedPage] = []
    total_extracted_chars = 0

    for idx in range(process_pages):
        page = doc[idx]
        text = page.get_text("text").strip()
        
        # Check if page has almost no text
        if len(text) < 10:
            pages.append(ExtractedPage(page_number=idx + 1, text=text, readable=False))
        else:
            pages.append(ExtractedPage(page_number=idx + 1, text=text, readable=True))
            total_extracted_chars += len(text)

    doc.close()

    # Scanned PDF check
    if total_extracted_chars < 30:
        raise ExtractionError("No readable text found. OCR is not supported in this version.", status_code=400)

    return ExtractedDocument(
        filename=actual_filename,
        file_hash=file_hash,
        page_count=process_pages,
        pages=pages,
        truncated=truncated
    )
