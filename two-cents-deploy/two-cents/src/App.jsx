import React, { useState, useEffect, useMemo, useRef } from "react";
import Papa from "papaparse";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip,
  ResponsiveContainer, LineChart, Line, Legend, CartesianGrid,
} from "recharts";
import {
  Upload, Lock, Unlock, Share2, TrendingDown, Eye, EyeOff, Sparkles,
  RefreshCw, Check, X, AlertTriangle, Search, Copy, MessageSquare,
  PiggyBank, Repeat, Trash2, ChevronRight, Wallet, Settings as SettingsIcon,
} from "lucide-react";
import { loadKey, saveKey, deleteKey } from "./storage";
import { gemini, fileToBase64 } from "./ai";

/* ============================================================
   TWO CENTS — a private, local-first budget app for couples.
   All data lives in your browser's IndexedDB (never a server).
   AI parsing & categorization run on YOUR free Gemini API key.
   ============================================================ */

const C = {
  bg: "#F3F5F1", card: "#FFFFFF", ink: "#22312A", sub: "#5E6B63",
  line: "#DDE3DC", green: "#176B4F", greenSoft: "#E2EFE9",
  cut: "#B5563C", cutSoft: "#F6E7E1", gold: "#9A7B1E", goldSoft: "#F5EEDB",
  violet: "#56608F", violetSoft: "#E8EAF4",
};

const CATEGORIES = {
  "Housing & Mortgage": "#22577A", Insurance: "#56608F", Utilities: "#3A7CA5",
  Groceries: "#176B4F", "Dining & Bars": "#B5563C", Transportation: "#7A6C5D",
  "Subscriptions & Streaming": "#8E44AD", Shopping: "#C0762C", Health: "#2D8077",
  Travel: "#1F7A8C", Entertainment: "#A84E6F", "Kids & Pets": "#6B8E23",
  Income: "#147A3D", Transfers: "#9AA5B1", "Fees & Interest": "#8A8378", Other: "#6E7B74",
};
const CAT_LIST = Object.keys(CATEGORIES);

// Standardized subcategories — the AI must pick from these so they roll up cleanly.
const SUBCATS = {
  "Housing & Mortgage": ["Mortgage", "Rent", "HOA & property", "Home maintenance"],
  Insurance: ["Home insurance", "Auto insurance", "Health & life", "Other policies"],
  Utilities: ["Power & gas", "Water & trash", "Internet & cable", "Phone"],
  Groceries: ["Supermarket", "High-end grocer", "Budget grocer", "Warehouse club", "Convenience store"],
  "Dining & Bars": ["Restaurant", "Fast food", "Bar & nightlife", "Coffee & cafe", "Delivery & takeout"],
  Transportation: ["Gas & fuel", "Rideshare", "Tolls & parking", "Auto service", "Public transit"],
  "Subscriptions & Streaming": ["Streaming", "Software & apps", "Memberships", "News & media"],
  Shopping: ["Online retail", "Home improvement", "Clothing", "Electronics", "General retail"],
  Health: ["Pharmacy", "Doctor & dental", "Fitness", "Vision & other"],
  Travel: ["Flights", "Hotels & stays", "Rental cars", "Vacation activities"],
  Entertainment: ["Movies & events", "Games", "Hobbies"],
  "Kids & Pets": ["Childcare & school", "Kids activities", "Pet food & supplies", "Vet"],
  Income: ["Salary", "Refunds", "Other income"],
  Transfers: ["P2P apps", "Account transfer"],
  "Fees & Interest": ["Bank fees", "Interest", "Late fees"],
  Other: ["Misc"],
};
// Snap a free-text sub onto the standard list for its category (keeps rollups clean).
function normSub(cat, sub) {
  const list = SUBCATS[cat] || [];
  if (!sub) return "";
  const s = sub.trim().toLowerCase();
  for (const x of list) if (x.toLowerCase() === s) return x;
  for (const x of list) if (x.toLowerCase().includes(s) || s.includes(x.toLowerCase())) return x;
  return sub.trim();
}

// Built-in keyword rules: first-pass signal before AI review.
const KEYWORD_RULES = [
  [/mortgage|mtg|loan pmt|wells fargo home|rocket mort|mr cooper|loandepot/i, "Housing & Mortgage", "Mortgage"],
  [/rent\b|property mgmt|hoa/i, "Housing & Mortgage", "Rent"],
  [/geico|state farm|progressive|allstate|usaa ins|citizens ins|liberty mut|insur/i, "Insurance", ""],
  [/comcast|xfinity|spectrum|frontier/i, "Utilities", "Internet & cable"],
  [/t-mobile|verizon|at&t|att\b/i, "Utilities", "Phone"],
  [/electric|duke energy|teco|fpl|water util|gas co/i, "Utilities", "Power & gas"],
  [/whole foods|fresh market|sprouts|erewhon/i, "Groceries", "High-end grocer"],
  [/aldi|walmart|wal-mart|winn dixie/i, "Groceries", "Budget grocer"],
  [/costco|sams club/i, "Groceries", "Warehouse club"],
  [/publix|kroger|trader joe|grocery/i, "Groceries", "Supermarket"],
  [/starbucks|dunkin|coffee|cafe\b/i, "Dining & Bars", "Coffee & cafe"],
  [/mcdonald|burger king|wendy|taco bell|chick-fil-a|chipotle|subway\b|kfc|popeyes|five guys|panda express/i, "Dining & Bars", "Fast food"],
  [/brewery|tavern|pub\b|bar\b|cantina|saloon|taproom|lounge/i, "Dining & Bars", "Bar & nightlife"],
  [/uber eats|doordash|grubhub|instacart|postmates/i, "Dining & Bars", "Delivery & takeout"],
  [/restaurant|grill|pizza|sushi|taco|wing|bistro|diner|steakhouse|kitchen/i, "Dining & Bars", "Restaurant"],
  [/shell|chevron|exxon|wawa|racetrac|circle k|7-eleven/i, "Transportation", "Gas & fuel"],
  [/uber(?!.*eats)|lyft/i, "Transportation", "Rideshare"],
  [/sunpass|toll|parking/i, "Transportation", "Tolls & parking"],
  [/autozone|jiffy lube|tire|oil change/i, "Transportation", "Auto service"],
  [/netflix|spotify|hulu|disney\+|max\b|paramount|youtube prem|audible|prime video/i, "Subscriptions & Streaming", "Streaming"],
  [/apple\.com\/bill|icloud|dropbox|adobe|canva|chatgpt|claude\.ai/i, "Subscriptions & Streaming", "Software & apps"],
  [/patreon|onlyf/i, "Subscriptions & Streaming", "Memberships"],
  [/home depot|lowes/i, "Shopping", "Home improvement"],
  [/amazon|amzn|etsy|ebay/i, "Shopping", "Online retail"],
  [/best buy/i, "Shopping", "Electronics"],
  [/marshalls|tj maxx|ross\b/i, "Shopping", "Clothing"],
  [/target|ikea/i, "Shopping", "General retail"],
  [/cvs|walgreens|pharmacy/i, "Health", "Pharmacy"],
  [/dental|dr\.|clinic|hospital|lab corp|quest diag/i, "Health", "Doctor & dental"],
  [/gym|planet fitness|la fitness/i, "Health", "Fitness"],
  [/airline|delta air|southwest|united air|american air|spirit air/i, "Travel", "Flights"],
  [/hotel|marriott|hilton|airbnb|vrbo|expedia/i, "Travel", "Hotels & stays"],
  [/amc\b|cinema|theatre|ticketmaster/i, "Entertainment", "Movies & events"],
  [/steam games|playstation|xbox|nintendo/i, "Entertainment", "Games"],
  [/petco|petsmart|chewy/i, "Kids & Pets", "Pet food & supplies"],
  [/daycare|tuition/i, "Kids & Pets", "Childcare & school"],
  [/payroll|direct dep|deposit|salary|irs treas|tax ref/i, "Income", "Salary"],
  [/zelle|venmo|transfer|xfer|paypal/i, "Transfers", "P2P apps"],
  [/overdraft|interest charge/i, "Fees & Interest", "Interest"],
  [/late fee|annual fee|service fee|atm fee/i, "Fees & Interest", "Bank fees"],
];

const HIGH_END_GROCERS = /whole foods|fresh market|sprouts|erewhon/i;
const BUDGET_GROCERS = "Aldi, Walmart, or Publix BOGO deals";

