import { useState } from 'react';
import { PlusIcon } from './icons';

function SubjectClaimsInput({ claims, setClaims, required, error }) {
  const [draft, setDraft] = useState('');

  const addClaim = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setClaims([...claims, trimmed]);
    setDraft('');
  };

  const removeClaim = (i) => setClaims(claims.filter((_, idx) => idx !== i));

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addClaim();
    }
  };

  return (
    <div>
      <h4 className="font-display text-[15px] font-semibold mb-1">
        What you've been told
        {required && <span className="text-danger ml-1" aria-hidden="true">*</span>}
      </h4>
      <p className="text-xs text-gray-500 mb-3">
        Add specific claims made by the subject — TRACY will cross-reference these against evidence
      </p>

      <div className="flex gap-2 mb-2">
        <input
          className={`flex-1 bg-bg border rounded-lg px-3.5 py-2 text-sm placeholder-gray-600 focus:outline-none focus:border-trust
            ${error ? 'border-danger' : 'border-border'}`}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. They claim to be a licensed broker"
          aria-required={required ? 'true' : undefined}
          aria-invalid={!!error}
        />
        <button
          type="button"
          onClick={addClaim}
          className="p-2.5 rounded-lg bg-surface2 border border-border hover:bg-border/60 transition"
          aria-label="Add claim"
        >
          <PlusIcon />
        </button>
      </div>

      {error && <p className="text-xs text-danger mb-2">{error}</p>}

      {claims.length === 0 ? (
        <p className="text-center text-xs text-gray-600 py-2">
          No claims added yet<br />
          <span className="text-gray-700">Claims will appear in your report labeled as user-provided</span>
        </p>
      ) : (
        <ul className="space-y-2">
          {claims.map((claim, i) => (
            <li key={i} className="flex justify-between items-start gap-3 bg-bg border border-border rounded-lg px-3.5 py-2.5 text-sm">
              <span>{claim}</span>
              <button type="button" onClick={() => removeClaim(i)} className="text-danger text-xs shrink-0">Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SubjectClaimsInput;