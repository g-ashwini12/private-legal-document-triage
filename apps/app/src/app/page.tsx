'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileText,
  FileCheck,
  Plus,
  Trash2,
  ChevronDown,
  Layers,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  fetchDocuments,
  fetchDocument,
  fetchDocumentCards,
  uploadDocument,
  deleteDocument,
} from '@/lib/api';
import {
  DocumentListItem,
  DocumentMetadata,
  DocumentAnalysisCards,
  Chunk,
} from '@/types';
import { t, LanguageCode } from '@/lib/i18n';
import DocumentViewer from '@/components/DocumentViewer';
import TriageCards from '@/components/TriageCards';
import DocumentChat from '@/components/DocumentChat';

export default function WorkspacePage() {
  const [currentLang, setCurrentLang] = useState<LanguageCode>('en');

  // Documents state
  const [docList, setDocList] = useState<DocumentListItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<DocumentMetadata | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [cards, setCards] = useState<DocumentAnalysisCards | null>(null);

  // UI state
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [showDocDropdown, setShowDocDropdown] = useState(false);
  const [highlightedChunkId, setHighlightedChunkId] = useState<string | null>(null);
  const [externalQuestion, setExternalQuestion] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync language with navbar/localStorage
  useEffect(() => {
    const saved = (localStorage.getItem('app_lang') || 'en') as LanguageCode;
    setCurrentLang(saved);

    const onLangChange = (e: any) => {
      const newLang = e.detail as LanguageCode;
      setCurrentLang(newLang);
    };
    window.addEventListener('app-language-change', onLangChange);
    return () => window.removeEventListener('app-language-change', onLangChange);
  }, []);

  // When language changes, reload cards for current document if selected
  useEffect(() => {
    if (selectedDocId) {
      loadDocument(selectedDocId, currentLang);
    }
  }, [currentLang]);

  // Load document list on initial mount
  useEffect(() => {
    loadDocumentList();
  }, []);

  const loadDocumentList = async () => {
    try {
      const list = await fetchDocuments();
      setDocList(list);
      // If none selected yet and docs exist, load the latest
      if (!selectedDocId && list.length > 0) {
        loadDocument(list[0].document_id, currentLang);
      }
    } catch (e) {
      // Backend not yet reachable or empty
    }
  };

  const loadDocument = async (docId: string, lang: string = 'en') => {
    setErrorMessage(null);
    setIsAnalyzing(true);
    setProgressMsg(t('readingDoc', lang));

    try {
      const doc = await fetchDocument(docId);
      setMetadata(doc.metadata);
      setChunks(doc.chunks);
      setSelectedDocId(docId);

      // Fetch cards in the selected language
      const triageCards = await fetchDocumentCards(docId, lang);
      setCards(triageCards);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(t('serviceUnavailable', lang));
    } finally {
      setIsAnalyzing(false);
      setProgressMsg('');
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Please upload a PDF document.');
      return;
    }

    setErrorMessage(null);
    setIsUploading(true);
    setProgressMsg(t('readingDoc', currentLang));

    try {
      const res = await uploadDocument(file, currentLang);
      const newDocId = res.document_id;
      await loadDocumentList();
      await loadDocument(newDocId, currentLang);
    } catch (err: any) {
      setErrorMessage(err.message || 'The analysis service is not running. Please start Ollama.');
    } finally {
      setIsUploading(false);
      setProgressMsg('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteCurrentDoc = async (docIdToDelete: string) => {
    if (!confirm(t('confirmDelete', currentLang))) return;
    try {
      await deleteDocument(docIdToDelete);
      const updatedList = await fetchDocuments();
      setDocList(updatedList);
      if (updatedList.length > 0) {
        loadDocument(updatedList[0].document_id, currentLang);
      } else {
        setSelectedDocId(null);
        setMetadata(null);
        setChunks([]);
        setCards(null);
        setShowViewer(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCitationClick = (clauseRef?: string, page?: number, chunkId?: string) => {
    setShowViewer(true);
    if (chunkId) {
      setHighlightedChunkId(chunkId);
    } else if (clauseRef) {
      // Find chunk matching clauseRef
      const found = chunks.find((c) => c.clause_number === clauseRef || (page && c.page === page));
      if (found) {
        setHighlightedChunkId(found.chunk_id);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileUpload(f);
        }}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {/* If no document selected and not loading: Clean Upload Hero */}
        {!selectedDocId && !isUploading && !isAnalyzing ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="max-w-xl w-full">
              {/* Drag and Drop Box */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFileUpload(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                className="group relative cursor-pointer border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-400 bg-white dark:bg-slate-900 rounded-3xl p-10 sm:p-14 text-center transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                  <Upload className="w-8 h-8" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {t('uploadTitle', currentLang)}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
                  {t('uploadPrompt', currentLang)}
                </p>

                <div className="mt-6">
                  <span className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors">
                    <FileText className="w-4 h-4" />
                    <span>{t('uploadButton', currentLang)}</span>
                  </span>
                </div>
              </div>

              {/* Privacy Note */}
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 text-center">
                {t('privacyNote', currentLang)}
              </p>

              {/* Error if any */}
              {errorMessage && (
                <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition-colors"
                  >
                    {t('retry', currentLang)}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : isUploading || isAnalyzing ? (
          /* Loading / Analyzing State */
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 animate-bounce">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {progressMsg || t('readingDoc', currentLang)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
              Analyzing clauses, risks, obligations, and deadlines on your local device...
            </p>
          </div>
        ) : (
          /* Document Loaded & Triage Active */
          <div className="flex-1 flex flex-col space-y-6">
            {/* "Your Document" Top Card */}
            {metadata && (
              <div className="no-print rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {metadata.doc_type}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {metadata.page_count} {t('pages', currentLang)} • {chunks.length} {t('clauses', currentLang)}
                      </span>
                    </div>
                    <h1 className="font-bold text-base text-slate-900 dark:text-white truncate mt-0.5">
                      {metadata.filename}
                    </h1>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {/* View Document button */}
                  <button
                    onClick={() => setShowViewer(!showViewer)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-xs transition-colors"
                  >
                    {showViewer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-emerald-600" />}
                    <span>{showViewer ? t('hideDocument', currentLang) : t('viewDocument', currentLang)}</span>
                  </button>

                  {/* Upload another document button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('uploadAnother', currentLang)}</span>
                  </button>

                  {/* My Documents Dropdown */}
                  {docList.length > 1 && (
                    <div className="relative">
                      <button
                        onClick={() => setShowDocDropdown(!showDocDropdown)}
                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center space-x-1"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>{t('myDocuments', currentLang)} ({docList.length})</span>
                        <ChevronDown className="w-3 h-3 ml-0.5" />
                      </button>

                      {showDocDropdown && (
                        <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2 space-y-1">
                          {docList.map((d) => (
                            <div
                              key={d.document_id}
                              className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer ${
                                d.document_id === selectedDocId
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-semibold'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <div
                                onClick={() => {
                                  setShowDocDropdown(false);
                                  loadDocument(d.document_id, currentLang);
                                }}
                                className="min-w-0 flex-1 pr-2 truncate"
                              >
                                <span className="block truncate">{d.filename}</span>
                                <span className="text-[10px] text-slate-400">
                                  {d.page_count} p • {d.doc_type}
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteCurrentDoc(d.document_id);
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                title={t('deleteDocument', currentLang)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Split Screen Layout if Document Viewer is open */}
            <div className={`grid grid-cols-1 ${showViewer ? 'lg:grid-cols-12 gap-6' : ''}`}>
              {/* Triage Cards & Chat Column */}
              <div className={`${showViewer ? 'lg:col-span-7' : 'w-full'} space-y-8`}>
                {cards && (
                  <TriageCards
                    cards={cards}
                    currentLanguage={currentLang}
                    onCitationClick={handleCitationClick}
                    onAskQuestion={(q) => setExternalQuestion(q)}
                  />
                )}

                {/* Plain-Language Chat Below the Cards */}
                {selectedDocId && (
                  <div className="pt-2">
                    <DocumentChat
                      documentId={selectedDocId}
                      suggestedQuestions={cards?.suggested_questions || []}
                      currentLanguage={currentLang}
                      onCitationClick={handleCitationClick}
                      externalQuestion={externalQuestion}
                      onQuestionConsumed={() => setExternalQuestion(null)}
                    />
                  </div>
                )}
              </div>

              {/* Document Viewer Column (When open) */}
              {showViewer && metadata && (
                <div className="lg:col-span-5 h-[850px] sticky top-20 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md">
                  <DocumentViewer
                    metadata={metadata}
                    chunks={chunks}
                    highlightedChunkId={highlightedChunkId}
                    onClose={() => setShowViewer(false)}
                    onClearDocument={() => {
                      loadDocumentList();
                      setSelectedDocId(null);
                      setMetadata(null);
                      setChunks([]);
                      setCards(null);
                      setShowViewer(false);
                    }}
                    currentLanguage={currentLang}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
