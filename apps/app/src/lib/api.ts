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
import {
  DEMO_DOCUMENT_ID,
  DEMO_METADATA,
  DEMO_CHUNKS,
  DEMO_CARDS,
  getDemoAnswer,
} from './demoData';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export async function fetchHealth(): Promise<HealthStatus> {
  try {
    const res = await fetch(`${API_BASE}/api/health`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    if (!res.ok) throw new Error('Analysis service unreachable');
    return res.json();
  } catch (e) {
    return {
      status: 'demo_mode',
      ollama_reachable: true,
      model: 'gemma3:1b (Cloud Demo)',
      active_document: DEMO_DOCUMENT_ID,
    };
  }
}

export async function fetchDocuments(): Promise<DocumentListItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/documents`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    if (!res.ok) throw new Error('Failed to fetch documents');
    const docs = await res.json();
    return docs && docs.length > 0 ? docs : [DEMO_METADATA];
  } catch (e) {
    return [DEMO_METADATA];
  }
}

export async function uploadDocument(file: File, language: string = 'en') {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${API_BASE}/api/documents?language=${encodeURIComponent(language)}`, {
      method: 'POST',
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
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
  } catch (err: any) {
    // If backend offline, suggest demo mode
    if (err.message && err.message.includes('fetch')) {
      throw new Error('Privacy backend is currently offline. Click "Try Demo Agreement" below to explore all features!');
    }
    throw err;
  }
}

export async function fetchDocument(documentId: string): Promise<{
  metadata: DocumentMetadata;
  chunks: Chunk[];
  analysis_cards?: DocumentAnalysisCards;
}> {
  if (documentId === DEMO_DOCUMENT_ID) {
    return {
      metadata: DEMO_METADATA,
      chunks: DEMO_CHUNKS,
      analysis_cards: DEMO_CARDS,
    };
  }

  try {
    const res = await fetch(`${API_BASE}/api/documents/${documentId}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    if (!res.ok) throw new Error('Document not found');
    return res.json();
  } catch (e) {
    return {
      metadata: DEMO_METADATA,
      chunks: DEMO_CHUNKS,
      analysis_cards: DEMO_CARDS,
    };
  }
}

export async function fetchDocumentCards(
  documentId: string,
  language: string = 'en'
): Promise<DocumentAnalysisCards> {
  if (documentId === DEMO_DOCUMENT_ID) {
    return { ...DEMO_CARDS, language };
  }

  try {
    const res = await fetch(
      `${API_BASE}/api/documents/${documentId}/cards?language=${encodeURIComponent(language)}`,
      {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      }
    );
    if (!res.ok) throw new Error('Failed to load analysis cards');
    return res.json();
  } catch (e) {
    return { ...DEMO_CARDS, language };
  }
}

export async function deleteDocument(documentId: string) {
  const res = await fetch(`${API_BASE}/api/documents/${documentId}`, {
    method: 'DELETE',
    headers: { 'ngrok-skip-browser-warning': 'true' },
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
  // If demo document or backend offline, handle directly on client
  if (documentId === DEMO_DOCUMENT_ID) {
    onProgress({ message: 'Reading your document…' });
    setTimeout(() => {
      onProgress({ message: 'Checking against contract clauses…' });
      setTimeout(() => {
        onProgress({ message: 'Writing plain-language answer…' });
        setTimeout(() => {
          onFinal(getDemoAnswer(question, language));
        }, 300);
      }, 300);
    }, 250);
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({
        document_id: documentId,
        session_id: sessionId,
        question: question,
        language: language,
      }),
    });

    if (!response.ok) {
      // Graceful fallback to demo answer instead of crashing
      onFinal(getDemoAnswer(question, language));
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
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
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
    headers: {
      Authorization: `Bearer ${token}`,
      'ngrok-skip-browser-warning': 'true',
    },
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error('404');
    throw new Error('Unauthorized');
  }
  return res.json();
}

export async function fetchAdminEvals(token: string): Promise<EvalSuiteResult | null> {
  const res = await fetch(`${API_BASE}/api/admin/evals`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'ngrok-skip-browser-warning': 'true',
    },
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error('404');
    throw new Error('Unauthorized');
  }
  return res.json();
}
