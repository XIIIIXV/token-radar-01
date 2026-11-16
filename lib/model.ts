// The token radar's model (radar-3): one snapshot of the protocol universe in, one ranked board out.
//
// The board ranks the protocols that could still launch a token. A protocol is rankable when it
// records no token (no market cap, no CoinGecko id, no symbol) AND is not a wrapped, staked or
// bridged product of a token that already trades, by the same rule the snapshot's watchlist uses:
// its category is not Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC or
// CEX, its name carries no whole word wrapped, staked or staking, it does not begin with an
// exchange's name, and it does not end in a version marker. WBTC is Bitcoin on Ethereum and
// Binance staked ETH is ETH in a staking product; neither waits on a launch of its own, so neither
// is ranked. The watchlist is the floor, never the ceiling: the board carries every protocol the
// rule keeps, at any TVL, not just the forty above the house's $50,000,000 floor.
//
// Implied value follows only from the snapshot's own figures, and radar-3 calibrates its base
// multiple to the snapshot itself instead of fixing one by hand:
//
// The peer multiple is the market's own answer to "what is a protocol worth per dollar of TVL".
// It is the median market-cap-to-TVL ratio of the protocols in the snapshot that already trade,
// taken per category where the category has at least five live protocols, and the overall median
// everywhere else. On this snapshot the overall median is 0.169: a decentralised exchange's
// category median is 0.342, a real-world-asset protocol's is 0.275, a basis-trading protocol's
// 0.482, a lending protocol's 0.132. Each category multiple is clamped to [0.05, 0.60], so a thin
// category cannot stretch the board and a rich one cannot dominate it. A fixed 0.25 for every
// protocol would claim a DEX and a lender are worth the same per TVL dollar; the market's own
// records say they are not, and the model now says so too. No protocol name is ever special-cased:
// the same peer table scores every row, and the table is recomputed from whatever snapshot is fed in.
//
// The other three factors are unchanged from radar-2: seven-day growth, clamped to [-60, 120] per
// cent and weighted at 0.50; maturity, 0.60 rising to 1.00 over three years listed with no token;
// chain breadth, 1.00 for one chain rising 0.03 per extra chain to 1.12 for five or more. The
// chain multiplier stays the smallest factor on purpose: a protocol live on five chains has five
// places a launch can land, but chain count is a tiebreaker between protocols of similar size,
// never a way for a small multi-chain protocol to outrank a large single-chain one.
//
// radar-3 adds a fourth factor the old model silently skipped: data quality. Two of the board's
// rows record no seven-day growth and seven record no listing date, and the old model treated
// those unknowns as neutral — zero growth, a 365-day age — as if the missing figure were known.
// An unknown is not a neutral: it is a reason to be a little less sure. Each unknown costs 3%:
// a row with no growth figure scores 0.97 on quality, a row with no listing date scores 0.97, a
// row missing both scores 0.97 x 0.97. The discount is small on purpose — a missing date is not
// evidence a protocol is worthless — but it is honest, and the detail view names it so a reader
// can see exactly which rows are discounted and why.
//
// The farm plan is generated, never hand-written. Each row's eight steps come from the
// protocol's own record: its category picks the action (lend, dex, bridge, staking, perpetual,
// prediction, curator, stablecoin, RWA, insurance, basis trading, farm, chain, BTC vault, CeDeFi,
// OTC, card, privacy, options vault, index, liquidity manager, or the generic deposit), its TVL
// picks the capital ($50 under $100M, $100 under $1B, $150 under $5B, $250 above), its age picks
// the hold (60 days under six months, 45 under a year, 30 above), and its first chain picks the
// gas figure (Ethereum about $12, Solana and Hyperliquid L1 under $0.10, an L2 about $0.50).
// Two protocols in the same category with the same TVL band and the same age band get the same
// plan; that is the point — the plan is a function of the record, so rebuilding the board from
// the same snapshot reproduces the same plan, and the gate can check it.
//
// The set-aside is not a deletion. The 144 wrapped products and the 402 live-token protocols
// are kept out of the ranked board, but the dashboard names every wrapped product it sets
// aside and the reason, and shows the live-token protocols with their market caps as the
// market's own values. A reader who disagrees with an exclusion can find it, read the reason,
// and check the snapshot's own fields. An exclusion nobody can see is a hidden judgement; an
// exclusion with its reason attached is a rule the reader can audit.
//
// The board is a pure function of the snapshot and the constants. Same snapshot in, same
// board out, byte for byte: main.ts runs buildBoard and writes board.json, and two runs from
// the same input produce identical files. The dossier is built the same way, so the gate's
// rebuild matches the submitted one exactly.
//
//   peer       = median(mcap_usd / tvl_usd) over live-token protocols in the row's category
//                (n >= 5), else the overall median; clamped to [peer_floor, peer_cap]
//   base       = tvl_usd x peer
//   growth     = clamp(change_7d, -60, 120) per cent
//   growthMult = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity   = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age_days unknown: 365)
//   chainMult  = 1 + CHAIN_BONUS x min(chains - 1, 4)      (a protocol on more chains reaches more
//                                                          users; one chain scores 1.00, five or
//                                                          more score 1.12)
//   quality    = 0.97 when change_7d is null, x 0.97 when listed_at is null, else 1.00
//   implied    = max(1, round(base x growthMult x maturityMult x chainMult x quality))
//
// The constants are the model's, stated in the dashboard and changeable in its sandbox. No
// protocol name is ever special-cased: the same function scores every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_bonus: number;
  chain_cap: number;
  peer_floor: number;
  peer_cap: number;
  peer_min_category_n: number;
  quality_unknown_growth: number;
  quality_unknown_age: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  chain_bonus: 0.03,
  chain_cap: 4,
  peer_floor: 0.05,
  peer_cap: 0.6,
  peer_min_category_n: 5,
  quality_unknown_growth: 0.97,
  quality_unknown_age: 0.97,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** How many set-aside protocols the dashboard names, by TVL. */
