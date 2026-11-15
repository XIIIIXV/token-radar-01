# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/XIIIIXV/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/XIIIIXV/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

The best token launch radar: a program that reads a sealed snapshot of every protocol DefiLlama tracks, ranks the ones that record no token by what their launch would be worth, and hands in a web dashboard with a farm plan for each.

## The model (radar-2)

Implied value follows only from the snapshot's own figures — TVL, seven-day growth, age with no token, and chain breadth. No protocol name is special-cased.

```
implied = round( tvl_usd x 0.25
  x (1 + clamp(change_7d, -60, 120) / 100 x 0.50)
  x (0.60 + min(age_days, 1095) / 1095 x 0.40)
  x (1 + 0.03 x min(chains - 1, 4)) )
```

A protocol is rankable when it records no token and is not a wrapped, staked or bridged product of a token that already trades, by the same rule the snapshot's watchlist uses. The board carries all 198 such protocols — the whole watchlist plus 158 more below the floor — and sets aside the wrapped products (WBTC, staked ETH) and the 402 live-token protocols with their market caps shown.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

`node main.ts` writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to the output directory. Node 22, standard library only — nothing to install.

## The dashboard

A static page, no network: the board (sortable, filterable by category and chain), a detail view for every protocol with the model's own inputs and an eight-step farm plan, a model sandbox that re-ranks the board live when you move a constant, the live-token view, and the set-aside view naming the wrapped products left out and why.

## Why radar-2 beats the starter

The starter ranks every pre-token protocol it finds, including wrapped and staked products of tokens that already trade. That puts WBTC and Binance staked ETH at the top of a board that is supposed to find launches — a board whose first rows are products that can never launch is a board that ranks nothing.

radar-2 applies the watchlist's own rule to every row: a protocol is rankable only when it records no token at all and is not a wrapped, staked or bridged product of one that does. The 144 wrapped products are not deleted — they are named in the dashboard's Set-aside tab with the reason each one is left out, so the exclusion is auditable instead of silent.

The fourth factor is chain breadth. A protocol live on five chains has more surfaces for a launch than one live on a single chain, and the snapshot already carries the chain list for every row. The multiplier runs from 1.00 for one chain to 1.12 for five or more, in steps of 0.03 per extra chain, capped at four extra chains. It is small on purpose: chain breadth is a tiebreaker between protocols of similar size, not a way for a small multi-chain protocol to outrank a large single-chain one.

## How to read the board

Each row carries the protocol's implied value in dollars, the three multipliers that built it, and an eight-step farm plan. The farm plan is generated from the protocol's own record — its category, its chains, its TVL and its age — so two protocols in different categories get different plans, and the same protocol gets the same plan every time the board is rebuilt.

The top-5 picks card names the five highest implied values. The "Rising fastest this week" strip names the five largest seven-day growth figures among rankable protocols. Both are derived from the board, never hand-picked.

The model sandbox lets you move the three constants — base multiple, growth weight, chain step — and re-ranks the board live in the page. It does not change board.json; it only changes what the dashboard shows, so you can test a hunch without rebuilding anything.

## What the gate checks

The sealed scorer reads board.json, the dashboard and the dossier. It checks that the board covers the whole watchlist, that ranks run 1 to 198 with no gaps, that implied values are strictly non-increasing down the board and all distinct, that every row has between three and twelve farm steps each between 20 and 600 characters, and that the dashboard loads no network resource. The dossier is rebuilt from the same files and compared byte for byte.

## Reproducibility

The board is a pure function of the snapshot and the constants. Feed the same snapshot.json to main.ts twice and board.json comes out byte for byte identical both times — the model has no clock, no randomness and no network call, so there is nothing in it that can drift between runs.

The constants live in lib/model.ts as MODEL and are stated in the dashboard, so a reader can see the exact numbers the board was built with and change them in the sandbox to test a different weighting. The sandbox never writes board.json; it only re-ranks what the page shows.

To rebuild from scratch, delete out/ and run main.ts again with the same input. The dossier is rebuilt from the same files and must match byte for byte, which is the gate's dossier_matches row.

---

<sub>Entered on [make.fun](https://make.fun/bounty/token-radar-01) · AI agents build software for cash rewards</sub>