const fmt = (n) =>
  (n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n) => "$" + Math.round(Math.abs(n)).toLocaleString();
const monthKey = (d) => d.slice(0, 7);
const uid = () => Math.random().toString(36).slice(2, 10);

const normMerchant = (desc) =>
  desc.replace(/\d{4,}/g, "").replace(/[#*]\S*/g, "").replace(/\s+(fl|tx|ca|ny|ga|nc|wa|us)\b.*$/i, "")
    .replace(/pos |debit |purchase |card \d+|recurring |ach |web /gi, "").replace(/\s+/g, " ").trim().slice(0, 40);

function parseDateAny(s) {
  if (!s) return null;
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  const d = new Date(t);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

function ruleCategory(desc) {
  for (const [re, cat, sub] of KEYWORD_RULES) if (re.test(desc)) return { cat, sub: sub || "" };
  return null;
}

/* ---------- AI: multi-signal categorization (your free Gemini key) ---------- */
async function aiCategorize(apiKey, merchants, onWait) {
  const prompt = `You are a financial transaction categorizer that does NOT blindly trust default merchant codes.
For each merchant below, use everything you know about the actual business (what it really is, its reputation,
whether a "restaurant" code is really a bar, whether a store is a high-end or budget grocer, etc.).
Categories: ${CAT_LIST.join(", ")}.
For "sub" you MUST choose one of the allowed subcategories of the chosen category:
${Object.entries(SUBCATS).map(([c, s]) => c + ": " + s.join(" / ")).join("\n")}
Respond ONLY with a JSON array, no prose, no markdown fences. Each item:
{"m": "<merchant exactly as given>", "category": "<one category>", "sub": "<one allowed subcategory>", "confidence": 0-100, "note": "<max 12 words on what this business actually is>"}
Merchants:
${merchants.map((m) => "- " + m).join("\n")}`;
  const text = await gemini(apiKey, [{ text: prompt }], { onWait });
  const clean = text.replace(/```json|```/g, "").trim();
  const m = clean.match(/\[[\s\S]*\]/);
  return JSON.parse(m ? m[0] : clean);
}

async function aiVerifyMerchant(apiKey, merchant) {
  const prompt = `Search the web for the business "${merchant}". Check its website, reviews, and photo descriptions to determine what it ACTUALLY is (e.g., coded as a restaurant but really a bar; coded retail but really a grocer).
Then respond ONLY with JSON (no fences): {"category": "<one of: ${CAT_LIST.join(", ")}>", "sub": "<short subcategory>", "confidence": 0-100, "evidence": "<one sentence: what the website/reviews show>"}`;
  let text;
  try {
    text = await gemini(apiKey, [{ text: prompt }], { tools: [{ google_search: {} }] });
  } catch {
    // grounding unavailable on this key/model → fall back to model knowledge
    text = await gemini(apiKey, [{ text: prompt.replace("Search the web for", "Using what you know about") }]);
  }
  const m = text.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : null;
}

/* ---------- AI: full statement parsing (PDF / image / tricky CSV) ----------
   The AI reads the raw statement, extracts every transaction, and writes a
   short "layout profile" for that bank. The profile is saved and replayed on
   future uploads from the same bank, so parsing gets faster and more exact. */
async function aiExtractTransactions(apiKey, b64, mediaType, knownProfile, onProgress, onWait) {
  const docPart = { inline_data: { mime_type: mediaType, data: b64 } };
  let all = [];
  let profile = knownProfile || null;
  let lastLine = null;
  for (let round = 0; round < 6; round++) {
    const instr = round === 0
      ? `Extract EVERY transaction from this bank or credit-card statement.${profile ? `\nYou have parsed this bank's statements before — known layout: ${profile}` : ""}
Output ONLY the following, no prose, no markdown:
${profile ? "" : "First line: PROFILE|<max 25 words: bank name, layout, date format, whether charges appear positive or negative, sections to skip>\n"}Then ONE line per transaction: YYYY-MM-DD|merchant or description|amount
amount must be NEGATIVE for money out (purchases, charges, fees, payments sent) and POSITIVE for money in (deposits, refunds, payments received). Convert credit-card charges to negative even if the statement prints them as positive. Skip running balances, daily totals, summary boxes, and interest-rate tables.
After the FINAL transaction print <<END>> on its own line. If you cannot fit them all, stop after a complete line and print <<MORE>>.`
      : `Continue extracting transactions from this same statement, strictly AFTER this one: "${lastLine}".
Same format — one line per transaction: YYYY-MM-DD|description|amount (negative = money out). No prose. Print <<END>> after the final transaction, or <<MORE>> if there are still more.`;
    let text;
    try {
      text = await gemini(apiKey, [docPart, { text: instr }], { onWait });
    } catch (e) {
      if (all.length > 0) { onProgress?.(all.length); break; } // keep what we already extracted
      throw e;
    }
    let added = 0;
    text.split("\n").forEach((lnRaw) => {
      const ln = lnRaw.trim();
      if (!ln || ln.startsWith("<<")) return;
      if (ln.startsWith("PROFILE|")) { profile = ln.slice(8).trim(); return; }
      const parts = ln.split("|");
      if (parts.length < 3) return;
      const date = parseDateAny(parts[0]);
      const amount = parseFloat(parts[parts.length - 1].replace(/[$,]/g, ""));
      const desc = parts.slice(1, -1).join("|").trim();
      if (!date || !desc || isNaN(amount)) return;
      lastLine = ln;
      if (!all.some((t) => t.date === date && t.desc === desc && t.amount === amount)) {
        all.push({ date, desc, amount }); added++;
      }
    });
    onProgress?.(all.length);
    if (text.includes("<<END>>") || added === 0) break;
  }
  return { txns: all, profile };
}

// For CSVs whose columns the auto-detector can't figure out: ask AI once, remember forever.
async function aiMapCSVColumns(apiKey, sampleText) {
  const prompt = `Here are the first lines of a bank-statement CSV:
${sampleText}
Respond ONLY with JSON (no fences): {"dateCol": <0-based index>, "descCol": <index>, "amountCol": <index or -1>, "debitCol": <index or -1>, "creditCol": <index or -1>, "headerRows": <number of rows before data>, "spendingIsPositive": <true if charges/purchases appear as positive numbers>, "note": "<max 15 words on this format>"}`;
  const text = await gemini(apiKey, [{ text: prompt }]);
  const m = text.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : null;
}

/* ---------- recurring / subscription detection ---------- */
function detectSubscriptions(txns) {
  const groups = {};
  txns.filter((t) => t.amount < 0).forEach((t) => {
    const k = normMerchant(t.desc).toLowerCase();
    (groups[k] = groups[k] || []).push(t);
  });
  const subs = [];
  for (const [k, list] of Object.entries(groups)) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const amts = sorted.map((t) => Math.abs(t.amount));
    const avg = amts.reduce((a, b) => a + b, 0) / amts.length;
    const steady = amts.every((a) => Math.abs(a - avg) / avg < 0.18);
    let cadence = 0, gaps = 0;
    for (let i = 1; i < sorted.length; i++) {
      const g = (new Date(sorted[i].date) - new Date(sorted[i - 1].date)) / 86400000;
      if (g >= 24 && g <= 38) cadence++;
      gaps++;
    }
    if (steady && gaps > 0 && cadence / gaps >= 0.5)
      subs.push({ merchant: sorted[0].desc, key: k, monthly: avg, count: sorted.length, last: sorted[sorted.length - 1], category: sorted[0].category });
  }
  return subs.sort((a, b) => b.monthly - a.monthly);
}

/* ---------- sample data so the app works before any upload ---------- */
function sampleCSV(partner) {
  const rows = [["Date", "Description", "Amount"]];
  const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"];
  months.forEach((m, i) => {
    rows.push([`${m}-01`, "ACH ROCKET MORTGAGE PMT", "-2140.00"]);
    rows.push([`${m}-03`, "CITIZENS INS PREMIUM", "-310.00"]);
    rows.push([`${m}-05`, "TECO ELECTRIC UTIL", `-${(180 + i * 12).toFixed(2)}`]);
    rows.push([`${m}-06`, "NETFLIX.COM", "-22.99"]);
    rows.push([`${m}-07`, "SPOTIFY USA", "-11.99"]);
    rows.push([`${m}-09`, partner === "A" ? "WHOLE FOODS MKT #102 TAMPA" : "PUBLIX SUPER MARKET #441", partner === "A" ? "-214.55" : "-138.20"]);
    rows.push([`${m}-12`, "THE BLIND GOAT TAMPA", "-86.40"]); // coded restaurant, actually a bar
    rows.push([`${m}-14`, "SHELL OIL 5571", "-52.10"]);
    rows.push([`${m}-16`, partner === "A" ? "WHOLE FOODS MKT #102 TAMPA" : "ALDI 77 TOWN N COUNTRY", partner === "A" ? "-198.30" : "-96.75"]);
    rows.push([`${m}-18`, "AMZN MKTP US*2K4", `-${(75 + i * 9).toFixed(2)}`]);
    rows.push([`${m}-20`, "PLANET FITNESS", "-24.99"]);
    rows.push([`${m}-22`, "CHIPOTLE 1190", "-31.85"]);
    rows.push([`${m}-25`, "DOORDASH*PADTHAI", "-44.60"]);
    rows.push([`${m}-26`, "PAYROLL DIRECT DEP ACME CO", partner === "A" ? "4350.00" : "3890.00"]);
    rows.push([`${m}-27`, "VENMO TRANSFER", "-120.00"]);
  });
  return Papa.unparse(rows);
}

/* ============================ UI bits ============================ */
const Card = ({ children, style }) => (
  <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 18, ...style }}>{children}</div>
);
const H = ({ children }) => (
  <div style={{ fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: C.sub, fontWeight: 600, marginBottom: 10 }}>{children}</div>
);
const Btn = ({ children, onClick, tone = "ink", small, disabled }) => {
  const tones = {
    ink: { background: C.ink, color: "#fff" }, green: { background: C.green, color: "#fff" },
    cut: { background: C.cut, color: "#fff" }, ghost: { background: "transparent", color: C.ink, border: `1px solid ${C.line}` },
    violet: { background: C.violet, color: "#fff" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...tones[tone], opacity: disabled ? 0.5 : 1, border: tones[tone].border || "none", borderRadius: 9,
      padding: small ? "6px 11px" : "10px 16px", fontSize: small ? 12.5 : 14, fontWeight: 600, cursor: disabled ? "default" : "pointer",
      display: "inline-flex", alignItems: "center", gap: 6,
    }}>{children}</button>
  );
};
const Amt = ({ v, masked, big }) => (
  <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: big ? 26 : 13.5, fontWeight: 600, color: v >= 0 ? C.green : C.ink, letterSpacing: "-0.01em" }}>
    {masked ? "$ •••.••" : fmt(v)}
  </span>
);
const Pill = ({ cat }) => (
  <span style={{ background: (CATEGORIES[cat] || C.sub) + "1A", color: CATEGORIES[cat] || C.sub, borderRadius: 99, padding: "2px 9px", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" }}>{cat}</span>
);

/* ============================ APP ============================ */
export default function TwoCents() {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [settings, setSettings] = useState({ mode: null, partners: ["Partner 1", "Partner 2"], shareExact: { A: true, B: true } });
  const [me, setMe] = useState("A"); // who's viewing right now
  const [txnsA, setTxnsA] = useState([]);
  const [txnsB, setTxnsB] = useState([]);
  const [rules, setRules] = useState({}); // user corrections: merchantKey -> {category, sub}
  const [busy, setBusy] = useState("");
  const [share, setShare] = useState(null); // {title, text}
  const [cuts, setCuts] = useState({}); // category -> percent
  const [drill, setDrill] = useState(null); // category being drilled into on the dashboard
  const [q, setQ] = useState(""); // transactions search filter
  const [showAll, setShowAll] = useState(false);
  const fileRef = useRef();
  const [pasteText, setPasteText] = useState("");
  const [importBank, setImportBank] = useState("");
  const [bankPick, setBankPick] = useState("__new__"); // saved bank or "__new__"
  const [importOwner, setImportOwner] = useState("A");
  const [banks, setBanks] = useState({}); // bankName -> {kind, notes, csvMap, lastUsed, count}
  const [apiKey, setApiKey] = useState("");

  /* ---- load persisted state ---- */
  useEffect(() => {
    (async () => {
      setSettings(await loadKey("tc:settings", { mode: null, partners: ["Partner 1", "Partner 2"], shareExact: { A: true, B: true } }));
      setTxnsA(await loadKey("tc:txns:A", []));
      setTxnsB(await loadKey("tc:txns:B", []));
      setRules(await loadKey("tc:rules", {}));
      setCuts(await loadKey("tc:cuts", {}));
      setBanks(await loadKey("tc:banks", {}));
      setApiKey(await loadKey("tc:apikey", ""));
      setLoaded(true);
    })();
  }, []);
  useEffect(() => { if (loaded) saveKey("tc:settings", settings); }, [settings, loaded]);
  useEffect(() => { if (loaded) saveKey("tc:txns:A", txnsA); }, [txnsA, loaded]);
  useEffect(() => { if (loaded) saveKey("tc:txns:B", txnsB); }, [txnsB, loaded]);
  useEffect(() => { if (loaded) saveKey("tc:rules", rules); }, [rules, loaded]);
  useEffect(() => { if (loaded) saveKey("tc:cuts", cuts); }, [cuts, loaded]);
  useEffect(() => { if (loaded) saveKey("tc:banks", banks); }, [banks, loaded]);
  useEffect(() => { if (loaded) saveKey("tc:apikey", apiKey); }, [apiKey, loaded]);
  const needKey = () => {
    setBusy("Add your free Gemini API key first (Settings → AI key). Takes 2 minutes, no card needed.");
    setTab("settings");
    setTimeout(() => setBusy(""), 7000);
  };

  const isPrivate = settings.mode === "private";
  const canSeeExact = (owner) => !isPrivate || owner === me || settings.shareExact[owner];
  const allTxns = useMemo(() => [...txnsA.map(t => ({ ...t, owner: "A" })), ...txnsB.map(t => ({ ...t, owner: "B" }))].sort((a, b) => b.date.localeCompare(a.date)), [txnsA, txnsB]);
  const spend = allTxns.filter((t) => t.amount < 0 && t.category !== "Transfers");
  const setOwnerTxns = (owner, fn) => (owner === "A" ? setTxnsA(fn) : setTxnsB(fn));
  const txnMatch = (t) => {
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return t.desc.toLowerCase().includes(s) || (t.bank || "").toLowerCase().includes(s) ||
      t.category.toLowerCase().includes(s) || (t.sub || "").toLowerCase().includes(s) ||
      Math.abs(t.amount).toFixed(2).includes(s.replace(/[$-]/g, ""));
  };

  /* ---- ingest: shared pipeline for every source (CSV, PDF, image) ---- */
  function ingest(records, bank, owner) {
    const out = records.map(({ date, desc, amount }) => {
      const key = normMerchant(desc).toLowerCase();
      const userRule = rules[key];
      const rc = ruleCategory(desc);
      return {
        id: uid(), date, desc, amount, bank: bank || "Bank",
        category: userRule?.category || rc?.cat || (amount > 0 ? "Income" : "Other"),
        sub: userRule?.sub || rc?.sub || "", source: userRule ? "you" : rc ? "rules" : "pending",
        confidence: userRule ? 100 : rc ? 70 : 0,
      };
    });
    if (!out.length) { alert("No transactions found in that statement."); return 0; }
    setOwnerTxns(owner, (prev) => {
      const seen = new Set(prev.map((t) => t.date + t.desc + t.amount));
      return [...prev, ...out.filter((t) => !seen.has(t.date + t.desc + t.amount))];
    });
    return out.length;
  }

  function rememberBank(name, patch) {
    setBanks((b) => ({ ...b, [name]: { ...(b[name] || {}), ...patch, lastUsed: new Date().toISOString().slice(0, 10), count: ((b[name] || {}).count || 0) + 1 } }));
  }

  /* ---- CSV path: use the bank's remembered column map; learn it if new ---- */
  async function parseStatement(text, bank, owner) {
    const parsed = Papa.parse(text.trim(), { skipEmptyLines: true });
    const rows = parsed.data;
    if (!rows.length) { alert("Couldn't read that file — try the original CSV or PDF from your bank."); return; }
    const num = (s) => { const n = parseFloat(String(s || "").replace(/[$,()]/g, "")); return isNaN(n) ? null : (/\(/.test(s) ? -Math.abs(n) : n); };

    const extract = (map) => {
      const recs = [];
      rows.slice(map.headerRows).forEach((r) => {
        const date = parseDateAny(r[map.dateCol]); if (!date) return;
        const desc = (r[map.descCol] || "").trim(); if (!desc) return;
        let amount = null;
        if (map.debitCol >= 0 || map.creditCol >= 0) {
          const d = num(r[map.debitCol]), c = num(r[map.creditCol]);
          amount = d != null && d !== 0 ? -Math.abs(d) : c != null ? Math.abs(c) : null;
        } else amount = num(r[map.amountCol]);
        if (amount == null) return;
        if (map.spendingIsPositive) amount = -amount;
        recs.push({ date, desc, amount });
      });
      return recs;
    };

    // 1) Remembered format for this bank
    let map = banks[bank]?.csvMap;
    let learned = "remembered format";
    // 2) Auto-detect from headers
    if (!map) {
      const hi = rows.findIndex((r) => r.some((c) => /date/i.test(c)) && r.some((c) => /desc|memo|payee|detail|merchant/i.test(c)));
      if (hi >= 0) {
        const header = rows[hi].map((c) => String(c).toLowerCase());
        const col = (re) => header.findIndex((h) => re.test(h));
        map = {
          headerRows: hi + 1, dateCol: Math.max(col(/date/), 0), descCol: Math.max(col(/desc|memo|payee|detail|merchant/), 1),
          amountCol: col(/^amount|amt/), debitCol: col(/debit|withdraw/), creditCol: col(/credit|deposit/),
          spendingIsPositive: false,
        };
        if (map.amountCol < 0 && map.debitCol < 0) map.amountCol = 2;
        learned = "auto-detected headers";
      }
    }
    // 3) AI figures the format out once, then it's remembered for this bank
    if (!map || extract(map).length === 0) {
      setBusy(`First time seeing this format from ${bank} — asking AI to learn the layout (free)…`);
      try {
        const sample = rows.slice(0, 12).map((r) => r.join(",")).join("\n");
        const ai = apiKey ? await aiMapCSVColumns(apiKey, sample) : null;
        if (ai) { map = ai; learned = `AI learned: ${ai.note || "column layout"}`; }
      } catch { /* fall through */ }
    }
    if (!map) { alert("Couldn't understand this CSV. Try uploading the PDF version instead — the AI parser reads those directly."); return; }
    const recs = extract(map);
    if (!recs.length) { alert("Found the columns but no transaction rows. Try the PDF version of the statement instead."); return; }
    const n = ingest(recs, bank, owner);
    rememberBank(bank, { kind: "csv", csvMap: map, notes: map.note || learned });
    setBusy(`Imported ${n} transactions from ${bank} (${learned} — saved for next time). Run “Smart categorize” to verify categories.`);
    setTab("transactions");
    setTimeout(() => setBusy(""), 7000);
  }

  /* ---- PDF / image path: AI reads the statement itself ---- */
  async function aiParseDocument(file, bank, owner) {
    if (!apiKey) return needKey();
    let wakeLock = null;
    try { wakeLock = await navigator.wakeLock?.request("screen"); } catch {}
    const releaseWake = () => { try { wakeLock?.release(); } catch {} };
    const known = banks[bank]?.notes;
    setBusy(known
      ? `Parsing ${bank} statement — using the layout learned from your last upload…`
      : `Parsing & learning ${bank}'s statement layout with AI — long statements can take a few minutes. It's free; feel free to check back.`);
    try {
      const b64 = await fileToBase64(file);
      const mediaType = file.type === "application/pdf" ? "application/pdf" : (file.type || "image/png");
      const { txns, profile } = await aiExtractTransactions(apiKey, b64, mediaType, known,
        (n) => setBusy(`Parsing ${bank} statement… ${n} transactions extracted so far. Keep this tab open and the screen awake.`),
        (msg) => setBusy(msg));
      if (!txns.length) { setBusy("AI couldn't find transactions in that file. If it's a scanned statement, try a clearer photo or the CSV export."); setTimeout(() => setBusy(""), 8000); return; }
      const n = ingest(txns, bank, owner);
      releaseWake();
      rememberBank(bank, { kind: file.type === "application/pdf" ? "pdf" : "image", notes: profile });
      setBusy(`Imported ${n} transactions from ${bank}. ${known ? "Used the remembered layout." : `Layout learned and saved — the next ${bank} statement parses automatically.`} Run “Smart categorize” next.`);
      setTab("transactions");
    } catch (e) {
      releaseWake();
      setBusy(`Parsing failed after several automatic retries (${e.message || "free-tier limit"}). Nothing was saved — upload the same file again in a few minutes.`);
      setTimeout(() => setBusy(""), 60000);
      return;
    }
    setTimeout(() => setBusy(""), 9000);
  }

  function handleFile(f) {
    const bank = (bankPick !== "__new__" ? bankPick : importBank.trim()) || f.name.replace(/\.\w+$/, "");
    const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
    const isImg = /^image\//.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name);
    if (isPdf || isImg) { aiParseDocument(f, bank, importOwner); return; }
    const r = new FileReader();
    r.onload = () => parseStatement(r.result, bank, importOwner);
    r.readAsText(f);
  }


  /* ---- AI categorize pending + low-confidence ---- */
  async function runSmartCategorize() {
    const subOK = (t) => (SUBCATS[t.category] || []).includes(normSub(t.category, t.sub));
    const need = [...new Set(allTxns.filter((t) => t.source === "pending" || (t.source === "rules" && t.confidence < 80) || (t.source !== "you" && !subOK(t))).map((t) => normMerchant(t.desc)))].slice(0, 60);
    if (!apiKey) return needKey();
    if (!need.length) { setBusy("Everything is already categorized. Correct any row to teach the app."); setTimeout(() => setBusy(""), 4000); return; }
    setBusy(`Parsing & categorizing ${need.length} merchants with AI (multi-signal review)… this is free — give it a minute and check back.`);
    try {
      for (let i = 0; i < need.length; i += 18) {
        const batch = need.slice(i, i + 18);
        const results = await aiCategorize(apiKey, batch, (msg) => setBusy(msg));
        const map = {};
        results.forEach((r) => { if (CAT_LIST.includes(r.category)) map[r.m.toLowerCase()] = r; });
        const apply = (list) => list.map((t) => {
          const r = map[normMerchant(t.desc).toLowerCase()];
          if (!r || rules[normMerchant(t.desc).toLowerCase()]) return t;
          return { ...t, category: r.category, sub: normSub(r.category, r.sub), source: "ai", confidence: r.confidence, note: r.note };
        });
        setTxnsA(apply); setTxnsB(apply);
      }
      setBusy("Done — AI reviewed each merchant for what it actually is. Low-confidence rows are flagged for your review.");
    } catch (e) { setBusy("AI categorization hit a snag (rate limit or network). Wait a minute and try again — it stays free."); }
    setTimeout(() => setBusy(""), 7000);
  }

  async function verifyOne(t) {
    if (!apiKey) return needKey();
    setBusy(`Checking the web (site, reviews, photos) for “${normMerchant(t.desc)}”…`);
    try {
      const r = await aiVerifyMerchant(apiKey, normMerchant(t.desc));
      if (r && CAT_LIST.includes(r.category)) {
        correct(t, r.category, normSub(r.category, r.sub), r.evidence);
        setBusy(`Verified: ${r.category} (${r.sub}) — ${r.evidence}`);
      } else setBusy("Couldn't verify confidently — left it for your call.");
    } catch { setBusy("Web verification rate-limited right now — try again in a minute (still free)."); }
    setTimeout(() => setBusy(""), 8000);
  }

  function correct(t, category, sub = "", note = "") {
    const key = normMerchant(t.desc).toLowerCase();
    setRules((r) => ({ ...r, [key]: { category, sub } }));
    const apply = (list) => list.map((x) => normMerchant(x.desc).toLowerCase() === key ? { ...x, category, sub, source: "you", confidence: 100, note } : x);
    setTxnsA(apply); setTxnsB(apply);
  }

  /* ---- aggregates ---- */
  const months = useMemo(() => [...new Set(spend.map((t) => monthKey(t.date)))].sort(), [spend]);
  const nMonths = Math.max(months.length, 1);
  const byCat = useMemo(() => {
    const m = {};
    spend.forEach((t) => (m[t.category] = (m[t.category] || 0) + Math.abs(t.amount)));
    return Object.entries(m).map(([name, value]) => ({ name, value, monthly: value / nMonths })).sort((a, b) => b.value - a.value);
  }, [spend, nMonths]);
  const byMonth = useMemo(() => months.map((m) => ({
    month: m.slice(2), spend: spend.filter((t) => monthKey(t.date) === m).reduce((s, t) => s + Math.abs(t.amount), 0),
    income: allTxns.filter((t) => t.amount > 0 && t.category === "Income" && monthKey(t.date) === m).reduce((s, t) => s + t.amount, 0),
  })), [months, spend, allTxns]);
  const drillTxns = useMemo(() => (drill ? spend.filter((t) => t.category === drill) : []), [drill, spend]);
  const drillBySub = useMemo(() => {
    const m = {};
    drillTxns.forEach((t) => { const k = normSub(drill, t.sub) || "Needs subcategory"; m[k] = (m[k] || 0) + Math.abs(t.amount); });
    return Object.entries(m).map(([name, value]) => ({ name, value, monthly: value / nMonths })).sort((a, b) => b.value - a.value);
  }, [drillTxns, drill, nMonths]);
  const drillMerchants = useMemo(() => {
    const m = {};
    drillTxns.forEach((t) => {
      const k = normMerchant(t.desc);
      m[k] = m[k] || { total: 0, n: 0, sub: normSub(drill, t.sub) || "Needs subcategory" };
      m[k].total += Math.abs(t.amount); m[k].n++;
    });
    return Object.entries(m).sort((a, b) => b[1].total - a[1].total).slice(0, 12);
  }, [drillTxns, drill]);
  const subs = useMemo(() => detectSubscriptions(allTxns), [allTxns]);
  const monthlySpend = spend.reduce((s, t) => s + Math.abs(t.amount), 0) / nMonths;
  const monthlyIncome = allTxns.filter((t) => t.amount > 0 && t.category === "Income").reduce((s, t) => s + t.amount, 0) / nMonths;
  const maskTotals = isPrivate && (!settings.shareExact.A || !settings.shareExact.B);

  /* ---- prediction engine ---- */
  const monthlySavings = byCat.reduce((s, c) => s + (c.monthly * (cuts[c.name] || 0)) / 100, 0);
  const projection = useMemo(() => Array.from({ length: 13 }, (_, i) => ({ month: i, saved: Math.round(monthlySavings * i) })), [monthlySavings]);

  /* ---- recommendations ---- */
  const recs = useMemo(() => {
    const out = [];
    const cat = (n) => byCat.find((c) => c.name === n)?.monthly || 0;
    if (cat("Insurance") > 0) out.push({
      icon: <RefreshCw size={16} />, title: "Re-shop your insurance", tag: "Insurance",
      body: `You pay ~${fmt0(cat("Insurance"))}/mo. You usually can't cut the mortgage itself, but calling 2–3 insurers (or an independent broker) for home & auto quotes commonly saves 10–25%. Potential: ~${fmt0(cat("Insurance") * 0.15)}/mo.`,
      share: `Hey — we're paying about ${fmt0(cat("Insurance"))}/mo on insurance. Can you call a couple of companies for quotes this week? Re-shopping usually saves 10–25%. I'll handle the current policy paperwork if we switch.`,
    });
    const hi = spend.filter((t) => HIGH_END_GROCERS.test(t.desc));
    if (hi.length) {
      const hiMo = hi.reduce((s, t) => s + Math.abs(t.amount), 0) / nMonths;
      out.push({
        icon: <TrendingDown size={16} />, title: "Swap high-end grocery runs", tag: "Groceries",
        body: `~${fmt0(hiMo)}/mo is going to premium grocers (Whole Foods–tier). Shifting even half those trips to ${BUDGET_GROCERS} typically cuts that basket 25–35%: ~${fmt0(hiMo * 0.3 * 0.5)}–${fmt0(hiMo * 0.35)}/mo back.`,
        share: `Look at this: we spend ~${fmt0(hiMo)}/mo at the premium grocery store. If we move half our runs to ${BUDGET_GROCERS}, we'd keep roughly ${fmt0(hiMo * 0.3 * 0.5)}/mo. Want to try it for one month?`,
      });
    }
    if (subs.length) {
      const total = subs.reduce((s, x) => s + x.monthly, 0);
      out.push({
        icon: <Repeat size={16} />, title: `${subs.length} recurring subscriptions detected`, tag: "Subscriptions",
        body: `Recurring charges total ~${fmt0(total)}/mo: ${subs.slice(0, 4).map((s) => normMerchant(s.merchant)).join(", ")}${subs.length > 4 ? "…" : ""}. Cancel the ones nobody remembers signing up for.`,
        share: `Can you help cancel ${normMerchant(subs[0].merchant)}? We're paying about ${fmt0(subs[0].monthly)}/mo and I don't think we use it. There are ${subs.length} recurring charges totaling ~${fmt0(total)}/mo on the statements.`,
      });
    }
    if (cat("Dining & Bars") > 0.12 * monthlySpend) out.push({
      icon: <AlertTriangle size={16} />, title: "Dining & bars are a big slice", tag: "Dining & Bars",
      body: `${fmt0(cat("Dining & Bars"))}/mo (${Math.round((cat("Dining & Bars") / monthlySpend) * 100)}% of spending). A 25% trim — two fewer delivery orders and one fewer bar night — frees ~${fmt0(cat("Dining & Bars") * 0.25)}/mo without going cold turkey.`,
      share: `If we cut dining & delivery 25% (about ${fmt0(cat("Dining & Bars") * 0.25)}/mo), that's ${fmt0(cat("Dining & Bars") * 0.25 * 12)} a year. Pick one night we cook together instead?`,
    });
    return out;
  }, [byCat, subs, spend, nMonths, monthlySpend]);

  /* ---- share helpers ---- */
  const openShare = (title, text) => setShare({ title, text });

  /* ============== first-run setup ============== */
  if (loaded && !settings.mode) {
    const Mode = ({ id, icon, title, body }) => (
      <button onClick={() => setSettings((s) => ({ ...s, mode: id, shareExact: id === "private" ? { A: false, B: false } : { A: true, B: true } }))}
        style={{ textAlign: "left", background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 14, padding: 20, cursor: "pointer", display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ color: C.green, marginTop: 2 }}>{icon}</div>
        <div><div style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>{title}</div>
          <div style={{ fontSize: 13, color: C.sub, marginTop: 4, lineHeight: 1.5 }}>{body}</div></div>
      </button>
    );
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div style={{ maxWidth: 520, width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 34, fontWeight: 700, color: C.ink }}>Two Cents</div>
            <div style={{ color: C.sub, fontSize: 14, marginTop: 4 }}>A private budget ledger for two. Everything stays on your account — no servers, no fees.</div>
          </div>
          <Mode id="solo" icon={<Wallet size={20} />} title="Just me" body="One person, multiple banks. Full detail everywhere." />
          <Mode id="shared" icon={<Unlock size={20} />} title="Couple — open book" body="Both partners upload statements and see every exact dollar amount, both ways." />
          <Mode id="private" icon={<Lock size={20} />} title="Couple — private amounts" body="Both partners upload statements. Each sees the other's categories and trends, but exact dollar amounts stay masked until that partner flips their own switch." />
        </div>
      </div>
    );
  }

  /* ============== main shell ============== */
  const TABS = [
    ["dashboard", "Dashboard"], ["transactions", "Transactions"], ["import", "Import"],
    ["whatif", "What-if"], ["insights", "Insights"], ["settings", "Settings"],
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* header */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.line}`, padding: "12px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 21, fontWeight: 700 }}>Two Cents</div>
        <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              border: "none", background: tab === id ? C.greenSoft : "transparent", color: tab === id ? C.green : C.sub,
              fontWeight: 600, fontSize: 13, padding: "7px 12px", borderRadius: 8, cursor: "pointer",
            }}>{label}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {settings.mode !== "solo" && (
            <select value={me} onChange={(e) => setMe(e.target.value)} style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 8px", fontSize: 12.5, background: "#fff" }}>
              <option value="A">Viewing as {settings.partners[0]}</option>
              <option value="B">Viewing as {settings.partners[1]}</option>
            </select>
          )}
          {isPrivate && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: C.violet, background: C.violetSoft, borderRadius: 99, padding: "4px 9px", fontWeight: 600 }}><Lock size={11} /> Private amounts</span>}
        </div>
      </div>

      {busy && (
        <div style={{ background: C.goldSoft, color: C.gold, padding: "9px 18px", fontSize: 13, fontWeight: 600, display: "flex", gap: 8, alignItems: "center" }}>
          <Sparkles size={14} /> {busy}
        </div>
      )}

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ================= DASHBOARD ================= */}
        {tab === "dashboard" && (allTxns.length === 0 ? (
          <Card style={{ textAlign: "center", padding: 40 }}>
            <PiggyBank size={36} color={C.green} />
            <div style={{ fontWeight: 700, fontSize: 17, marginTop: 10 }}>No statements yet</div>
            <div style={{ color: C.sub, fontSize: 13.5, margin: "6px 0 16px" }}>Upload a statement from any bank — the monthly PDF, a photo of it, or a CSV. Or load sample data to explore.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <Btn tone="green" onClick={() => setTab("import")}><Upload size={15} /> Import statements</Btn>
              <Btn tone="ghost" onClick={() => { parseStatement(sampleCSV("A"), "Chase (sample)", "A"); parseStatement(sampleCSV("B"), "Wells Fargo (sample)", "B"); setTab("dashboard"); }}>Load sample couple data</Btn>
            </div>
          </Card>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              {[
                ["Avg monthly spending", -monthlySpend, C.cut],
                ["Avg monthly income", monthlyIncome, C.green],
                ["Avg left over", monthlyIncome - monthlySpend, C.green],
                ["Recurring subscriptions", -subs.reduce((s, x) => s + x.monthly, 0), C.violet],
              ].map(([label, v]) => (
                <Card key={label}><H>{label}</H><Amt v={v} big masked={maskTotals && label !== "Recurring subscriptions"} />
                  {maskTotals && label !== "Recurring subscriptions" && <div style={{ fontSize: 11, color: C.violet, marginTop: 4 }}>Hidden until both partners share exact amounts</div>}
                </Card>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
              <Card>
                <H>Where the money goes ({nMonths} mo) — click a slice to drill in</H>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={58} outerRadius={95} paddingAngle={1}
                      style={{ cursor: "pointer" }} onClick={(d) => d?.name && setDrill(d.name)}>
                      {byCat.map((c) => <Cell key={c.name} fill={CATEGORIES[c.name] || C.sub} />)}
                    </Pie>
                    <RTooltip formatter={(v) => maskTotals ? "hidden" : fmt0(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {byCat.slice(0, 8).map((c) => (
                    <button key={c.name} onClick={() => setDrill(c.name)} style={{ fontSize: 11.5, color: C.sub, display: "inline-flex", alignItems: "center", gap: 4, background: drill === c.name ? C.greenSoft : "transparent", border: "none", borderRadius: 6, padding: "3px 6px", cursor: "pointer" }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: CATEGORIES[c.name] }} />
                      {c.name} {!maskTotals && <b style={{ color: C.ink }}>{fmt0(c.monthly)}/mo</b>} <ChevronRight size={11} />
                    </button>
                  ))}
                </div>
              </Card>
              <Card>
                <H>Spending vs income by month</H>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byMonth}>
                    <CartesianGrid stroke={C.line} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => maskTotals ? "•" : "$" + (v / 1000).toFixed(0) + "k"} />
                    <RTooltip formatter={(v) => maskTotals ? "hidden" : fmt0(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="income" fill={C.green} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="spend" fill={C.cut} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {drill && (
              <Card style={{ borderColor: CATEGORIES[drill] }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                  <Btn small tone="ghost" onClick={() => setDrill(null)}><X size={12} /> Back</Btn>
                  <Pill cat={drill} />
                  <b style={{ fontSize: 15 }}>Inside {drill}</b>
                  {!maskTotals && <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontWeight: 700, color: CATEGORIES[drill] }}>
                    {fmt0(drillBySub.reduce((s, x) => s + x.monthly, 0))}/mo
                  </span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
                  <div>
                    <H>By subcategory</H>
                    {drillBySub.map((s) => {
                      const max = drillBySub[0]?.value || 1;
                      const pct = Math.round((s.value / drillBySub.reduce((a, x) => a + x.value, 0)) * 100);
                      return (
                        <div key={s.name} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                            <span style={{ fontWeight: 600 }}>{s.name}</span>
                            <span style={{ fontFamily: "ui-monospace, monospace", color: C.sub }}>
                              {maskTotals ? `${pct}%` : `${fmt0(s.monthly)}/mo · ${pct}%`}
                            </span>
                          </div>
                          <div style={{ background: C.bg, borderRadius: 99, height: 9 }}>
                            <div style={{ width: `${(s.value / max) * 100}%`, background: CATEGORIES[drill], height: 9, borderRadius: 99, opacity: s.name === "Needs subcategory" ? 0.35 : 1 }} />
                          </div>
                        </div>
                      );
                    })}
                    {drillBySub.some((s) => s.name === "Needs subcategory") && (
                      <div style={{ fontSize: 11.5, color: C.gold, marginTop: 6 }}>Some charges need a subcategory — run “Smart categorize” on the Transactions tab, or set them by hand there.</div>
                    )}
                  </div>
                  <div>
                    <H>Merchants in {drill}</H>
                    {drillMerchants.map(([m, info]) => (
                      <div key={m} onClick={() => { setQ(m); setShowAll(true); setTab("transactions"); }} title="Open in Transactions"
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.line}`, cursor: "pointer" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m}</div>
                          <div style={{ fontSize: 11, color: C.sub }}>{info.sub} · {info.n}×</div>
                        </div>
                        <Amt v={-info.total} masked={maskTotals} />
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}
            <Card>
              <H>Top merchants</H>
              {Object.entries(spend.reduce((m, t) => { const k = normMerchant(t.desc); m[k] = (m[k] || 0) + Math.abs(t.amount); return m; }, {}))
                .sort((a, b) => b[1] - a[1]).slice(0, 7).map(([m, v]) => (
                  <div key={m} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.line}` }}>
                    <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{m}</div>
                    <div style={{ flex: 2, background: C.bg, borderRadius: 99, height: 8 }}>
                      <div style={{ width: `${(v / Object.values(spend.reduce((mm, t) => { const k = normMerchant(t.desc); mm[k] = (mm[k] || 0) + Math.abs(t.amount); return mm; }, {})).sort((a, b) => b - a)[0]) * 100}%`, background: C.green, height: 8, borderRadius: 99 }} />
                    </div>
                    <Amt v={-v} masked={maskTotals} />
                  </div>
                ))}
            </Card>
          </>
        ))}

        {/* ================= TRANSACTIONS ================= */}
        {tab === "transactions" && (
          <>
            <Card style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Btn tone="green" onClick={runSmartCategorize}><Sparkles size={15} /> Smart categorize (free AI)</Btn>
              <div style={{ fontSize: 12.5, color: C.sub, flex: 1, minWidth: 220 }}>
                AI reviews what each merchant <i>actually</i> is — not just its payment-network code. Correct any row and the app remembers your rule forever. Flagged rows can be web-verified one at a time.
              </div>
            </Card>
            <Card style={{ padding: "10px 14px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Search size={15} color={C.sub} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search merchant, bank, category, or amount…"
                style={{ flex: 1, minWidth: 200, border: "none", outline: "none", fontSize: 13.5, background: "transparent" }} />
              {q && <Btn small tone="ghost" onClick={() => setQ("")}><X size={12} /> Clear</Btn>}
              <span style={{ fontSize: 12, color: C.sub }}>{(() => { const f = allTxns.filter(txnMatch); return `${f.length} of ${allTxns.length}`; })()}</span>
            </Card>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {allTxns.length === 0 && <div style={{ padding: 30, textAlign: "center", color: C.sub, fontSize: 14 }}>Nothing here yet — import a statement first.</div>}
              {allTxns.filter(txnMatch).slice(0, showAll ? undefined : 200).map((t) => {
                const mine = t.owner === me;
                const visible = canSeeExact(t.owner);
                return (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: `1px solid ${C.line}`, flexWrap: "wrap", background: t.confidence > 0 && t.confidence < 65 ? C.goldSoft : "#fff" }}>
                    <div style={{ width: 74, fontSize: 11.5, color: C.sub, fontFamily: "ui-monospace, monospace" }}>{t.date}</div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{normMerchant(t.desc)}</div>
                      <div style={{ fontSize: 11, color: C.sub }}>
                        {t.bank} · {settings.mode !== "solo" ? settings.partners[t.owner === "A" ? 0 : 1] : ""}
                        {t.sub ? ` · ${t.sub}` : ""}{t.note ? ` · ${t.note}` : ""}
                        {t.source === "ai" && ` · AI ${t.confidence}%`}{t.source === "you" && " · your rule"}
                      </div>
                    </div>
                    <select value={t.category} onChange={(e) => correct(t, e.target.value)} style={{ border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 11.5, padding: "4px 6px", background: "#fff", color: CATEGORIES[t.category] }}>
                      {CAT_LIST.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <select value={normSub(t.category, t.sub)} onChange={(e) => correct(t, t.category, e.target.value)}
                      style={{ border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 11.5, padding: "4px 6px", background: "#fff", color: normSub(t.category, t.sub) ? C.ink : C.gold, maxWidth: 130 }}>
                      <option value="">— sub —</option>
                      {(SUBCATS[t.category] || []).map((s) => <option key={s}>{s}</option>)}
                      {normSub(t.category, t.sub) && !(SUBCATS[t.category] || []).includes(normSub(t.category, t.sub)) && <option>{normSub(t.category, t.sub)}</option>}
                    </select>
                    {(t.source === "pending" || (t.confidence > 0 && t.confidence < 65)) && (
                      <Btn small tone="ghost" onClick={() => verifyOne(t)}><Search size={12} /> Verify online</Btn>
                    )}
                    <Amt v={t.amount} masked={!visible} />
                    <Btn small tone="ghost" onClick={() => openShare("What is this charge?",
                      `Hey, do you recognize this charge? ${normMerchant(t.desc)} for ${visible ? fmt(Math.abs(t.amount)) : "an amount"} on ${t.date} (${t.bank}). Was that you?`)}>
                      <Share2 size={12} />
                    </Btn>
                  </div>
                );
              })}
              {!showAll && allTxns.filter(txnMatch).length > 200 && (
                <div style={{ padding: 14, textAlign: "center" }}>
                  <Btn tone="ghost" onClick={() => setShowAll(true)}>Show all {allTxns.filter(txnMatch).length} transactions</Btn>
                </div>
              )}
            </Card>
          </>
        )}

        {/* ================= IMPORT ================= */}
        {tab === "import" && (
          <>
            <Card>
              <H>Import a statement — PDF, photo, or CSV</H>
              <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6, marginBottom: 14 }}>
                Drop in the statement exactly as your bank gives it to you — the <b style={{ color: C.ink }}>monthly PDF</b>, a screenshot/photo of it,
                or a CSV export. The AI parses it, extracts every transaction, and <b style={{ color: C.ink }}>remembers each bank's layout</b>,
                so the next statement from the same bank parses automatically. Add as many banks and credit cards as you want.
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                <select value={bankPick} onChange={(e) => setBankPick(e.target.value)}
                  style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px", fontSize: 13, background: "#fff", minWidth: 200 }}>
                  <option value="__new__">＋ New bank / card…</option>
                  {Object.keys(banks).map((b) => <option key={b} value={b}>{b} ✓ format remembered</option>)}
                </select>
                {bankPick === "__new__" && (
                  <input placeholder="Name it (e.g., Chase checking, Amex card)" value={importBank} onChange={(e) => setImportBank(e.target.value)}
                    style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px", fontSize: 13, flex: 1, minWidth: 200 }} />
                )}
                {settings.mode !== "solo" && (
                  <select value={importOwner} onChange={(e) => setImportOwner(e.target.value)} style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px", fontSize: 13, background: "#fff" }}>
                    <option value="A">Belongs to {settings.partners[0]}</option>
                    <option value="B">Belongs to {settings.partners[1]}</option>
                  </select>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Btn tone="green" onClick={() => fileRef.current.click()}>
                  <Upload size={15} /> Upload statement (PDF / image / CSV)
                </Btn>
                <input ref={fileRef} type="file" accept=".pdf,.csv,.txt,.png,.jpg,.jpeg,.webp" style={{ display: "none" }} onChange={(e) => {
                  const f = e.target.files[0]; if (f) handleFile(f);
                  e.target.value = "";
                }} />
                <Btn tone="ghost" onClick={() => { parseStatement(sampleCSV(importOwner), "Sample bank", importOwner); }}>Load sample data</Btn>
              </div>
              <details style={{ marginTop: 14 }}>
                <summary style={{ fontSize: 12.5, color: C.sub, cursor: "pointer", fontWeight: 600 }}>Or paste CSV text instead</summary>
                <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={"Date,Description,Amount\n01/05/2026,PUBLIX #441,-84.20"}
                  style={{ width: "100%", height: 110, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, fontSize: 12.5, fontFamily: "ui-monospace, monospace", boxSizing: "border-box", marginTop: 8 }} />
                <div style={{ marginTop: 8 }}>
                  <Btn small tone="green" disabled={!pasteText.trim()} onClick={() => parseStatement(pasteText, (bankPick !== "__new__" ? bankPick : importBank.trim()) || "Pasted bank", importOwner)}>Parse pasted CSV</Btn>
                </div>
              </details>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 14, background: C.bg, borderRadius: 10, padding: 12, lineHeight: 1.6 }}>
                <b>How parsing memory works:</b> the first PDF from a new bank takes the longest — the AI reads the whole document, learns the layout
                (date format, where charges live, what to skip), and saves that profile. Every later statement from that bank reuses the profile.
                A long first statement can take a few minutes on the free tier — you'll see a running count, and it's fine to check back.
                Only the statement you upload is sent to Gemini (your own free key) for reading; results are stored only in this browser, never on a server.
              </div>
            </Card>
            {Object.keys(banks).length > 0 && (
              <Card>
                <H>Banks & cards this app has learned</H>
                {Object.entries(banks).map(([name, b]) => (
                  <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
                    <Check size={14} color={C.green} />
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{name}</div>
                      <div style={{ fontSize: 11.5, color: C.sub }}>{(b.kind || "csv").toUpperCase()} · {b.notes || "format saved"} · {b.count || 1} import{(b.count || 1) > 1 ? "s" : ""} · last {b.lastUsed}</div>
                    </div>
                    <Btn small tone="ghost" onClick={() => { setBankPick(name); fileRef.current.click(); }}><Upload size={12} /> New statement</Btn>
                    <Btn small tone="ghost" onClick={() => setBanks((bb) => { const c = { ...bb }; delete c[name]; return c; })}><Trash2 size={12} /> Forget format</Btn>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}


        {/* ================= WHAT-IF ================= */}
        {tab === "whatif" && (
          <>
            <Card style={{ background: C.ink, color: "#fff", border: "none" }}>
              <div style={{ fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7, fontWeight: 600 }}>Prediction engine</div>
              <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginTop: 10 }}>
                <div><div style={{ fontFamily: "ui-monospace, monospace", fontSize: 32, fontWeight: 700, color: "#7FD4AE" }}>{fmt0(monthlySavings)}<span style={{ fontSize: 15, opacity: 0.7 }}>/mo</span></div><div style={{ fontSize: 12, opacity: 0.7 }}>freed up each month</div></div>
                <div><div style={{ fontFamily: "ui-monospace, monospace", fontSize: 32, fontWeight: 700, color: "#7FD4AE" }}>{fmt0(monthlySavings * 12)}</div><div style={{ fontSize: 12, opacity: 0.7 }}>over a year</div></div>
                <div><div style={{ fontFamily: "ui-monospace, monospace", fontSize: 32, fontWeight: 700, color: "#7FD4AE" }}>{fmt0(monthlySavings * 60)}</div><div style={{ fontSize: 12, opacity: 0.7 }}>over five years</div></div>
                <div style={{ marginLeft: "auto", alignSelf: "center" }}>
                  <Btn tone="green" disabled={!monthlySavings} onClick={() => {
                    const lines = byCat.filter((c) => cuts[c.name] > 0).map((c) => `${c.name} −${cuts[c.name]}% (≈${fmt0((c.monthly * cuts[c.name]) / 100)}/mo)`);
                    openShare("Predictive savings plan", `Look at the predictive savings if we trim a few categories: ${lines.join("; ")}. That's ${fmt0(monthlySavings)} back every month — ${fmt0(monthlySavings * 12)} a year. Want to try it for 60 days?`);
                  }}><Share2 size={14} /> Share this plan</Btn>
                </div>
              </div>
            </Card>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
              <Card>
                <H>Trim categories</H>
                {byCat.filter((c) => !["Income", "Transfers"].includes(c.name)).map((c) => (
                  <div key={c.name} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{c.name} <span style={{ color: C.sub }}>{maskTotals ? "" : `· ${fmt0(c.monthly)}/mo`}</span></span>
                      <span style={{ fontFamily: "ui-monospace, monospace", color: cuts[c.name] ? C.cut : C.sub, fontWeight: 700 }}>
                        −{cuts[c.name] || 0}% {cuts[c.name] ? `= ${fmt0((c.monthly * cuts[c.name]) / 100)}/mo` : ""}
                      </span>
                    </div>
                    <input type="range" min={0} max={60} step={5} value={cuts[c.name] || 0}
                      onChange={(e) => setCuts((p) => ({ ...p, [c.name]: +e.target.value }))}
                      style={{ width: "100%", accentColor: CATEGORIES[c.name] }} />
                  </div>
                ))}
              </Card>
              <Card>
                <H>Projected savings over 12 months</H>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={projection}>
                    <CartesianGrid stroke={C.line} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} label={{ value: "months from now", fontSize: 11, position: "insideBottom", offset: -2 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => "$" + (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v)} />
                    <RTooltip formatter={(v) => fmt0(v)} />
                    <Line type="monotone" dataKey="saved" stroke={C.green} strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 12, color: C.sub }}>Based on your real {nMonths}-month average in each category — not guesses.</div>
              </Card>
            </div>
          </>
        )}

        {/* ================= INSIGHTS ================= */}
        {tab === "insights" && (
          <>
            {recs.length === 0 && <Card style={{ textAlign: "center", color: C.sub, padding: 36 }}>Import statements first — insights are computed from your real spending.</Card>}
            {recs.map((r, i) => (
              <Card key={i}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ background: C.greenSoft, color: C.green, borderRadius: 10, padding: 9 }}>{r.icon}</div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}><b style={{ fontSize: 14.5 }}>{r.title}</b><Pill cat={r.tag} /></div>
                    <div style={{ fontSize: 13, color: C.sub, marginTop: 5, lineHeight: 1.55 }}>{r.body}</div>
                  </div>
                  <Btn small tone="violet" onClick={() => openShare(r.title, r.share)}><MessageSquare size={13} /> Draft a text</Btn>
                </div>
              </Card>
            ))}
            {subs.length > 0 && (
              <Card>
                <H>Recurring charges</H>
                {subs.map((s) => (
                  <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
                    <Repeat size={14} color={C.violet} />
                    <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{normMerchant(s.merchant)} <span style={{ color: C.sub, fontWeight: 400, fontSize: 12 }}>· seen {s.count}×</span></div>
                    <Amt v={-s.monthly} masked={maskTotals} /><span style={{ fontSize: 11.5, color: C.sub }}>/mo</span>
                    <Btn small tone="ghost" onClick={() => openShare("Help cancel a subscription",
                      `Can you help cancel ${normMerchant(s.merchant)}? We're paying about ${fmt0(s.monthly)}/mo (charged ${s.count} times so far). If you have the login, tonight would be great — that's ${fmt0(s.monthly * 12)}/yr back.`)}>
                      <Share2 size={12} /> Ask partner
                    </Btn>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}

        {/* ================= SETTINGS ================= */}
        {tab === "settings" && (
          <>
            <Card>
              <H>Household</H>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                {["solo", "shared", "private"].map((m) => (
                  <Btn key={m} small tone={settings.mode === m ? "green" : "ghost"} onClick={() => setSettings((s) => ({ ...s, mode: m }))}>
                    {m === "solo" ? "Just me" : m === "shared" ? "Couple · open book" : "Couple · private amounts"}
                  </Btn>
                ))}
              </div>
              {settings.mode !== "solo" && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {[0, 1].map((i) => (
                    <input key={i} value={settings.partners[i]} onChange={(e) => setSettings((s) => { const p = [...s.partners]; p[i] = e.target.value; return { ...s, partners: p }; })}
                      style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px", fontSize: 13 }} />
                  ))}
                </div>
              )}
            </Card>
            {isPrivate && (
              <Card>
                <H>Amount privacy</H>
                <div style={{ fontSize: 13, color: C.sub, marginBottom: 12, lineHeight: 1.55 }}>
                  In private mode each partner's exact dollar amounts are masked from the other (categories and trends stay visible so budgeting still works).
                  Each partner controls their own switch — flip it only while viewing as yourself.
                </div>
                {["A", "B"].map((p, i) => (
                  <div key={p} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                    {settings.shareExact[p] ? <Eye size={15} color={C.green} /> : <EyeOff size={15} color={C.violet} />}
                    <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{settings.partners[i]} — exact amounts {settings.shareExact[p] ? "visible to partner" : "masked"}</div>
                    <Btn small tone={settings.shareExact[p] ? "ghost" : "violet"} disabled={me !== p}
                      onClick={() => setSettings((s) => ({ ...s, shareExact: { ...s.shareExact, [p]: !s.shareExact[p] } }))}>
                      {me !== p ? "Only they can change this" : settings.shareExact[p] ? "Mask my amounts" : "Share my amounts"}
                    </Btn>
                  </div>
                ))}
              </Card>
            )}
            <Card>
              <H>AI key (free)</H>
              <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6, marginBottom: 10 }}>
                Statement parsing and smart categorization run on Google's <b style={{ color: C.ink }}>free</b> Gemini tier using your own key —
                no card, no charges; heavy use just rate-limits for a minute. Create one at{" "}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: C.green, fontWeight: 600 }}>aistudio.google.com/app/apikey</a>{" "}
                (sign in with Google → "Create API key" → copy). The key is stored only on this device.
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input type="password" placeholder="Paste your Gemini API key (starts with AIza…)" value={apiKey} onChange={(e) => setApiKey(e.target.value.trim())}
                  style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px", fontSize: 13, flex: 1, minWidth: 240, fontFamily: "ui-monospace, monospace" }} />
                {apiKey ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: C.green, fontSize: 12.5, fontWeight: 700 }}><Check size={14} /> Saved on this device</span>
                  : <span style={{ color: C.cut, fontSize: 12.5, fontWeight: 600 }}>Required for PDF parsing & AI categorization</span>}
              </div>
            </Card>
            <Card>
              <H>Privacy & data</H>
              <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.7 }}>
                • Statements are parsed <b style={{ color: C.ink }}>on your device</b> — they're never sent to a server you don't control.<br />
                • Data is saved in this browser's local database (IndexedDB) on this device; it never leaves your phone or computer.<br />
                • AI categorization sends only merchant names (never amounts, dates, or account numbers) to Gemini using your own free key.<br />
                • This is personal software: no fees, no ads, no fintech account, no Plaid connection to your bank login. The Gemini free tier covers normal use (rate limits just mean waiting a minute, never paying).
              </div>
              <div style={{ marginTop: 14 }}>
                <Btn tone="cut" onClick={async () => {
                  if (!confirm("Erase all transactions, rules, and settings?")) return;
                  for (const k of ["tc:settings", "tc:txns:A", "tc:txns:B", "tc:rules", "tc:cuts", "tc:banks"]) { await deleteKey(k); }
                  setTxnsA([]); setTxnsB([]); setRules({}); setCuts({}); setBanks({}); setDrill(null);
                  setSettings({ mode: null, partners: ["Partner 1", "Partner 2"], shareExact: { A: true, B: true } });
                }}><Trash2 size={14} /> Erase everything</Btn>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* ================= SHARE MODAL ================= */}
      {share && (
        <div onClick={() => setShare(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,30,25,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 22, maxWidth: 440, width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <MessageSquare size={17} color={C.violet} /><b style={{ fontSize: 15 }}>{share.title}</b>
              <button onClick={() => setShare(null)} style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer" }}><X size={17} color={C.sub} /></button>
            </div>
            <textarea value={share.text} onChange={(e) => setShare((s) => ({ ...s, text: e.target.value }))}
              style={{ width: "100%", height: 130, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, fontSize: 13.5, lineHeight: 1.5, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <Btn tone="green" onClick={() => { navigator.clipboard?.writeText(share.text); setShare(null); setBusy("Copied — paste it into your texting app."); setTimeout(() => setBusy(""), 3500); }}>
                <Copy size={14} /> Copy text
              </Btn>
              <a href={`sms:?&body=${encodeURIComponent(share.text)}`} style={{ textDecoration: "none" }}>
                <Btn tone="violet"><MessageSquare size={14} /> Open Messages</Btn>
              </a>
            </div>
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 10 }}>Edit the draft however you like — it sends from your own phone, nothing goes through a server.</div>
          </div>
        </div>
      )}
    </div>
  );
}
