// All data lives in the browser's IndexedDB on YOUR device.
// Nothing is ever written to a server or synced anywhere.
import { get, set, del } from "idb-keyval";

export async function loadKey(key, fallback) {
  try {
    const v = await get(key);
    return v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
}

export async function saveKey(key, val) {
  try {
    await set(key, val);
  } catch (e) {
    console.error("save failed", e);
  }
}

export async function deleteKey(key) {
  try {
    await del(key);
  } catch {}
}
