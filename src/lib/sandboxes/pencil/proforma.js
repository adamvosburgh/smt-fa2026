// The pro-forma, over typed arrays.
//
// One function, called on every parameter change, producing BOTH the color
// array and the metrics in the same pass. That is deliberate and it is the same
// rule bathtub follows: the picture and the numbers must come from the same
// data by the same formula, so they cannot quietly disagree.
//
// Every step below is a line of the HPD Plus One ADU term sheet, except where
// it is marked as ours. The manifest carries the citations.

export const FLAG = {
  two_family: 1 << 0,
  eligible_backyard: 1 << 1,
  in_10yr_rainfall_frra: 1 << 2,
  in_coastal_frra: 1 << 3,
  in_high_risk_flood_zone: 1 << 4,
  in_historic_district: 1 << 5,
  excluded_district: 1 << 6,
  city_owned: 1 << 7
};

// Column offsets into lots.bin. Must match manifest.columns.
const LON = 0, LAT = 1, LOT_FRONT = 2, REQ_DEPTH = 3, LOT_AREA = 4,
      RENT_FMR = 5, TRACT_INCOME = 6, TRACT_IDX = 7, BLDG_TYPE = 8;
export const STRIDE = 9;
// Exported so the component does not have to hardcode an offset. It did, and
// the offsets moved when the sizing became a browser-side computation.
export const COL = { LON, LAT, LOT_FRONT, REQ_DEPTH, LOT_AREA, RENT_FMR,
                     TRACT_INCOME, TRACT_IDX, BLDG_TYPE };

// The rear-yard box rides in rear.bin, an Int16Array in lots.bin's row order:
// whole feet, because nothing in a siting box is precise to better than a
// foot. frontage_count is the number of street frontages the pipeline's
// block test found - 0 landlocked, 1 ordinary, 2+ corner and through lots.
// Must match manifest.rear_columns.
const REAR_X = 0, REAR_Y = 1, REAR_DEPTH = 2, REAR_WIDTH = 3,
      FRONTAGE_COUNT = 4;
export const RSTRIDE = 5;
export const RCOL = { REAR_X, REAR_Y, REAR_DEPTH, REAR_WIDTH, FRONTAGE_COUNT };

// lots.bin column 8. Attached buildings cannot have a backyard ADU under
// ZR 23-341(b)(4) at all, so their area comes out zero; the category is here so
// the map can say WHY a lot is out rather than only that it is.
export const TYPE = { attached: 0, semi_detached: 1, detached: 2, unknown: 3 };

// Feet per degree of latitude, matching the pipeline's own constant. Used only
// to turn an offset of a few tens of feet into an offset in degrees.
export const FT_PER_DEG_LAT = 364000;

/**
 * Where the unit stands, and how big its footprint is.
 *
 * The pipeline ships the OPEN GROUND BEHIND THE HOUSE as a box - a center, a
 * depth running away from the building, and a width across the lot. This
 * finishes the sum, and it has to be finished here rather than baked in
 * because `side_setback_ft` and the size of the unit are both controls.
 *
 * Returns null when the unit cannot be placed: no building footprint on record,
 * a lot centroid outside its own polygon (an L-shaped or flag lot), a house
 * that already reaches the rear lot line, or a back garden too shallow or too
 * narrow for a unit this shape. That last case is common and it is left
 * visible rather than fudged - the rule the program applies is about the AREA
 * of the required rear yard, and an area is not a plan.
 */
export function siteUnit(lots, rear, i, aduSf, setbackFt, ratio) {
  const base = i * STRIDE;
  const rbase = i * RSTRIDE;
  const bx = rear[rbase + REAR_X], by = rear[rbase + REAR_Y];
  const boxDepth = rear[rbase + REAR_DEPTH], boxWidth = rear[rbase + REAR_WIDTH];
  if (!(boxDepth > 0) || !(aduSf > 0)) return null;

  // NOT A SQUARE. Every design in HPD's library is a rectangle, and the unit is
  // drawn at their median proportion, standing with its long side along the
  // rear fence - which is how a backyard cottage actually goes in, and which
  // matters because depth is the scarce dimension in a rear yard.
  const deep = Math.sqrt(aduSf * ratio);         // along the lot, feet
  const wide = aduSf / deep;                     // across the lot, feet

  // Five feet off the rear lot line, and five off each side. The front of the
  // unit may meet the back of the house - the rule sets no separation between
  // them, and this model does not invent one.
  if (deep > boxDepth - setbackFt) return null;
  if (wide > boxWidth - 2 * setbackFt) return null;

  const span = Math.hypot(bx, by);
  if (!(span > 0)) return null;
  const ux = bx / span, uy = by / span;          // away from the house
  const px = -uy, py = ux;                       // across the lot

  // Pushed to the back of the open ground, less the setback.
  const shift = boxDepth / 2 - setbackFt - deep / 2;
  const lat = lots[base + LAT];
  const perDegLon = FT_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  const cx = lots[base + LON] + (bx + ux * shift) / perDegLon;
  const cy = lat + (by + uy * shift) / FT_PER_DEG_LAT;

  // Turned to face the house, so a row of them along a block lines up the way
  // the houses do rather than all pointing north.
  const hd = deep / 2, hw = wide / 2;
  const ring = [];
  for (const [a, b] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
    const ox = ux * a * hd + px * b * hw;
    const oy = uy * a * hd + py * b * hw;
    ring.push([cx + ox / perDegLon, cy + oy / FT_PER_DEG_LAT]);
  }
  ring.push(ring[0]);
  return ring;
}

