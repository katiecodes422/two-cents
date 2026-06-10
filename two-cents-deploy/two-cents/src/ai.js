// Free AI via your own Google Gemini API key (free tier).
// Get a key at https://aistudio.google.com/app/apikey — no card required.
// Only what's needed for the task is sent: statement file for parsing,
// merchant NAMES (no amounts/accounts) for categorization.

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Automatically rides out free-tier hiccups:
//   429 TooManyRequests  -> wait ~65s and retry (limits reset each minute)
//   503 ServiceUnavailable / overloaded -> wait 15s and retry
export async function gemini(apiKey, parts, opts = {}) {
  const { tools, maxOutputTokens = 8192, onWait } = opts;
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
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
          const code = data.error.code;
          lastErr = new Error(msg);
          if (code === 404 || /not found|not supported/i.test(msg)) continue; // try next model
          if (code === 429) {
            onWait?.("Free-tier rate limit hit — auto-retrying in ~65 seconds. Keep this tab open and the screen awake.");
            await sleep(65000);
            break; // retry outer loop, same model order
          }
          if (code === 503 || /overloaded|unavailable/i.test(msg)) {
            onWait?.("Google's free tier is briefly overloaded — auto-retrying in 15 seconds…");
            await sleep(15000);
            break;
          }
          throw lastErr;
        }
        const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
        if (text.trim()) return text;
        lastErr = new Error("Empty response");
      } catch (e) {
        if (e instanceof TypeError) {
          // network blip
          lastErr = e;
          onWait?.("Network hiccup — retrying in 10 seconds…");
          await sleep(10000);
          break;
        }
        lastErr = e;
        throw e;
      }
    }
  }
  throw lastErr || new Error("Gemini didn't respond after several retries — try again in a few minutes.");
}

export function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("Couldn't read file"));
    r.readAsDataURL(file);
  });
}