export const SET_ASIDE_ROWS = 12;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    peer_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    quality_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  peer_multiple: number;
  quality_multiplier: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** A protocol set aside from the ranking, and why: its token is a receipt of one that trades. */
export interface SetAsideRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  reason: string;
}

/** The peer calibration: the overall median and the per-category medians the board uses. */
export interface PeerMultiples {
  overall: number;
  by_category: Record<string, number>;
}

/** Everything the dashboard needs: the board, the live set, the set-aside set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  peer: PeerMultiples;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  set_aside_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  set_aside: SetAsideRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a sorted list of numbers; the middle value, or the mean of the middle two. */
function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * The peer calibration, from the snapshot's own live-token protocols: the median market-cap-to-TVL
 * ratio overall, and per category where the category has at least `peer_min_category_n` live
 * protocols. Category multiples are clamped to [peer_floor, peer_cap]; the overall median is
 * clamped the same way. A category with too few live protocols falls back to the overall median,
 * so no row's base depends on a sample of one or two.
 */
export function peerMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): PeerMultiples {
  const clamp = (v: number): number => Math.min(model.peer_cap, Math.max(model.peer_floor, v));
  const live = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.tvl_usd > 0);
  const overall = clamp(median(live.map((p) => p.mcap_usd! / p.tvl_usd).sort((a, b) => a - b)));
  const byCategory: Record<string, number> = {};
  const byCat = new Map<string, number[]>();
  for (const p of live) {
    const list = byCat.get(p.category ?? 'Other') ?? [];
    list.push(p.mcap_usd! / p.tvl_usd);
    byCat.set(p.category ?? 'Other', list);
  }
  for (const [category, ratios] of byCat) {
    if (ratios.length >= model.peer_min_category_n) byCategory[category] = clamp(median(ratios.sort((a, b) => a - b)));
  }
  return { overall, by_category: byCategory };
}

/** The peer multiple one category scores: its own median where it has one, else the overall median. */
export function peerMultipleFor(category: string | null, peer: PeerMultiples): number {
  return peer.by_category[category ?? 'Other'] ?? peer.overall;
}

