const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isModelUnavailableError(err) {
  const msg = err.message || '';
  return msg.includes('404') || msg.includes('no longer available') || msg.includes('not found');
}

function isTransientError(err) {
  const msg = err.message || '';
  return msg.includes('429') || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand');
}

export async function withModelResilience(models, attemptFn, { retries = 2, baseDelayMs = 1500 } = {}) {
  const uniqueModels = [...new Set(models.filter(Boolean))];
  let lastErr;

  for (const modelName of uniqueModels) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await attemptFn(modelName);
      } catch (err) {
        lastErr = err;

        if (isModelUnavailableError(err)) {
          console.warn(`Model "${modelName}" unavailable — moving to next model in chain.`);
          break;
        }

        if (isTransientError(err) && attempt < retries) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          console.warn(`Transient error on "${modelName}" (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        console.warn(`Giving up on "${modelName}" after ${attempt + 1} attempt(s): ${err.message}`);
        break;
      }
    }
  }

  throw lastErr;
}