/**
 * The unit's floor area, from ZR 23-341(b)(4) and ZR 23-342.
 *
 * THIS IS HERE RATHER THAN IN THE PIPELINE because two of its inputs are
 * controls. `rear_yard_denominator` is the ZR's one-third; `side_setback_ft` is
 * its five feet. Both are the numbers the rule turns on, and the whole point of
 * the sandbox is to re-run the borough against a rule the city did not write.
 *
 * Returns 0 where no unit is possible: an attached building, which
 * ZR 23-341(b)(4) does not cover at all; a lot too narrow to hold the narrowest
 * published design between two setbacks; or a result under the habitability
 * floor, which HPD's guidebook puts at 250-300 square feet.
 *
 * NOTE WHAT THIS IS NOT. It is an AREA, computed from the rule, and it says
 * nothing about whether a building of that area will fit behind the house.
 * siteUnit answers that, and it often answers no.
 */
function aduArea(lots, base, p, sizing) {
  if (lots[base + BLDG_TYPE] === TYPE.attached) return 0;
  const front = lots[base + LOT_FRONT];
  const depth = lots[base + REQ_DEPTH];
  if (front <= 0 || depth <= 0) return 0;
  if (front - 2 * p.side_setback_ft < sizing.narrowest_detached_plan_ft) return 0;
  // The ZR's fraction, as a denominator. See the schema for why this is a
  // whole number and not a decimal share: the 300sf habitability floor is a
  // cliff, and a third and 33% put nearly six thousand lots on opposite
  // sides of it.
  const a = Math.min((front * depth) / p.rear_yard_denominator, sizing.max_sf);
  return a < sizing.min_sf ? 0 : a;
}

