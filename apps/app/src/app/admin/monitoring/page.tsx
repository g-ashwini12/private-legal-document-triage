'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Clock,
  Database,
  ShieldAlert,
  Zap,
  TrendingUp,
  Cpu,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import AdminAuthWrapper from '../AdminAuthWrapper';
import { fetchAdminMetrics } from '@/lib/api';
import { MetricSummary } from '@/types';

function MonitoringContent({ token }: { token: string }) {
  const [metrics, setMetrics] = useState<MetricSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    fetchAdminMetrics(token)
      .then(setMetrics)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [token]);

  if (loading && !metrics) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
            <Link href="/" className="hover:underline flex items-center space-x-1">
              <ArrowLeft className="w-3 h-3" />
              <span>Workspace</span>
            </Link>
            <span>/</span>
            <span>Admin</span>
            <span>/</span>
            <span>Monitoring</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Pipeline Monitoring & Telemetry
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Zero-cloud runtime diagnostics, cache performance, and node-level latency metrics.
          </p>
        </div>

        <button
          onClick={loadData}
          className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Total Queries</span>
            <Zap className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {metrics?.total_queries ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Local session queries</p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Semantic Cache Hit Rate</span>
            <Database className="w-4 h-4 text-teal-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {((metrics?.cache_hit_rate ?? 0) * 100).toFixed(1)}%
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {metrics?.cache_hits ?? 0} hits out of {metrics?.total_queries ?? 0} queries
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Average Latency</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {metrics?.avg_latency_ms ? `${metrics.avg_latency_ms} ms` : '0 ms'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Gemma offline inference</p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Tokens / Query</span>
            <Cpu className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {metrics?.avg_tokens ? Math.round(metrics.avg_tokens) : 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Local context usage</p>
        </div>
      </div>

      {/* Node Timings breakdown */}
      {metrics?.node_latencies && Object.keys(metrics.node_latencies).length > 0 && (
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3">
            LangGraph Node Execution Latencies
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(metrics.node_latencies).map(([node, ms]) => (
              <div key={node} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block truncate">
                  {node}
                </span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {ms} ms
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminMonitoringPage() {
  return (
    <AdminAuthWrapper>
      {(token) => <MonitoringContent token={token} />}
    </AdminAuthWrapper>
  );
}
