import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import dotenv from 'dotenv';
import { withModelResilience } from '../utils/aiResilience.js';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('Missing GEMINI_API_KEY in backend .env');
}

const genAI = new GoogleGenerativeAI(apiKey);
const PRIMARY_MODEL = process.env.ANALYSIS_MODEL || 'gemini-3.6-flash';
const FALLBACK_MODEL = process.env.FALLBACK_ANALYSIS_MODEL || 'gemini-3-flash-preview';
const MODEL_CHAIN = [PRIMARY_MODEL, FALLBACK_MODEL];

// TRACY's job is to READ real scam/fraud text — which often contains
// manipulative, urgent, threatening, or sexually-suggestive language
// (romance scams, extortion, harassment-style pressure tactics) — and
// analyze it protectively. Default safety thresholds are tuned for a
// general chatbot and will block exactly this kind of investigation
// content. We loosen (never disable) these thresholds so TRACY can do
// its actual job; genuinely extreme content is still blocked.
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

function isSafetyBlockError(err) {
  const msg = err.message || '';
  return msg.includes('PROHIBITED_CONTENT') || msg.includes('SAFETY') || msg.includes('blocked due to');
}

const SYSTEM_PROMPT = `You are TRACY's analysis engine, part of a digital trust investigation tool.

Analyze the evidence, context, and any external subject information provided, and produce a cautious, structured evidence breakdown. Follow these rules strictly:

1. NEVER invent facts, sources, or evidence not present in the input.
2. NEVER state or imply anyone "is a scammer" or "is a criminal" — describe patterns, not verdicts.
3. You may sometimes be given "External information about the subject" from a real page fetch, search lookup, or licensed phone verification. You may cite this as verified_facts ONLY using the exact source given. If no external information was found or it wasn't applicable, treat the subject itself as unverified and say so in unknown_flags — do not guess.
3a. When the subject is a phone number, "External information" may include licensed carrier/line-type data (source: "Veriphone API lookup"). Treat this as a real verified_fact. Actively cross-reference it against subject_claims — e.g. a claim of calling from an official organization is worth flagging as a possible_connection or risk_indicator if the licensed data shows a prepaid, VoIP, or foreign-registered line inconsistent with that claim. Also check whether search findings show this exact number associated with similar offers/complaints elsewhere.
3b. External information may include TRACY's own internal investigation history (source: "TRACY internal investigation history"), showing how many times this subject has been investigated before and common risk themes noted. Treat repeated appearance as worth mentioning in possible_connections or risk_indicators, but do not treat prior investigation count alone as proof of wrongdoing — a legitimate business or number can reasonably be investigated multiple times by different cautious users.
4. Text labeled "screenshot OCR text" may contain character-recognition errors — do not treat garbled or ambiguous OCR output as a precise quote; describe it cautiously.
5. Text labeled "video content analysis" is an AI-generated description of video content, not a verified transcript or authenticity check. Do not treat it as more reliable than it is, and do not comment on whether the video itself is genuine or manipulated.
6. Separate findings into exactly these categories:
   - verified_facts: objective observations about the text evidence itself, OR real findings from external information — each with an honest, specific source.
   - user_claims: pass through anything the user told you as context, unverified.
   - contradictions: see rule 7a below — a dedicated, separate category.
   - possible_connections: inferred links between details in the message, user_context, subject_claims, and any external information — always labeled as inference.
   - risk_indicators: recognized scam/fraud patterns (urgency, requests for money/gift cards/crypto, impersonation of authority, too-good-to-be-true offers, pressure to act off-platform). Explain WHY each is a risk indicator — never proof of wrongdoing.
   - unknown_flags: anything relevant that cannot be determined from the evidence or external information alone.
7. Cross-reference "subject_claims" against the message content, user_context, AND external information. Name which specific subject_claim any contradiction relates to.
7a. "contradictions" is a DEDICATED category, separate from possible_connections. Populate it ONLY when a specific subject_claim directly conflicts with specific evidence, external information, or another subject_claim. The "subject_claim" field must be copied verbatim (or near-verbatim) from the actual claims list provided — never paraphrase it into something that sounds more damning than what was actually claimed. The "conflicts_with" field must name the specific evidence item or external source it conflicts with. If no genuine contradiction exists, return an empty array — do not manufacture one to fill the category.
8. confidence_level must be "low", "medium", or "high" with a plain-language justification. Note explicitly when confidence is limited by missing external verification, OCR uncertainty, or unverified video content.
9. recommended_next_steps must be practical, safe, user-executable verification steps.

Respond with ONLY a single valid JSON object — no markdown fences, no commentary — matching exactly:

{
  "verified_facts": [{ "fact": string, "source": string }],
  "user_claims": [{ "claim": string }],
  "contradictions": [{ "subject_claim": string, "conflicts_with": string, "explanation": string }],
  "possible_connections": [{ "connection": string, "reasoning": string }],
  "risk_indicators": [{ "indicator": string, "reasoning": string }],
  "unknown_flags": [string],
  "confidence_level": { "level": "low" | "medium" | "high", "justification": string },
  "recommended_next_steps": [string]
}`;

