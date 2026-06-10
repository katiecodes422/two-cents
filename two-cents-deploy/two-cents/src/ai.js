// Free AI via your own Google Gemini API key (free tier).
// Get a key at https://aistudio.google.com/app/apikey — no card required.
// Only what's needed for the task is sent: statement file for parsing,
// merchant NAMES (no amounts/accounts) for categorization.

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

export async function gemini(apiKey, parts, opts = {}) {
  const { tools, maxOutputTokens = 8192 } = opts;
  let lastErr = null;
  for (const model of MODELS) {
    try {
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
        lastErr = new Error(msg);
        // model not available for this key → try the next one
        if (data.error.code === 404 || /not found|not supported/i.test(msg)) continue;
        if (data.error.code === 429) throw new Error("Free-tier rate limit reached — wait ~60 seconds and try again. It stays free.");
        throw lastErr;
      }
      return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    } catch (e) {
      lastErr = e;
      if (/rate limit/i.test(e.message)) throw e;
    }
  }
  throw lastErr || new Error("No Gemini model responded");
}

export function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("Couldn't read file"));
    r.readAsDataURL(file);
  });
}
