'use client';

import React, { useState } from 'react';
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Scale,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Languages,
  Printer,
  ChevronRight,
  ExternalLink,
  Layers,
  Users,
  Clock,
  Coins,
  Sparkles,
  CalendarPlus,
} from 'lucide-react';
import {
  DocumentAnalysisCards,
  DocumentOverview,
  KeyDetailItem,
  WatchOutItem,
  ObligationItem,
  SimpleDeadlineItem,
  LawyerAdvice,
} from '@/types';
import { t, formatCitation } from '@/lib/i18n';
import { speakLocalText, stopSpeaking } from '@/lib/speech';
import AnimatedContent from '@/components/AnimatedContent';
import FairnessScoreCard from '@/components/FairnessScoreCard';
import CounterOfferModal from '@/components/CounterOfferModal';
import { exportDeadlinesToICS, getGoogleCalendarLink } from '@/lib/calendar';

interface TriageCardsProps {
  cards: DocumentAnalysisCards;
  currentLanguage: string;
  onCitationClick: (clauseRef?: string, page?: number) => void;
  onAskQuestion?: (q: string) => void;
}

export default function TriageCards({
  cards,
  currentLanguage,
  onCitationClick,
  onAskQuestion,
}: TriageCardsProps) {
  // English toggle states per card
  const [showEnSummary, setShowEnSummary] = useState(false);
  const [showEnDetails, setShowEnDetails] = useState(false);
  const [showEnRisks, setShowEnRisks] = useState(false);
  const [showEnObligations, setShowEnObligations] = useState(false);
  const [showEnDates, setShowEnDates] = useState(false);
  const [showEnLawyer, setShowEnLawyer] = useState(false);

  // Copy feedback states
  const [copiedCard, setCopiedCard] = useState<string | null>(null);

  // Counter-offer modal state
  const [selectedRiskForCounter, setSelectedRiskForCounter] = useState<WatchOutItem | null>(null);
  const [isCounterModalOpen, setIsCounterModalOpen] = useState(false);
  const [calendarDownloaded, setCalendarDownloaded] = useState(false);

  // Audio speech states
  const [speakingCard, setSpeakingCard] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const handleCopy = (cardKey: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCard(cardKey);
    setTimeout(() => setCopiedCard(null), 2000);
  };

  const handleSpeak = (cardKey: string, text: string, forceEn: boolean) => {
    if (speakingCard === cardKey) {
      stopSpeaking();
      setSpeakingCard(null);
      return;
    }

    setSpeechError(null);
    setSpeakingCard(cardKey);

    const lang = forceEn ? 'en' : currentLanguage;
    const ok = speakLocalText(
      text,
      lang,
      () => setSpeakingCard(null),
      (err) => {
        setSpeechError(err);
        setSpeakingCard(null);
        setTimeout(() => setSpeechError(null), 4000);
      }
    );

    if (!ok) {
      setSpeakingCard(null);
    }
  };

  const handleDownloadSummary = () => {
    window.print();
  };

  const isNonEnglish = currentLanguage !== 'en';

  return (
    <div className="space-y-6">
      {/* Toast alert for speech error */}
      {speechError && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between shadow-sm">
          <span>{speechError}</span>
          <button
            onClick={() => setSpeechError(null)}
            className="text-amber-600 dark:text-amber-400 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Top action row */}
      <div className="flex items-center justify-between no-print pt-2 pb-1">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('documentTriageTitle', currentLanguage)}
        </h2>
        <button
          onClick={handleDownloadSummary}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5 text-emerald-600" />
          <span>{t('downloadSummary', currentLanguage)}</span>
        </button>
      </div>

      {/* Contract Fairness & Risk Meter + Pre-Signing Action Checklist */}
      <AnimatedContent distance={40} direction="vertical" duration={0.65} ease="power3.out" threshold={0.1}>
        <FairnessScoreCard cards={cards} currentLanguage={currentLanguage} />
      </AnimatedContent>

      {/* 0. Overview Card (rendered only if cards.overview exists) */}
      {cards.overview && (
        <AnimatedContent distance={60} direction="vertical" duration={0.8} ease="power3.out" threshold={0.1}>
          <div
            id="section-overview"
            tabIndex={-1}
            className="scroll-mt-24 triage-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition-shadow focus:outline-none"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {t('overview', currentLanguage)}
                </h3>
                {cards.overview.document_type && (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                    {cards.overview.document_type}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-1 no-print">
                <button
                  onClick={() => {
                    const ov = cards.overview!;
                    const text = `${ov.document_type}. ${ov.purpose}. Parties: ${ov.parties.join(', ')}. Period: ${ov.period || 'N/A'}. Amounts: ${ov.main_amounts.map((a) => `${a.label} ${a.value}`).join(', ')}`;
                    handleSpeak('overview', text, false);
                  }}
                  aria-label="Listen"
                  className="p-1.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                  title={speakingCard === 'overview' ? t('stopListening', currentLanguage) : t('listen', currentLanguage)}
                >
                  {speakingCard === 'overview' ? (
                    <VolumeX className="w-4 h-4 text-emerald-600 animate-pulse" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => {
                    const ov = cards.overview!;
                    const text = `${ov.document_type}\n${ov.purpose}\nParties: ${ov.parties.join(', ')}\nPeriod: ${ov.period || 'N/A'}\nAmounts:\n${ov.main_amounts.map((a) => `- ${a.label}: ${a.value}`).join('\n')}`;
                    handleCopy('overview', text);
                  }}
                  aria-label="Copy"
                  className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title={copiedCard === 'overview' ? t('copied', currentLanguage) : t('copy', currentLanguage)}
                >
                  {copiedCard === 'overview' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Purpose sentence */}
            {cards.overview.purpose && (
              <p className="text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed mb-4">
                {cards.overview.purpose}
              </p>
            )}

            {/* Details grid with staggered box animation */}
            <AnimatedContent
              distance={40}
              direction="vertical"
              duration={0.65}
              ease="power3.out"
              stagger={0.08}
              threshold={0.1}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1"
            >
              {/* Parties */}
              {cards.overview.parties && cards.overview.parties.length > 0 && (
                <div className="triage-box p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 mb-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {t('parties', currentLanguage)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {cards.overview.parties.map((party, pIdx) => (
                      <p key={pIdx} className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {party}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Period */}
              {cards.overview.period && (
                <div className="triage-box p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 mb-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {t('period', currentLanguage)}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {cards.overview.period}
                  </p>
                </div>
              )}

              {/* Main Amounts */}
              {cards.overview.main_amounts && cards.overview.main_amounts.length > 0 && (
                <div className="triage-box p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 mb-1.5">
                    <Coins className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {t('mainAmounts', currentLanguage)}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {cards.overview.main_amounts.map((amt, aIdx) => (
                      <div key={aIdx} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-400">{amt.label}:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{amt.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </AnimatedContent>

            {/* Citations */}
            {cards.overview.citations && cards.overview.citations.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase font-semibold text-slate-400">
                  {t('clause', currentLanguage)}:
                </span>
                {cards.overview.citations.map((c, cIdx) => (
                  <button
                    key={cIdx}
                    onClick={() => onCitationClick(c)}
                    className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        </AnimatedContent>
      )}

      {/* 1. Summary Card */}
      <AnimatedContent distance={60} direction="vertical" duration={0.8} ease="power3.out" threshold={0.1}>
        <div id="section-summary" tabIndex={-1} className="scroll-mt-24 triage-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition-shadow focus:outline-none">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {t('cardSummaryTitle', currentLanguage)}
              </h3>
            </div>

            <div className="flex items-center space-x-1 no-print">
              {isNonEnglish && (
                <button
                  onClick={() => setShowEnSummary(!showEnSummary)}
                  className="px-2 py-1 rounded text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {showEnSummary ? t('showInOriginal', currentLanguage) : t('showInEnglish', currentLanguage)}
                </button>
              )}
              <button
                onClick={() =>
                  handleSpeak(
                    'summary',
                    showEnSummary && cards.summary_en ? cards.summary_en : cards.summary,
                    showEnSummary
                  )
                }
                aria-label="Listen"
                className="p-1.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                title={speakingCard === 'summary' ? t('stopListening', currentLanguage) : t('listen', currentLanguage)}
              >
                {speakingCard === 'summary' ? (
                  <VolumeX className="w-4 h-4 text-emerald-600 animate-pulse" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() =>
                  handleCopy(
                    'summary',
                    showEnSummary && cards.summary_en ? cards.summary_en : cards.summary
                  )
                }
                aria-label="Copy"
                className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={copiedCard === 'summary' ? t('copied', currentLanguage) : t('copy', currentLanguage)}
              >
                {copiedCard === 'summary' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {showEnSummary && cards.summary_en ? cards.summary_en : cards.summary}
          </p>
        </div>
      </AnimatedContent>

      {/* 2. Key Details Card */}
      {cards.key_details && cards.key_details.length > 0 && (
        <AnimatedContent distance={60} direction="vertical" duration={0.8} ease="power3.out" threshold={0.1}>
          <div id="section-key-details" tabIndex={-1} className="scroll-mt-24 triage-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition-shadow focus:outline-none">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {t('cardKeyDetailsTitle', currentLanguage)}
                </h3>
              </div>

              <div className="flex items-center space-x-1 no-print">
                <button
                  onClick={() => {
                    const text = cards.key_details.map((k) => `${k.category} - ${k.label}: ${k.value}`).join('\n');
                    handleSpeak('details', text, false);
                  }}
                  aria-label="Listen"
                  className="p-1.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                  title={t('listen', currentLanguage)}
                >
                  {speakingCard === 'details' ? (
                    <VolumeX className="w-4 h-4 text-emerald-600 animate-pulse" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => {
                    const text = cards.key_details.map((k) => `${k.category} - ${k.label}: ${k.value}`).join('\n');
                    handleCopy('details', text);
                  }}
                  aria-label="Copy"
                  className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title={copiedCard === 'details' ? t('copied', currentLanguage) : t('copy', currentLanguage)}
                >
                  {copiedCard === 'details' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <AnimatedContent
              distance={50}
              direction="vertical"
              duration={0.65}
              ease="power3.out"
              stagger={0.08}
              threshold={0.1}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {cards.key_details.map((detail, idx) => (
                <div
                  key={idx}
                  className="triage-box p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {detail.category}
                    </span>
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {detail.label}
                    </h4>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                      {detail.value}
                    </p>
                  </div>

                  {detail.clause_ref && (
                    <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/50 flex items-center justify-between">
                      <button
                        onClick={() => onCitationClick(detail.clause_ref, detail.page)}
                        className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        <span>{formatCitation(detail.clause_ref, detail.page, currentLanguage)}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </AnimatedContent>
          </div>
        </AnimatedContent>
      )}

      {/* 3. Watch Out For Card (Risks sorted High first) */}
      {cards.watch_out_risks && cards.watch_out_risks.length > 0 && (
        <AnimatedContent distance={60} direction="vertical" duration={0.8} ease="power3.out" threshold={0.1}>
          <div id="section-risks" tabIndex={-1} className="scroll-mt-24 triage-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition-shadow focus:outline-none">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {t('cardWatchOutTitle', currentLanguage)}
                </h3>
              </div>

              <div className="flex items-center space-x-1 no-print">
                {isNonEnglish && (
                  <button
                    onClick={() => setShowEnRisks(!showEnRisks)}
                    className="px-2 py-1 rounded text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {showEnRisks ? t('showInOriginal', currentLanguage) : t('showInEnglish', currentLanguage)}
                  </button>
                )}
                <button
                  onClick={() => {
                    const text = cards.watch_out_risks.map((r) => `${r.level} risk: ${r.headline}. ${r.explanation}`).join('\n');
                    handleSpeak('risks', text, showEnRisks);
                  }}
                  aria-label="Listen"
                  className="p-1.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                  title={t('listen', currentLanguage)}
                >
                  {speakingCard === 'risks' ? (
                    <VolumeX className="w-4 h-4 text-emerald-600 animate-pulse" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => {
                    const text = cards.watch_out_risks.map((r) => `${r.level} risk: ${r.headline}. ${r.explanation}`).join('\n');
                    handleCopy('risks', text);
                  }}
                  aria-label="Copy"
                  className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title={copiedCard === 'risks' ? t('copied', currentLanguage) : t('copy', currentLanguage)}
                >
                  {copiedCard === 'risks' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <AnimatedContent
              distance={50}
              direction="vertical"
              duration={0.65}
              ease="power3.out"
              stagger={0.08}
              threshold={0.1}
              className="space-y-3"
            >
              {cards.watch_out_risks.map((risk, idx) => {
                const isHigh = risk.level === 'High';
                const isMedium = risk.level === 'Medium';
                const headline = showEnRisks && risk.headline_en ? risk.headline_en : risk.headline;
                const explanation = showEnRisks && risk.explanation_en ? risk.explanation_en : risk.explanation;
                const suggested = showEnRisks && risk.suggested_question_en ? risk.suggested_question_en : risk.suggested_question;

                return (
                  <div
                    key={idx}
                    className={`triage-box p-3.5 rounded-xl border ${
                      isHigh
                        ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20'
                        : isMedium
                        ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            isHigh
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'
                              : isMedium
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                              : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {risk.level === 'High' ? t('highRisk', currentLanguage) : risk.level === 'Medium' ? t('mediumRisk', currentLanguage) : t('lowRisk', currentLanguage)}
                        </span>
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                          {headline}
                        </h4>
                      </div>

                      <button
                        onClick={() => onCitationClick(risk.clause_ref, risk.page)}
                        className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 hover:underline flex items-center space-x-0.5"
                      >
                        <span>{formatCitation(risk.clause_ref, risk.page, currentLanguage)}</span>
                      </button>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mt-1">
                      {explanation}
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-slate-200/50 dark:border-slate-700/40 flex flex-wrap items-center justify-between gap-2 no-print">
                      {suggested && onAskQuestion ? (
                        <button
                          onClick={() => onAskQuestion(suggested)}
                          className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 flex items-center space-x-1 cursor-pointer"
                        >
                          <span>💡 {t('questionsToAsk', currentLanguage)} {suggested}</span>
                          <ChevronRight className="w-3 h-3 ml-0.5" />
                        </button>
                      ) : <div />}

                      <button
                        onClick={() => {
                          setSelectedRiskForCounter(risk);
                          setIsCounterModalOpen(true);
                        }}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-700/50 text-[11px] font-bold transition-all hover:scale-[1.02] cursor-pointer shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{t('draftCounterOffer', currentLanguage)}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </AnimatedContent>
          </div>
        </AnimatedContent>
      )}

      {/* 4. What You Must Do Card (Obligations) */}
      {cards.what_you_must_do && cards.what_you_must_do.length > 0 && (
        <AnimatedContent distance={60} direction="vertical" duration={0.8} ease="power3.out" threshold={0.1}>
          <div id="section-obligations" tabIndex={-1} className="scroll-mt-24 triage-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition-shadow focus:outline-none">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {t('cardObligationsTitle', currentLanguage)}
                </h3>
              </div>

              <div className="flex items-center space-x-1 no-print">
                {isNonEnglish && (
                  <button
                    onClick={() => setShowEnObligations(!showEnObligations)}
                    className="px-2 py-1 rounded text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {showEnObligations ? t('showInOriginal', currentLanguage) : t('showInEnglish', currentLanguage)}
                  </button>
                )}
                <button
                  onClick={() => {
                    const text = cards.what_you_must_do.map((o) => `${o.who}: ${o.action}`).join('\n');
                    handleSpeak('obligations', text, showEnObligations);
                  }}
                  aria-label="Listen"
                  className="p-1.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                  title={t('listen', currentLanguage)}
                >
                  {speakingCard === 'obligations' ? (
                    <VolumeX className="w-4 h-4 text-emerald-600 animate-pulse" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => {
                    const text = cards.what_you_must_do.map((o) => `${o.who}: ${o.action}`).join('\n');
                    handleCopy('obligations', text);
                  }}
                  aria-label="Copy"
                  className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title={copiedCard === 'obligations' ? t('copied', currentLanguage) : t('copy', currentLanguage)}
                >
                  {copiedCard === 'obligations' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <AnimatedContent
              distance={50}
              direction="vertical"
              duration={0.65}
              ease="power3.out"
              stagger={0.08}
              threshold={0.1}
              className="space-y-2.5"
            >
              {cards.what_you_must_do.map((item, idx) => {
                const actionText = showEnObligations && item.action_en ? item.action_en : item.action;
                return (
                  <div
                    key={idx}
                    className="triage-box p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-3"
                  >
                    <div className="flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {item.who}
                      </span>
                      <p className="text-xs text-slate-800 dark:text-slate-200 mt-0.5 leading-relaxed">
                        {actionText}
                      </p>
                    </div>

                    <button
                      onClick={() => onCitationClick(item.clause_ref, item.page)}
                      className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                    >
                      {formatCitation(item.clause_ref, item.page, currentLanguage)}
                    </button>
                  </div>
                );
              })}
            </AnimatedContent>
          </div>
        </AnimatedContent>
      )}

      {/* 5. Important Dates Card (Timeline sorted) */}
      {cards.important_dates && cards.important_dates.length > 0 && (
        <AnimatedContent distance={60} direction="vertical" duration={0.8} ease="power3.out" threshold={0.1}>
          <div id="section-dates" tabIndex={-1} className="scroll-mt-24 triage-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition-shadow focus:outline-none">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {t('cardDatesTitle', currentLanguage)}
                </h3>
              </div>

              <div className="flex items-center space-x-1 no-print">
                {isNonEnglish && (
                  <button
                    onClick={() => setShowEnDates(!showEnDates)}
                    className="px-2 py-1 rounded text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {showEnDates ? t('showInOriginal', currentLanguage) : t('showInEnglish', currentLanguage)}
                  </button>
                )}
                <button
                  onClick={() => {
                    const text = cards.important_dates.map((d) => `${d.date_display}: ${d.event}`).join('\n');
                    handleSpeak('dates', text, showEnDates);
                  }}
                  aria-label="Listen"
                  className="p-1.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                  title={t('listen', currentLanguage)}
                >
                  {speakingCard === 'dates' ? (
                    <VolumeX className="w-4 h-4 text-emerald-600 animate-pulse" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => {
                    exportDeadlinesToICS(cards.important_dates, cards.overview?.document_type || 'Legal_Agreement');
                    setCalendarDownloaded(true);
                    setTimeout(() => setCalendarDownloaded(false), 2500);
                  }}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer shadow-xs"
                  title="Download .ics calendar file"
                >
                  {calendarDownloaded ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{t('calendarExported', currentLanguage)}</span>
                    </>
                  ) : (
                    <>
                      <CalendarPlus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{t('exportCalendar', currentLanguage)}</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    const text = cards.important_dates.map((d) => `${d.date_display}: ${d.event}`).join('\n');
                    handleCopy('dates', text);
                  }}
                  aria-label="Copy"
                  className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title={copiedCard === 'dates' ? t('copied', currentLanguage) : t('copy', currentLanguage)}
                >
                  {copiedCard === 'dates' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <AnimatedContent
              distance={50}
              direction="vertical"
              duration={0.65}
              ease="power3.out"
              stagger={0.08}
              threshold={0.1}
              className="space-y-2"
            >
              {cards.important_dates.map((deadline, idx) => {
                const eventText = showEnDates && deadline.event_en ? deadline.event_en : deadline.event;
                return (
                  <div
                    key={idx}
                    className="triage-box p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-100/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                          {deadline.date_display}
                        </span>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                          {eventText}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2.5 shrink-0">
                      <a
                        href={getGoogleCalendarLink(deadline, cards.overview?.document_type || 'Agreement')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-100/70 hover:bg-amber-200/80 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-300 text-[10px] font-bold transition-all shadow-2xs cursor-pointer"
                        title={t('addToGoogleCalendar', currentLanguage)}
                      >
                        <CalendarPlus className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                        <span className="hidden sm:inline">{t('addToGoogleCalendar', currentLanguage)}</span>
                      </a>

                      <button
                        onClick={() => onCitationClick(deadline.clause_ref, deadline.page)}
                        className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                      >
                        {formatCitation(deadline.clause_ref, deadline.page, currentLanguage)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </AnimatedContent>
          </div>
        </AnimatedContent>
      )}

      {/* 6. Should You See a Lawyer Card */}
      {cards.lawyer_advice && cards.lawyer_advice.should_see_lawyer && (
        <AnimatedContent distance={60} direction="vertical" duration={0.8} ease="power3.out" threshold={0.1}>
          <div id="section-lawyer" tabIndex={-1} className="scroll-mt-24 triage-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition-shadow focus:outline-none">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                  <Scale className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {t('cardLawyerTitle', currentLanguage)}
                </h3>
              </div>

              <div className="flex items-center space-x-1 no-print">
                {isNonEnglish && (
                  <button
                    onClick={() => setShowEnLawyer(!showEnLawyer)}
                    className="px-2 py-1 rounded text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {showEnLawyer ? t('showInOriginal', currentLanguage) : t('showInEnglish', currentLanguage)}
                  </button>
                )}
                <button
                  onClick={() => {
                    const law = cards.lawyer_advice;
                    const text = `${law.should_see_lawyer ? 'Yes, consult a lawyer' : 'Not needed right now'}. Reason: ${law.reason}. What to ask: ${law.what_to_ask}`;
                    handleSpeak('lawyer', text, showEnLawyer);
                  }}
                  aria-label="Listen"
                  className="p-1.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                  title={t('listen', currentLanguage)}
                >
                  {speakingCard === 'lawyer' ? (
                    <VolumeX className="w-4 h-4 text-emerald-600 animate-pulse" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => {
                    const law = cards.lawyer_advice;
                    const text = `${law.should_see_lawyer ? 'Yes, consult a lawyer' : 'Not needed right now'}\nReason: ${law.reason}\nWhat to ask: ${law.what_to_ask}`;
                    handleCopy('lawyer', text);
                  }}
                  aria-label="Copy"
                  className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title={copiedCard === 'lawyer' ? t('copied', currentLanguage) : t('copy', currentLanguage)}
                >
                  {copiedCard === 'lawyer' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {/* Yes/No Badge */}
              <div className="flex items-center space-x-2.5">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                    cards.lawyer_advice.should_see_lawyer
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                  }`}
                >
                  {cards.lawyer_advice.should_see_lawyer
                    ? t('lawyerYes', currentLanguage)
                    : t('lawyerNo', currentLanguage)}
                </span>
              </div>

              <AnimatedContent
                distance={50}
                direction="vertical"
                duration={0.65}
                ease="power3.out"
                stagger={0.08}
                threshold={0.1}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1"
              >
                <div className="triage-box p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {t('lawyerWhy', currentLanguage)}
                  </span>
                  <p className="text-xs text-slate-800 dark:text-slate-200 mt-1 leading-relaxed">
                    {showEnLawyer && cards.lawyer_advice.reason_en
                      ? cards.lawyer_advice.reason_en
                      : cards.lawyer_advice.reason}
                  </p>
                </div>

                <div className="triage-box p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {t('lawyerWhatToAsk', currentLanguage)}
                  </span>
                  <p className="text-xs text-slate-800 dark:text-slate-200 mt-1 leading-relaxed">
                    {showEnLawyer && cards.lawyer_advice.what_to_ask_en
                      ? cards.lawyer_advice.what_to_ask_en
                      : cards.lawyer_advice.what_to_ask}
                  </p>
                </div>

                <div className="triage-box p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {t('lawyerByWhen', currentLanguage)}
                  </span>
                  <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                    {showEnLawyer && cards.lawyer_advice.by_when_en
                      ? cards.lawyer_advice.by_when_en
                      : cards.lawyer_advice.by_when}
                  </p>
                </div>

                <div className="triage-box p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {t('lawyerSpecialist', currentLanguage)}
                  </span>
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                    {showEnLawyer && cards.lawyer_advice.recommended_specialist_en
                      ? cards.lawyer_advice.recommended_specialist_en
                      : cards.lawyer_advice.recommended_specialist}
                  </p>
                </div>
              </AnimatedContent>
            </div>
          </div>
        </AnimatedContent>
      )}
      {/* Counter-Offer Negotiation Modal */}
      <CounterOfferModal
        isOpen={isCounterModalOpen}
        onClose={() => setIsCounterModalOpen(false)}
        risk={selectedRiskForCounter}
        documentType={cards.overview?.document_type || 'Legal Agreement'}
        documentName={cards.overview?.document_type ? `${cards.overview.document_type} draft` : 'Draft Agreement'}
        currentLanguage={currentLanguage}
      />
    </div>
  );
}
