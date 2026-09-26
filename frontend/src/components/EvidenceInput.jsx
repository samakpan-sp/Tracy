import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { MessageIcon, LinkIcon, ScreenshotIcon, VideoIcon } from './icons';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const EVIDENCE_TYPES = [
  { value: 'message', label: 'Message', icon: MessageIcon },
  { value: 'url', label: 'URL', icon: LinkIcon },
  { value: 'screenshot', label: 'Screenshot', icon: ScreenshotIcon },
  { value: 'video', label: 'Video', icon: VideoIcon },
];

function EvidenceInput({ evidence, setEvidence }) {
  const [draftType, setDraftType] = useState('message');
  const [draftText, setDraftText] = useState('');
  const [draftFile, setDraftFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const isFileType = draftType === 'screenshot' || draftType === 'video';

  const addEvidence = async () => {
    setUploadError(null);
    if (isFileType) {
      if (!draftFile) return;
      setUploading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('You must be logged in.');
        const formData = new FormData();
        formData.append('file', draftFile);
        formData.append('evidence_type', draftType);
        const res = await fetch(`${API_BASE}/api/evidence-upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `Upload failed (${res.status})`);
        }
        const result = await res.json();
        setEvidence([...evidence, {
          type: draftType,
          file_name: result.file_name,
          storage_path: result.storage_path,
          ocr_text: result.ocr_text || null,
          video_analysis_text: result.video_analysis_text || null,
        }]);
        setDraftFile(null);
      } catch (err) {
        setUploadError(err.message);
      } finally {
        setUploading(false);
      }
    } else {
      const trimmed = draftText.trim();
      if (!trimmed) return;
      setEvidence([...evidence, { type: draftType, content: trimmed }]);
      setDraftText('');
    }
  };

  const removeEvidence = (i) => setEvidence(evidence.filter((_, idx) => idx !== i));

  return (
    <div>
      <label className="block text-sm font-semibold mb-1.5">Evidence</label>
      <p className="text-xs text-gray-500 mb-3">
        Add messages, screenshots, video evidence, or a URL — this is what TRACY analyzes to support its report.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        {EVIDENCE_TYPES.map((t) => {
          const Icon = t.icon;
          const active = draftType === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => { setDraftType(t.value); setDraftText(''); setDraftFile(null); setUploadError(null); }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm border transition
                ${active ? 'bg-trust border-trust text-[#06231F] font-medium' : 'border-border text-gray-400 bg-bg'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 mb-2">
        {isFileType ? (
          <input
            className="flex-1 bg-bg border border-border rounded-lg px-3.5 py-2 text-sm text-gray-300
                       file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-surface2 file:text-gray-300"
            type="file"
            accept={draftType === 'video' ? 'video/*' : 'image/*'}
            onChange={(e) => setDraftFile(e.target.files[0] || null)}
          />
        ) : (
          <input
            className="flex-1 bg-bg border border-border rounded-lg px-3.5 py-2 text-sm placeholder-gray-600 focus:outline-none focus:border-trust"
            type="text"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder={draftType === 'url' ? 'https://...' : 'Paste the message text'}
          />
        )}
        <button
          type="button"
          onClick={addEvidence}
          disabled={uploading}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-surface2 border border-border hover:bg-border/60 transition disabled:opacity-60"
        >
          {uploading ? 'Uploading...' : 'Add'}
        </button>
      </div>

      {draftType === 'video' && <p className="text-xs text-gray-600 mb-2">Max 40MB (~1 minute). Trim longer clips to the relevant portion.</p>}
      {draftType === 'screenshot' && <p className="text-xs text-gray-600 mb-2">Max 10MB.</p>}
      {uploadError && <p className="text-sm text-danger mb-2">{uploadError}</p>}

      {evidence.length === 0 ? (
        <p className="text-center text-xs text-gray-600 py-2">No evidence added yet</p>
      ) : (
        <ul className="space-y-2">
          {evidence.map((item, i) => (
            <li key={i} className="flex justify-between items-start gap-3 bg-bg border border-border rounded-lg px-3.5 py-2.5 text-sm">
              <div className="flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-trust mb-0.5">{item.type}</span>
                {item.content || item.file_name}
                {item.type === 'screenshot' && item.ocr_text && (
                  <span className="block text-gray-500 italic mt-1">
                    OCR: "{item.ocr_text.slice(0, 60)}{item.ocr_text.length > 60 ? '...' : ''}"
                  </span>
                )}
                {item.type === 'video' && item.video_analysis_text && (
                  <span className="block text-gray-500 italic mt-1">
                    Analysis: "{item.video_analysis_text.slice(0, 60)}{item.video_analysis_text.length > 60 ? '...' : ''}"
                  </span>
                )}
              </div>
              <button type="button" onClick={() => removeEvidence(i)} className="text-danger text-xs shrink-0">Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default EvidenceInput;