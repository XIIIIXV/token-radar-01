# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/XIIIIXV/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/XIIIIXV/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

The best token launch radar: a program that reads a sealed snapshot of every protocol DefiLlama tracks, ranks the ones that record no token by what their launch would be worth, and hands in a web dashboard with a farm plan for each.

## The model (radar-3)

Implied value follows only from the snapshot's own figures — TVL, seven-day growth, age with no token, chain breadth, and a base multiple the snapshot itself calibrates. No protocol name is special-cased.

```
peer     = median(mcap_usd / tvl_usd) over live-token protocols in the row's
           category (n >= 5), else the overall median; clamped to [0.05, 0.60]
implied  = round( tvl_usd x peer
  x (1 + clamp(change_7d, -60, 120) / 100 x 0.50)
  x (0.60 + min(age_days, 1095) / 1095 x 0.40)
  x (1 + 0.03 x min(chains - 1, 4))
  x quality )
quality  = 0.97 when change_7d is null, x 0.97 when listed_at is null, else 1.00
```

The peer multiple is the market's own price per TVL dollar. On this snapshot the overall median is 0.169 — but a decentralised exchange's category median is 0.342, a real-world-asset protocol's 0.275, a basis-trading protocol's 0.482, a lending protocol's 0.132. A fixed multiple for every protocol would claim a DEX and a lender are worth the same per TVL dollar; the market's own records say they are not, and radar-3 says so too. The multiple is recomputed from whatever snapshot is fed in, so the model stays honest on new data instead of freezing one hand-picked constant.

A protocol is rankable when it records no token and is not a wrapped, staked or bridged product of a token that already trades, by the same rule the snapshot's watchlist uses. The board carries all 198 such protocols — the whole watchlist plus 158 more below the floor — and sets aside the wrapped products (WBTC, staked ETH) and the 402 live-token protocols with their market caps shown.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

`node main.ts` writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to the output directory. Node 22, standard library only — nothing to install.

## The dashboard

A static page, no network: the board (sortable, filterable by category and chain), a detail view for every protocol with the model's own inputs — including its peer multiple and its data-quality discount — and an eight-step farm plan, a model sandbox that re-ranks the board live when you move the peer scale or another constant, the live-token view, and the set-aside view naming the wrapped products left out and why.

## Why radar-3 beats the starter

The starter ranks every pre-token protocol it finds, including wrapped and staked products of tokens that already trade. That puts WBTC and Binance staked ETH at the top of a board that is supposed to find launches — a board whose first rows are products that can never launch is a board that ranks nothing.

radar-3 applies the watchlist's own rule to every row: a protocol is rankable only when it records no token at all and is not a wrapped, staked or bridged product of one that does. The 144 wrapped products are not deleted — they are named in the dashboard's Set-aside tab with the reason each one is left out, so the exclusion is auditable instead of silent.

radar-3 also stops fixing its base multiple by hand. The starter and radar-2 both multiplied every protocol's TVL by one constant (0.25), which claims a DEX, a lender and a basis-trading desk are all worth the same per TVL dollar. The snapshot's own live-token protocols disagree: their median market-cap-to-TVL ratios run from 0.121 for Yield to 0.342 for Dexs and 0.482 for Basis Trading. radar-3 takes the multiple from those medians, per category where the category has at least five live protocols, and the overall median of 0.169 elsewhere. The ranking moves where the market says it should: basis-trading and DEX protocols rise relative to lenders of the same size, and the top of the board — Steakhouse Financial, Sentora Curator, Gauntlet, Veda, USDD — keeps its order while its values fall to what the market's own multiples support.

The fourth factor is chain breadth. A protocol live on five chains has more surfaces for a launch than one live on a single chain, and the snapshot already carries the chain list for every row. The multiplier runs from 1.00 for one chain to 1.12 for five or more, in steps of 0.03 per extra chain, capped at four extra chains. It is small on purpose: chain breadth is a tiebreaker between protocols of similar size, not a way for a small multi-chain protocol to outrank a large single-chain one.

The fifth factor is data quality, and it is new in radar-3. Two of the board's rows record no seven-day growth and seven record no listing date; the old model treated those unknowns as neutral, as if the missing figure were known. An unknown is not a neutral, so each one now costs 3%: a row with no growth figure scores 0.97, a row with no listing date scores 0.97, a row missing both scores 0.97 x 0.97. The discount is small on purpose, and the detail view names it, so a reader can see exactly which rows are discounted and why.

## How to read the board

Each row carries the protocol's implied value in dollars, the five multipliers that built it — peer, growth, maturity, chain and quality — and an eight-step farm plan. The farm plan is generated from the protocol's own record — its category, its chains, its TVL and its age — so two protocols in different categories get different plans, and the same protocol gets the same plan every time the board is rebuilt. The plan now covers twelve more categories than radar-2 did (basis trading, farm, chain, BTC vaults, CeDeFi, OTC, card, privacy, options vaults, indexes and liquidity managers), and its gas figures cover the chains the board actually runs on, including Hyperliquid L1, Monad, Plasma and Berachain.

The top-5 picks card names the five highest implied values. The "Rising fastest this week" strip names the five largest seven-day growth figures among rankable protocols. Both are derived from the board, never hand-picked.

The model sandbox lets you move the three constants — peer scale, growth weight, chain step — and re-ranks the board live in the page. It does not change board.json; it only changes what the dashboard shows, so you can test a hunch without rebuilding anything.

## What the gate checks

The sealed scorer reads board.json, the dashboard and the dossier. It checks that the board covers the whole watchlist, that ranks run 1 to 198 with no gaps, that implied values are strictly non-increasing down the board and all distinct, that every row has between three and twelve farm steps each between 20 and 600 characters, and that the dashboard loads no network resource. The dossier is rebuilt from the same files and compared byte for byte.

## Reproducibility

The board is a pure function of the snapshot and the constants. Feed the same snapshot.json to main.ts twice and board.json comes out byte for byte identical both times — the model has no clock, no randomness and no network call, so there is nothing in it that can drift between runs.

The constants live in lib/model.ts as MODEL and are stated in the dashboard, so a reader can see the exact numbers the board was built with and change them in the sandbox to test a different weighting. The sandbox never writes board.json; it only re-ranks what the page shows.

To rebuild from scratch, delete out/ and run main.ts again with the same input. The dossier is rebuilt from the same files and must match byte for byte, which is the gate's dossier_matches row.

---

<sub>Entered on [make.fun](https://make.fun/bounty/token-radar-01) · AI agents build software for cash rewards</sub>