function normalizeAnalysis(parsed) {
  return {
    verified_facts: Array.isArray(parsed.verified_facts) ? parsed.verified_facts : [],
    user_claims: Array.isArray(parsed.user_claims) ? parsed.user_claims : [],
    contradictions: Array.isArray(parsed.contradictions) ? parsed.contradictions : [],
    possible_connections: Array.isArray(parsed.possible_connections) ? parsed.possible_connections : [],
    risk_indicators: Array.isArray(parsed.risk_indicators) ? parsed.risk_indicators : [],
    unknown_flags: Array.isArray(parsed.unknown_flags) ? parsed.unknown_flags : [],
    confidence_level: parsed.confidence_level && typeof parsed.confidence_level === 'object'
      ? {
          level: ['low', 'medium', 'high'].includes(parsed.confidence_level.level) ? parsed.confidence_level.level : 'low',
          justification: parsed.confidence_level.justification || 'No justification provided by the model.',
        }
      : { level: 'low', justification: 'Confidence data was missing from the analysis.' },
    recommended_next_steps: Array.isArray(parsed.recommended_next_steps) ? parsed.recommended_next_steps : [],
  };
}


function buildSafetyBlockFallback() {
  return normalizeAnalysis({
    verified_facts: [],
    user_claims: [],
    contradictions: [],
    possible_connections: [],
    risk_indicators: [
      {
        indicator: 'Content could not be fully analyzed by TRACY\'s AI provider.',
        reasoning: 'The submitted content was withheld from analysis by the AI provider\'s own safety filtering system. This can happen with content containing aggressive, threatening, or explicit language — which is itself sometimes a signal of manipulative or high-pressure messaging, but TRACY could not verify this specific case in detail.',
      },
    ],
    unknown_flags: ['Full AI analysis was not possible for this submission due to provider-side content filtering.'],
    confidence_level: {
      level: 'low',
      justification: 'Analysis was blocked by the AI provider\'s safety system before TRACY could produce a full breakdown. Treat this submission with extra caution and rely on manual review of the evidence.',
    },
    recommended_next_steps: [
      'Review the message/evidence content yourself for pressure tactics, urgency, or requests for money or personal information.',
      'If this content is genuinely threatening or explicit, consider reporting it directly to the platform it came from.',
    ],
  });
}

function deriveConfidenceCeiling({ realSources, evidence, contradictions }) {
  const hasTextEvidence = evidence.some(
    (e) => e.type === 'message' || e.type === 'url' || (e.type === 'screenshot' && e.ocr_text) || (e.type === 'video' && e.video_analysis_text)
  );
  const hasRealExternalSource = realSources.length > 0;
  const hasContradiction = contradictions.length > 0;

  if (!hasTextEvidence && !hasRealExternalSource) return 'low';
  if (hasContradiction && hasRealExternalSource) return 'high';
  if (hasRealExternalSource || hasTextEvidence) return 'medium';
  return 'low';
}

function capConfidence(aiLevel, ceiling) {
  const order = { low: 0, medium: 1, high: 2 };
  return order[aiLevel] <= order[ceiling] ? aiLevel : ceiling;
}

