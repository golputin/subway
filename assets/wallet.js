/*
 * Subway Hood — wallet + token gating.
 * Uses ethers v6 (loaded via CDN) and window.ethereum (MetaMask / injected wallets).
 * Exposes window.SubwayWallet.
 */
(function () {
  const C = window.CONFIG || {};
  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
  ];

  const state = {
    address: null,
    chainId: null,
    balance: null,     // human-readable number of gated token
    worthUsd: null,    // balance * price (USD)
    eligible: false,   // holdings worth >= minHoldUsd -> compete
    mode: "practice"       // "practice" | "compete"
  };

  // Resolve $HOOD price in USD: priceApi (JSON {usd}) first, else static tokenPriceUsd.
  async function getPriceUsd() {
    if (C.priceApi) {
      try {
        const r = await fetch(C.priceApi);
        if (r.ok) { const j = await r.json(); if (j && Number(j.usd) > 0) return Number(j.usd); }
      } catch (e) { console.warn("price fetch failed", e); }
    }
    return Number(C.tokenPriceUsd) || 0;
  }

  const listeners = [];
  function onChange(fn) { listeners.push(fn); }
  function emit() { listeners.forEach(fn => { try { fn(state); } catch (e) {} }); }

  function short(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : ""; }

  function hasWallet() { return typeof window.ethereum !== "undefined"; }

  async function connect() {
    if (!hasWallet()) {
      alert("No Web3 wallet found. Install MetaMask to connect — or just hit Play (Practice).");
      return state;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      state.address = accounts[0];
      const net = await provider.getNetwork();
      state.chainId = Number(net.chainId);

      await refreshBalance(provider);
      persist();
      emit();
    } catch (e) {
      console.warn("connect failed", e);
    }
    return state;
  }

  async function refreshBalance(provider) {
    state.balance = null;
    state.eligible = false;

    // If no token configured yet, we can't gate — stay in practice but connected.
    if (!C.tokenAddress) { state.mode = "practice"; return; }

    // Wrong network? not eligible.
    if (C.chainId && state.chainId !== C.chainId) { state.mode = "practice"; return; }

    try {
      const token = new ethers.Contract(C.tokenAddress, ERC20_ABI, provider);
      const raw = await token.balanceOf(state.address);
      let dec = C.tokenDecimals || 18;
      try { dec = Number(await token.decimals()); } catch (e) {}
      state.balance = Number(ethers.formatUnits(raw, dec));

      const price = await getPriceUsd();
      if (price > 0 && Number(C.minHoldUsd) > 0) {
        // USD-value gate: any amount is fine as long as it's worth >= minHoldUsd
        state.worthUsd = state.balance * price;
        state.eligible = state.worthUsd >= Number(C.minHoldUsd);
      } else {
        // no live price yet -> fall back to a token-count gate
        state.worthUsd = null;
        state.eligible = state.balance >= (C.minHold || 0);
      }
      state.mode = state.eligible ? "compete" : "practice";
    } catch (e) {
      console.warn("balance check failed", e);
      state.mode = "practice";
    }
  }

  async function switchNetwork() {
    if (!hasWallet() || !C.chainId) return;
    const hex = "0x" + C.chainId.toString(16);
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const net = await provider.getNetwork();
      state.chainId = Number(net.chainId);
      await refreshBalance(provider);
      emit();
    } catch (e) { console.warn("switch failed", e); }
  }

  function playDemo() { state.mode = "practice"; emit(); }

  function persist() {
    try { localStorage.setItem("sh_addr", state.address || ""); } catch (e) {}
  }

  // React to wallet account/network changes.
  if (hasWallet()) {
    window.ethereum.on && window.ethereum.on("accountsChanged", () => location.reload());
    window.ethereum.on && window.ethereum.on("chainChanged", () => location.reload());
  }

  window.SubwayWallet = {
    state, connect, playDemo, switchNetwork, onChange, short, hasWallet,
    get address() { return state.address; },
    get mode() { return state.mode; }
  };
})();
