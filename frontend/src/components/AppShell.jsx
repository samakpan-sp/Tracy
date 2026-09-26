import { ShieldIcon, PlusIcon, HistoryIcon, LogoutIcon } from './icons';

function AppShell({ session, view, onNewInvestigation, onViewHistory, historyCount, onLogout, children }) {
  const initials = session.user.email.slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-bg text-gray-100 font-body">
      <aside className="w-64 shrink-0 bg-surface border-r border-border flex flex-col p-4">
        <div className="flex items-center gap-2.5 px-1 pb-6">
          <ShieldIcon className="text-trust" />
          <div className="leading-tight">
            <div className="font-display font-bold text-[15px]">TRACY</div>
            <div className="text-[11px] text-gray-500">Trust Investigation</div>
          </div>
        </div>

        <button
          onClick={onNewInvestigation}
          className="w-full flex items-center justify-center gap-2 bg-trust text-[#06231F] font-medium
                     text-sm py-2.5 rounded-lg mb-5 hover:brightness-110 transition"
        >
          <PlusIcon />
          New Investigation
        </button>

        <nav className="flex flex-col gap-1 flex-1">
          <button
            onClick={onNewInvestigation}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition
              ${view === 'new' ? 'bg-trust/10 text-trust' : 'text-gray-400 hover:bg-surface2 hover:text-gray-100'}`}
          >
            <PlusIcon />
            New Investigation
          </button>
          <button
            onClick={onViewHistory}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition
              ${view === 'history' ? 'bg-trust/10 text-trust' : 'text-gray-400 hover:bg-surface2 hover:text-gray-100'}`}
          >
            <HistoryIcon />
            Investigation History
            {historyCount > 0 && (
              <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-full
                ${view === 'history' ? 'bg-trust/20 text-trust' : 'bg-surface2 text-gray-400'}`}>
                {historyCount}
              </span>
            )}
          </button>
        </nav>

        <div className="border-t border-border pt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-trust/15 text-trust flex items-center justify-center text-xs font-semibold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{session.user.email.split('@')[0]}</div>
              <div className="text-[11px] text-gray-500 truncate max-w-[140px]">{session.user.email}</div>
            </div>
          </div>
          <button onClick={onLogout} aria-label="Log out"
            className="p-2 rounded-lg text-gray-500 hover:bg-surface2 hover:text-danger transition shrink-0">
            <LogoutIcon />
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto px-10 py-8">
        <div className="max-w-5xl mx-auto">{children}</div>
      </main>
    </div>
  );
}

export default AppShell;