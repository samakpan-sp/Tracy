import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { investigationRateLimiter } from '../middleware/rateLimiter.js';
import { analyzeMessageEvidence } from '../services/messageAnalysisService.js';
import { verifySubject } from '../services/subjectVerificationService.js';
import {
  getSubjectSignal,
  upsertSubjectSignal,
  saveInvestigation,
  listInvestigations,
  getInvestigationById,
} from '../services/investigationHistoryService.js';

const router = Router();

const VALID_SUBJECT_TYPES = ['url', 'business_advert', 'social_profile', 'phone_number'];
const VALID_EVIDENCE_TYPES = ['message', 'url', 'screenshot', 'video'];
const VALID_PLATFORMS = ['instagram', 'facebook', 'tiktok', 'x', 'linkedin', 'whatsapp', 'telegram', 'youtube', 'other'];

router.post('/', requireAuth, investigationRateLimiter, async (req, res) => {
  const { subject_type, subject_value, subject_platform, evidence, user_context, subject_claims } = req.body;

  if (!VALID_SUBJECT_TYPES.includes(subject_type)) {
    return res.status(400).json({ error: `subject_type must be one of: ${VALID_SUBJECT_TYPES.join(', ')}` });
  }
  if (!subject_value || typeof subject_value !== 'string' || subject_value.trim().length === 0) {
    return res.status(400).json({ error: 'subject_value is required' });
  }
  if (subject_type === 'social_profile') {
    if (!subject_platform || !VALID_PLATFORMS.includes(subject_platform)) {
      return res.status(400).json({ error: `subject_platform is required for social_profile and must be one of: ${VALID_PLATFORMS.join(', ')}` });
    }
  }
  if (!Array.isArray(evidence)) {
    return res.status(400).json({ error: 'evidence must be an array (can be empty)' });
  }
  for (const item of evidence) {
    if (!VALID_EVIDENCE_TYPES.includes(item.type)) {
      return res.status(400).json({ error: `evidence type must be one of: ${VALID_EVIDENCE_TYPES.join(', ')}` });
    }
  }
  if (!user_context || typeof user_context !== 'string' || user_context.trim().length === 0) {
    return res.status(400).json({ error: 'user_context is required — add what you already know about this subject so TRACY can check it against the evidence.' });
  }
  if (!Array.isArray(subject_claims) || subject_claims.length === 0) {
    return res.status(400).json({ error: 'subject_claims is required — add at least one claim TRACY should verify.' });
  }

  const safeUserContext = user_context;
  const safeSubjectClaims = subject_claims;
  const normalizedPlatform = subject_platform || null;

  let externalSubjectInfo = null;
  try {
    externalSubjectInfo = await verifySubject({
      subjectType: subject_type,
      subjectValue: subject_value,
      subjectPlatform: normalizedPlatform,
    });
  } catch (err) {
    console.error('Subject verification failed (continuing without it):', err.message);
    externalSubjectInfo = { method: 'failed', findings: [] };
  }

  // --- Cross-investigation identity signal: has TRACY seen this subject
  //     before, across ANY user, in a privacy-safe aggregate form? ---
  try {
    const signal = await getSubjectSignal(subject_type, subject_value, normalizedPlatform);
    if (signal && signal.occurrence_count > 0) {
      externalSubjectInfo.findings.push({
        source: 'TRACY internal investigation history',
        title: 'Prior investigations of this subject',
        content: `This subject has been investigated ${signal.occurrence_count} time(s) before via TRACY (first seen ${signal.first_seen_at}). Common risk themes previously noted: ${signal.risk_labels?.join(', ') || 'none recorded'}.`,
      });
    }
  } catch (err) {
    console.error('Subject signal lookup failed (continuing without it):', err.message);
  }

  let analysis;
  try {
    analysis = await analyzeMessageEvidence({
      subjectType: subject_type,
      subjectValue: subject_value,
      subjectPlatform: normalizedPlatform,
      evidence,
      userContext: safeUserContext,
      subjectClaims: safeSubjectClaims,
      externalSubjectInfo,
    });
  } catch (err) {
    console.error('Message analysis failed:', err.message);
    return res.status(502).json({
      error: 'AI analysis is currently unavailable. Please try again shortly.',
    });
  }

  const report = {
    subject_type,
    subject_value,
    subject_platform: subject_type === 'social_profile' ? normalizedPlatform : null,
    evidence,
    user_context: safeUserContext,
    subject_claims: safeSubjectClaims,
    ...analysis,
    created_by: req.user.id,
    created_at: new Date().toISOString(),
  };

  // Persist — failures here are logged but never block the response,
  // since the user's report is already complete and valid at this point.
  saveInvestigation(req.user.id, report).catch((err) =>
    console.error('Non-blocking: failed to save investigation history:', err.message)
  );

  const riskLabels = (analysis.risk_indicators || []).map((r) => r.indicator).slice(0, 3);
  upsertSubjectSignal(subject_type, subject_value, normalizedPlatform, riskLabels).catch((err) =>
    console.error('Non-blocking: failed to update subject signal:', err.message)
  );

  res.json(report);
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const investigations = await listInvestigations(req.user.id);
    res.json(investigations);
  } catch (err) {
    console.error('Failed to list investigations:', err.message);
    res.status(502).json({ error: 'Failed to load investigation history.' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const investigation = await getInvestigationById(req.user.id, req.params.id);
    if (!investigation) {
      return res.status(404).json({ error: 'Investigation not found.' });
    }
    res.json(investigation);
  } catch (err) {
    console.error('Failed to fetch investigation:', err.message);
    res.status(502).json({ error: 'Failed to load investigation.' });
  }
});

export default router;