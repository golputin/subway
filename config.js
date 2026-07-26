/*
 * Subway Hood — central configuration.
 * Edit these values, no other file needs to change.
 * When you deploy your real token + backend, just fill in the blanks here.
 */
window.CONFIG = {
  // --- Branding ---
  projectName: "Subway Hood",
  tagline: "Run the underground. Earn from the pool.",

  // --- Prize pool (display only — real payout handled off-chain/by you) ---
  prizePool: "2,000 USDT",
  leaderboardSlots: 5000,

  // --- Token gating (Web3) ---
  // Chain to require. 1 = Ethereum, 56 = BNB Chain, 137 = Polygon, etc.
  chainId: 56,
  chainName: "BNB Smart Chain",
  // ERC-20 token address players must hold to compete. Leave "" until deployed.
  tokenAddress: "",
  tokenSymbol: "HOOD",
  tokenDecimals: 18,
  // Minimum amount to hold to enter Compete mode (human-readable).
  minHold: 1000,

  // --- Leaderboard backend ---
  // Leave "" to use local (browser) leaderboard for now (demo/simulation).
  // Later: point to your API base, e.g. "https://api.subwayhood.xyz".
  apiBase: "",

  // --- Links ---
  social: {
    twitter: "#",
    telegram: "#",
    docs: "#"
  }
};
