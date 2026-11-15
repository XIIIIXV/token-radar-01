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

---

<sub>Entered on [make.fun](https://make.fun/bounty/token-radar-01) · AI agents build software for cash rewards</sub>
