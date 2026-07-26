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
    eligible: false,   // holds enough token -> compete
    mode: "demo"       // "demo" | "compete"
  };

  const listeners = [];
  function onChange(fn) { listeners.push(fn); }
  function emit() { listeners.forEach(fn => { try { fn(state); } catch (e) {} }); }

  function short(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : ""; }

  function hasWallet() { return typeof window.ethereum !== "undefined"; }

  async function connect() {
    if (!hasWallet()) {
      alert("No Web3 wallet found. Install MetaMask to connect — or just hit Play Demo.");
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

    // If no token configured yet, we can't gate — stay in demo but connected.
    if (!C.tokenAddress) { state.mode = "demo"; return; }

    // Wrong network? not eligible.
    if (C.chainId && state.chainId !== C.chainId) { state.mode = "demo"; return; }

    try {
      const token = new ethers.Contract(C.tokenAddress, ERC20_ABI, provider);
      const raw = await token.balanceOf(state.address);
      const dec = C.tokenDecimals || 18;
      state.balance = Number(ethers.formatUnits(raw, dec));
      state.eligible = state.balance >= (C.minHold || 0);
      state.mode = state.eligible ? "compete" : "demo";
    } catch (e) {
      console.warn("balance check failed", e);
      state.mode = "demo";
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

  function playDemo() { state.mode = "demo"; emit(); }

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
