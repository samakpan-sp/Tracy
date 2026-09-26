import { supabaseAdmin } from '../lib/supabaseClient.js';


function normalizeSubjectKey(subjectType, subjectValue, subjectPlatform) {
  if (subjectType === 'phone_number') {
    // Last 10 digits — a pragmatic way to match local vs. international
    // formats of the same number without full E.164 parsing.
    return subjectValue.replace(/\D/g, '').slice(-10);
  }

  if (subjectType === 'social_profile') {
    const handle = subjectValue.toLowerCase().trim().replace(/^@/, '');
    return `${subjectPlatform || 'unknown'}:${handle}`;
  }

  if (subjectType === 'url' || subjectType === 'business_advert') {
    try {
      const url = new URL(subjectValue);
      return `${url.hostname.replace(/^www\./, '')}${url.pathname}`.toLowerCase().replace(/\/$/, '');
    } catch {
      return subjectValue.toLowerCase().trim();
    }
  }

  return subjectValue.toLowerCase().trim();
}

export async function getSubjectSignal(subjectType, subjectValue, subjectPlatform) {
  const key = normalizeSubjectKey(subjectType, subjectValue, subjectPlatform);

  const { data, error } = await supabaseAdmin
    .from('subject_signals')
    .select('*')
    .eq('subject_type', subjectType)
    .eq('subject_key', key)
    .maybeSingle();

  if (error) {
    console.error('Failed to read subject signal (continuing without it):', error.message);
    return null;
  }

  return data;
}

export async function upsertSubjectSignal(subjectType, subjectValue, subjectPlatform, newRiskLabels) {
  const key = normalizeSubjectKey(subjectType, subjectValue, subjectPlatform);

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('subject_signals')
    .select('*')
    .eq('subject_type', subjectType)
    .eq('subject_key', key)
    .maybeSingle();

  if (fetchError) {
    console.error('Failed to check existing subject signal:', fetchError.message);
    return;
  }

  const dedupedLabels = Array.from(new Set([...(existing?.risk_labels || []), ...newRiskLabels])).slice(0, 10);

  if (existing) {
    const { error } = await supabaseAdmin
      .from('subject_signals')
      .update({
        occurrence_count: existing.occurrence_count + 1,
        risk_labels: dedupedLabels,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) console.error('Failed to update subject signal:', error.message);
  } else {
    const { error } = await supabaseAdmin
      .from('subject_signals')
      .insert({
        subject_type: subjectType,
        subject_key: key,
        occurrence_count: 1,
        risk_labels: dedupedLabels,
      });

    if (error) console.error('Failed to insert subject signal:', error.message);
  }
}

export async function saveInvestigation(userId, report) {
  const { error } = await supabaseAdmin.from('investigations').insert({
    created_by: userId,
    subject_type: report.subject_type,
    subject_value: report.subject_value,
    subject_platform: report.subject_platform,
    evidence: report.evidence,
    user_context: report.user_context,
    subject_claims: report.subject_claims,
    verified_facts: report.verified_facts,
    user_claims: report.user_claims,
    contradictions: report.contradictions,
    possible_connections: report.possible_connections,
    risk_indicators: report.risk_indicators,
    unknown_flags: report.unknown_flags,
    confidence_level: report.confidence_level,
    recommended_next_steps: report.recommended_next_steps,
  });

  if (error) {
    console.error('Failed to save investigation to history:', error.message);
  }
}

export async function listInvestigations(userId, limit = 50) {
  const { data, error } = await supabaseAdmin
    .from('investigations')
    .select('id, subject_type, subject_value, subject_platform, confidence_level, created_at')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list investigations: ${error.message}`);
  }

  return data;
}

export async function getInvestigationById(userId, id) {
  const { data, error } = await supabaseAdmin
    .from('investigations')
    .select('*')
    .eq('id', id)
    .eq('created_by', userId) // manual filter — service_role bypasses RLS
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch investigation: ${error.message}`);
  }

  return data;
}