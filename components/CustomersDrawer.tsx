'use client';

import { useState, useEffect } from 'react';
import { X, User, Trash2, Pencil, ExternalLink, Search, Sparkles } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

const supabase = createClient();

interface CustomerProfile {
  id: string;
  shop_id: string;
  nickname: string;
  phone_number?: string;
  facebook_link?: string;
  total_visits: number;
}

interface CustomersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string | null;
}

export default function CustomersDrawer({ isOpen, onClose, shopId }: CustomersDrawerProps) {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Editing State
  const [editingCustomer, setEditingCustomer] = useState<CustomerProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editFb, setEditFb] = useState('');

  useEffect(() => {
    if (isOpen && shopId) {
      fetchCustomers();
    }
  }, [isOpen, shopId]);

  const fetchCustomers = async () => {
    if (!shopId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shopId)
      .order('total_visits', { ascending: false });

    if (!error && data) {
      setCustomers(data);
    }
    setLoading(false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !editName.trim()) return;

    const cleanName = editName.trim();
    const cleanFb = editFb.trim();

    const { error } = await supabase
      .from('customers')
      .update({ nickname: cleanName, facebook_link: cleanFb })
      .eq('id', editingCustomer.id);

    if (!error) {
      // Also update orders table customer_name if nickname changed
      await supabase
        .from('orders')
        .update({ customer_name: cleanName })
        .eq('customer_id', editingCustomer.id);

      setCustomers((prev) =>
        prev.map((c) => (c.id === editingCustomer.id ? { ...c, nickname: cleanName, facebook_link: cleanFb } : c))
      );
      setEditingCustomer(null);
    } else {
      alert('Failed to update customer.');
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from saved regular customers?`)) return;

    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (!error) {
      setCustomers((prev) => prev.filter((c) => c.id !== id));
    } else {
      alert('Failed to remove customer.');
    }
  };

  const filteredCustomers = customers.filter((c) =>
    c.nickname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-400" />
            <div>
              <h2 className="text-base font-black tracking-tight">Customer Directory (CRM)</h2>
              <p className="text-[11px] text-slate-400">{customers.length} total regular profiles</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-800 p-2 text-slate-300 hover:text-white active:scale-95">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b bg-slate-50 shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search regular customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-900"
            />
          </div>
        </div>

        {/* Edit Modal / Inline Panel if editing */}
        {editingCustomer && (
          <form onSubmit={handleSaveEdit} className="bg-blue-50 border-b border-blue-200 p-4 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase text-blue-900">Edit Customer Profile</p>
              <button type="button" onClick={() => setEditingCustomer(null)} className="text-xs text-slate-500 font-bold hover:underline">Cancel</button>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Nickname / Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Facebook Profile / Messenger Link</label>
              <input
                type="text"
                placeholder="https://facebook.com/username"
                value={editFb}
                onChange={(e) => setEditFb(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 py-2 text-xs font-black text-white shadow-xs active:scale-95"
            >
              Save Changes
            </button>
          </form>
        )}

        {/* Content Body List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading ? (
            <p className="py-8 text-center text-xs font-bold text-slate-400">Loading customers...</p>
          ) : filteredCustomers.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
              <p className="text-xs font-bold text-slate-500">No customers found.</p>
            </div>
          ) : (
            filteredCustomers.map((c) => {
              const isRegular = c.total_visits >= 3;
              return (
                <div key={c.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900 truncate">{c.nickname}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        isRegular ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {isRegular ? 'Regular' : 'New'} ({c.total_visits} visits)
                      </span>
                    </div>

                    {c.facebook_link ? (
                      <a
                        href={c.facebook_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline truncate max-w-full"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" /> FB Profile Linked
                      </a>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-1 italic">No Facebook link added yet</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCustomer(c);
                        setEditName(c.nickname);
                        setEditFb(c.facebook_link || '');
                      }}
                      className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                      title="Edit profile & FB link"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomer(c.id, c.nickname)}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Delete customer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}