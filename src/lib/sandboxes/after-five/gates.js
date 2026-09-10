// The two gates, over typed arrays.
//
// Same shape as sandbox 02: one pass on every parameter change, producing the
// colors and the panel's numbers together so they cannot disagree.
//
// A building converts when BOTH gates open:
//   1. its convertibility score clears the threshold
//   2. the residential deal beats the office income it gives up
//
// THERE IS NO YEAR. The 09-08 reframe took the snapshot years out: the state's
// conversion incentive requires a project to finish by the end of 2039, so the
// date is 2040 and everything that converts in this model has converted by
// then. The only clock left is the hour of the day.
//
// Neither gate is a prediction. Together they are a statement of what a
// conversion argument contains once it is written down.
//
// WHERE THE NUMBERS COME FROM. This file used to carry its own copy of the
// economic constants, and one of them disagreed with the manifest: here
// officeRentBase was 38, in the manifest office_rent_base_psf_yr was 62. A
// constant that lives in two places has two values. They now live in the
// manifest's `economics` block, with their sources, and this file reads them.

// Column offsets into buildings.bin. Must match manifest.columns.
//
// The score used to be ONE baked float at index 9. It is now the four
// sub-scores it was made of, so the weights are controls rather than something
// welded into a binary file. That is the whole reason the stride is 18.
const LON = 0, LAT = 1, HEIGHT = 2, FLOORS = 3, BLDG_AREA = 4, OFFICE_AREA = 5,
      RES_AREA = 6, COM_AREA = 7, YEAR_BUILT = 8,
      S_DEPTH = 9, S_F2F = 10, S_AREA = 11, S_AGE = 12,
      UNITS_CREATED = 13, FLOORS_ADDED = 14, CONVERTED_YEAR = 15,
      FOOTPRINT_AREA = 16, DISTRICT = 17;
export const STRIDE = 18;

// Fallbacks only. The live values are read off the manifest - see `econ()` -
// and these exist so a component that renders before the fetch lands does not
// produce NaN. Keep them equal to the manifest's.
export const ASSUME = {
  officeRentBase: 54,      // $/sf/yr ASKING, Manhattan class B and C combined
  sfPerUnit: 1152,         // measured from DOB conversion filings
  baseYear: 2025,
  // How much harder a badly-shaped building is to convert, as a multiplier on
  // the cost slider. A building scoring 1 costs what the slider says; one
  // scoring 0 costs twice that.
  //
  // This is what makes the pro-forma vary from building to building at all.
  // Without it every building in the district is tested against the same three
  // district-wide numbers and they all give the same answer, so the gate opens
  // for everybody at once or for nobody - which is not a model of anything.
  // It is also the honest relationship: a deep plate with a low floor-to-floor
  // is not merely less desirable to convert, it is more expensive per foot.
  costPenalty: 1.0
};

/**
 * Square feet of office floor area per office-using job, per district, indexed
 * the way buildings.bin's district column is.
 *
 * Measured, not assumed: LODES counts the jobs at each census block and
 * MapPLUTO gives the office floor area on the same blocks. It comes out at one
 * job per 490 square feet in Lower Manhattan and per 324 in Midtown South,
 * both well above the 150-250 quoted for a fitted-out floor - the difference is
 * vacancy, plus the fact that OfficeArea is gross and LODES counts primary jobs
 * only. Using the measured ratio means a converted building displaces the jobs
 * that were really recorded on that floor area rather than the ones a rule of
 * thumb would put there.
 */
function jobDensity(manifest) {
  const d = manifest?.presence?.districts;
  if (!d) return null;
  return (manifest.districts ?? []).map((k) => d[k]?.sq_ft_per_office_job ?? 0);
}

function econ(manifest) {
  const e = manifest?.economics ?? {};
  return {
    officeRentBase: e.office_rent_base_psf_yr ?? ASSUME.officeRentBase,
    sfPerUnit: e.sf_per_unit ?? ASSUME.sfPerUnit,
    baseYear: e.base_year ?? ASSUME.baseYear,
    costPenalty: e.cost_penalty ?? ASSUME.costPenalty
  };
}

/**
 * The convertibility score: our weighted sum of four proxies for Gensler's
 * published criteria.
 *
 * The weights are NORMALIZED by their own sum, so they are relative rather than
 * absolute and moving one does not silently move the threshold's meaning as
 * well. All four at zero scores everything zero, which is the honest answer to
 * a question with nothing in it.
 */
export function scoreOf(buildings, base, w) {
  const sum = w.w_depth + w.w_f2f + w.w_area + w.w_age;
  if (sum <= 0) return 0;
  return (w.w_depth * buildings[base + S_DEPTH]
        + w.w_f2f * buildings[base + S_F2F]
        + w.w_area * buildings[base + S_AREA]
        + w.w_age * buildings[base + S_AGE]) / sum;
}

