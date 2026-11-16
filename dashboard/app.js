// Token Radar's dashboard (radar-3). It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, a per-protocol detail drawer with the model's
// own inputs and the protocol's farm plan, a model sandbox that re-ranks the board live, and the
// live-token and set-aside views. No network: every byte it shows is in data.js.
//
// The model in one function: the page recomputes a row from the snapshot figures and checks the
// number board.json carries, so the page's code and the board's data are visibly the same
// arithmetic. The sandbox changes only the constants the reader moves; the submitted board
// uses the defaults the model panel states.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var PAGE = 50;
  var state = { q: '', category: 'all', chain: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null, shown: PAGE };
  var sandbox = { peer_scale: 1, growth_weight: DATA.model.growth_weight, chain_bonus: DATA.model.chain_bonus };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  // The model, as lib/model.ts writes it: TVL x the peer multiple for the row's category
  // (the median market-cap-to-TVL ratio of the live-token protocols in that category, or the
  // overall median where the category has too few) x growth x maturity x chain x data quality,
  // from the snapshot's own figures. The sandbox passes its own constants and peer scale; the
  // board's numbers use DATA.model and a scale of 1.
  function impliedOf(row, m, scale) {
    var peer = row.peer_multiple === null || row.peer_multiple === undefined ? DATA.peer.overall : row.peer_multiple;
    var quality = row.quality_multiplier === null || row.quality_multiplier === undefined ? 1 : row.quality_multiplier;
    var growth = Math.min(m.growth_cap, Math.max(m.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * m.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? m.unknown_age_days : row.age_days;
    var maturity = m.maturity_floor + (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
    var chainMult = 1 + m.chain_bonus * Math.min(Math.max((row.chains || []).length - 1, 0), m.chain_cap);
    return Math.max(1, Math.round(row.tvl_usd * peer * (scale || 1) * growthMult * maturity * chainMult * quality));
  }
  function sandboxModel() {
    return {
      growth_weight: sandbox.growth_weight,
      growth_floor: DATA.model.growth_floor, growth_cap: DATA.model.growth_cap,
      maturity_floor: DATA.model.maturity_floor, maturity_range: DATA.model.maturity_range,
      maturity_days: DATA.model.maturity_days, unknown_age_days: DATA.model.unknown_age_days,
      chain_bonus: sandbox.chain_bonus, chain_cap: DATA.model.chain_cap
    };
  }
  function sandboxChanged() {
    return sandbox.peer_scale !== 1 || sandbox.growth_weight !== DATA.model.growth_weight || sandbox.chain_bonus !== DATA.model.chain_bonus;
  }
  // Every row with its implied value under the sandbox, ranked strongest first.
  function rankedRows() {
    var m = sandboxModel();
    var list = DATA.rows.map(function (r) { return { row: r, implied: impliedOf(r, m, sandbox.peer_scale) }; });
    list.sort(function (a, b) { return b.implied - a.implied || (a.row.slug < b.row.slug ? -1 : a.row.slug > b.row.slug ? 1 : 0); });
    list.forEach(function (x, i) { x.rank = i + 1; });
    return list;
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and
  // age decide the action, the capital, the hold and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function gasFor(chain) {
    var c = (chain || '').toLowerCase();
    if (c === 'ethereum') return 'about $12 of gas';
    if (c === 'solana' || c === 'hyperliquid l1') return 'under $0.10 of gas';
    if (c === 'binance' || c === 'bsc') return 'about $0.30 of gas';
    if (['base', 'arbitrum', 'optimism', 'polygon', 'zksync', 'scroll', 'blast', 'linea', 'mantle', 'mode', 'avalanche', 'monad', 'plasma', 'berachain', 'sonic', 'sui', 'aptos', 'robinhood chain'].indexOf(c) >= 0) return 'about $0.50 of gas';
    return 'about $2 of gas';
  }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('options') >= 0) return 'Deposit $' + capital + " of USDC into " + name + "'s options vault on " + chain + ' and hold the vault shares.';
    if (c.indexOf('basis trading') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + "'s basis strategy on " + chain + ' and keep the position open.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('liquidity manager') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' managed pool on ' + chain + ' and keep the position open.';
    if (c.indexOf('farm') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + "'s farm on " + chain + ' and keep the position staked.';
    if (c.indexOf('chain') >= 0) return 'Bridge $' + capital + ' of USDC to ' + name + "'s chain and use it in the chain's own app.";
    if (c.indexOf('btc') >= 0 || c.indexOf('bitcoin') >= 0) return 'Deposit $' + capital + ' of BTC into ' + name + ' on ' + chain + ' and keep the receipt.';
    if (c.indexOf('cedefi') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('otc') >= 0) return 'List $' + capital + " of the asset through " + name + "'s OTC desk on " + chain + ' and settle one trade.';
    if (c.indexOf('card') >= 0) return 'Load $' + capital + ' onto the ' + name + ' card from ' + chain + ' and spend once with it.';
    if (c.indexOf('privacy') >= 0) return 'Deposit $' + capital + " through " + name + "'s private pool on " + chain + ' and keep the receipt.';
    if (c.indexOf('indexes') >= 0) return 'Buy $' + capital + ' of the ' + name + ' index on ' + chain + ' and hold the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('governance') >= 0) return 'Deposit $' + capital + ' into ' + name + ' on ' + chain + ' and vote once with the position.';
    if (c.indexOf('payment') >= 0) return 'Route $' + capital + ' of payments through ' + name + ' on ' + chain + ' and keep the receipts.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function secondFeature(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'borrow a small amount against the deposit and repay it';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0) return 'swap once in the same pool and add a second, smaller position';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'deposit into a second vault of the same protocol';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) return 'close the hedge and open one in the opposite direction';
    if (c.indexOf('basis trading') >= 0) return 'close the basis position and reopen it after the funding rate resets';
    if (c.indexOf('prediction') >= 0) return 'settle one market and place a second position';
    if (c.indexOf('liquidity manager') >= 0) return 'rebalance the managed pool once and add a second, smaller deposit';
    if (c.indexOf('farm') >= 0) return 'harvest the farm rewards once and restake them';
    if (c.indexOf('chain') >= 0) return 'use the chain app a second time, such as its other pool or market';
    if (c.indexOf('btc') >= 0 || c.indexOf('bitcoin') >= 0) return 'mint a second, smaller BTC receipt and hold it beside the first';
    if (c.indexOf('cedefi') >= 0) return 'use a second feature of the protocol, such as its other pool or market';
    if (c.indexOf('otc') >= 0) return 'settle a second, smaller OTC trade';
    if (c.indexOf('card') >= 0) return 'spend a second time with the card, on a different merchant';
    if (c.indexOf('privacy') >= 0) return 'make a second private deposit of a smaller amount';
    if (c.indexOf('indexes') >= 0) return 'buy a second, smaller index position and hold it';
    if (c.indexOf('stable') >= 0) return 'redeem a small amount and mint it back';
    if (c.indexOf('rwa') >= 0) return 'claim the yield once and reinvest it';
    return 'use a second feature of the protocol, such as its other pool or market';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = gasFor(chain);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and ' + gas, time: '15 minutes to set up' },
      { text: 'Use the position once a week: ' + secondFeature(p) + ', so the activity is counted in more than one snapshot.', cost: gas + ' a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days, and do not withdraw it all at once when the window ends.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Open the protocol's own points or rewards page from the link its own site publishes, and check whether your wallet shows any points.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Keep a second wallet ready on the same chain, so a failed transaction or a changed contract does not strand the position.', cost: 'nothing but the spare wallet', time: '5 minutes' },
      { text: 'Write the wallet, the dates and every transaction hash in a farm log, so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' },
      { text: "When you unwind, withdraw in stages and claim only from the protocol's own page: a claim that asks for a fee or a new approval is a scam.", cost: gas + ' to unwind', time: '20 minutes' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function filteredRanked() {
    var q = state.q.trim().toLowerCase();
    return rankedRows().filter(function (x) {
      var r = x.row;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRanked(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.row.name.toLowerCase(); bv = b.row.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.row.tvl_usd; bv = b.row.tvl_usd; }
      else if (key === 'growth') { av = a.row.change_7d === null ? -Infinity : a.row.change_7d; bv = b.row.change_7d === null ? -Infinity : b.row.change_7d; }
      else if (key === 'age') { av = a.row.age_days === null ? Infinity : a.row.age_days; bv = b.row.age_days === null ? Infinity : b.row.age_days; }
      else { av = a.implied; bv = b.implied; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.row.slug < b.row.slug ? -1 : a.row.slug > b.row.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    var top = rankedRows()[0];
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.board_size + ' pre-token protocols, ranked by implied value' }),
        el('p', { html: 'The watchlist is the floor: every protocol with at least <b>$' + Math.round(DATA.floor_usd / 1e6) + 'M</b> of TVL and no token on record. The radar adds <b>' + DATA.early_size + '</b> more below that floor, and sets aside <b>' + DATA.set_aside_size + '</b> wrapped, staked and bridged products whose token is a receipt of one that already trades. Implied value is a model, not a promise — the strongest row, <b>' + (top ? top.row.name : '—') + '</b>, is worth <b>' + fmtUsd(top ? top.implied : 0) + '</b> under it.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Wrapped products set aside' }), el('b', { text: String(DATA.set_aside_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function picks() {
    var top = rankedRows().slice(0, 5);
    return el('section', { class: 'picks', 'aria-label': 'Top radar picks' },
      top.map(function (x, i) {
        return el('button', { type: 'button', class: 'pick' + (i === 0 ? ' first' : ''), onclick: function () { openDetail(x.row.slug); } },
          el('span', { class: 'rank', text: 'RANK ' + x.rank }),
          el('b', { text: x.row.name }),
          el('span', { class: 'val', text: fmtUsd(x.implied) }),
          el('span', { class: 'meta', text: fmtUsd(x.row.tvl_usd) + ' TVL · ' + fmtPct(x.row.change_7d) + ' 7d · ' + fmtAge(x.row.age_days) })
        );
      })
    );
  }

  function rising() {
    var fast = DATA.rows.filter(function (r) { return r.change_7d !== null && r.change_7d > 0; })
      .sort(function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); }).slice(0, 3);
    if (fast.length === 0) return null;
    return el('div', { class: 'rising' },
      el('span', { text: 'Rising fastest this week:' }),
      fast.map(function (r) {
        return el('span', null,
          el('b', { text: r.name + ' ' }),
          el('span', { class: 'up', text: fmtPct(r.change_7d) })
        );
      })
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; state.shown = PAGE; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; state.shown = PAGE; writeHash(); render(); });
    var chainSel = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; state.shown = PAGE; writeHash(); render(); });
    var tabs = ['pre-token', 'live', 'set-aside'].map(function (t) {
      var label = t === 'pre-token' ? 'Pre-token' : t === 'live' ? 'Live token' : 'Set aside';
      return el('button', { type: 'button', 'aria-pressed': state.tab === t ? 'true' : 'false', text: label, onclick: function () { state.tab = t; state.shown = PAGE; writeHash(); render(); } });
    });
    var count = state.tab === 'pre-token' ? filteredRanked().length + ' rows shown' : state.tab === 'live' ? DATA.live.length + ' live-token protocols' : DATA.set_aside_size + ' wrapped products set aside';
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSel),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, tabs)),
      el('span', { class: 'count', text: count })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRanked(filteredRanked());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.shown = PAGE; writeHash(); render(); } })
      ));
    }
    var shown = list.slice(0, state.shown);
    var max = shown[0] ? shown[0].implied : 1;
    var tbody = el('tbody');
    shown.forEach(function (x) {
      var r = x.row;
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(x.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((x.implied / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(x.implied) })
        )),
        el('td', null, el('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    var panel = el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
    if (list.length > state.shown) {
      panel.appendChild(el('button', { class: 'button more', type: 'button', text: 'Show ' + Math.min(PAGE, list.length - state.shown) + ' more of ' + list.length, onclick: function () { state.shown += PAGE; render(); } }));
    }
    return panel;
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function setAsidePanel() {
    return el('section', { class: 'panel setaside' },
      el('h2', { text: 'Set aside: wrapped, staked and bridged products' }),
      el('p', { class: 'sub', text: 'These ' + DATA.set_aside_size + ' protocols record no token, but each is a wrapped, staked or bridged product of a token that already trades — its token is a receipt, not a launch. WBTC is Bitcoin on Ethereum; a staked-ETH product is ETH in a staking contract. They are not ranked, because there is no launch to rank.' }),
      el('div', { class: 'setaside-list' },
        DATA.set_aside.map(function (r) {
          return el('div', { class: 'setaside-row' },
            el('b', { text: r.name + ' (' + fmtUsd(r.tvl_usd) + ')' }),
            el('span', { text: r.reason })
          );
        })
      )
    );
  }

  function categoryBars() {
    var counts = {};
    DATA.rows.forEach(function (r) { var c = r.category || 'Other'; counts[c] = (counts[c] || 0) + 1; });
    var top = Object.keys(counts).map(function (c) { return { c: c, n: counts[c] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    var max = top[0] ? top[0].n : 1;
    return el('section', { class: 'panel cats' },
      el('h2', { text: 'Where the pre-token protocols sit' }),
      el('p', { class: 'sub', text: 'Rows by category. Select one to filter the board.' }),
      top.map(function (x) {
        return el('button', { type: 'button', class: 'cat-row', onclick: function () { state.category = x.c; state.tab = 'pre-token'; state.shown = PAGE; writeHash(); render(); } },
          el('span', { class: 'cat-name', text: x.c }),
          el('span', { class: 'cat-track' }, el('i', { style: 'width:' + Math.round((x.n / max) * 100) + '%' })),
          el('span', { class: 'cat-count', text: String(x.n) })
        );
      })
    );
  }

  // A category's peer multiple as the model panel prints it, or the overall median.
  function peerText(category) {
    var v = DATA.peer.by_category[category];
    if (v === null || v === undefined) return DATA.peer.overall.toFixed(3);
    return v.toFixed(3);
  }

  function modelPanel() {
    var m = DATA.model;
    var changed = sandboxChanged();
    function slider(id, label, min, max, step, value, fmt) {
      var out = el('output', { for: id, text: fmt(value) });
      var input = el('input', { type: 'range', id: id, min: String(min), max: String(max), step: String(step), value: String(value), 'aria-label': label });
      input.addEventListener('input', function () {
        var v = parseFloat(input.value);
        if (id === 'sb-peer') sandbox.peer_scale = v;
        if (id === 'sb-growth') sandbox.growth_weight = v;
        if (id === 'sb-chain') sandbox.chain_bonus = v;
        out.textContent = fmt(v);
        render();
      });
      return el('div', { class: 'slider-row' }, el('label', { for: id, text: label }), input, out);
    }
    var panel = el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        el('span', { html: 'implied = round( tvl_usd x <b>peer multiple</b> x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x (1 + ' + m.chain_bonus + ' x min(chains - 1, ' + m.chain_cap + ')) x <b>quality</b> )' })
      ),
      el('p', { class: 'sub', text: 'The peer multiple is the market\u2019s own price per TVL dollar: the median market-cap-to-TVL ratio of the protocols in this snapshot that already trade — ' + DATA.peer.overall.toFixed(3) + ' overall, and per category where the category has at least ' + m.peer_min_category_n + ' live protocols (Dexs ' + peerText('Dexs') + ', RWA ' + peerText('RWA') + ', Basis Trading ' + peerText('Basis Trading') + ', Lending ' + peerText('Lending') + '), each clamped to [' + m.peer_floor + ', ' + m.peer_cap + ']. TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. Chain breadth counts because a protocol on more chains reaches more users: one chain scores 1.00, five or more score 1.12. Quality is 0.97 when the growth figure is missing and 0.97 again when the listing date is missing — an unknown is a reason to be a little less sure, not a neutral.' }),
      el('div', { class: 'sandbox' },
        el('h3', { text: 'Model sandbox: move a constant, the board re-ranks' }),
        slider('sb-peer', 'Peer multiple scale', 0.5, 2, 0.05, sandbox.peer_scale, function (v) { return v.toFixed(2) + 'x'; }),
        slider('sb-growth', 'Growth weight', 0, 1, 0.05, sandbox.growth_weight, function (v) { return v.toFixed(2); }),
        slider('sb-chain', 'Chain bonus per extra chain', 0, 0.05, 0.005, sandbox.chain_bonus, function (v) { return v.toFixed(3); }),
        el('p', { class: 'sandbox-note', html: changed ? '<b>The board above is re-ranked with your constants.</b> The submitted board.json uses the defaults: peer scale 1.00x, growth 0.50, chain 0.030.' : 'The board above uses the defaults: peer scale 1.00x, growth 0.50, chain 0.030. Move a slider to re-rank it.' }),
        changed ? el('button', { class: 'button', type: 'button', text: 'Reset to the submitted model', onclick: function () { sandbox.peer_scale = 1; sandbox.growth_weight = DATA.model.growth_weight; sandbox.chain_bonus = DATA.model.chain_bonus; render(); } }) : null
      )
    );
    return panel;
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var found = rankedRows().filter(function (x) { return x.row.slug === slug; })[0];
    if (!found) return;
    var row = found.row;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var m = sandboxModel();
    var peer = row.peer_multiple === null || row.peer_multiple === undefined ? DATA.peer.overall : row.peer_multiple;
    var quality = row.quality_multiplier === null || row.quality_multiplier === undefined ? 1 : row.quality_multiplier;
    var qualityNote = quality >= 1 ? 'complete record' : 'discounted: ' + (row.change_7d === null ? 'no 7-day growth on record' : '') + (row.change_7d === null && row.listed_at === null ? ' and ' : '') + (row.listed_at === null ? 'no listing date on record' : '');
    var growth = Math.min(m.growth_cap, Math.max(m.growth_floor, row.change_7d === null ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * m.growth_weight;
    var age = row.age_days === null ? m.unknown_age_days : row.age_days;
    var maturity = m.maturity_floor + (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
    var chainMult = 1 + m.chain_bonus * Math.min(Math.max((row.chains || []).length - 1, 0), m.chain_cap);
    var shown = sandboxChanged() ? found.implied : row.implied_value_usd;
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + found.rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Peer multiple (' + (row.category || 'Other') + ')' }), el('b', { class: 'num', text: peer.toFixed(3) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Chains' }), el('b', { class: 'num', text: String((row.chains || []).length) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: growthMult.toFixed(4) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: maturity.toFixed(4) })),
        el('div', null, el('span', { text: 'Chain multiplier' }), el('b', { class: 'num', text: chainMult.toFixed(4) })),
        el('div', null, el('span', { text: 'Data quality' }), el('b', { class: 'num', text: quality.toFixed(2) + ' — ' + qualityNote })),
        el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(shown) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(impliedOf(row, DATA.model, 1)) + (impliedOf(row, DATA.model, 1) === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + (sandboxChanged() ? ' The sandbox is on: this value uses your constants.' : '') + ' This is an estimate, not a price. The protocol records no token.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function footer() {
    return el('footer', { class: 'foot' },
      el('span', { text: 'Source: ' + DATA.source + '. ' }),
      el('span', { text: 'A protocol records no token when DefiLlama carries no market cap, CoinGecko id or symbol for it; that is the record, never proof it has none. Implied value is this entry\u2019s own claim, never make.fun\u2019s.' })
    );
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(picks());
    var r = rising();
    if (r) shell.appendChild(r);
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : state.tab === 'live' ? liveTable() : setAsidePanel());
    if (state.tab === 'pre-token') shell.appendChild(categoryBars());
    shell.appendChild(modelPanel());
    shell.appendChild(footer());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
    window.__shotReady = true;
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