/** Monthly debt service on F over n months at annual rate r. */
function payment(F, annualRate, months) {
  if (F <= 0) return 0;
  const r = annualRate / 12;
  // The rate slider reaches zero because the program does - "5%. Rate may be
  // reduced." - and the amortisation formula divides by zero there.
  if (r === 0) return F / months;
  return (F * r) / (1 - Math.pow(1 + r, -months));
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function median(sorted) {
  if (!sorted.length) return 0;
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

/**
 * Run the three tests on every lot.
 *
 * Every lot goes through them in order and a lot that fails one is not tested
 * further, so the counts nest: allowed >= has room >= works for the owner.
 * The outcome is one byte per lot:
 *
 *   0  fails test 1 - not allowed under the rules
 *   1  fails test 2 - allowed, but no room for a unit
 *   2  fails test 3 - allowed, room, but it does not work for the owner
 *   3  passes all three
 *
 * `room` is a second, non-cumulative pass of test 2 alone, run on every lot
 * whatever its outcome. The 3D view needs it: a unit standing on a lot the
 * rules exclude is the thing that view is for, and the cumulative rule would
 * never have tested those lots. It is cheap - the same arithmetic - and the
 * counting still uses the cumulative outcome.
 *
 * Returns typed arrays the layer reads directly, plus the panel's numbers.
 * Nothing is allocated per lot and nothing is recomputed twice.
 */
export function compute(lots, rear, flags, manifest, p) {
  const n = flags.length;
  const margin = new Float32Array(n);
  const aduSf = new Float32Array(n);
  const outcome = new Uint8Array(n);
  const room = new Uint8Array(n); // test 2 alone, for the 3D view

  const loanMax = manifest.program.loan_max;
  const propertyTax = manifest.assumptions.property_tax.value;   // 0 - see the card
  const rentAmi = manifest.rent_ami_monthly;

  // Soft cost is a FORMULA, not a flat sum, and it is HPD's own - recovered
  // from their budgeting tool by moving one slider at a time:
  //   soft cost = $50,000 + 0.48 x hard cost
  // The tool's four exposed inputs account for 0.20 + 0.08 of hard cost plus
  // $50,000. The remaining 20% of hard cost is a term the tool never shows the
  // user, equal in size to the largest one it does. Probably GC overhead and
  // profit; unlabeled anywhere in the interface. That is the finding, and it is
  // why this uses the measured output rather than adding up the published parts.
  const softFlat = manifest.hpd_budget.soft_cost_flat;
  const softShare = manifest.hpd_budget.soft_cost_share_of_hard;

  // Operating cost, also HPD's defaults rather than a rule of thumb: upkeep and
  // management as shares of rent, insurance as a flat monthly sum.
  const op = manifest.hpd_budget.operating;
  const opexShare = op.upkeep_share + op.management_share;
  const insurance = op.insurance_monthly;
  const sizing = manifest.adu_sizing;
  const ratio = manifest.plan_library?.depth_to_width_ratio ?? 0.7;
  const cushion = p.cushion;

  let allowed = 0, hasRoom = 0, works = 0;
  // The two figures the dev note reports. `allowedWithArea` is what test 2 used
  // to be - the one-third-of-the-rear-yard area clearing the habitability
  // floor - and `hasRoom` is what it is now, with the requirement that a unit
  // of that area actually fit behind the house. The gap between them is the
  // change the 09-08 rebuild made.
  let areaOnly = 0, allowedWithArea = 0;
  const passingIdx = [];

  for (let i = 0; i < n; i++) {
    const f = flags[i];
    const base = i * STRIDE;
    const A = aduArea(lots, base, p, sizing);
    aduSf[i] = A;

    // TEST 2, run on every lot for the 3D view. Two conditions, both required:
    // the one-third-of-the-required-rear-yard area clears the habitability
    // floor, AND a rectangle of that area at the plan library's proportion fits
    // in the open ground behind the house after the setbacks. The second half
    // used to be reported beside the count and is now part of the test.
    const fits = A > 0 && siteUnit(lots, rear, i, A, p.side_setback_ft, ratio) !== null;
    room[i] = fits ? 1 : 0;
    if (A > 0) areaOnly += 1;

    // TEST 1: allowed under the rules. The eligibility flag the pipeline
    // writes from building class, the historic districts, the flood areas and
    // the excluded low-density districts outside the Greater Transit Zone.
    // THERE IS NO "IGNORE THIS TEST" SWITCH any more: the three tests are what
    // the sandbox is, and a switch that skipped the first one made the other
    // two mean something different without saying so.
    if ((f & FLAG.eligible_backyard) === 0) { outcome[i] = 0; continue; }
    allowed += 1;
    if (A > 0) allowedWithArea += 1;

    // TEST 2, cumulatively.
    if (!fits) { outcome[i] = 1; continue; }
    hasRoom += 1;

    // TEST 3: works for the owner. The pro forma, unchanged.
    //
    // THERE IS NO OWNER-OCCUPANCY CONTROL, deliberately. The program requires
    // the owner to live at the property "no less than 270 days per year", and
    // this model cannot represent that at all: there is no dataset of who lives
    // in which house. The requirement is named in the model card under what
    // this cannot see.
    const hard = A * p.cost_per_sf;
    const C = hard + softFlat + softShare * hard;
    const S = Math.min(p.grant_max, C);
    const E = p.equity_share * C;
    const need = Math.max(0, C - S - E);

    // A lot whose remaining cost exceeds the loan cap fails here, the same as
    // one whose rent will not clear the cushion. Both are "does not work for
    // the owner"; the reasons are different and neither is a separate test.
    if (need > loanMax) { outcome[i] = 2; continue; }

    const D = payment(need, p.interest_rate, p.term_months);

    let R;
    if (p.rent_basis === 'ami_cap') R = rentAmi;
    else if (p.rent_basis === 'fmr') R = lots[base + RENT_FMR];
    else R = p.rent_flat;

    const Reff = R * (1 - p.vacancy);
    const O = opexShare * Reff + insurance;
    const M = Reff - O - propertyTax - D;
    margin[i] = M;

    if (M >= cushion) {
      outcome[i] = 3;
      works += 1;
      passingIdx.push(i);
    } else {
      outcome[i] = 2;
    }
  }

  // ---- metrics, from the same pass --------------------------------------
  //
  // NO UPTAKE RATE, and no permitting queue. The count is every lot that
  // passes all three tests, which is an upper bound and is labeled as one.
  const perTract = new Map();
  const incomes = [];
  for (const i of passingIdx) {
    incomes.push(lots[i * STRIDE + TRACT_INCOME]);
    const t = lots[i * STRIDE + TRACT_IDX];
    perTract.set(t, (perTract.get(t) ?? 0) + 1);
  }

  const marginsOfPassing = passingIdx.map((i) => margin[i]).sort((a, b) => a - b);
  const sizesOfPassing = passingIdx.map((i) => aduSf[i]).sort((a, b) => a - b);
  incomes.sort((a, b) => a - b);

  // The concentration measure, defined here and stated in the card: tracts are
  // ranked by how many units they receive, and this is the share of all units
  // falling in the top DECILE of those tracts.
  const counts = [...perTract.values()].sort((a, b) => b - a);
  const topDecileTracts = Math.max(1, Math.ceil(counts.length / 10));
  const inTop = counts.slice(0, topDecileTracts).reduce((a, b) => a + b, 0);
  const concentration = works > 0 ? inTop / works : 0;

  return {
    margin, outcome, room, aduSf, perTract,
    metrics: {
      allowed, hasRoom, works, areaOnly, allowedWithArea,
      shareOfAllowed: allowed > 0 ? works / allowed : 0,
      medianMargin: median(marginsOfPassing),
      medianAduSf: median(sizesOfPassing),
      medianTractIncome: median(incomes),
      concentration,
      tractsReceiving: counts.length
    }
  };
}

/**
 * The three tests, in the order they run, with the color each is drawn in.
 *
 * A lot draws in a test's color where it reached that test and passed it, red
 * where it reached it and failed, and not at all where an earlier test had
 * already removed it. The index is the outcome a lot needs to have PASSED the
 * test, which is what makes `outcome >= index` the whole rule.
 */
export const TESTS = [
  { key: 'eligible', index: 1, label: 'allowed under the rules', color: [242, 194, 48] },
  { key: 'feasible', index: 2, label: 'room for a unit', color: [63, 174, 90] },
  { key: 'financial', index: 3, label: 'works for the owner', color: [43, 91, 215] }
];
export const FAIL_COLOR = [224, 49, 42];

/** The single-hue sequential ramp the tract choropleth uses, six classes. */
export const TRACT_RAMP = [
  [222, 235, 247],
  [198, 219, 239],
  [158, 202, 225],
  [107, 174, 214],
  [49, 130, 189],
  [8, 81, 156]
];

/**
 * Quantile breaks over the tract values that are above zero.
 *
 * Computed on the CURRENT values rather than fixed, because every assumption
 * slider moves the whole distribution; a fixed set of breaks would make the
 * map look unchanged while the numbers underneath it moved.
 */
export function quantileBreaks(values, classes = TRACT_RAMP.length) {
  const v = values.filter((x) => x > 0).sort((a, b) => a - b);
  if (!v.length) return [];
  const breaks = [];
  for (let i = 1; i < classes; i++) breaks.push(v[Math.floor((v.length * i) / classes)]);
  return breaks;
}

export function rampIndex(value, breaks) {
  let i = 0;
  while (i < breaks.length && value >= breaks[i]) i++;
  return i;
}

/**
 * Color every lot for the lot view.
 *
 * A lot that failed an earlier test is not drawn at all - alpha zero - because
 * the test being shown was never run on it. Returns a Uint8Array of RGBA,
 * which deck.gl reads without copying.
 */
export function lotColors(result, testKey) {
  const test = TESTS.find((t) => t.key === testKey) ?? TESTS[2];
  const { outcome } = result;
  const n = outcome.length;
  const rgba = new Uint8Array(n * 4);
  const [pr, pg, pb] = test.color;
  const [fr, fg, fb] = FAIL_COLOR;

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const s = outcome[i];
    if (s >= test.index) {
      rgba[o] = pr; rgba[o + 1] = pg; rgba[o + 2] = pb; rgba[o + 3] = 200;
    } else if (s === test.index - 1) {
      // Reached this test and failed it.
      rgba[o] = fr; rgba[o + 1] = fg; rgba[o + 2] = fb; rgba[o + 3] = 170;
    } else {
      rgba[o + 3] = 0; // removed by an earlier test; not drawn
    }
  }
  return rgba;
}

/**
 * The color of a unit in the 3D view.
 *
 * Only lots with room for one are drawn, whatever the other two tests said, so
 * the view can show a unit standing on a lot the rules exclude - which is the
 * one thing this view is for.
 */
export const VOLUME_COLOR = {
  works: [43, 91, 215],       // passes all three
  no_deal: [242, 194, 48],    // allowed, has room, does not work for the owner
  not_allowed: [224, 49, 42]  // has room, but not allowed under the rules
};

export function volumeColor(outcomeValue) {
  if (outcomeValue === 3) return VOLUME_COLOR.works;
  if (outcomeValue === 2) return VOLUME_COLOR.no_deal;
  return VOLUME_COLOR.not_allowed;
}
