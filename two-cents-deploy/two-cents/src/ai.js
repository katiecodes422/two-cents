// Free AI via your own Google Gemini API key (free tier).
// v1.2 — model rotation + proactive throttle.
// Primary model is gemini-2.5-flash-lite: highest free-tier rate limits and
// least congested. On 429/503 we immediately hop to the next model instead of
// waiting on the busy one; long waits only happen if EVERY model is busy.

const MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Proactive throttle: never start two requests less than 7s apart.
// Keeps us under every model's free-tier requests-per-minute cap.
let lastCallAt = 0;
async function throttle(onWait) {
  const gap = 7000 - (Date.now() - lastCallAt);
  if (gap > 0) {
    if (gap > 2000) onWait?.(`Pacing requests to stay inside the free tier… (${Math.ceil(gap / 1000)}s)`);
    await sleep(gap);
  }
  lastCallAt = Date.now();
}

export async function gemini(apiKey, parts, opts = {}) {
  const { tools, maxOutputTokens = 8192, onWait } = opts;
  // Escalating waits between full passes over all models
  const passWaits = [0, 20000, 40000, 65000, 65000];
  let lastErr = null;

  for (let pass = 0; pass < passWaits.length; pass++) {
    if (passWaits[pass] > 0) {
      onWait?.(`All free models are busy — waiting ${passWaits[pass] / 1000}s before the next attempt. Keep this tab open.`);
      await sleep(passWaits[pass]);
    }
    for (const model of MODELS) {
      try {
        await throttle(onWait);
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts }],
              ...(tools ? { tools } : {}),
              generationConfig: { maxOutputTokens, temperature: 0.1 },
            }),
          }
        );
        const data = await res.json();
        if (data.error) {
          const msg = data.error.message || "Gemini error";
          const code = data.error.code;
          lastErr = new Error(`${msg} (${model})`);
          // busy / limited / missing → hop to the NEXT model immediately
          if (code === 429 || code === 503 || code === 404 || /overloaded|unavailable|not found|not supported|quota/i.test(msg)) {
            onWait?.(`${model} is busy or limited — trying the next free model…`);
            continue;
          }
          throw lastErr; // real error (bad key, malformed request) — don't burn retries
        }
        const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
        if (text.trim()) return text;
        lastErr = new Error(`Empty response (${model})`);
      } catch (e) {
        if (e instanceof TypeError) { // network blip — brief wait, next model
          lastErr = e;
          onWait?.("Network hiccup — retrying…");
          await sleep(5000);
          continue;
        }
        throw e;
      }
    }
  }
  throw lastErr || new Error("All free Gemini models stayed busy — try again in a few minutes.");
}

export function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("Couldn't read file"));
    r.readAsDataURL(file);
  });
}
