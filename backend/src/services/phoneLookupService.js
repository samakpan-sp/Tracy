const VERIPHONE_API_KEY = process.env.VERIPHONE_API_KEY;

export async function lookupPhoneNumber(phoneNumber) {
  if (!VERIPHONE_API_KEY) {
    throw new Error('Missing VERIPHONE_API_KEY in backend .env');
  }

  const url = `https://api.veriphone.io/v3/verify?phone=${encodeURIComponent(phoneNumber)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${VERIPHONE_API_KEY}` },
  });

  const data = await res.json();

  if (!res.ok || data.status === 'error') {
    throw new Error(`Veriphone error: ${data.message || `HTTP ${res.status}`}`);
  }

  return {
    valid: data.phone_valid,
    number: data.international_number || data.e164,
    countryName: data.country,
    countryCode: data.country_code,
    carrier: data.carrier || 'Unknown',
    lineType: data.phone_type || 'Unknown',
    region: data.phone_region || 'Unknown',
  };
}