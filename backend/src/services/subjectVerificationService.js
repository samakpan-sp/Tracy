import { fetchPublicPage } from './pageFetchService.js';
import { searchWeb } from './searchService.js';
import { lookupPhoneNumber } from './phoneLookupService.js';

// Platforms whose ToS prohibit automated access, or that are effectively
// always login-walled for meaningful profile content. Never fetched directly.
const BLOCKED_FETCH_PLATFORMS = ['instagram', 'facebook', 'tiktok', 'x', 'linkedin', 'whatsapp'];

// Platforms with genuinely static, publicly viewable pages that don't
// require login for basic profile/channel info.
const FETCHABLE_PLATFORMS = ['telegram', 'youtube', 'other'];

function looksLikeUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export async function verifySubject({ subjectType, subjectValue, subjectPlatform }) {
  // --- Phone number: licensed carrier lookup + search footprint check ---
  if (subjectType === 'phone_number') {
    const findings = [];

    try {
      const lookup = await lookupPhoneNumber(subjectValue);
      findings.push({
        source: 'Veriphone API lookup',
        title: 'Carrier/line verification',
        content: `Valid number: ${lookup.valid}. Carrier: ${lookup.carrier}. Line type: ${lookup.lineType}. Country: ${lookup.countryName} (${lookup.countryCode}). Region: ${lookup.region}.`,
      });
    } catch (err) {
      console.error('Phone lookup failed (continuing without it):', err.message);
    }

    const searchResult = await runSearchFallback(
      `"${subjectValue}"`,
      'Search results show where this exact number is publicly indexed (e.g. scam reports, forum complaints, business listings) — this is not proof the number itself is compromised or fraudulent, only where it appears.'
    );

    return {
      method: 'phone_lookup',
      note: searchResult.note,
      findings: [...findings, ...searchResult.findings],
    };
  }

  // --- Social profile ---
  if (subjectType === 'social_profile') {
    if (BLOCKED_FETCH_PLATFORMS.includes(subjectPlatform)) {
      return runSearchFallback(
        `${subjectPlatform} ${subjectValue}`,
        `Direct access to ${subjectPlatform} profiles is not permitted under this tool's guardrails (Terms of Service / login-wall). Findings below are from public search results only, not direct account inspection.`
      );
    }

    if (FETCHABLE_PLATFORMS.includes(subjectPlatform) && looksLikeUrl(subjectValue)) {
      const fetched = await fetchPublicPage(subjectValue);
      if (!fetched.blocked && !fetched.error) {
        return {
          method: 'direct_fetch',
          findings: [{ source: fetched.url, title: fetched.title, content: `${fetched.description}\n${fetched.textSnippet}`.trim() }],
        };
      }
      return runSearchFallback(`${subjectPlatform} ${subjectValue}`, fetched.reason || fetched.error);
    }

    return runSearchFallback(`${subjectPlatform} ${subjectValue}`, null);
  }

  // --- URL or business advert containing a URL ---
  const candidateUrl = looksLikeUrl(subjectValue) ? subjectValue : null;

  if (candidateUrl) {
    const fetched = await fetchPublicPage(candidateUrl);
    if (!fetched.blocked && !fetched.error) {
      return {
        method: 'direct_fetch',
        findings: [{ source: fetched.url, title: fetched.title, content: `${fetched.description}\n${fetched.textSnippet}`.trim() }],
      };
    }
    return runSearchFallback(subjectValue, fetched.reason || fetched.error);
  }

  // Business advert with no direct URL — search on the description itself.
  return runSearchFallback(subjectValue, null);
}

async function runSearchFallback(query, contextNote) {
  try {
    const results = await searchWeb(query);
    return {
      method: 'search',
      note: contextNote,
      findings: results.map((r) => ({ source: r.url, title: r.title, content: r.snippet })),
    };
  } catch (err) {
    console.error('Search fallback failed:', err.message);
    return { method: 'search_failed', note: contextNote, findings: [] };
  }
}