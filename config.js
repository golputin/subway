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
    url: "https://www.ponsfamily.com/launchpad/0x663b83ffd94bfaf21a59b80849114214af31301a",
    status: "Live on curve" // "Coming soon" | "Live on curve" | "Graduated"
  },

  // --- Token gating (Web3) ---
  // Set chainId to Robinhood Chain's id once confirmed. 0 = skip network check for now.
  chainId: 0,
  chainName: "Robinhood Chain",
  // Read-only RPC used to check token balance on the token's chain, regardless of
  // which network the player's wallet is currently on.
  rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
  // Official token on Pons / Robinhood Chain (contract name "SubwayHood", ticker SBWY).
  tokenAddress: "0x663B83FfD94bfAF21A59B80849114214AF31301A",
  tokenSymbol: "HOOD",
  tokenDecimals: 18,
  // --- Compete eligibility ---
  // Primary gate: USD value of your $HOOD holdings must be >= this. Any token
  // amount is fine as long as it's worth this much. Below it = Practice (not recorded).
  minHoldUsd: 5,
  // Live price auto-detected from DexScreener (Robinhood Chain pair). Parser also
  // accepts a plain { "usd": <number> } endpoint. tokenPriceUsd is a manual fallback.
  tokenPriceUsd: 0,
  priceApi: "https://api.dexscreener.com/latest/dex/tokens/0x663b83ffd94bfaf21a59b80849114214af31301a",
  // Fallback token-count gate, used only when no USD price is available yet.
  minHold: 100000,

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
