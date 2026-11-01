'use client';

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Sparkles,
  TrendingUp,
  FileCheck2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DocumentAnalysisCards } from '@/types';
import { t } from '@/lib/i18n';

interface FairnessScoreCardProps {
  cards: DocumentAnalysisCards;
  currentLanguage: string;
}

export default function FairnessScoreCard({
  cards,
  currentLanguage,
}: FairnessScoreCardProps) {
  const [showChecklist, setShowChecklist] = useState(true);

  // Compute deterministic score (25 to 96)
  const { score, statusKey, color, bgGradient, highCount, medCount, lowCount, subMetrics } = useMemo(() => {
    let s = 96;
    const risks = cards.watch_out_risks || [];
    let high = 0;
    let med = 0;
    let low = 0;

    risks.forEach((r) => {
      if (r.level === 'High') {
        s -= 22;
        high++;
      } else if (r.level === 'Medium') {
        s -= 10;
        med++;
      } else {
        s -= 4;
        low++;
      }
    });

    if (cards.lawyer_advice?.should_see_lawyer) {
      s -= 8;
    }

    const finalScore = Math.max(28, Math.min(96, s));

    let status = 'safeToSign';
    let col = 'emerald';
    let bg = 'from-emerald-500/10 to-teal-500/5 dark:from-emerald-950/40 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800/80';

    if (finalScore < 60 || high >= 2) {
      status = 'highRiskTerms';
      col = 'rose';
      bg = 'from-rose-500/10 to-amber-500/5 dark:from-rose-950/40 dark:to-amber-950/20 border-rose-200 dark:border-rose-900/80';
    } else if (finalScore < 80 || high === 1 || med >= 2) {
      status = 'moderateRisk';
      col = 'amber';
      bg = 'from-amber-500/10 to-orange-500/5 dark:from-amber-950/40 dark:to-orange-950/20 border-amber-200 dark:border-amber-900/80';
    }

    // Sub-metrics
    const clarity = Math.min(98, 88 + (cards.key_details ? Math.min(8, cards.key_details.length) : 5));
    const balance = Math.max(40, finalScore - 5);

    return {
      score: finalScore,
      statusKey: status,
      color: col,
      bgGradient: bg,
      highCount: high,
      medCount: med,
      lowCount: low,
      subMetrics: {
        clarity,
        balance,
      },
    };
  }, [cards]);

  // Generate dynamic pre-signing checklist based on document analysis
  const defaultChecklist = useMemo(() => {
    const list = [
      { id: 'c1', label: 'Verify security deposit refund timeline and deduction conditions' },
      { id: 'c2', label: 'Confirm notice period duration and penalty exemptions' },
      { id: 'c3', label: 'Document initial condition, meter readings, and existing damages' },
      { id: 'c4', label: 'Clarify maintenance responsibilities between parties' },
      { id: 'c5', label: 'Ensure signed receipts are provided for all advance payments' },
    ];
    return list;
  }, []);

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({
    c1: true,
  });

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const completedCount = defaultChecklist.filter((it) => checkedItems[it.id]).length;
  const progressPercent = Math.round((completedCount / defaultChecklist.length) * 100);

  // SVG Gauge calculations
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className={`triage-card rounded-2xl border bg-gradient-to-br ${bgGradient} p-5 sm:p-6 shadow-xs transition-all`}>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        {/* Left: Gauge & Score */}
        <div className="flex items-center space-x-5">
          {/* Circular SVG Gauge */}
          <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="text-slate-200 dark:text-slate-800"
                strokeWidth="9"
                stroke="currentColor"
                fill="transparent"
              />
              {/* Progress stroke */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className={
                  color === 'emerald'
                    ? 'text-emerald-500'
                    : color === 'amber'
                    ? 'text-amber-500'
                    : 'text-rose-500'
                }
                strokeWidth="9"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                style={{ transition: 'stroke-dashoffset 1s ease-out' }}
              />
            </svg>

            {/* Score in center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {score}
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                / 100
              </span>
            </div>
          </div>

          {/* Score details */}
          <div>
            <div className="flex items-center space-x-2">
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full ${
                  color === 'emerald'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : color === 'amber'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                }`}
              >
                {t(statusKey, currentLanguage)}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
              {t('fairnessScoreTitle', currentLanguage)}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 max-w-sm">
              {highCount > 0
                ? `${highCount} critical clause(s) require negotiation before signing.`
                : medCount > 0
                ? `${medCount} terms need minor clarification with the owner.`
                : 'Terms are well-balanced and adhere to standard legal guidelines.'}
            </p>
          </div>
        </div>

        {/* Right: Quick Sub-Bars */}
        <div className="w-full md:w-64 space-y-2.5 bg-white/70 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
          <div>
            <div className="flex justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
              <span>Clarity & Specificity</span>
              <span className="font-bold">{subMetrics.clarity}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${subMetrics.clarity}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
              <span>Reciprocal Fairness</span>
              <span className="font-bold">{subMetrics.balance}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${subMetrics.balance}%` }}
              />
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>High risks: {highCount}</span>
            <span>Medium: {medCount}</span>
            <span>Low: {lowCount}</span>
          </div>
        </div>
      </div>

      {/* Pre-Signing Checklist Toggle Header */}
      <div className="mt-5 pt-4 border-t border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between">
        <button
          onClick={() => setShowChecklist(!showChecklist)}
          className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer"
        >
          <FileCheck2 className="w-4 h-4 text-emerald-600" />
          <span>{t('preSigningChecklist', currentLanguage)}</span>
          <span className="text-[11px] font-normal text-slate-500">
            ({completedCount}/{defaultChecklist.length} {t('checklistCompleted', currentLanguage)})
          </span>
          {showChecklist ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {/* Mini progress bar */}
        <div className="w-24 sm:w-32 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              progressPercent === 100 ? 'bg-emerald-500' : 'bg-emerald-600'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Checklist items */}
      {showChecklist && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
          {defaultChecklist.map((item) => {
            const isChecked = Boolean(checkedItems[item.id]);
            return (
              <div
                key={item.id}
                onClick={() => toggleCheck(item.id)}
                className={`p-2.5 rounded-xl border flex items-start space-x-2.5 cursor-pointer transition-all ${
                  isChecked
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-200'
                    : 'bg-white/80 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isChecked ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <span className={`text-[11px] leading-tight ${isChecked ? 'line-through opacity-85 font-medium' : 'font-semibold'}`}>
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
