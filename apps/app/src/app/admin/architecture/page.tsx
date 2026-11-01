'use client';

import React from 'react';
import {
  ShieldCheck,
  Cpu,
  Layers,
  Search,
  CheckCircle2,
  Lock,
  Workflow,
  ArrowRight,
  Database,
  Split,
  Calculator,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import AdminAuthWrapper from '../AdminAuthWrapper';

function ArchitectureContent() {
  const pipelineSteps = [
    {
      num: '01',
      title: 'Page Extraction & Legal Gate',
      desc: 'PyMuPDF extracts text page-by-page while preserving clause line numbers. The Legal Gate screens document type, rejecting non-legal files or prompt injections.',
      icon: Search,
    },
    {
      num: '02',
      title: 'Clause-Aware Chunking & Local Indexing',
      desc: 'Regex detects numbered clauses (§1, §2, Clause 3...) and indexes them in Chroma (local persistent vector store) and rank_bm25 (lexical search). Deduplication prevents re-indexing identical file hashes.',
      icon: Database,
    },
    {
      num: '03',
      title: 'Semantic Cache & Router',
      desc: 'Embedded questions are matched against prior inquiries (cosine similarity >= 0.92) for sub-second retrieval. The router directs the question into clause, risk, obligation, or deadline streams.',
      icon: Workflow,
    },
    {
      num: '04',
      title: 'Hybrid RAG & Parallel Analysis Branches',
      desc: 'Reciprocal Rank Fusion (RRF) combines dense vector and sparse lexical BM25 hits. Four parallel analysis branches extract clauses, detect asymmetric risks, calculate timelines, and assess legal escalation.',
      icon: Split,
    },
    {
      num: '05',
      title: 'Evidence Verification & Safety Validation',
      desc: 'Every generated claim is verified against verbatim quotes in the document. Unverified claims are stripped out. Safety checks ensure answers never pretend to be licensed attorney advice.',
      icon: ShieldCheck,
    },
    {
      num: '06',
      title: 'Multilingual Grade-6 Plain Synthesis',
      desc: 'Translates to Tamil, Kannada, Telugu, Hindi, or Malayalam using simple Grade 6 words while preserving Western digits (0-9) and rupee amounts (₹) verbatim.',
      icon: Calculator,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-8">
      <div>
        <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
          <Link href="/" className="hover:underline flex items-center space-x-1">
            <ArrowLeft className="w-3 h-3" />
            <span>Workspace</span>
          </Link>
          <span>/</span>
          <span>Admin</span>
          <span>/</span>
          <span>Architecture</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          System Architecture & Graph Topology
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Local, privacy-preserving, deterministic LangGraph pipeline topology.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {pipelineSteps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.num}
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs relative"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {step.num}
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1.5">
                {step.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {step.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminArchitecturePage() {
  return (
    <AdminAuthWrapper>
      {() => <ArchitectureContent />}
    </AdminAuthWrapper>
  );
}