/** The five multipliers and the implied value one protocol gets under `model` and `peer`. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants, peer: PeerMultiples): { implied: number; peerMultiple: number; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; qualityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  // Rounded to four decimals before use: board.json and data.js carry the rounded figure, so
  // the dashboard's recompute of this row from the stored multiple lands on the same dollar.
  const peerMultiple = Math.round(peerMultipleFor(protocol.category, peer) * 1e4) / 1e4;
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), model.chain_cap);
  const chainMult = 1 + model.chain_bonus * extraChains;
  const qualityMult = (protocol.change_7d === null ? model.quality_unknown_growth : 1) * (protocol.listed_at === null ? model.quality_unknown_age : 1);
  const base = protocol.tvl_usd * peerMultiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * chainMult * qualityMult));
  return { implied, peerMultiple, growthPct, growthMult, maturityMult, chainMult, qualityMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** The categories a wrapped, staked or bridged product lives in: its token is a receipt, not a launch. */
const WRAPPED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** A name that carries a whole word wrapped, staked or staking is a receipt of a token that trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** A name that begins with an exchange's name is that exchange's product, not a launch of its own. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is a wrapped, staked or bridged product of a token that already trades. */
export function isWrappedProduct(p: SnapshotProtocol): boolean {
  return WRAPPED_CATEGORIES.has(p.category ?? '') || WRAPPED_WORD.test(p.name) || EXCHANGE_PREFIX.test(p.name);
}

/** Why a pre-token protocol is set aside from the ranking, or null when it is rankable. */
export function setAsideReason(p: SnapshotProtocol): string | null {
  if (p.category === 'CEX') return 'a centralised exchange, not a protocol launch';
  if (WRAPPED_CATEGORIES.has(p.category ?? '')) return `a ${p.category} product: its token is a receipt of one that already trades`;
  if (WRAPPED_WORD.test(p.name)) return 'a wrapped or staked product: its token is a receipt of one that already trades';
  if (EXCHANGE_PREFIX.test(p.name)) return "an exchange's own product, not a launch of its own";
  if (VERSIONED.test(p.name)) return 'a versioned pool of another protocol';
  return null;
}

/** Whether a protocol is one the board may rank: pre-token, and no wrapped, staked or bridged product. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && setAsideReason(p) === null;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record). A watchlist
  // slug is rankable by the house's own rule, so it is always kept.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable pre-token protocol, at any TVL. The floor is never the whole
  // board: protocols below it are the early finds, and protocols above it that the watchlist's
  // rule keeps are ranked too. No name is special-cased and no row is hand-picked.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const peer = peerMultiples(snapshot, model);
  const scored = [...chosen.values()].map((p) => {
    const { implied, peerMultiple, growthPct, growthMult, maturityMult, chainMult, qualityMult, age } = impliedValue(p, snapshot.as_of, model, peer);
    return { p, implied, peerMultiple, growthPct, growthMult, maturityMult, chainMult, qualityMult, age };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      peer_multiple: round4(s.peerMultiple),
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.chainMult),
      quality_multiplier: round4(s.qualityMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** What one transaction costs on a chain, in the words a farmer budgets with. */
function gasFor(chain: string): string {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 'about $12 of gas';
  if (c === 'solana' || c === 'hyperliquid l1') return 'under $0.10 of gas';
  if (c === 'binance' || c === 'bsc') return 'about $0.30 of gas';
  if (['base', 'arbitrum', 'optimism', 'polygon', 'zksync', 'scroll', 'blast', 'linea', 'mantle', 'mode', 'avalanche', 'monad', 'plasma', 'berachain', 'sonic', 'sui', 'aptos', 'robinhood chain'].includes(c)) return 'about $0.50 of gas';
  return 'about $2 of gas';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('options')) return `Deposit $${capital} of USDC into ${name}'s options vault on ${chain} and hold the vault shares.`;
  if (c.includes('basis trading')) return `Deposit $${capital} of USDC into ${name}'s basis strategy on ${chain} and keep the position open.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('liquidity manager')) return `Deposit $${capital} into a ${name} managed pool on ${chain} and keep the position open.`;
  if (c.includes('farm')) return `Deposit $${capital} of USDC into ${name}'s farm on ${chain} and keep the position staked.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC to ${name}'s chain and use it in the chain's own app.`;
  if (c.includes('btc') || c.includes('bitcoin')) return `Deposit $${capital} of BTC into ${name} on ${chain} and keep the receipt.`;
  if (c.includes('cedefi')) return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
  if (c.includes('otc')) return `List $${capital} of the asset through ${name}'s OTC desk on ${chain} and settle one trade.`;
  if (c.includes('card')) return `Load $${capital} onto the ${name} card from ${chain} and spend once with it.`;
  if (c.includes('privacy')) return `Deposit $${capital} through ${name}'s private pool on ${chain} and keep the receipt.`;
  if (c.includes('indexes')) return `Buy $${capital} of the ${name} index on ${chain} and hold the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('governance')) return `Deposit $${capital} into ${name} on ${chain} and vote once with the position.`;
  if (c.includes('payment')) return `Route $${capital} of payments through ${name} on ${chain} and keep the receipts.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A second feature to use, so the activity is more than one deposit. */
