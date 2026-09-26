import { useState } from 'react';
import AuthForm from './AuthForm';
import { ShieldIcon, LinkIcon, PhoneIcon, AdIcon, ProfileIcon, ArrowRightIcon } from './icons';

const GRAPH_NODES = [
  { Icon: LinkIcon, label: 'Website', top: '10%', left: '50%', accent: 'danger', delay: '0s' },
  { Icon: PhoneIcon, label: 'Phone', top: '50%', left: '90%', accent: 'risk', delay: '1.2s' },
  { Icon: AdIcon, label: 'Advert', top: '90%', left: '50%', accent: 'connection', delay: '2.1s' },
  { Icon: ProfileIcon, label: 'Profile', top: '50%', left: '10%', accent: 'trust', delay: '0.6s' },
];

const ACCENT_CLASSES = {
  trust: { ring: 'border-trust/40', bg: 'bg-trust/10', text: 'text-trust' },
  risk: { ring: 'border-risk/40', bg: 'bg-risk/10', text: 'text-risk' },
  connection: { ring: 'border-connection/40', bg: 'bg-connection/10', text: 'text-connection' },
  danger: { ring: 'border-danger/40', bg: 'bg-danger/10', text: 'text-danger' },
};

function EvidenceGraph() {
  return (
    <div className="relative flex-1 min-h-[260px]">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {GRAPH_NODES.map((node, i) => (
          <line
            key={i}
            x1="50"
            y1="50"
            x2={parseFloat(node.left)}
            y2={parseFloat(node.top)}
            className={ACCENT_CLASSES[node.accent].text}
            stroke="currentColor"
            strokeWidth="0.4"
            strokeOpacity="0.3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="absolute inset-0 w-20 h-20 -m-3 rounded-full bg-trust/20 blur-xl animate-pulseGlow" />
        <div className="relative w-14 h-14 rounded-full bg-surface border border-trust/40 flex items-center justify-center">
          <ShieldIcon className="text-trust" />
        </div>
      </div>

      {GRAPH_NODES.map(({ Icon, label, top, left, accent, delay }, i) => {
        const c = ACCENT_CLASSES[accent];
        return (
          <div
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 animate-driftSlow"
            style={{ top, left, animationDelay: delay }}
          >
            <div className={`w-11 h-11 rounded-full border ${c.ring} ${c.bg} flex items-center justify-center`}>
              <Icon className={c.text} />
            </div>
            <span className="text-[11px] text-gray-500">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Landing({ onAuthSuccess }) {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-bg text-gray-100 font-body">
      <div className="w-full lg:w-1/2 lg:min-h-screen relative overflow-hidden bg-gradient-to-br from-surface to-bg border-b lg:border-b-0 lg:border-r border-border flex flex-col p-8">
        <div className="flex items-center gap-2.5">
          <ShieldIcon className="text-trust" />
          <div className="leading-tight">
            <div className="font-display font-bold text-[15px]">TRACY</div>
            <div className="text-[11px] text-gray-500">Trust Investigation</div>
          </div>
        </div>
        <EvidenceGraph />
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-sm animate-fadeSlideUp">
          {showAuth ? (
            <div className="bg-surface border border-border rounded-2xl p-8">
              <AuthForm onAuthSuccess={onAuthSuccess} />
            </div>
          ) : (
            <>
              <span className="font-display font-bold text-3xl block mb-4">TRACY</span>
              <p className="text-gray-400 leading-relaxed mb-8 max-w-[38ch]">
                An AI-powered investigation assistant that helps people assess whether
                something they encounter online deserves further trust or caution.
              </p>
              <button
                onClick={() => setShowAuth(true)}
                className="inline-flex items-center gap-2 bg-trust text-[#06231F] font-medium
                           px-6 py-3 rounded-lg hover:brightness-110 transition"
              >
                Sign in to get started
                <ArrowRightIcon />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Landing;
