// The pro-forma, over typed arrays.
//
// One function, called on every parameter change, producing BOTH the colour
// array and the metrics in the same pass. That is deliberate and it is the same
// rule bathtub follows: the picture and the numbers must come from the same
// data by the same formula, so they cannot quietly disagree.
//
// Every step below is a line of the HPD Plus One ADU term sheet, except where
// it is marked as ours. The manifest carries the citations.

export const FLAG = {
  two_family: 1 << 0,
  eligible_attached: 1 << 1,
  eligible_detached: 1 << 2,
  in_flood_2050: 1 << 3,
  in_flood_2080: 1 << 4,
  in_historic_district: 1 << 5,
  excluded_district: 1 << 6,
  city_owned: 1 << 7
};

// Column offsets into lots.bin. Must match manifest.columns.
const LON = 0, LAT = 1, ADU_SF = 2, LOT_AREA = 3, RENT_FMR = 4,
      TRACT_INCOME = 5, TRACT_IDX = 6;
export const STRIDE = 7;

/** Monthly debt service on F over n months at annual rate r. */
function payment(F, annualRate, months) {
  if (F <= 0) return 0;
  const r = annualRate / 12;
  // The rate slider reaches zero because the programme does - "5%. Rate may be
  // reduced." - and the amortisation formula divides by zero there.
  if (r === 0) return F / months;
  return (F * r) / (1 - Math.pow(1 + r, -months));
}

