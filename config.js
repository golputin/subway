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
  prizePool: "5,000 USDT",
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
  // Read-only RPC used to check token balance on the token's chain, regardless of
  // which network the player's wallet is currently on.
  rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
  // Token contract players must hold to compete. Fill in after the token graduates / is created.
  tokenAddress: "0x0c1eD62D7811e5b437e537Ac9d0592469C119C74", // TEST token
  tokenSymbol: "HOOD",
  tokenDecimals: 18,
  // --- Compete eligibility ---
  // Primary gate: USD value of your $HOOD holdings must be >= this. Any token
  // amount is fine as long as it's worth this much. Below it = Practice (not recorded).
  minHoldUsd: 5,
  // Price of 1 $HOOD in USD. Until a live price feed exists, set it manually here,
  // or set priceApi to an endpoint returning JSON { "usd": <number> }. 0 = unknown.
  tokenPriceUsd: 0,
  priceApi: "",
  // Fallback token-count gate, used only when no USD price is available yet.
  minHold: 1, // TEST: hold >= 1 token to enter Compete

  // --- Leaderboard backend ---
  // Anti-cheat leaderboard API (Hermes-deployed VPS). "" = local/simulated store.
  apiBase: "https://api.subwayhood.fun",

  // --- Links ---
  social: {
    twitter: "https://x.com/subwayhoodfun",
    telegram: "",   // empty -> shows "SOON" when clicked
    docs: "docs.html"
  }
};
