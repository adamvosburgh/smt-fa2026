/* micropolisJS. Adapted by Graeme McCutcheon from Micropolis.
 *
 * This code is released under the GNU GPL v3, with some additional terms.
 * Please see the files LICENSE and COPYING for details. Alternatively,
 * consult http://micropolisjs.graememcc.co.uk/LICENSE and
 * http://micropolisjs.graememcc.co.uk/COPYING
 *
 * The name/term "MICROPOLIS" is a registered trademark of Micropolis (https://www.micropolis.com) GmbH
 * (Micropolis Corporation, the "licensor") and is licensed here to the authors/publishers of the "Micropolis"
 * city simulation game and its source code (the project or "licensee(s)") as a courtesy of the owner.
 *
 */

import { EventEmitter } from './eventEmitter.js';
import { VALVES_UPDATED } from './messages.ts';
import { MiscUtils } from './miscUtils.js';
// SMT EDIT: the named constants. See ../../tunables.js.
import { C } from '../../tunables.js';

var Valves = EventEmitter(function () {
  this.resValve = 0;
  this.comValve = 0;
  this.indValve = 0;
  this.resCap = false;
  this.comCap = false;
  this.indCap = false;
});


var RES_VALVE_RANGE = 2000;
var COM_VALVE_RANGE = 1500;
var IND_VALVE_RANGE = 1500;


// SMT EDIT: both tables moved to coefficients.json and read at call time.
// taxTable was the 21 values 200 down to -600; extMarketParamTable was
// [1.2, 1.1, 0.98]. Between them they are the ENTIRE response of the economy to
// tax rates and the entire model of demand from outside the city.

Valves.prototype.save = function(saveData) {
  saveData.resValve = this.resValve;
  saveData.comValve = this.comValve;
  saveData.indValve = this.indValve;
};


Valves.prototype.load = function(saveData) {
  this.resValve = saveData.resValve;
  this.comValve = saveData.comValve;
  this.indValve = saveData.indValve;

  this._emitEvent(VALVES_UPDATED);
};


Valves.prototype.setValves = function(gameLevel, census, budget) {
  var resPopDenom = 8;
  // SMT EDIT: was 0.02, 1.3 and 3.7 as function locals. The whole demography
  // of the city, as three numbers with no source attached.
  var birthRate = C.demography.birth_rate;
  var labourBaseMax = C.demography.labour_base_max;
  var internalMarketDenom = C.demography.internal_market_denom;
  var projectedIndPopMin = 5.0;
  var resRatioDefault = 1.3;
  var resRatioMax = 2;
  var comRatioMax = 2;
  var indRatioMax = 2;
  var taxMax = 20;
  var taxTableScale = C.demography.tax_table_scale;  // SMT EDIT: was 600
  var employment, labourBase;

  // Residential zones scale their population index when reporting it to the census
  var normalizedResPop = census.resPop / resPopDenom;
  census.totalPop = Math.round(normalizedResPop + census.comPop + census.indPop);

  // A lack of developed commercial and industrial zones means there are no employment opportunities, which constrain
  // growth. (This might hurt initially if, for example, the player lays out an initial grid, as the residential zones
  // will likely develop first, so the residential valve will immediately crater).
  if (census.resPop > 0)
    employment = (census.comHist10[1] + census.indHist10[1]) / normalizedResPop;
  else
    employment = 1;

  // Given the employment rate, calculate expected migration, add in births, and project the new population.
  var migration = normalizedResPop * (employment - 1);
  var births = normalizedResPop * birthRate;
  var projectedResPop = normalizedResPop + migration + births;

  // Examine how many zones require workers
  labourBase = census.comHist10[1] + census.indHist10[1];
  if (labourBase > 0.0)
    labourBase = census.resHist10[1] / labourBase;
  else
    labourBase = 1;
  labourBase = MiscUtils.clamp(labourBase, 0.0, labourBaseMax);

  // Project future industry and commercial needs, taking into account available labour, and competition from
  // other global cities
  var internalMarket = (normalizedResPop + census.comPop + census.indPop) / internalMarketDenom;
  var projectedComPop = internalMarket * labourBase;
  var projectedIndPop = census.indPop * labourBase * C.demography.ext_market_param_table[gameLevel];
  projectedIndPop = Math.max(projectedIndPop, projectedIndPopMin);

  // Calculate the expected percentage changes in each population type
  var resRatio;
  if (normalizedResPop > 0)
    resRatio = projectedResPop / normalizedResPop;
  else
    resRatio = resRatioDefault;

  var comRatio;
  if (census.comPop > 0)
    comRatio = projectedComPop / census.comPop;
  else
    comRatio = projectedComPop;

  var indRatio;
  if (census.indPop > 0)
    indRatio = projectedIndPop / census.indPop;
  else
    indRatio = projectedIndPop;

  resRatio = Math.min(resRatio, resRatioMax);
  comRatio = Math.min(comRatio, comRatioMax);
  indRatio = Math.min(indRatio, indRatioMax);

  // Constrain growth according to the tax level.
  var z = Math.min((budget.cityTax + gameLevel), taxMax);
  resRatio = (resRatio - 1) * taxTableScale + C.demography.tax_table[z];
  comRatio = (comRatio - 1) * taxTableScale + C.demography.tax_table[z];
  indRatio = (indRatio - 1) * taxTableScale + C.demography.tax_table[z];

  this.resValve = MiscUtils.clamp(this.resValve + Math.round(resRatio), -RES_VALVE_RANGE, RES_VALVE_RANGE);
  this.comValve = MiscUtils.clamp(this.comValve + Math.round(comRatio), -COM_VALVE_RANGE, COM_VALVE_RANGE);
  this.indValve = MiscUtils.clamp(this.indValve + Math.round(indRatio), -IND_VALVE_RANGE, IND_VALVE_RANGE);

  if (this.resCap && this.resValve > 0)
    this.resValve = 0;

  if (this.comCap && this.comValve > 0)
      this.comValve = 0;

  if (this.indCap && this.indValve > 0)
      this.indValve = 0;

  this._emitEvent(VALVES_UPDATED);
};


export { Valves };
