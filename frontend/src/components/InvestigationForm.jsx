import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import EvidenceInput from './EvidenceInput';
import SubjectClaimsInput from './SubjectClaimsInput';
import { LinkIcon, PhoneIcon, AdIcon, ProfileIcon, InfoIcon, GearIcon } from './icons';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const SUBJECT_TYPES = [
  { value: 'url', label: 'Website / URL', subtitle: 'Domain & link check', icon: LinkIcon },
  { value: 'phone_number', label: 'Phone Number', subtitle: 'Carrier & line verification', icon: PhoneIcon },
  { value: 'business_advert', label: 'Business Advert', subtitle: 'Offer & claims review', icon: AdIcon },
  { value: 'social_profile', label: 'Social Profile', subtitle: 'Account analysis', icon: ProfileIcon },
];

const SOCIAL_PLATFORMS = ['instagram', 'facebook', 'tiktok', 'x', 'linkedin', 'whatsapp', 'telegram', 'youtube', 'other'];

const LEGEND = [
  { color: 'bg-trust', title: 'Verified Facts', desc: 'Confirmed from public sources' },
  { color: 'bg-risk', title: 'User-Provided Claims', desc: 'What you told TRACY' },
  { color: 'bg-connection', title: 'Possible Connections', desc: 'Labeled as inference' },
  { color: 'bg-danger', title: 'Risk Indicators', desc: 'Patterns, not proof' },
];

function Panel({ title, hint, children, icon, required }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 mb-5">
      {title && (
        <div className="flex items-start gap-2 mb-1">
          {icon}
          <h3 className="font-display text-[15px] font-semibold m-0">
            {title}
            {required && <span className="text-danger ml-1" aria-hidden="true">*</span>}
          </h3>
        </div>
      )}
      {hint && <p className="text-xs text-gray-500 mb-4">{hint}</p>}
      {children}
    </div>
  );
}

