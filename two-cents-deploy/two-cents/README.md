# Two Cents — Private Budget for Two

A free, private, local-first budgeting web app for couples.

- **AI statement parsing**: upload the monthly PDF (or a photo, or CSV) from any bank or credit card. The AI extracts every transaction and **remembers each bank's layout** for next time. Unlimited banks.
- **Smarter categorization**: merchants are categorized by what the business *actually is* (a "restaurant" that's really a bar gets caught), with an optional per-merchant web verification. Your corrections become permanent rules.
- **Prediction engine**: per-category sliders show exactly how much you free up per month / year / 5 years if you trim spending.
- **Insights**: subscription detection, insurance re-shop prompts, high-end grocery swap estimates.
- **Couple sharing**: every charge/insight/plan has a "draft a text" button. Modes: solo, open book, or **private amounts** (each partner controls whether the other sees their exact dollars).
- **Free**: runs on your own Google Gemini free-tier API key. **Private**: all data lives in your browser's IndexedDB; there is no server, no database, no account.

## Deploy to Vercel (free)

Option A — no terminal needed:
1. Create a free account at https://github.com and https://vercel.com (sign in to Vercel *with* GitHub).
2. On GitHub: New repository → name it `two-cents` → create. Click "uploading an existing file" and drag **all files in this folder** (keep the folder structure: `src/`, `public/`, `package.json`, `vite.config.js`, `index.html`). Commit.
3. On Vercel: Add New → Project → Import `two-cents`. Vercel auto-detects Vite. Click **Deploy**.
4. ~1 minute later you get a URL like `https://two-cents-xyz.vercel.app`. That's your app.

Option B — terminal:
```bash
npm install
npm run build        # sanity check
npx vercel           # log in, accept defaults
npx vercel --prod
```

## Install on your phone (it behaves like a native app)

The app is a PWA — no app store, no sideloading, works on both iPhone and Android:

- **iPhone (Safari)**: open your Vercel URL → Share button → **Add to Home Screen** → Add.
- **Android (Chrome)**: open the URL → you'll see an **Install app** prompt (or ⋮ menu → *Add to Home screen* / *Install*).

It opens full-screen with its own icon, and your data stays on that device.
**Couples on one login**: use the same URL on one shared device, or each install it — note that data is per-device/browser, so the "household" lives wherever you do the uploads (a shared tablet or one phone works best for the private-amounts mode).

## First use (5 minutes)

1. Open the app → pick a mode: **Just me**, **Couple — open book**, or **Couple — private amounts**.
2. Go to **Settings → AI key**: create a free key at https://aistudio.google.com/app/apikey (Google sign-in → Create API key → copy) and paste it. No credit card; stored only on your device.
3. (Optional) Settings → rename the two partners.
4. **Import** tab → "＋ New bank / card…" → name it (e.g., "Chase checking") → pick whose it is → **Upload statement** and choose the monthly **PDF** straight from your bank. Watch the running count ("…42 transactions extracted so far"). First statement from a new bank is the slowest — it's learning the layout.
5. **Transactions** tab → tap **Smart categorize**. Fix any category from the dropdown (the app remembers your correction forever). Flagged low-confidence rows have a **Verify online** button.
6. Repeat step 4 for each bank/credit card and each month you want covered (a few months gives much better averages).
7. Explore **Dashboard** (charts), **What-if** (savings sliders → share the plan), **Insights** (subscriptions, insurance, grocery swaps → "Draft a text").

## UAT checklist

Parsing & bank memory
- [ ] Upload a PDF statement for a brand-new bank → transactions appear; Import tab shows the bank with "✓ format remembered".
- [ ] Upload the *next month's* PDF from the same bank → status says it's using the remembered layout; no duplicate rows if you upload the same file twice.
- [ ] Upload a CSV from a second bank → parses; re-upload another CSV from it → uses saved column map.
- [ ] Upload a photo/screenshot of a statement page → transactions extracted.
- [ ] "Forget format" removes the bank; next upload re-learns it.

Categorization
- [ ] Smart categorize assigns sensible categories with confidence %, and a venue coded as a restaurant but known as a bar lands in Dining & Bars with a bar note.
- [ ] Change a category manually → every transaction from that merchant updates, marked "your rule", and stays after a page refresh.
- [ ] "Verify online" on a flagged row returns a category plus one-line evidence.

Charts, predictions, insights
- [ ] Dashboard shows pie, monthly bars, and top merchants matching the imported data.
- [ ] What-if: setting Dining −25% and Groceries −15% shows correct $/month (category monthly avg × percent) and a 12-month line.
- [ ] Insights detects a real subscription (e.g., Netflix monthly) with the right monthly amount.

Sharing & privacy
- [ ] Share button on a transaction drafts "What is this charge?" with merchant/amount/date; Copy works; "Open Messages" opens your SMS app with the text prefilled (on phone).
- [ ] In **private amounts** mode: viewing as Partner A, Partner B's amounts show as `$ •••.••` and dashboard totals are hidden; only Partner B (when selected as viewer) can flip their own "Share my amounts" switch.
- [ ] Switch to open book mode → all amounts visible.

Privacy & persistence
- [ ] Close the browser/app entirely, reopen → all data still there.
- [ ] Airplane-mode the phone → dashboard, transactions, what-if all still work (only AI buttons need network).
- [ ] Settings → Erase everything → app returns to first-run screen with no data.
- [ ] DevTools → Network during normal browsing: no requests except to `generativelanguage.googleapis.com` when you press an AI button.

## Notes & limits

- Gemini free tier: if you upload many statements back-to-back you may hit the per-minute limit — the app tells you to wait ~60 seconds. It never costs money.
- Data is per device/browser. To move devices, re-upload statements there (an export/import backup feature is an easy future add).
- Scanned/photographed statements parse best when the photo is sharp and flat.
