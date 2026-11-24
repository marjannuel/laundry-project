'use client';

import { X, Sparkles, CheckCircle2 } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
      {/* Modal Container with max-height and flex column layout */}
      <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
        
        {/* Fixed Header */}
        <div className="flex items-center justify-between border-b p-5 bg-white z-20">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-amber-500 p-2 text-slate-900 font-black">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Pro Business Suite</h2>
              <p className="text-xs text-slate-500">Unlock AI-powered operational tools</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-600 active:scale-95">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1">
            <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Weekly Profit & Pricing Advisor
            </div>
            <p className="text-xs text-slate-600 pl-6">
              Let Gemini analyze your service breakdown and recommend optimal bundling prices.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1">
            <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Regulars & Churn Alerts
            </div>
            <p className="text-xs text-slate-600 pl-6">
              Automatically flag regulars who haven&apos;t returned within their usual interval.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1">
            <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Smart Queue Forecasts
            </div>
            <p className="text-xs text-slate-600 pl-6">
              Manage Baguio weather bottlenecks and peak student turnaround speeds.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 text-center space-y-1 mt-2">
            <p className="text-[11px] font-black uppercase text-blue-700 tracking-wider">Ready to upgrade this shop?</p>
            <p className="text-xs text-slate-700 font-medium">
              Contact your software developer to activate Pro features for this branch.
            </p>
          </div>

        </div>

        {/* Fixed Footer with Button */}
        <div className="border-t p-4 bg-white z-20">
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-slate-900 py-4 text-sm font-black text-white shadow-lg active:scale-95"
          >
            GOT IT
          </button>
        </div>

      </div>
    </div>
  );
}