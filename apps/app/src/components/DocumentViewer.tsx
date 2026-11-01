'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
} from 'lucide-react';
import { Chunk, DocumentMetadata } from '@/types';
import { deleteDocument, getDocumentPdfUrl } from '@/lib/api';
import { t } from '@/lib/i18n';

interface DocumentViewerProps {
  metadata: DocumentMetadata | null;
  chunks: Chunk[];
  highlightedChunkId: string | null;
  onClose?: () => void;
  onClearDocument: () => void;
  currentLanguage?: string;
}

export default function DocumentViewer({
  metadata,
  chunks,
  highlightedChunkId,
  onClose,
  onClearDocument,
  currentLanguage = 'en',
}: DocumentViewerProps) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'clauses' | 'pdf'>('clauses');
  const [deleting, setDeleting] = useState(false);

  // Navigate to chunk page on highlight
  useEffect(() => {
    if (highlightedChunkId) {
      const target = chunks.find((c) => c.chunk_id === highlightedChunkId);
      if (target) {
        setCurrentPage(target.page);
        setViewMode('clauses');
        setTimeout(() => {
          const el = document.getElementById(`chunk-${highlightedChunkId}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [highlightedChunkId, chunks]);

  if (!metadata) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/50">
        <FileText className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" />
        <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
          No Document Selected
        </h3>
      </div>
    );
  }

  const totalPages = metadata.page_count;
  const pageChunks = chunks.filter((c) => c.page === currentPage);
  const filteredChunks = searchQuery
    ? pageChunks.filter(
        (c) =>
          c.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.heading && c.heading.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : pageChunks;

  const handleDelete = async () => {
    if (!confirm(t('confirmDelete', currentLanguage))) return;
    setDeleting(true);
    try {
      await deleteDocument(metadata.document_id);
      onClearDocument();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const pdfUrl = getDocumentPdfUrl(metadata.document_id);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-xl">
      {/* Header bar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="min-w-0 pr-2">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              {metadata.doc_type}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {metadata.page_count} {t('pages', currentLanguage)} • {chunks.length} {t('clauses', currentLanguage)}
            </span>
          </div>
          <h2 className="font-bold text-sm text-slate-900 dark:text-white truncate mt-1">
            {metadata.filename}
          </h2>
        </div>

        <div className="flex items-center space-x-1.5">
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 text-xs bg-slate-50 dark:bg-slate-800">
            <button
              onClick={() => setViewMode('clauses')}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'clauses'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t('textMode', currentLanguage)}
            </button>
            <button
              onClick={() => setViewMode('pdf')}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'pdf'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t('pdfMode', currentLanguage)}
            </button>
          </div>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            title={t('deleteDocument', currentLanguage)}
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={t('hideDocument', currentLanguage)}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {viewMode === 'pdf' ? (
        <div className="flex-1 w-full h-full bg-slate-100 dark:bg-slate-950">
          <iframe
            src={`${pdfUrl}#page=${currentPage}`}
            className="w-full h-full border-none"
            title="PDF Document"
          />
        </div>
      ) : (
        <>
          {/* Page Navigation & Search */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40 text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 px-2">
                {t('page', currentLanguage)} {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40 text-slate-600 dark:text-slate-300"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="relative flex-1 max-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-400" />
              <input
                type="text"
                placeholder={t('searchPlaceholder', currentLanguage)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Clause Content Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredChunks.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                {t('noClausesMatch', currentLanguage)}
              </div>
            ) : (
              filteredChunks.map((chunk) => {
                const isHighlighted = highlightedChunkId === chunk.chunk_id;
                return (
                  <div
                    key={chunk.chunk_id}
                    id={`chunk-${chunk.chunk_id}`}
                    className={`p-3.5 rounded-xl border transition-all duration-300 ${
                      isHighlighted
                        ? 'border-emerald-500 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/30 shadow-md'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] flex items-center justify-center">
                          {chunk.clause_number || '§'}
                        </span>
                        <h4 className="font-semibold text-xs text-slate-900 dark:text-white">
                          {chunk.heading || `${t('clause', currentLanguage)} ${chunk.clause_number || ''}`}
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                        {t('page', currentLanguage)} {chunk.page}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                      {chunk.text}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
