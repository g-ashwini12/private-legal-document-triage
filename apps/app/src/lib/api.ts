import {
  HealthStatus,
  DocumentMetadata,
  DocumentListItem,
  Chunk,
  DocumentAnalysisCards,
  AnswerResponse,
  NodeProgress,
  MetricSummary,
  EvalSuiteResult,
} from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error('Analysis service unreachable');
  return res.json();
}

export async function fetchDocuments(): Promise<DocumentListItem[]> {
  const res = await fetch(`${API_BASE}/api/documents`);
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

export async function uploadDocument(file: File, language: string = 'en') {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/api/documents?language=${encodeURIComponent(language)}`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.reason ||
        errorData.detail?.error ||
        errorData.detail ||
        'Failed to upload PDF'
    );
  }
  return res.json();
}

export async function fetchDocument(documentId: string): Promise<{
  metadata: DocumentMetadata;
  chunks: Chunk[];
  analysis_cards?: DocumentAnalysisCards;
}> {
  const res = await fetch(`${API_BASE}/api/documents/${documentId}`);
  if (!res.ok) throw new Error('Document not found');
  return res.json();
}

export async function fetchDocumentCards(
  documentId: string,
  language: string = 'en'
): Promise<DocumentAnalysisCards> {
  const res = await fetch(
    `${API_BASE}/api/documents/${documentId}/cards?language=${encodeURIComponent(language)}`
  );
  if (!res.ok) throw new Error('Failed to load analysis cards');
  return res.json();
}

export async function deleteDocument(documentId: string) {
  const res = await fetch(`${API_BASE}/api/documents/${documentId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete document');
  return res.json();
}

export function getDocumentPdfUrl(documentId: string): string {
  return `${API_BASE}/api/documents/${documentId}/file`;
}

export async function askQuestionStream(
  documentId: string,
  sessionId: string,
  question: string,
  language: string = 'en',
  onProgress: (p: NodeProgress) => void,
  onFinal: (r: AnswerResponse) => void,
  onError: (err: string) => void
) {
  try {
    const response = await fetch(`${API_BASE}/api/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document_id: documentId,
        session_id: sessionId,
        question: question,
        language: language,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Request failed' }));
      onError(err.detail || 'The analysis service is not running');
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError('Readable stream not supported');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        if (!block.trim()) continue;
        const lines = block.split('\n');
        let event = '';
        let dataStr = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            event = line.replace('event: ', '').trim();
          } else if (line.startsWith('data: ')) {
            dataStr = line.replace('data: ', '').trim();
          }
        }

        if (event === 'node_progress' && dataStr) {
          try {
            const parsed = JSON.parse(dataStr);
            onProgress(parsed);
          } catch (e) {
            console.error('Error parsing progress', e);
          }
        } else if (event === 'final_response' && dataStr) {
          try {
            const parsed = JSON.parse(dataStr);
            onFinal(parsed);
          } catch (e) {
            console.error('Error parsing final response', e);
          }
        } else if (event === 'error' && dataStr) {
          try {
            const parsed = JSON.parse(dataStr);
            onError(parsed.error || 'The analysis service is not running');
          } catch {
            onError('The analysis service is not running');
          }
        }
      }
    }
  } catch (err: any) {
    onError(err.message || 'The analysis service is not running');
  }
}

export async function adminLogin(password: string): Promise<{ status: string; token: string }> {
  const res = await fetch(`${API_BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error('404');
    throw new Error('Incorrect password');
  }
  return res.json();
}

export async function fetchAdminMetrics(token: string): Promise<MetricSummary> {
  const res = await fetch(`${API_BASE}/api/admin/metrics`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error('404');
    throw new Error('Unauthorized');
  }
  return res.json();
}

export async function fetchAdminEvals(token: string): Promise<EvalSuiteResult | null> {
  const res = await fetch(`${API_BASE}/api/admin/evals`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error('404');
    throw new Error('Unauthorized');
  }
  return res.json();
}
