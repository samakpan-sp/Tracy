import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabaseClient';
import Landing from './components/Landing';
import AppShell from './components/AppShell';
import InvestigationForm from './components/InvestigationForm';
import ReportView from './components/ReportView';
import ErrorBoundary from './components/ErrorBoundary';
import InvestigationHistory from './components/InvestigationHistory';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

function App() {
  const [session, setSession] = useState(null);
  const [report, setReport] = useState(null);
  const [view, setView] = useState('new');
  const [historyCount, setHistoryCount] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const refreshHistoryCount = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) return;
    try {
      const res = await fetch(`${API_BASE}/api/investigations`, {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });
      if (res.ok) {
        const list = await res.json();
        setHistoryCount(list.length);
      }
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    if (session) refreshHistoryCount();
  }, [session, refreshHistoryCount]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setReport(null);
    setView('new');
  };

  const handleReportReceived = (newReport) => {
    setReport(newReport);
    refreshHistoryCount();
  };

  if (!session) {
    return <Landing onAuthSuccess={setSession} />;
  }

  return (
    <AppShell
      session={session}
      view={view}
      historyCount={historyCount}
      onNewInvestigation={() => { setView('new'); setReport(null); }}
      onViewHistory={() => setView('history')}
      onLogout={handleLogout}
    >
      {view === 'history' ? (
        <ErrorBoundary>
          <InvestigationHistory onBack={() => { setView('new'); setReport(null); }} />
        </ErrorBoundary>
      ) : report ? (
        <ErrorBoundary>
          <ReportView report={report} onNewInvestigation={() => setReport(null)} />
        </ErrorBoundary>
      ) : (
        <InvestigationForm onReportReceived={handleReportReceived} />
      )}
    </AppShell>
  );
}

export default App;