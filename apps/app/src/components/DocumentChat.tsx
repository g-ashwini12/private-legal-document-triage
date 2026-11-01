'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Languages,
  Mic,
  MicOff,
} from 'lucide-react';
import { AnswerResponse, NodeProgress } from '@/types';
import { askQuestionStream } from '@/lib/api';
import { t, formatCitation } from '@/lib/i18n';
import { speakLocalText, stopSpeaking } from '@/lib/speech';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  response?: AnswerResponse;
  timestamp: string;
}

interface DocumentChatProps {
  documentId: string;
  suggestedQuestions: string[];
  currentLanguage: string;
  onCitationClick: (clauseRef?: string, page?: number, chunkId?: string) => void;
  externalQuestion?: string | null;
  onQuestionConsumed?: () => void;
}

export default function DocumentChat({
  documentId,
  suggestedQuestions,
  currentLanguage,
  onCitationClick,
  externalQuestion,
  onQuestionConsumed,
}: DocumentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionId] = useState(() => 'sess_' + Math.random().toString(36).substring(2, 9));

  // Toggles for English per message
  const [showEnMap, setShowEnMap] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // Voice recording state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Only scroll the inner message container if there are messages, NEVER scroll the entire window
    if (messages.length > 0 && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, progressMsg]);

  // Language locale mapping for speech recognition
  const getSpeechLocale = (lang: string) => {
    switch (lang) {
      case 'hi': return 'hi-IN';
      case 'ta': return 'ta-IN';
      case 'te': return 'te-IN';
      case 'kn': return 'kn-IN';
      case 'ml': return 'ml-IN';
      default: return 'en-IN';
    }
  };

  const toggleVoiceInput = () => {
    if (typeof window === 'undefined') return;

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert(t('micNotSupported', currentLanguage));
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = getSpeechLocale(currentLanguage);
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInputQuestion(transcript);
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  // Handle questions passed from cards (e.g. from watch out for card)
  useEffect(() => {
    if (externalQuestion && !loading) {
      handleAsk(externalQuestion);
      onQuestionConsumed?.();
    }
  }, [externalQuestion]);

  const handleAsk = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || loading) return;

    setErrorMsg(null);
    setInputQuestion('');
    setProgressMsg(t('readingDoc', currentLanguage));
    setLoading(true);

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);

    await askQuestionStream(
      documentId,
      sessionId,
      q,
      currentLanguage,
      (p: NodeProgress) => {
        setProgressMsg(p.message);
      },
      (finalResp: AnswerResponse) => {
        setLoading(false);
        setProgressMsg(null);
        const botMsg: ChatMessage = {
          id: 'msg_' + Date.now(),
          role: 'assistant',
          content: finalResp.answer,
          response: finalResp,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, botMsg]);
      },
      (err: string) => {
        setLoading(false);
        setProgressMsg(null);
        setErrorMsg(t('serviceUnavailable', currentLanguage));
      }
    );
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeak = (id: string, text: string, forceEn: boolean) => {
    if (speakingId === id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(id);
    const lang = forceEn ? 'en' : currentLanguage;
    const ok = speakLocalText(
      text,
      lang,
      () => setSpeakingId(null),
      () => setSpeakingId(null)
    );
    if (!ok) setSpeakingId(null);
  };

  return (
    <div
      id="section-chat"
      tabIndex={-1}
      className="scroll-mt-24 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col h-[650px] no-print focus:outline-none transition-shadow"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            {t('chatTitle', currentLanguage)}
          </h3>
        </div>
      </div>

      {/* Suggested Questions Pills */}
      {suggestedQuestions && suggestedQuestions.length > 0 && messages.length === 0 && (
        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-2">
            {t('suggestedQuestions', currentLanguage)}:
          </span>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.slice(0, 4).map((sq, idx) => (
              <button
                key={idx}
                onClick={() => handleAsk(sq)}
                disabled={loading}
                className="text-left text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
              >
                {sq}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 dark:text-slate-500">
            <Sparkles className="w-8 h-8 text-emerald-500/60 mb-2" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('chatTitle', currentLanguage)}
            </p>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Ask about rent, deposit, notice periods, repair clauses, or responsibilities. Answers will be plain and backed by exact quotes.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isEn = showEnMap[msg.id] || false;
          const displayContent =
            !isUser && isEn && msg.response?.answer_en
              ? msg.response.answer_en
              : msg.content;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 shadow-xs ${
                  isUser
                    ? 'bg-emerald-600 text-white rounded-br-xs'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 rounded-bl-xs border border-slate-200 dark:border-slate-700/60'
                }`}
              >
                <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                  {displayContent}
                </p>

                {/* Evidence citations chips */}
                {!isUser && msg.response?.evidence && msg.response.evidence.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mr-1">
                      {t('evidence', currentLanguage)}:
                    </span>
                    {msg.response.evidence.map((ev, i) => (
                      <button
                        key={i}
                        onClick={() => onCitationClick(ev.clause, ev.page, ev.chunk_id)}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-semibold hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-colors"
                        title={ev.quote}
                      >
                        <span>{formatCitation(ev.clause, ev.page, currentLanguage)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Actions row for assistant message */}
                {!isUser && (
                  <div className="mt-3 pt-2 flex items-center justify-between border-t border-slate-200/50 dark:border-slate-700/50 text-slate-400">
                    <div className="flex items-center space-x-2">
                      {currentLanguage !== 'en' && msg.response?.answer_en && (
                        <button
                          onClick={() =>
                            setShowEnMap((prev) => ({ ...prev, [msg.id]: !isEn }))
                          }
                          className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                        >
                          {isEn ? t('showInOriginal', currentLanguage) : t('showInEnglish', currentLanguage)}
                        </button>
                      )}
                      <button
                        onClick={() => handleSpeak(msg.id, displayContent, isEn)}
                        aria-label="Listen"
                        className="p-1 rounded hover:text-emerald-600 transition-colors"
                        title={speakingId === msg.id ? t('stopListening', currentLanguage) : t('listen', currentLanguage)}
                      >
                        {speakingId === msg.id ? (
                          <VolumeX className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleCopy(msg.id, displayContent)}
                        aria-label="Copy"
                        className="p-1 rounded hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        title={copiedId === msg.id ? t('copied', currentLanguage) : t('copy', currentLanguage)}
                      >
                        {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <span className="text-[10px] text-slate-400">
                      {msg.timestamp}
                    </span>
                  </div>
                )}
              </div>

              {/* One short line under answers */}
              {!isUser && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 ml-1">
                  {t('privacyNote', currentLanguage)}
                </span>
              )}
            </div>
          );
        })}

        {/* Progress indicator */}
        {loading && (
          <div className="flex items-center space-x-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 max-w-sm text-xs text-slate-600 dark:text-slate-300 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
            <span>{progressMsg || t('readingDoc', currentLanguage)}</span>
          </div>
        )}

        {/* Error notification */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => handleAsk(inputQuestion || suggestedQuestions[0] || 'Explain this agreement')}
              className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs ml-3 shrink-0 transition-colors"
            >
              {t('retry', currentLanguage)}
            </button>
          </div>
        )}

      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk(inputQuestion);
        }}
        className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-2xl relative"
      >
        {isListening && (
          <div className="absolute -top-7 left-4 right-4 flex items-center justify-between px-3 py-1 bg-emerald-500 text-slate-950 font-bold text-[11px] rounded-t-lg shadow-sm animate-pulse">
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-ping inline-block" />
              <span>{t('listening', currentLanguage)}</span>
            </span>
            <button
              type="button"
              onClick={toggleVoiceInput}
              className="text-[10px] underline hover:opacity-80"
            >
              {t('stopListeningVoice', currentLanguage)}
            </button>
          </div>
        )}
        <div className="flex items-center space-x-2">
          <input
            id="document-chat-input"
            type="text"
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            disabled={loading}
            placeholder={isListening ? t('listening', currentLanguage) : t('chatPlaceholder', currentLanguage)}
            className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={toggleVoiceInput}
            aria-label="Voice Input"
            title={isListening ? t('stopListeningVoice', currentLanguage) : t('voiceQuestion', currentLanguage)}
            className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 ${
              isListening
                ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30'
                : 'text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            type="submit"
            disabled={loading || !inputQuestion.trim()}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold text-xs sm:text-sm flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <span>{t('send', currentLanguage)}</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
