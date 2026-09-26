const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:5002';

export async function extractTextFromImage({ fileBuffer, originalName, mimeType }) {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append('file', blob, originalName);

  const response = await fetch(`${OCR_SERVICE_URL}/ocr`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `OCR service responded ${response.status}`);
  }

  const data = await response.json();
  return data.text || '';
}