'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import GradientASCII from '@/components/GradientASCII';
import ScrollExpand from '@/components/ScrollExpand';
import LineSidebar from '@/components/LineSidebar';

interface NavSection {
  id: string;
  label: string;
  targetId: string;
}

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

  // Sidebar & Accessibility states
  const [activeSidebarIndex, setActiveSidebarIndex] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const clickCooldownRef = useRef<number>(0);
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

  // Sync dark mode & prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkDark = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const motionHandler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', motionHandler);

    return () => {
      observer.disconnect();
      mq.removeEventListener('change', motionHandler);
    };
  }, []);

  // When language changes, reload cards for current document if selected
  useEffect(() => {
    if (selectedDocId) {
      loadDocument(selectedDocId, currentLang);
    }
  }, [currentLang]);

  // Load document list on mount
  useEffect(() => {
    loadDocumentList();
  }, []);

  const loadDocumentList = async () => {
    try {
      const list = await fetchDocuments();
      setDocList(list);
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
      const found = chunks.find((c) => c.clause_number === clauseRef || (page && c.page === page));
      if (found) {
        setHighlightedChunkId(found.chunk_id);
      }
    }
  };

  // Build real sidebar items in strict order
  const navSections: NavSection[] = useMemo(() => {
    if (!cards) return [];
    const items: NavSection[] = [];

    if (cards.overview) {
      items.push({ id: 'overview', label: t('overview', currentLang), targetId: 'section-overview' });
    }
    if (cards.key_details && cards.key_details.length > 0) {
      items.push({ id: 'key-details', label: t('cardKeyDetailsTitle', currentLang), targetId: 'section-key-details' });
    }
    if (cards.watch_out_risks && cards.watch_out_risks.length > 0) {
      items.push({ id: 'risks', label: t('cardWatchOutTitle', currentLang), targetId: 'section-risks' });
    }
    if (cards.what_you_must_do && cards.what_you_must_do.length > 0) {
      items.push({ id: 'obligations', label: t('cardObligationsTitle', currentLang), targetId: 'section-obligations' });
    }
    if (cards.important_dates && cards.important_dates.length > 0) {
      items.push({ id: 'dates', label: t('cardDatesTitle', currentLang), targetId: 'section-dates' });
    }
    if (cards.lawyer_advice && cards.lawyer_advice.should_see_lawyer) {
      items.push({ id: 'lawyer', label: t('talkToLawyer', currentLang), targetId: 'section-lawyer' });
    }
    // "Ask a question" and "Original document" always appear
    items.push({ id: 'chat', label: t('askQuestion', currentLang), targetId: 'section-chat' });
    items.push({ id: 'viewer', label: t('originalDocument', currentLang), targetId: 'section-viewer' });

    return items;
  }, [cards, currentLang]);

  // Click handler for sidebar items
  const handleSidebarClick = (index: number, _label: string) => {
    setActiveSidebarIndex(index);
    clickCooldownRef.current = Date.now() + 800;

    const target = navSections[index];
    if (!target) return;

    if (target.id === 'viewer') {
      setShowViewer(true);
      setTimeout(() => {
        const el = document.getElementById('section-viewer');
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top, behavior: 'smooth' });
          el.focus();
          el.classList.add('ring-2', 'ring-emerald-500', 'ring-offset-2');
          setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-500', 'ring-offset-2'), 1200);
        }
      }, 100);
      return;
    }

    if (target.id === 'chat') {
      const el = document.getElementById('section-chat');
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: 'smooth' });
        const inputEl = document.getElementById('document-chat-input');
        inputEl?.focus();
        el.classList.add('ring-2', 'ring-emerald-500', 'ring-offset-2');
        setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-500', 'ring-offset-2'), 1200);
      }
      return;
    }

    const el = document.getElementById(target.targetId);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });
      el.focus();
      el.classList.add('ring-2', 'ring-emerald-500', 'ring-offset-2');
      setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-500', 'ring-offset-2'), 1200);
    }
  };

  // Scroll-spy with IntersectionObserver
  useEffect(() => {
    if (!selectedDocId || !cards || navSections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < clickCooldownRef.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = navSections.findIndex((it) => it.targetId === entry.target.id);
            if (idx !== -1) {
              setActiveSidebarIndex(idx);
              break;
            }
          }
        }
      },
      {
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0.1,
      }
    );

    navSections.forEach((it) => {
      const el = document.getElementById(it.targetId);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [selectedDocId, cards, currentLang, navSections]);

  const handleStartScroll = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.scrollTo({
      top: window.innerHeight * 1.05,
      behavior: 'smooth',
    });
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

      {/* 1. HERO STATE (When no document is selected and not loading) */}
      {!selectedDocId && !isUploading && !isAnalyzing ? (
        <div
          className="w-full flex flex-col"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) handleFileUpload(f);
          }}
        >
          <ScrollExpand
            useWindowScroll
            backgroundNode={
              <div className="absolute inset-0 w-full h-full bg-slate-950">
                <GradientASCII
                  colors={['#3bb68d', '#3bb68d', '#c2e78b', '#3bb68d']}
                  shape="horizon"
                  characters=" ░▒▓█"
                  cellSize={13}
                  density={0.8}
                  glyphOpacity={0.35}
                  glow={0.55}
                  depthOfField={0}
                  flicker={0.03}
                  softness={0.5}
                  scale={1.2}
                  flow={0.5}
                  speed={1}
                  gradientOpacity={0.9}
                  grain={0.08}
                  variation={0}
                  mouseInteraction
                  scrambleRadius={0.1}
                  clickEffect="wave"
                  intro
                  lightMode={false}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950 pointer-events-none" />
              </div>
            }
            title={
              <div className="flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl bg-slate-900/85 backdrop-blur-xl border border-slate-700/60 shadow-2xl max-w-sm sm:max-w-md mx-auto text-center pointer-events-auto">
                <img
                  src="/logo-icon.png"
                  alt="Logo"
                  className="w-16 h-16 sm:w-20 sm:h-20 mb-3 rounded-2xl drop-shadow-lg object-contain"
                />
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {t('appName', currentLang)}
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-2 font-medium">
                  {t('logoLine', currentLang)}
                </p>
                <button
                  onClick={handleStartScroll}
                  className="mt-6 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 cursor-pointer"
                >
                  {t('start', currentLang)}
                </button>
              </div>
            }
            scrollHint={t('scrollToBegin', currentLang)}
            startWidth={42}
            startHeight={58}
            startRadius={24}
            endRadius={0}
            mediaZoom={1.15}
            scrollDistance={1.0}
            holdDistance={0.35}
            smoothing={0.1}
            overlayScrim={0.2}
            enabled={!prefersReducedMotion}
          >
            {/* Real Upload Card fading in on full-screen green mosaic */}
            <div className="relative z-10 w-full max-w-xl p-4 sm:p-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group relative cursor-pointer border-2 border-dashed border-emerald-400/40 hover:border-emerald-400 bg-slate-900/80 backdrop-blur-md rounded-3xl p-8 sm:p-12 text-center transition-all duration-300 shadow-2xl hover:scale-[1.01]"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner border border-emerald-500/30">
                  <Upload className="w-8 h-8" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {t('uploadTitle', currentLang)}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-md mx-auto">
                  {t('uploadPrompt', currentLang)}
                </p>

                <div className="mt-6">
                  <span className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg transition-all hover:shadow-emerald-500/30">
                    <FileText className="w-4 h-4" />
                    <span>{t('uploadButton', currentLang)}</span>
                  </span>
                </div>
              </div>

              {/* Privacy Note */}
              <p className="text-xs text-slate-300 mt-4 text-center font-medium drop-shadow-sm">
                {t('privacyNote', currentLang)}
              </p>

              {/* Error if any */}
              {errorMessage && (
                <div className="mt-4 p-3 rounded-xl bg-rose-950/80 backdrop-blur-md border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
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
          </ScrollExpand>

          {/* Footer Line Under Hero */}
          <footer className="py-6 text-center text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
            {t('privacyNote', currentLang)}
          </footer>
        </div>
      ) : isUploading || isAnalyzing ? (
        /* 2. LOADING / ANALYZING STATE (With Sidebar Skeleton) */
        <div className="pt-20 flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row gap-8">
          {/* Skeleton in sidebar */}
          <div className="w-56 shrink-0 hidden md:block">
            <div className="sticky top-24 p-4 space-y-5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="flex items-center space-x-3 animate-pulse">
                  <div className="w-8 h-0.5 bg-slate-300 dark:bg-slate-700 rounded" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28" />
                </div>
              ))}
            </div>
          </div>

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
        </div>
      ) : (
        /* 3. DOCUMENT LOADED & TRIAGE WORKSPACE (With LineSidebar) */
        <div className="pt-20 flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col space-y-6">
          {/* Top Document Card */}
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
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {showViewer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-emerald-600" />}
                  <span>{showViewer ? t('hideDocument', currentLang) : t('viewDocument', currentLang)}</span>
                </button>

                {/* Upload another document button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('uploadAnother', currentLang)}</span>
                </button>

                {/* My Documents Dropdown */}
                {docList.length > 1 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowDocDropdown(!showDocDropdown)}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center space-x-1 cursor-pointer"
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

          {/* Mobile Horizontal Scrollable Chip Bar */}
          {navSections.length > 0 && (
            <div className="md:hidden sticky top-16 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 -mx-4 px-4 py-2 flex items-center space-x-2 overflow-x-auto no-scrollbar shadow-xs">
              {navSections.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => handleSidebarClick(idx, item.label)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
                    activeSidebarIndex === idx
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="opacity-70 mr-1 text-[10px] font-mono">{String(idx + 1).padStart(2, '0')}</span>
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Main Content Area with Desktop Sticky LineSidebar */}
          <div className="flex items-start gap-8">
            {/* Desktop Sticky Left Column (~220px) */}
            {navSections.length > 0 && (
              <aside className="w-56 shrink-0 hidden md:block">
                <div className="sticky top-24">
                  <LineSidebar
                    items={navSections.map((s) => s.label)}
                    activeIndex={activeSidebarIndex}
                    onItemClick={handleSidebarClick}
                    accentColor={isDarkMode ? '#34d399' : '#059669'}
                    textColor={isDarkMode ? '#94a3b8' : '#64748b'}
                    markerColor={isDarkMode ? '#334155' : '#cbd5e1'}
                    showIndex
                    showMarker
                    scaleTick
                    maxShift={24}
                    proximityRadius={90}
                    itemGap={18}
                  />
                </div>
              </aside>
            )}

            {/* Right Column: Triage Cards, Chat & Document Viewer */}
            <main className="flex-1 min-w-0">
              <div className={`grid grid-cols-1 ${showViewer ? 'lg:grid-cols-12 gap-6' : ''}`}>
                {/* Triage Cards & Chat */}
                <div className={`${showViewer ? 'lg:col-span-7' : 'w-full'} space-y-8 min-w-0`}>
                  {cards && (
                    <TriageCards
                      cards={cards}
                      currentLanguage={currentLang}
                      onCitationClick={handleCitationClick}
                      onAskQuestion={(q) => setExternalQuestion(q)}
                    />
                  )}

                  {/* Chat Section */}
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

                {/* Document Viewer (When open) */}
                {showViewer && metadata && (
                  <div
                    id="section-viewer"
                    tabIndex={-1}
                    className="scroll-mt-24 lg:col-span-5 h-[850px] sticky top-20 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md focus:outline-none transition-shadow"
                  >
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
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