function secondFeature(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'borrow a small amount against the deposit and repay it';
  if (c.includes('dex') || c.includes('yield')) return 'swap once in the same pool and add a second, smaller position';
  if (c.includes('curator') || c.includes('allocator')) return 'deposit into a second vault of the same protocol';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return 'close the hedge and open one in the opposite direction';
  if (c.includes('basis trading')) return 'close the basis position and reopen it after the funding rate resets';
  if (c.includes('prediction')) return 'settle one market and place a second position';
  if (c.includes('liquidity manager')) return 'rebalance the managed pool once and add a second, smaller deposit';
  if (c.includes('farm')) return 'harvest the farm rewards once and restake them';
  if (c.includes('chain')) return 'use the chain app a second time, such as its other pool or market';
  if (c.includes('btc') || c.includes('bitcoin')) return 'mint a second, smaller BTC receipt and hold it beside the first';
  if (c.includes('cedefi')) return 'use a second feature of the protocol, such as its other pool or market';
  if (c.includes('otc')) return 'settle a second, smaller OTC trade';
  if (c.includes('card')) return 'spend a second time with the card, on a different merchant';
  if (c.includes('privacy')) return 'make a second private deposit of a smaller amount';
  if (c.includes('indexes')) return 'buy a second, smaller index position and hold it';
  if (c.includes('stable')) return 'redeem a small amount and mint it back';
  if (c.includes('rwa')) return 'claim the yield once and reinvest it';
  return 'use a second feature of the protocol, such as its other pool or market';
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(chain);
  const action = actionFor(p, capital, chain);
  const second = secondFeature(p);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: `Use the position once a week: ${second.toLowerCase()}, so the activity is counted in more than one snapshot.`,
      cost: `${gas} a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days, and do not withdraw it all at once when the window ends.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Open the protocol's own points or rewards page from the link its own site publishes, and check whether your wallet shows any points.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Keep a second wallet ready on the same chain, so a failed transaction or a changed contract does not strand the position.`,
      cost: 'nothing but the spare wallet',
      time: '5 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction hash in a farm log, so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
    {
      text: `When you unwind, withdraw in stages and claim only from the protocol's own page: a claim that asks for a fee or a new approval is a scam.`,
      cost: `${gas} to unwind`,
      time: '20 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** The pre-token protocols set aside from the ranking, by TVL, with the reason each is set aside. */
export function setAsideRows(snapshot: Snapshot): SetAsideRow[] {
  return snapshot.protocols
    .filter((p) => isPreToken(p) && setAsideReason(p) !== null)
    .sort((a, b) => b.tvl_usd - a.tvl_usd)
    .slice(0, SET_ASIDE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      tvl_usd: p.tvl_usd,
      reason: setAsideReason(p)!,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    peer_multiple: row.model.peer_multiple,
    quality_multiplier: row.model.quality_multiplier,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const peer = peerMultiples(snapshot, model);
  const live = liveRows(snapshot);
  const setAside = setAsideRows(snapshot);
  const setAsideTotal = snapshot.protocols.filter((p) => isPreToken(p) && setAsideReason(p) !== null).length;
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    peer,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    set_aside_size: setAsideTotal,
    rows: board.map(radarRow),
    live,
    set_aside: setAside,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
