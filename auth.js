import { Client, Account, Databases, ID, Query, Permission, Role } from "https://cdn.jsdelivr.net/npm/appwrite@16.0.2/+esm";

const client = new Client()
  .setEndpoint("https://fra.cloud.appwrite.io/v1")
  .setProject("6ad610fa000331f54242");

if (typeof client.ping === "function") client.ping().catch(() => {});

export const account = new Account(client);
export const databases = new Databases(client);
export { ID };

// ---- Appwrite IDs (from your Console) ----
const DB_ID = "6afd2af000210e1e2a63";
const WISH_ID = "6afd2b2c003117c8a795"; // your wishlists table

// Links in emails point to pages in the same folder as the current page
const BASE = new URL(".", location.href).href;
export const verifyUrl = BASE + "verify.html";
export const recoveryUrl = BASE + "reset.html";

export async function currentUser() {
  try { return await account.get(); } catch { return null; }
}

export const errMsg = (e) => (e && e.message) ? e.message : "Something went wrong. Please try again.";

export function say(el, text, ok = false) {
  el.textContent = text;
  el.className = "msg " + (ok ? "ok" : "err");
  el.style.display = text ? "block" : "none";
}

// ---------------- Wishlist ----------------
let wishMap = null; // Map: carId (string) -> Appwrite row ID

// Loads this customer's wishlist. Returns null if logged out.
export async function loadWishlist(force = false) {
  const u = await currentUser();
  if (!u) { wishMap = null; return null; }
  if (wishMap && !force) return wishMap;
  const map = new Map();
  let cursor = null;
  while (true) {
    const q = [Query.equal("userId", [u.$id]), Query.limit(100)];
    if (cursor) q.push(Query.cursorAfter(cursor));
    const res = await databases.listDocuments(DB_ID, WISH_ID, q);
    res.documents.forEach((d) => map.set(String(d.carId), d.$id));
    if (res.documents.length < 100) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  wishMap = map;
  return map;
}

export async function wishlistCount() {
  const m = await loadWishlist();
  return m ? m.size : 0;
}

// Adds the car if not saved, removes it if saved. Returns { saved: true|false }.
// Throws Error("LOGIN_REQUIRED") when nobody is logged in.
// Throws Error("SAVE_FAILED") when the save was rejected as a duplicate but
// the car is not actually in this customer's wishlist.
export async function toggleWishlist(carId) {
  const u = await currentUser();
  if (!u) throw new Error("LOGIN_REQUIRED");
  const key = String(carId);
  const map = await loadWishlist();

  if (map.has(key)) {
    await databases.deleteDocument(DB_ID, WISH_ID, map.get(key));
    map.delete(key);
    return { saved: false };
  }
  try {
    const doc = await databases.createDocument(
      DB_ID, WISH_ID, ID.unique(),
      { userId: u.$id, carId: key },
      [Permission.read(Role.user(u.$id)), Permission.delete(Role.user(u.$id))]
    );
    map.set(key, doc.$id);
  } catch (e) {
    if (e && e.code === 409) {
      // 409 = the unique index says this user + car already exists.
      // Reload and confirm it really is in this customer's own wishlist.
      const fresh = await loadWishlist(true);
      if (!fresh || !fresh.has(key)) throw new Error("SAVE_FAILED");
    } else {
      throw e;
    }
  }
  return { saved: true };
}

export async function removeFromWishlist(carId) {
  const map = await loadWishlist();
  if (!map) throw new Error("LOGIN_REQUIRED");
  const rowId = map.get(String(carId));
  if (!rowId) return;
  await databases.deleteDocument(DB_ID, WISH_ID, rowId);
  map.delete(String(carId));
}

// Sends a logged-out visitor to login, remembering where to come back to
export function goLogin(message) {
  const page = (location.pathname.split("/").pop() || "index.html") + location.search;
  try {
    sessionStorage.setItem("returnTo", page);
    sessionStorage.setItem("loginMsg", message || "Please log in to continue.");
  } catch (_) {}
  location.href = "login.html";
}

// Small pop-up message
export function toast(text) {
  let t = document.getElementById("toast86");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast86";
    t.setAttribute("role", "status");
    t.style.cssText = "position:fixed;left:50%;bottom:28px;transform:translate(-50%,20px);opacity:0;background:#191919;color:#fff;border:1px solid #F00018;padding:12px 20px;border-radius:14px;font:600 14px Inter,sans-serif;z-index:1000000;transition:.3s;pointer-events:none;box-shadow:0 8px 30px rgba(0,0,0,.6)";
    document.body.appendChild(t);
  }
  t.textContent = text;
  requestAnimationFrame(() => { t.style.opacity = "1"; t.style.transform = "translate(-50%,0)"; });
  clearTimeout(t._h);
  t._h = setTimeout(() => { t.style.opacity = "0"; t.style.transform = "translate(-50%,20px)"; }, 2200);
}

// Updates the navbar link (id="accountLink") on any page that has it
(async () => {
  const el = document.getElementById("accountLink");
  if (!el) return;
  const u = await currentUser();
  el.textContent = u ? "👤 " + (u.name || "Account") : "Login";
  el.href = u ? "account.html" : "login.html";
})();
