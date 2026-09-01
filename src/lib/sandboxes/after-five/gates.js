// The two gates, over typed arrays.
//
// Same shape as sandbox 02: one pass on every parameter change, producing the
// colours and the panel's numbers together so they cannot disagree.
//
// A building converts in the first snapshot year where BOTH gates open:
//   1. its convertibility score clears the threshold
//   2. the residential deal beats the office income it gives up
//
// Neither gate is a prediction. Together they are a statement of what a
// conversion argument contains once it is written down.

// Column offsets into buildings.bin. Must match manifest.columns.
const LON = 0, LAT = 1, HEIGHT = 2, FLOORS = 3, BLDG_AREA = 4, OFFICE_AREA = 5,
      RES_AREA = 6, COM_AREA = 7, YEAR_BUILT = 8, CONVERTIBILITY = 9,
      UNITS_CREATED = 10, FLOORS_ADDED = 11, CONVERTED_YEAR = 12,
      FOOTPRINT_AREA = 13, DISTRICT = 14;
export const STRIDE = 15;

// Assumptions that are ours. Each is named in the manifest and the card.
export const ASSUME = {
  capRate: 0.055,          // how an income stream becomes a value
  opexShare: 0.35,         // operating cost as a share of gross rent
  officeRentBase: 38,      // $/sf/yr EFFECTIVE rent on the older, deeper stock
  sfPerUnit: 900,          // floor area per apartment, for the unit count
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

/** Present value of a rent stream, in dollars per square foot. */
function value(rentPerSf) {
  return (rentPerSf * (1 - ASSUME.opexShare)) / ASSUME.capRate;
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
  const nonResidential = (b[base + OFFICE_AREA] + b[base + COM_AREA]) / bldgArea;
  return nonResidential >= 0.9 && unitsMade >= 6;
}

export const DISTRICT_INDEX = { mn01: 0, mn05: 1 };

export function compute(buildings, manifest, p) {
  const n = buildings.length / STRIDE;
  const years = manifest.snapshot_years;
  const convertedIn = new Int16Array(n).fill(-1);
  const state = new Uint8Array(n);   // 0 not office, 1 never converts, 2 converted
  const unitsOf = new Float32Array(n);

  let officeBuildings = 0;
  let converted = 0;
  let unitsTotal = 0;
  let officeRemoved = 0;
  let residentsAdded = 0;

  const householdSize = manifest.household_size ?? 1.9;

  for (let i = 0; i < n; i++) {
    const base = i * STRIDE;
    // The district filter. Shipping both districts costs 1.2MB more than one,
    // which is nothing beside the rest of the site, so both are here and this
    // decides what is counted and drawn.
    if (p.district !== 'both' && buildings[base + DISTRICT] !== DISTRICT_INDEX[p.district]) {
      state[i] = 3;   // out of the selected district
      continue;
    }
    const office = buildings[base + OFFICE_AREA];
    if (office <= 0) { state[i] = 0; continue; }
    officeBuildings += 1;
    state[i] = 1;

    if (buildings[base + CONVERTIBILITY] < p.convertibility_threshold) continue;

    const unitsMade = Math.floor(office / ASSUME.sfPerUnit);
    if (p.incentive_467m && !qualifies467m(buildings, base, unitsMade)) continue;

    // The deal, tested at each snapshot year. Office rent drifts; residential
    // rent does not, which is itself an assumption and a strong one.
    const resValue = value(p.residential_rent);
    const score = buildings[base + CONVERTIBILITY];
    const costSf = p.conversion_cost_sf * (1 + ASSUME.costPenalty * (1 - score));
    for (let y = 0; y < years.length; y++) {
      const yr = years[y];
      const drift = Math.pow(1 + p.office_rent_trend, yr - ASSUME.baseYear);
      const officeValue = value(ASSUME.officeRentBase * drift);
      if (resValue - costSf > officeValue) {
        convertedIn[i] = yr;
        unitsOf[i] = unitsMade;
        break;
      }
    }
  }

  for (let i = 0; i < n; i++) {
    if (convertedIn[i] < 0 || convertedIn[i] > p.year) continue;
    const base = i * STRIDE;
    state[i] = 2;
    converted += 1;
    unitsTotal += unitsOf[i];
    officeRemoved += buildings[base + OFFICE_AREA];
    residentsAdded += unitsOf[i] * householdSize;
  }

  return {
    convertedIn, state, unitsOf,
    metrics: {
      officeBuildings, converted, unitsTotal, officeRemoved, residentsAdded,
      shareConverted: officeBuildings > 0 ? converted / officeBuildings : 0
    }
  };
}

/** Colour per building, from the same pass. */
export function colours(result, buildings, p) {
  const n = result.state.length;
  const rgba = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const base = i * STRIDE;
    let r = 176, g = 176, b = 172, a = 220;   // neither office nor converted
    if (result.state[i] === 3) {              // outside the selected district
      rgba[o] = 228; rgba[o + 1] = 228; rgba[o + 2] = 224; rgba[o + 3] = 70;
      continue;
    }

    if (p.colour_by === 'convertibility') {
      const v = Math.max(0, Math.min(1, buildings[base + CONVERTIBILITY]));
      r = Math.round(238 - 200 * v); g = Math.round(233 - 150 * v); b = Math.round(222 - 60 * v);
    } else if (p.colour_by === 'year_converted') {
      const y = result.convertedIn[i];
      if (y < 0 || y > p.year) { r = 200; g = 200; b = 196; }
      else {
        const t = (y - 2025) / 25;
        r = Math.round(40 + 200 * t); g = Math.round(110 - 40 * t); b = Math.round(160 - 90 * t);
      }
    } else {
      // use: office, residential, converted
      if (result.state[i] === 2) { r = 205; g = 74; b = 60; }        // converted
      else if (result.state[i] === 1) { r = 60; g = 92; b = 138; }   // still office
      else if (buildings[base + RES_AREA] > 0) { r = 150; g = 160; b = 150; }
    }
    rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = a;
  }
  return rgba;
}

export { LON, LAT, HEIGHT, FLOORS, BLDG_AREA, OFFICE_AREA, RES_AREA, COM_AREA,
         YEAR_BUILT, CONVERTIBILITY, UNITS_CREATED, FLOORS_ADDED, CONVERTED_YEAR,
         FOOTPRINT_AREA, DISTRICT };
