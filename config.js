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

  // --- Launchpad (Pons) ---
  // $HOOD launches on the Pons Launchpad (fair-launch bonding curve) on Robinhood Chain.
  launchpad: {
    platform: "Pons",
    chain: "Robinhood Chain",
    url: "",                 // your Pons token page once created, e.g. https://ponsfamily.com/launchpad/<token>
    status: "Coming soon"    // "Coming soon" | "Live on curve" | "Graduated"
  },

  // --- Token gating (Web3) ---
  // Set chainId to Robinhood Chain's id once confirmed. 0 = skip network check for now.
  chainId: 0,
  chainName: "Robinhood Chain",
  // Token contract players must hold to compete. Fill in after the token graduates / is created.
  tokenAddress: "",
  tokenSymbol: "HOOD",
  tokenDecimals: 18,
  // Minimum amount to hold to enter Compete mode (human-readable).
  // Below this you play in Practice mode and your score is NOT recorded.
  minHold: 100000,

  // --- Leaderboard backend ---
  // Anti-cheat leaderboard API (Hermes-deployed VPS). "" = local/simulated store.
  apiBase: "https://api.neoparty.web.id",

  // --- Links ---
  social: {
    twitter: "#",
    telegram: "#",
    docs: "#"
  }
};
