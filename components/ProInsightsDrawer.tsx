'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Sparkles, X, RefreshCw, TrendingUp, Users, Clock, Package } from 'lucide-react';

interface ProInsightsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string | null;
}

interface Insight {
  id: string;
  pillar_type: 'pricing_advisor' | 'inventory_alert' | 'churn_alert' | 'queue_forecast';
  title: string;
  summary: string;
}

const PILLAR_CONFIG = {
  pricing_advisor: { label: 'Pricing & Profit Advisor', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
  inventory_alert: { label: 'Stock & Supply Runway', icon: Package, color: 'text-rose-600 bg-rose-50' },
  churn_alert: { label: 'Regulars & Churn Alert', icon: Users, color: 'text-blue-600 bg-blue-50' },
  queue_forecast: { label: 'Queue & Turnaround Forecast', icon: Clock, color: 'text-amber-600 bg-amber-50' },
};

export default function ProInsightsDrawer({ isOpen, onClose, shopId }: ProInsightsDrawerProps) {
  const supabase = createClient();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInsights = useCallback(async () => {
    if (!shopId) return;
    const { data } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (data) setInsights(data as Insight[]);
  }, [shopId, supabase]);

  useEffect(() => {
    if (isOpen) {
      fetchInsights();
    }
  }, [isOpen, fetchInsights]);

  const handleRegenerate = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchInsights();
      } else {
        alert(data.error || 'Failed to run AI audit.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl space-y-5 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-amber-100 p-2 text-amber-600">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">AI Business Advisor</h2>
              <p className="text-xs font-semibold text-slate-400">Pro Tier Analytics</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-100 p-3 text-slate-600 active:scale-95">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content Feed */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {insights.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-bold text-slate-600">No AI insights generated yet.</p>
              <p className="text-xs text-slate-400 mt-1">Tap below to run your first automated data audit.</p>
            </div>
          ) : (
            insights.map((item) => {
              const config = PILLAR_CONFIG[item.pillar_type] || PILLAR_CONFIG.pricing_advisor;
              const Icon = config.icon;
              return (
                <div key={item.id} className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-xl p-2 ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                      {config.label}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900">{item.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.summary}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Refresh / Generate Button */}
        <button
          onClick={handleRegenerate}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-base font-black text-white shadow-lg active:scale-98 disabled:opacity-50"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Analyzing Store Data...' : 'Run Fresh AI Audit'}
        </button>
      </div>
    </div>
  );
}