/** Present value of a rent stream, in dollars per square foot.
 *
 * The cap rate is an argument now, not a field read off p, because office and
 * residential no longer share one. A single 0.055 applied to both sides scaled
 * both and very nearly canceled - and the gap between office and residential
 * yields is a large part of why anyone converts anything. The two controls
 * default equal, so the change is provably neutral until a reader pulls them
 * apart.
 */
function value(rentPerSf, capRate, opexShare) {
  return (rentPerSf * (1 - opexShare)) / capRate;
}

/**
 * Floor area per apartment at a cut of the measured ladder the pipeline ships.
 * The cut is a judgment - 1,366 sf with no floor, 1,152 at ten units, 907 at
 * fifty - and it is fixed at 10+ rather than exposed as a control, because
 * cutting at one unit lets filings that report a whole building's floor area
 * against a single apartment into the sample. The card's footnote states the
 * figure and the cutoff. The function stays because it documents why 10.
 */
function sfPerUnitAt(manifest, cut) {
  const row = manifest?.economics?.sensitivity_to_the_unit_floor?.[String(cut)];
  return row?.sf_per_unit ?? manifest?.economics?.sf_per_unit ?? ASSUME.sfPerUnit;
}

/**
 * 467-m, as a BINARY ELIGIBILITY GATE and nothing more.
 *
 * The benefit schedule - the exemption percentage and its duration - is not in
 * the published FAQ and was not verified, so the incentive cannot be given a
 * value here. What it can do is decide who is allowed to play.
 *
 * Switched ON, only buildings that meet the published tests convert, on the
 * argument developers themselves make: without the exemption the deal does not
 * close in this district at all. Switched OFF, the tests are not applied and no
 * benefit is added either - so the difference between the two settings is
 * exactly what 467-m's ELIGIBILITY RULES exclude, not what its money is worth.
 *
 * The 50%-of-floor-area-preserved test is not checkable from any dataset here
 * and is treated as satisfied.
 */
function qualifies467m(b, base, unitsMade) {
  const bldgArea = b[base + BLDG_AREA];
  if (bldgArea <= 0) return false;
  // THE SHARE THAT IS NOT RESIDENTIAL, measured as one minus the residential
  // share. It used to be (OfficeArea + ComArea) / BldgArea, which double-counts
  // every office building: in MapPLUTO, ComArea is TOTAL commercial floor area
  // and OfficeArea is a subset of it. ComArea >= OfficeArea on all 1,818 office
  // buildings here, and 1,620 of them came out with a non-residential share
  // above 1.0, which is impossible. The gate was too easy by 63 buildings.
  // Do not add the two again.
  const nonResidential = 1 - b[base + RES_AREA] / bldgArea;
  return nonResidential >= 0.9 && unitsMade >= 6;
}

export const DISTRICT_INDEX = { mn01: 0, mn05: 1 };

