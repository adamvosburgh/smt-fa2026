// The rule and the run, from Tutorials 3 and 4.
//
// Split in two by what the sliders move:
//
//   grow()  once per page load. Each census tree's crown in every year if it
//           survives, and one planted honeylocust's crown by years since
//           planting. No slider changes growth, so this never reruns.
//   run()   whenever deaths, plantings or the random draw move. Works out the
//           year each tree dies and the year each site is planted. Rain and
//           interception do not rerun it: they multiply every crown by the
//           same number, so they are applied when the totals are read.

export const YEAR0 = 2015;
export const YEARS = 31; // 2015 to 2045
export const IN_TO_M = 0.0254;
export const M3_TO_GAL = 264.17;
export const PLANT_DBH_CM = 3 * 2.54;
export const PLANT_SPECIES = 'GLTR';
// A tree that never dies in the run.
export const NEVER = 255;

// The Urban Tree Database's equation forms (McPherson et al. 2016, Table 3).
// In the log-log and exponential forms c is the fit's mean squared error, and
// the c/2 term is the correction for taking the exponent of a log-scale fit;
// loglogw2 weights it by the square root of x.
export function equation(e, x) {
  const { form, a, b, c, d } = e;
  if (form === 'lin') return a + b * x;
  if (form === 'quad') return a + b * x + c * x * x;
  if (form === 'cub') return a + b * x + c * x * x + d * x * x * x;
  if (form === 'loglogw1') return Math.exp(a + b * Math.log(Math.log(x + 1)) + c / 2);
  if (form === 'loglogw2') return Math.exp(a + b * Math.log(Math.log(x + 1)) + (Math.sqrt(x) * c) / 2);
  if (form === 'expow1') return Math.exp(a + b * x + c / 2);
  throw new Error(`unknown equation form ${form}`);
}

function predict(sp, what, x) {
  const e = sp[what];
  const xi = e.x_max != null ? Math.min(x, e.x_max) : x;
  return equation(e, xi);
}

// Crown footprint in m², as a circle. Very small trees can come out with a
// negative crown; those count as zero.
function canopy(sp, dbhCm) {
  const crown = Math.max(predict(sp, 'crown_diameter_from_dbh', dbhCm), 0);
  return Math.PI * (crown / 2) ** 2;
}

// One year of growth: the difference between the species' diameter at this
// age and at the next. Past the end of the curve the tree stops thickening.
function grow1(sp, dbhCm, age) {
  const step = predict(sp, 'dbh_from_age', age + 1) - predict(sp, 'dbh_from_age', age);
  return dbhCm + Math.max(step, 0);
}

function trajectory(sp, dbhCm, n) {
  const area = new Float32Array(n);
  const dbh = new Float32Array(n);
  const ages = new Float32Array(n);
  let age = Math.max(predict(sp, 'age_from_dbh', dbhCm), 0);
  for (let t = 0; t < n; t++) {
    area[t] = canopy(sp, dbhCm);
    dbh[t] = dbhCm;
    ages[t] = age;
    dbhCm = grow1(sp, dbhCm, age);
    age += 1;
  }
  return { area, dbh, ages };
}

/** Every tree's crown, diameter and age in every year, if it survives. */
export function grow(trees, manifest) {
  const species = manifest.species;
  const n = trees.lon.length;
  const area = new Float32Array(n * YEARS);
  const dbh = new Float32Array(n * YEARS);
  const age = new Float32Array(n * YEARS);
  for (let i = 0; i < n; i++) {
    const tr = trajectory(species[trees.sp[i]], trees.dbh_in[i] * 2.54, YEARS);
    area.set(tr.area, i * YEARS);
    dbh.set(tr.dbh, i * YEARS);
    age.set(tr.ages, i * YEARS);
  }
  const planted = trajectory(
    species.find((s) => s.code === PLANT_SPECIES),
    PLANT_DBH_CM,
    YEARS
  );
  return { n, area, dbh, age, planted };
}

// A small seeded generator (mulberry32), so a draw number always gives the
// same run.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The random parts of one draw, made once per draw number: one number per tree
 * per year for deaths, one per site per year, and the order sites are planted
 * in. Keeping them fixed means moving the death slider changes which trees die
 * smoothly instead of reshuffling the whole map.
 */
export function chance(draw, nTrees, nSites) {
  const r = rng(draw * 9973 + 17);
  const treeU = new Float32Array(nTrees * YEARS);
  for (let k = 0; k < treeU.length; k++) treeU[k] = r();
  const siteU = new Float32Array(nSites * YEARS);
  for (let k = 0; k < siteU.length; k++) siteU[k] = r();
  const order = Array.from({ length: nSites }, (_, i) => i);
  for (let i = nSites - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { treeU, siteU, order };
}

/**
 * One run. For every census tree, the last year it is standing; for every site,
 * the first year a planted tree is standing on it and the last.
 *
 * Each year: count the trees standing, then the year's deaths, then the year's
 * plantings, then growth. So a tree planted at the end of 2015 is first counted
 * in 2016, and 2015 is always the census as recorded.
 */
export function run(g, nSites, ch, { deathYoung, deathOld, plantings }) {
  const lastYear = new Uint8Array(g.n).fill(NEVER);
  for (let i = 0; i < g.n; i++) {
    for (let t = 0; t < YEARS - 1; t++) {
      const rate = g.age[i * YEARS + t] < 5 ? deathYoung : deathOld;
      if (ch.treeU[i * YEARS + t] < rate) {
        lastYear[i] = t;
        break;
      }
    }
  }

  const siteFirst = new Uint8Array(nSites).fill(NEVER);
  const siteLast = new Uint8Array(nSites).fill(NEVER);
  if (plantings > 0) {
    for (let j = 0; j < nSites; j++) {
      const first = Math.floor(j / plantings) + 1;
      if (first >= YEARS) break;
      const s = ch.order[j];
      siteFirst[s] = first;
      for (let t = first; t < YEARS - 1; t++) {
        const rate = g.planted.ages[t - first] < 5 ? deathYoung : deathOld;
        if (ch.siteU[s * YEARS + t] < rate) {
          siteLast[s] = t;
          break;
        }
      }
    }
  }

  // Crown area standing in each year, census trees and planted trees apart.
  const censusArea = new Float64Array(YEARS);
  const plantedArea = new Float64Array(YEARS);
  const censusCount = new Uint32Array(YEARS);
  const plantedCount = new Uint32Array(YEARS);
  for (let i = 0; i < g.n; i++) {
    const end = Math.min(lastYear[i], YEARS - 1);
    for (let t = 0; t <= end; t++) {
      censusArea[t] += g.area[i * YEARS + t];
      censusCount[t] += 1;
    }
  }
  for (let s = 0; s < nSites; s++) {
    if (siteFirst[s] === NEVER) continue;
    const end = Math.min(siteLast[s], YEARS - 1);
    for (let t = siteFirst[s]; t <= end; t++) {
      plantedArea[t] += g.planted.area[t - siteFirst[s]];
      plantedCount[t] += 1;
    }
  }
  return { lastYear, siteFirst, siteLast, censusArea, plantedArea, censusCount, plantedCount };
}

/** Gallons a year per m² of crown, for a rainfall and an interception share. */
export function galPerM2(rainIn, interception) {
  return rainIn * IN_TO_M * interception * M3_TO_GAL;
}
