import dns from "dns";
import { Agent, setGlobalDispatcher } from "undici";

console.log("--- DNS-FIX MODULE LOADED (MONKEYPATCH BYPASSED) ---");

try {
  // Increase connection, headers, and body timeouts globally to 45s to survive slow NAT64/DNS64 connection latency
  setGlobalDispatcher(new Agent({ 
    connect: { timeout: 45000 },
    headersTimeout: 45000,
    bodyTimeout: 45000 
  }));
  console.log("--- UNDICI GLOBAL DISPATCHER CONFIGURED (TIMEOUTS EXTENDED TO 45S) ---");
} catch (e) {
  console.error("Failed to configure undici dispatcher:", e);
}

try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {}
export {};