function median(sorted) {
  if (!sorted.length) return 0;
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

/**
 * Run the pro-forma on every lot.
 *
 * Returns typed arrays the layer reads directly, plus the panel's numbers.
 * Nothing is allocated per lot and nothing is recomputed twice.
 */
export function compute(lots, flags, manifest, p) {
  const n = flags.length;
  const margin = new Float32Array(n);
  const roe = new Float32Array(n);
  const state = new Uint8Array(n);   // 0 ineligible, 1 fails, 2 over loan cap, 3 pencils
  const releaseYear = new Int16Array(n).fill(-1);

  const loanMax = manifest.programme.loan_max;
  const softCost = manifest.assumptions.soft_cost.value;
  const opexShare = manifest.assumptions.opex_share.value;
  const propertyTax = manifest.assumptions.property_tax.value;   // 0 - see the card
  const rentAmi = manifest.rent_ami_monthly;

  const useAll = p.eligibility === 'all';
  const wantDetached = true;   // the sandbox prices the better of the two
  const cushion = p.cushion;

  let eligible = 0, pencils = 0, overCap = 0;
  const passingRoe = [];
  const passingIdx = [];

  for (let i = 0; i < n; i++) {
    const f = flags[i];
    const base = i * STRIDE;
    const A = lots[base + ADU_SF];

    // Eligibility. `all` prices an ADU on every one-to-two-family lot in Queens
    // regardless of legality, so the difference between the two settings is
    // exactly what the zoning rule costs.
    const legal = wantDetached
      ? (f & FLAG.eligible_detached) !== 0
      : (f & FLAG.eligible_attached) !== 0;
    const inSet = A > 0 && (useAll ? (f & FLAG.city_owned) === 0 : legal);
    if (!inSet) { state[i] = 0; continue; }

    // THERE IS NO OWNER-OCCUPANCY CONTROL, deliberately.
    //
    // The programme requires the owner to live at the property "no less than
    // 270 days per year", and this model cannot represent that at all: there is
    // no dataset of who lives in which house. An earlier version had the switch
    // and it screened out city-owned lots, which the eligibility test above
    // already excludes - so it was a control that changed nothing, which is a
    // bug, and a worse one than a missing control because it implies the model
    // knows something it does not. The requirement is named in the model card
    // under what this cannot see.

    eligible += 1;

    const C = A * p.cost_per_sf + softCost;
    const S = Math.min(p.grant_max, C);
    const E = p.equity_share * C;
    const need = Math.max(0, C - S - E);

    // A lot whose remaining cost exceeds the loan cap does not pencil, and the
    // reason is reported separately from failing the cushion - they are
    // different failures and a student should be able to tell them apart.
    if (need > loanMax) { state[i] = 2; overCap += 1; continue; }

    const D = payment(need, p.interest_rate, p.term_months);

    let R;
    if (p.rent_basis === 'ami_cap') R = rentAmi;
    else if (p.rent_basis === 'fmr') R = lots[base + RENT_FMR];
    else R = p.rent_flat;

    const Reff = R * (1 - p.vacancy);
    const O = opexShare * Reff;
    const M = Reff - O - propertyTax - D;
    margin[i] = M;

    // Guard the divide: equity can legitimately be zero, and the programme's
    // own default is that the homeowner puts in nothing.
    roe[i] = E > 0 ? (12 * M) / E : (M > 0 ? Infinity : 0);

    if (M >= cushion) {
      state[i] = 3;
      pencils += 1;
      passingRoe.push(roe[i]);
      passingIdx.push(i);
    } else {
      state[i] = 1;
    }
  }

  // ---- time -------------------------------------------------------------
  // Rank the passing lots by return on equity and release the top
  // permits_per_year each year. The claim this makes is explicit: the binding
  // constraint is permitting throughput, not demand. Nothing here represents a
  // homeowner deciding anything, and the ranking is a stand-in for a decision.
  passingIdx.sort((a, b) => {
    const ra = roe[a], rb = roe[b];
    if (ra === rb) return a - b;          // stable, so the map does not shimmer
    return rb - ra;
  });
  const startYear = manifest.start_year ?? 2027;
  const perYear = Math.max(1, p.permits_per_year);
  for (let rank = 0; rank < passingIdx.length; rank++) {
    releaseYear[passingIdx[rank]] = startYear + Math.floor(rank / perYear);
  }

  // ---- metrics, from the same pass --------------------------------------
  let builtByYear = 0, builtThisYear = 0;
  const incomesOfBuilt = [];
  const perTract = new Map();
  for (let rank = 0; rank < passingIdx.length; rank++) {
    const i = passingIdx[rank];
    const y = releaseYear[i];
    if (y > p.year) break;               // sorted by rank, so this is safe
    builtByYear += 1;
    if (y === p.year) builtThisYear += 1;
    incomesOfBuilt.push(lots[i * STRIDE + TRACT_INCOME]);
    const t = lots[i * STRIDE + TRACT_IDX];
    perTract.set(t, (perTract.get(t) ?? 0) + 1);
  }

  const marginsOfPassing = passingIdx.map((i) => margin[i]).sort((a, b) => a - b);
  incomesOfBuilt.sort((a, b) => a - b);

  // The concentration measure, defined here and stated in the card: tracts are
  // ranked by how many units they receive, and this is the share of all units
  // falling in the top DECILE of those tracts.
  const counts = [...perTract.values()].sort((a, b) => b - a);
  const topDecileTracts = Math.max(1, Math.ceil(counts.length / 10));
  const inTop = counts.slice(0, topDecileTracts).reduce((a, b) => a + b, 0);
  const concentration = builtByYear > 0 ? inTop / builtByYear : 0;

  return {
    margin, roe, state, releaseYear,
    metrics: {
      eligible, pencils, overCap,
      shareOfEligible: eligible > 0 ? pencils / eligible : 0,
      builtByYear, builtThisYear,
      medianMargin: median(marginsOfPassing),
      medianTractIncome: median(incomesOfBuilt),
      concentration,
      tractsReceiving: counts.length
    }
  };
}

/**
 * Colour every lot, from the results of the same pass.
 *
 * Returns a Uint8Array of RGBA, which deck.gl reads without copying.
 */
export function colours(result, lots, p, manifest) {
  const n = result.state.length;
  const rgba = new Uint8Array(n * 4);
  const { state, margin, roe, releaseYear } = result;
  const startYear = manifest.start_year ?? 2027;

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const s = state[i];
    let r = 214, g = 214, b = 210, a = 40;   // ineligible: pale, nearly invisible

    if (s !== 0) {
      if (p.tint === 'eligibility') {
        [r, g, b, a] = s === 3 ? [30, 80, 140, 200] : [209, 69, 61, 120];
      } else if (p.tint === 'release_year') {
        if (releaseYear[i] < 0 || releaseYear[i] > p.year) {
          [r, g, b, a] = [225, 225, 220, 60];
        } else {
          const t = (releaseYear[i] - startYear) / 24;
          [r, g, b, a] = [Math.round(30 + 200 * t), Math.round(90 - 30 * t),
                          Math.round(140 - 60 * t), 210];
        }
      } else if (p.tint === 'roe') {
        const v = Math.max(0, Math.min(1, roe[i] / 0.4));
        [r, g, b, a] = [Math.round(245 - 215 * v), Math.round(240 - 160 * v),
                        Math.round(230 - 90 * v), 190];
      } else {
        // margin, the default. Diverging around the cushion.
        const m = margin[i];
        if (m >= p.cushion) {
          const v = Math.max(0, Math.min(1, (m - p.cushion) / 1200));
          [r, g, b, a] = [Math.round(200 - 170 * v), Math.round(225 - 145 * v),
                          Math.round(235 - 95 * v), 200];
        } else {
          const v = Math.max(0, Math.min(1, (p.cushion - m) / 1200));
          [r, g, b, a] = [Math.round(235 - 26 * v), Math.round(215 - 146 * v),
                          Math.round(210 - 149 * v), 170];
        }
      }
    }
    rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = a;
  }
  return rgba;
}
