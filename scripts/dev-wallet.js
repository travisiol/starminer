// STARMINER dev wallet — DEV ONLY. An EIP-1193 / EIP-6963 provider that relays every request to a
// local Hardhat node whose accounts are unlocked, so `eth_sendTransaction` needs no signature.
// Paste into the browser console (or evaluate it from a tool) on a page of the local dev server.
(() => {
  const RPC = window.__DEV_RPC || "http://127.0.0.1:8781";
  const ACCOUNTS = window.__DEV_ACCOUNTS || ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"];
  const CHAIN_ID = window.__DEV_CHAIN_ID || "0x7a69";
  let id = 1;
  const listeners = {};
  const rpc = async (method, params) => {
    const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: id++, method, params }) });
    const j = await r.json();
    if (j.error) {
      const e = new Error(j.error.message);
      e.code = j.error.code;
      e.data = j.error.data;
      throw e;
    }
    return j.result;
  };
  const provider = {
    isDevWallet: true,
    request: async ({ method, params = [] }) => {
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return ACCOUNTS;
        case "eth_chainId":
          return CHAIN_ID;
        case "net_version":
          return String(parseInt(CHAIN_ID, 16));
        case "wallet_switchEthereumChain":
        case "wallet_addEthereumChain":
          return null;
        case "wallet_requestPermissions":
        case "wallet_getPermissions":
          return [{ parentCapability: "eth_accounts" }];
        case "eth_sendTransaction": {
          const tx = { ...params[0] };
          delete tx.type;
          window.__DEV_LAST_TX = tx;
          return rpc("eth_sendTransaction", [tx]);
        }
        default:
          return rpc(method, params);
      }
    },
    on: (ev, fn) => {
      (listeners[ev] ||= []).push(fn);
      return provider;
    },
    removeListener: (ev, fn) => {
      listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn);
      return provider;
    },
  };
  const info = Object.freeze({
    uuid: "starminer-dev-wallet-0001",
    name: "Dev Wallet",
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%237c3aed'/%3E%3C/svg%3E",
    rdns: "app.starminer.devwallet",
  });
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }));
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
  window.__devWallet = provider;
  console.log("[dev-wallet] announced", ACCOUNTS[0], "on", RPC);
})();
