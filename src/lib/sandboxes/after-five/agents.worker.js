// The timetable builder, off the main thread.
//
// PERSISTENT, unlike the coefficients divergence worker: nearestNodes is a
// one-off 3,728 x nNodes scan worth keeping, so the worker takes one 'init'
// with the static data and then any number of 'sample' messages. A
// generation counter lets the page drop stale answers instead of paying for
// terminate-and-restart on every slider move. Old trips keep rendering while
// the new ones build; onready gates the year transport to the worker's pace.

import { nearestNodes, sampleAgents, buildTimetable } from './agents.js';

let nodes, routes, gateways, flow, buildings, nearest, manifest;

self.onmessage = (e) => {
  const d = e.data;
  if (d.type === 'init') {
    nodes = new Float32Array(d.nodes);
    routes = new Uint16Array(d.routes);
    gateways = d.gateways;
    flow = d.flow;
    manifest = d.manifest;
    buildings = new Float32Array(d.buildings);
    nearest = nearestNodes(buildings, nodes);
    self.postMessage({ type: 'ready' });
    return;
  }
  if (d.type !== 'sample') return;
  const agents = sampleAgents({
    buildings,
    state: new Uint8Array(d.state),
    unitsOf: new Float32Array(d.unitsOf),
    metrics: d.metrics,
    manifest,
    gateways,
    flow,
    params: d.params,
    seed: d.seed
  });
  const trips = buildTimetable({ agents, nodes, routes, gateways, nearest, buildings });
  self.postMessage(
    {
      type: 'trips',
      gen: d.gen,
      workShare: agents.workShare,
      length: trips.length,
      startIndices: trips.startIndices,
      positions: trips.positions,
      timestamps: trips.timestamps,
      roles: trips.roles
    },
    [trips.startIndices.buffer, trips.positions.buffer,
     trips.timestamps.buffer, trips.roles.buffer]
  );
};