export function compute(buildings, manifest, p) {
  const n = buildings.length / STRIDE;
  const A = econ(manifest);
  const converts = new Uint8Array(n);
  const state = new Uint8Array(n);   // 0 not office, 1 stays office, 2 converted, 3 out of district
  const unitsOf = new Float32Array(n);
  const score = new Float32Array(n);

  let officeBuildings = 0;
  let converted = 0;
  let unitsTotal = 0;
  let officeRemoved = 0;
  let residentsAdded = 0;

  const householdSize = manifest.household_size ?? 1.9;
  // The seven deal numbers come from the scenario the reader picked, or from
  // the sliders under it once one has been moved. Each scenario is a published
  // set and its note says where every figure came from; the sandbox does not
  // hold an opinion about which is right.
  const officeRent = p.office_rent ?? A.officeRentBase;
  const capOffice = p.cap_rate_office ?? 0.055;
  const capResidential = p.cap_rate_residential ?? 0.05;
  const opexOffice = p.opex_office ?? 0.35;
  const opexResidential = p.opex_residential ?? 0.2;
  const sfPerUnit = sfPerUnitAt(manifest, 10);
  const officeScores = [];
  const sfPerJob = jobDensity(manifest);
  let officeJobsHere = 0;      // office-using jobs in the district today
  let officeJobsRemoved = 0;   // and the ones the conversions take with them

  for (let i = 0; i < n; i++) {
    const base = i * STRIDE;
    // The district filter. Shipping both districts costs 1.2MB more than one,
    // which is nothing beside the rest of the site, so both are here and this
    // decides what is counted and drawn.
    if (p.district !== 'both' && buildings[base + DISTRICT] !== DISTRICT_INDEX[p.district]) {
      state[i] = 3;   // out of the selected district
      continue;
    }
    score[i] = scoreOf(buildings, base, p);
    const office = buildings[base + OFFICE_AREA];
    if (office <= 0) { state[i] = 0; continue; }
    officeBuildings += 1;
    officeScores.push(score[i]);
    state[i] = 1;

    if (score[i] < p.convertibility_threshold) continue;

    const unitsMade = Math.floor(office / sfPerUnit);
    if (p.incentive_467m && !qualifies467m(buildings, base, unitsMade)) continue;

    // The deal. One test, at 2040: the apartments are worth more than the
    // offices given up, after paying for the work. The cost is not flat across
    // buildings - a badly shaped one costs more per foot, scaled by its own
    // score - which is what makes this a per-building test rather than one
    // district-wide answer.
    const resValue = value(p.residential_rent, capResidential, opexResidential);
    const costSf = p.conversion_cost_sf * (1 + A.costPenalty * (1 - score[i]));
    const officeValue = value(officeRent, capOffice, opexOffice);
    if (resValue - costSf > officeValue) {
      converts[i] = 1;
      unitsOf[i] = unitsMade;
    }
  }

  for (let i = 0; i < n; i++) {
    if (!converts[i]) continue;
    const base = i * STRIDE;
    state[i] = 2;
    converted += 1;
    unitsTotal += unitsOf[i];
    officeRemoved += buildings[base + OFFICE_AREA];
    residentsAdded += unitsOf[i] * householdSize;
    const per = sfPerJob?.[buildings[base + DISTRICT]];
    if (per > 0) officeJobsRemoved += buildings[base + OFFICE_AREA] / per;
  }

  // The district's own job count, from LODES. Not derived from the buildings -
  // it is the whole district, including the office floor area that never
  // appears in the massing.
  let residentsHere = 0;
  if (manifest.presence?.districts) {
    (manifest.districts ?? []).forEach((k, i) => {
      if (p.district !== 'both' && DISTRICT_INDEX[p.district] !== i) return;
      officeJobsHere += manifest.presence.districts[k]?.office_using_jobs ?? 0;
      residentsHere += manifest.presence.districts[k]?.residents_2020 ?? 0;
    });
  }

  // Gensler's published result - about a quarter of the buildings they scored
  // came out suitable - is the ONE number our score and theirs can be held up
  // beside each other, because their scoring is closed. This is where our
  // threshold would have to sit to agree with them, and it is recomputed here
  // rather than read off the manifest because it MOVES when the weights move.
  // A mark that stays put while the score changes underneath it is a lie.
  officeScores.sort((a, b) => b - a);
  const k = Math.round(0.25 * officeScores.length);
  const gensler = officeScores.length ? officeScores[Math.max(0, k - 1)] : null;

  return {
    converts, state, unitsOf, score, gensler,
    metrics: {
      officeBuildings, converted, unitsTotal, officeRemoved, residentsAdded,
      officeJobsHere, officeJobsRemoved, residentsHere,
      shareConverted: officeBuildings > 0 ? converted / officeBuildings : 0
    }
  };
}

/** Color per building, from the same pass. */
// The building palette, all views. Converted buildings are dark green rather
// than the orange they used to be, because the population view draws people
// from homes in that green and the two have to be the same claim.
export const BUILDING_COLOR = {
  office: [201, 211, 224],        // #c9d3e0, light blue-gray
  converted: [31, 111, 63],       // #1f6f3f, dark green
  existing_homes: [217, 201, 163], // #d9c9a3, tan
  other: [189, 189, 189]          // #bdbdbd, gray
};

/** Color per building, from the same pass. */
export function colors(result, buildings, p) {
  const n = result.state.length;
  const rgba = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const base = i * STRIDE;
    if (result.state[i] === 3) {              // outside the selected district
      rgba[o] = 228; rgba[o + 1] = 228; rgba[o + 2] = 224; rgba[o + 3] = 70;
      continue;
    }

    let c;
    if (p.view === 'convertibility') {
      // The score, ramped, with the threshold marked in the legend. Only the
      // office buildings carry a score; everything else is the flat other-gray.
      if (result.state[i] === 0) {
        c = buildings[base + RES_AREA] > 0
          ? BUILDING_COLOR.existing_homes : BUILDING_COLOR.other;
      } else {
        const v = Math.max(0, Math.min(1, result.score[i]));
        c = [Math.round(238 - 200 * v), Math.round(233 - 150 * v), Math.round(222 - 60 * v)];
      }
    } else if (result.state[i] === 2) c = BUILDING_COLOR.converted;
    else if (result.state[i] === 1) c = BUILDING_COLOR.office;
    else if (buildings[base + RES_AREA] > 0) c = BUILDING_COLOR.existing_homes;
    else c = BUILDING_COLOR.other;

    rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = 220;
  }
  return rgba;
}

export { LON, LAT, HEIGHT, FLOORS, BLDG_AREA, OFFICE_AREA, RES_AREA, COM_AREA,
         YEAR_BUILT, S_DEPTH, S_F2F, S_AREA, S_AGE, UNITS_CREATED, FLOORS_ADDED,
         CONVERTED_YEAR, FOOTPRINT_AREA, DISTRICT };
