import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import ReportView from './ReportView';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

function InvestigationHistory({ onBack }) {
  const [list, setList] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadList() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('You must be logged in.');
      const res = await fetch(`${API_BASE}/api/investigations`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      setList(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id) {
    setError(null);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('You must be logged in.');
      const res = await fetch(`${API_BASE}/api/investigations/${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      setSelected(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadList(); }, []);

  if (selected) {
    return (
      <div>
        <button onClick={() => setSelected(null)} className="mb-4 text-sm text-gray-400 hover:text-gray-200">
          ← Back to history
        </button>
        <ReportView report={selected} onNewInvestigation={onBack} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h2 className="font-display text-xl font-semibold">Investigation History</h2>
        <button
          onClick={onBack}
          className="bg-trust text-[#06231F] text-sm font-medium px-4 py-2 rounded-lg hover:brightness-110 transition"
        >
          New Investigation
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {list && list.length === 0 && <p className="text-sm text-gray-500">No investigations yet.</p>}

      {list && list.length > 0 && (
        <div className="space-y-2">
          {list.map((item) => (
            <div
              key={item.id}
              onClick={() => loadDetail(item.id)}
              className="bg-surface border border-border rounded-xl px-5 py-4 cursor-pointer
                         hover:border-trust hover:-translate-y-0.5 transition"
            >
              <div className="text-sm font-medium">
                <span className="capitalize">{item.subject_type.replace('_', ' ')}</span>
                {item.subject_platform && ` (${item.subject_platform})`} — {item.subject_value}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Confidence: {item.confidence_level?.level?.toUpperCase() || 'N/A'} · {new Date(item.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default InvestigationHistory;