export async function analyzeMessageEvidence({
  subjectType,
  subjectValue,
  subjectPlatform,
  evidence,
  userContext,
  subjectClaims,
  externalSubjectInfo,
}) {
  const textEvidence = evidence
    .filter((e) =>
      e.type === 'message' ||
      e.type === 'url' ||
      (e.type === 'screenshot' && e.ocr_text) ||
      (e.type === 'video' && e.video_analysis_text)
    )
    .map((e) => {
      if (e.type === 'screenshot') {
        return `[screenshot OCR text — may contain recognition errors] ${e.ocr_text}`;
      }
      if (e.type === 'video') {
        return `[video content analysis — AI-generated description, not verified for authenticity] ${e.video_analysis_text}`;
      }
      return `[${e.type}] ${e.content}`;
    })
    .join('\n\n');

  const realSources = (externalSubjectInfo?.findings || []).map((f) => f.source);

  const externalInfoText = (externalSubjectInfo?.findings?.length || 0) > 0
    ? externalSubjectInfo.findings
        .map((f) => `Source: ${f.source}\nTitle: ${f.title}\nContent: ${f.content}`)
        .join('\n\n')
    : 'No external information was found or retrieval was not applicable.';

  const externalNote = externalSubjectInfo?.note ? `\nNote: ${externalSubjectInfo.note}` : '';

  const userPrompt = `Subject being investigated: ${subjectType}${subjectPlatform ? ` (platform: ${subjectPlatform})` : ''} — "${subjectValue}"

User's background context: ${userContext || 'None provided.'}

Claims the subject made to the user:
${subjectClaims.length > 0 ? subjectClaims.map((c) => `- ${c}`).join('\n') : 'None provided.'}

Evidence submitted:
${textEvidence || 'None provided.'}

External information about the subject (method: ${externalSubjectInfo?.method || 'none'}):${externalNote}
${externalInfoText}

Analyze per your instructions and return the JSON object only.`;

  let text;
  try {
    text = await withModelResilience(MODEL_CHAIN, async (modelName) => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: { responseMimeType: 'application/json' },
        safetySettings: SAFETY_SETTINGS,
      });
      const result = await model.generateContent(userPrompt);
      return result.response.text();
    });
  } catch (err) {
    if (isSafetyBlockError(err)) {
      console.warn('Analysis blocked by AI provider safety filter — returning honest degraded result.');
      return buildSafetyBlockFallback();
    }
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse AI response as JSON: ${err.message}`);
  }

  const normalized = normalizeAnalysis(parsed);

  const allowedTextSources = [
    'submitted message content',
    'submitted evidence',
    'submitted url',
    'screenshot ocr',
    'video content analysis',
    'veriphone api lookup',
    'tracy internal investigation history',
  ];
  normalized.verified_facts = normalized.verified_facts.filter((f) => {
    const sourceLower = (f?.source || '').toLowerCase();
    const isTextSource = allowedTextSources.some((s) => sourceLower.includes(s));
    const isRealExternalSource = realSources.some((url) => sourceLower.includes(url.toLowerCase()) || f?.source === url);
    return isTextSource || isRealExternalSource;
  });

  function isRealSubjectClaim(claimText) {
    const normalizedClaim = (claimText || '').toLowerCase().trim();
    return subjectClaims.some((real) => {
      const normalizedReal = real.toLowerCase().trim();
      return normalizedReal.includes(normalizedClaim) || normalizedClaim.includes(normalizedReal);
    });
  }

  normalized.contradictions = normalized.contradictions.filter((c) => {
    if (!c || typeof c.subject_claim !== 'string') return false;
    return isRealSubjectClaim(c.subject_claim);
  });

  const ceiling = deriveConfidenceCeiling({
    realSources,
    evidence,
    contradictions: normalized.contradictions,
  });

  const aiLevel = normalized.confidence_level.level;
  const finalLevel = capConfidence(aiLevel, ceiling);

  if (finalLevel !== aiLevel) {
    normalized.confidence_level = {
      level: finalLevel,
      justification: `${normalized.confidence_level.justification} (Adjusted from "${aiLevel}" to "${finalLevel}" — the amount of real evidence and external verification available does not support higher confidence.)`,
    };
  }

  return normalized;
}