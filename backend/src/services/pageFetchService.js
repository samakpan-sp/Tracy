import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';

const USER_AGENT = 'TRACY-InvestigationBot/1.0 (+single-request evidence verification; not a bulk crawler)';
const FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function isAllowedByRobotsTxt(targetUrl) {
  try {
    const { origin } = new URL(targetUrl);
    const robotsUrl = `${origin}/robots.txt`;
    const res = await fetchWithTimeout(robotsUrl, { headers: { 'User-Agent': USER_AGENT } });

    if (!res.ok) {
      // No robots.txt, or it errored — default to allowed (standard crawler behavior).
      return true;
    }

    const body = await res.text();
    const robots = robotsParser(robotsUrl, body);
    return robots.isAllowed(targetUrl, USER_AGENT) !== false;
  } catch {
    // If we can't check robots.txt at all, err toward NOT fetching —
    // safer default than assuming permission.
    return false;
  }
}

export async function fetchPublicPage(targetUrl) {
  const allowed = await isAllowedByRobotsTxt(targetUrl);
  if (!allowed) {
    return { blocked: true, reason: 'robots.txt disallows automated access to this page' };
  }

  try {
    const res = await fetchWithTimeout(targetUrl, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!res.ok) {
      return { blocked: false, error: `Page responded with status ${res.status}` };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return { blocked: false, error: 'Page did not return HTML content' };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    $('script, style, nav, footer, noscript').remove();

    const title = $('title').first().text().trim();
    const description = $('meta[name="description"]').attr('content')?.trim() || '';
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 3000);

    return {
      blocked: false,
      url: targetUrl,
      title,
      description,
      textSnippet: bodyText,
    };
  } catch (err) {
    return { blocked: false, error: `Fetch failed: ${err.message}` };
  }
}