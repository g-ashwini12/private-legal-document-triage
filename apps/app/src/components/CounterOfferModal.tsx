'use client';

import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Mail,
  Sparkles,
  FileText,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { WatchOutItem } from '@/types';
import { t, formatCitation } from '@/lib/i18n';

interface CounterOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  risk: WatchOutItem | null;
  documentType?: string;
  documentName?: string;
  currentLanguage: string;
}

export default function CounterOfferModal({
  isOpen,
  onClose,
  risk,
  documentType = 'agreement',
  documentName = 'Agreement',
  currentLanguage,
}: CounterOfferModalProps) {
  const [copied, setCopied] = useState(false);
  const [inEnglish, setInEnglish] = useState(false);

  if (!isOpen || !risk) return null;

  const isRental = documentType.toLowerCase().includes('rental') || documentType.toLowerCase().includes('lease');
  const isEmployment = documentType.toLowerCase().includes('employ') || documentType.toLowerCase().includes('job');

  const recipient = isRental ? 'Landlord / Property Owner' : isEmployment ? 'HR / Hiring Manager' : 'Counterparty';
  const clauseText = formatCitation(risk.clause_ref, risk.page, currentLanguage);

  // Generate tailored proposal wording based on the risk topic
  const generateProposal = () => {
    const titleLower = (risk.headline || '').toLowerCase();
    const explanationLower = (risk.explanation || '').toLowerCase();

    let issueSummary = risk.headline;
    let proposedRevision = '';
    let justification = '';

    if (titleLower.includes('deposit') || explanationLower.includes('deposit')) {
      issueSummary = 'Security deposit refund timeline and deduction terms';
      proposedRevision = `Proposed Amendment for ${risk.clause_ref || 'Deposit Clause'}:
"The Landlord shall inspect the premises mutually with the Tenant on the move-out date. The security deposit (less any mutually verified damages beyond normal wear and tear) shall be refunded via bank transfer within 7 business days of vacating."`;
      justification = 'Standard practice in residential agreements is to refund deposits within 7 to 10 days following mutual inspection.';
    } else if (titleLower.includes('notice') || explanationLower.includes('notice') || titleLower.includes('lock-in')) {
      issueSummary = 'Notice period and termination terms';
      proposedRevision = `Proposed Amendment for ${risk.clause_ref || 'Termination Clause'}:
"Either party may terminate this agreement by providing one (1) month prior written notice, or payment of rent in lieu thereof. The Tenant shall not be subject to forfeiture of the security deposit beyond the agreed notice period rent."`;
      justification = 'A balanced 1-month mutual notice period protects both parties without imposing punitive forfeiture clauses.';
    } else if (titleLower.includes('repair') || explanationLower.includes('maintenance')) {
      issueSummary = 'Repairs and maintenance cost allocation';
      proposedRevision = `Proposed Amendment for ${risk.clause_ref || 'Repairs Clause'}:
"The Tenant shall be responsible for routine minor maintenance up to ₹1,000 per occurrence. Major structural repairs, seepage, plumbing overhauls, and pre-existing electrical issues shall remain the Landlord's responsibility."`;
      justification = 'Clear threshold limits prevent future disagreements over wear-and-tear versus structural damage.';
    } else if (titleLower.includes('entry') || titleLower.includes('inspection') || explanationLower.includes('entry')) {
      issueSummary = 'Premises inspection and entry notice';
      proposedRevision = `Proposed Amendment for ${risk.clause_ref || 'Inspection Clause'}:
"The Landlord or their authorized agent may inspect the premises only after providing at least 24 hours prior notice to the Tenant, with visits scheduled during reasonable daytime hours."`;
      justification = 'Reasonable prior notice ensures privacy while maintaining the owner’s right to inspect the property.';
    } else if (titleLower.includes('non-compete') || titleLower.includes('penalty')) {
      issueSummary = 'Post-termination restriction / penalty clause';
      proposedRevision = `Proposed Amendment for ${risk.clause_ref || 'Restriction Clause'}:
"Any post-termination restrictions shall be limited strictly to direct solicitation of active clients and use of confidential company trade secrets, in accordance with applicable labor regulations."`;
      justification = 'Aligns the agreement with statutory guidelines governing fair trade and employment.';
    } else {
      issueSummary = risk.headline;
      proposedRevision = `Proposed Amendment for ${risk.clause_ref || 'Subject Clause'}:
"Both parties agree that ${risk.headline} shall be modified to require mutual written agreement and standard grace periods before any penalties or forfeitures take effect."`;
      justification = 'Ensures reciprocal fairness and prevents unilateral penalties.';
    }

    const emailSubject = `Regarding ${documentName} — Request for Clarification / Amendment on ${risk.clause_ref || 'Clause'}`;
    const emailBody = `Dear ${recipient},

Thank you for sharing the draft ${documentType}. I am excited about moving forward with this agreement.

Upon reviewing the draft terms, I noticed ${risk.clause_ref ? risk.clause_ref : 'a term'} regarding ${issueSummary} (${risk.explanation}).

To ensure the agreement is balanced and protects both of our interests, I would like to kindly propose the following adjustment:

${proposedRevision}

Why this adjustment is requested:
${justification}

Please let me know if this adjustment is acceptable to you so we can finalize the agreement. I appreciate your understanding and cooperation!

Warm regards,
[Your Name]
[Your Phone Number]`;

    return { subject: emailSubject, body: emailBody };
  };

  const { subject, body } = generateProposal();

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('negotiateTitle', currentLanguage)}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('negotiateSubtitle', currentLanguage)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clause Reference Banner */}
        <div className="px-6 py-2.5 bg-rose-50/80 dark:bg-rose-950/30 border-b border-rose-100 dark:border-rose-900/40 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-rose-800 dark:text-rose-300 font-medium truncate pr-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="font-bold">{risk.headline}</span>
            {risk.clause_ref && (
              <span className="opacity-80 font-mono text-[11px]">({clauseText})</span>
            )}
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-200 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 shrink-0">
            {risk.level || 'High'}
          </span>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Subject Line
            </label>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-slate-100">
              {subject}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Draft Message
            </label>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-sans text-xs sm:text-sm select-all">
              {body}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t('close', currentLanguage)}
          </button>

          <div className="flex items-center space-x-2.5">
            <a
              href={mailtoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-semibold transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{t('openInEmail', currentLanguage)}</span>
            </a>

            <button
              onClick={handleCopy}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all hover:scale-[1.02]"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>{t('copied', currentLanguage)}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-white" />
                  <span>{t('copyProposal', currentLanguage)}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