function InvestigationForm({ onReportReceived }) {
  const [subjectType, setSubjectType] = useState('url');
  const [subjectValue, setSubjectValue] = useState('');
  const [subjectPlatform, setSubjectPlatform] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [userContext, setUserContext] = useState('');
  const [subjectClaims, setSubjectClaims] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const subjectPlaceholder = {
    url: 'https://example.com',
    business_advert: 'Describe the advert (platform, what it offers, contact details shown)',
    social_profile: '@handle or profile link',
    phone_number: '+234...',
  }[subjectType];

  const validate = () => {
    const errors = {};
    if (subjectType === 'social_profile' && !subjectPlatform) {
      errors.subjectPlatform = 'Please select which platform this profile is on.';
    }
    if (!userContext.trim()) {
      errors.userContext = 'Add what you already know — TRACY needs this to check for contradictions.';
    }
    if (subjectClaims.length === 0) {
      errors.subjectClaims = 'Add at least one claim TRACY should verify against the evidence.';
    }
    return errors;
  };

  const fieldErrors = attemptedSubmit ? validate() : {};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setAttemptedSubmit(true);

    if (Object.keys(validate()).length > 0) {
      return;
    }

    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('You must be logged in.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/investigations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          subject_type: subjectType,
          subject_value: subjectValue,
          subject_platform: subjectType === 'social_profile' ? subjectPlatform : null,
          evidence,
          user_context: userContext,
          subject_claims: subjectClaims,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Server responded ${res.status}`);
      }
      onReportReceived(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-[2.1fr_1fr] gap-6 items-start">
        <div>
          <Panel title="What are you investigating?" hint="Select the type of artifact you want TRACY to analyze">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SUBJECT_TYPES.map((t) => {
                const Icon = t.icon;
                const active = subjectType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => { setSubjectType(t.value); setSubjectValue(''); setSubjectPlatform(null); }}
                    className={`flex flex-col items-start gap-2 p-4 rounded-lg border text-left transition
                      ${active ? 'border-trust bg-trust/10' : 'border-border bg-bg hover:border-gray-600'}`}
                  >
                    <Icon className={active ? 'text-trust' : 'text-gray-500'} />
                    <span className="text-sm font-semibold">{t.label}</span>
                    <span className="text-xs text-gray-500 leading-snug">{t.subtitle}</span>
                  </button>
                );
              })}
            </div>

            {subjectType === 'social_profile' && (
              <div className="mt-4">
                <label className="block text-sm font-semibold mb-2">Which platform?</label>
                <div className="flex flex-wrap gap-2">
                  {SOCIAL_PLATFORMS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSubjectPlatform(p)}
                      className={`px-3.5 py-1.5 rounded-full text-sm border transition capitalize
                        ${subjectPlatform === p ? 'bg-trust border-trust text-[#06231F] font-medium' : 'border-border text-gray-400 bg-bg'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                {fieldErrors.subjectPlatform && (
                  <p className="text-xs text-danger mt-2">{fieldErrors.subjectPlatform}</p>
                )}
              </div>
            )}
          </Panel>

          <Panel>
            <label className="block text-sm font-semibold mb-1.5">Subject</label>
            <input
              className="w-full bg-bg border border-border rounded-lg px-3.5 py-2.5 text-sm mb-5
                         placeholder-gray-600 focus:outline-none focus:border-trust transition"
              type="text"
              value={subjectValue}
              onChange={(e) => setSubjectValue(e.target.value)}
              required
              placeholder={subjectPlaceholder}
            />
            <EvidenceInput evidence={evidence} setEvidence={setEvidence} />
          </Panel>

          <div className="bg-surface border border-border rounded-xl p-4 mb-5">
            <p className="text-[11px] font-semibold tracking-wider text-gray-500 mb-2">ANALYSIS TIPS</p>
            <ul className="text-sm text-gray-400 space-y-1.5 list-disc list-inside">
              <li>Include the full message — partial text reduces evidence quality</li>
              <li>Keep any URLs intact — TRACY will check them where possible</li>
              <li>Add sender details (phone, email, username) as separate evidence if visible</li>
            </ul>
          </div>

          {error && <p className="text-sm text-danger mb-3">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-trust text-[#06231F] font-medium
                    py-3.5 rounded-lg hover:brightness-110 transition disabled:opacity-60"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              <GearIcon />
              Begin Investigation
            </>
          )}
        </button>
        </div>

        <aside>
          <Panel
            title="Your Context"
            required
            icon={<InfoIcon className="text-gray-500 mt-0.5" />}
            hint="What do you know about this? Your context helps TRACY identify contradictions."
          >
            <textarea
              className={`w-full bg-bg border rounded-lg px-3.5 py-2.5 text-sm
                         placeholder-gray-600 focus:outline-none focus:border-trust transition resize-y
                         ${fieldErrors.userContext ? 'border-danger' : 'border-border'}`}
              value={userContext}
              onChange={(e) => setUserContext(e.target.value)}
              rows={4}
              placeholder="e.g. I received this from a number claiming to be my bank..."
              aria-required="true"
              aria-invalid={!!fieldErrors.userContext}
            />
            {fieldErrors.userContext && (
              <p className="text-xs text-danger mt-1.5">{fieldErrors.userContext}</p>
            )}
          </Panel>

          <Panel>
            <SubjectClaimsInput
              claims={subjectClaims}
              setClaims={setSubjectClaims}
              required
              error={fieldErrors.subjectClaims}
            />
          </Panel>

          <Panel title="Report will include">
            <ul className="space-y-3">
              {LEGEND.map((item) => (
                <li key={item.title} className="flex items-start gap-2.5">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${item.color}`} />
                  <div>
                    <div className="text-sm font-medium">{item.title}</div>
                    <div className="text-xs text-gray-500">{item.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>
    </form>
  );
}

export default InvestigationForm;