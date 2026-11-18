import { Client, Account, ID } from "https://cdn.jsdelivr.net/npm/appwrite@16.0.2/+esm";

const client = new Client()
  .setEndpoint("https://fra.cloud.appwrite.io/v1")
  .setProject("6ad610fa000331f54242");

if (typeof client.ping === "function") client.ping().catch(() => {});

export const account = new Account(client);
export { ID };

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

// Updates the navbar link (id="accountLink") on any page that has it
(async () => {
  const el = document.getElementById("accountLink");
  if (!el) return;
  const u = await currentUser();
  el.textContent = u ? "👤 " + (u.name || "Account") : "Login";
  el.href = u ? "account.html" : "login.html";
})();
