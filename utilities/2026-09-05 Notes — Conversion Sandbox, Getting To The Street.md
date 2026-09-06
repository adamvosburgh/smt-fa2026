n---
title: Notes — Conversion sandbox, getting to the street
date: 2026-09-05
type: notes
---

# Getting the conversion sandbox to the street

Adam's brief for the Office to Residential Conversion sandbox (05 Sept): the point is the urban consequence of conversion, not the developer's return. His read of the current build: it points out that at published conditions conversions don't happen, and it "reads too much like a map disembodied from the space it describes." He asked for ideas on closing that gap. These are Claude's suggestions, ordered by how much they'd move the sandbox toward the brief per unit of work. None are built. Data claims below are only about datasets already on disk unless marked *unverified*.

## 1. A street-level metric, not a district one

The panel counts workers and residents for the whole district. The ambition is about a block. Add per-segment counts on the CSCL street graph the crowd already walks: for the selected hour, how many walkers are on each segment, and colour the streets by it. Then "what conversion does to the street" becomes literal: the same street at 20:00 before and after conversion, with the difference in people on it. Everything needed is already shipped (the graph, the routes, the schedule). This is the cheapest change with the biggest effect on the brief.

## 2. A ground-floor rule

Conversion changes what the ground floor is for. The model has nothing about ground floors at all. A simple, labelled assumption would do: a converted building's ground floor becomes "active" (shop, lobby with frontage) with probability p, a slider defaulting to something we say is ours. Colour the ground-floor edge of each building on the map. Then the 20:00 street reads as lit or dark frontage, which is much closer to what a person on Water Street notices than a red tower. Ground-floor use isn't in PLUTO at building resolution; *unverified* whether DCP's PLUTO `RetailArea` per lot is good enough as a starting point.

## 3. Pick a street and stand on it

A "street view" mode: choose a segment, and the camera drops to eye height looking down it, with the walkers passing at the selected hour. deck.gl can do this with the existing massing and the existing agents; it's a camera change and a UI affordance, not new data. Even a crude version (boxes and dots at eye height) answers the "disembodied" complaint more directly than any overlay does, because the reader is in the space rather than above it.

## 4. Time of day as the primary comparison

Right now the year is the comparison axis (2025 vs 2050). For the urban question the more useful comparison is hour vs hour in one year: 09:00 vs 20:00, before and after conversion. A "compare" toggle that splits the viewport, or draws the two hours' crowds in two colours, would make the diurnal change the thing you see first.

## 5. Residents need a schedule, not a mirror

The crowd's residents are the mirror of the workers (evening arrivals, morning departures). Real residents come and go all day and are on the street at hours workers aren't. ATUS has a "not employed / at home" at-location share by hour that could give residents their own curve (*unverified* which TEWHERE codes and which universe). This is what would make a converted block look different at 14:00 on a weekday, which is when the difference between a jobs district and a neighbourhood is largest.

## 6. Say what the empty map means, in the right place

The default map is blank because the published rent makes the deal fail. That's a real finding about the argument, but as the first thing a visitor sees it reads as "nothing here." Two options: default the office rent to the $41 stop (ours, labelled as ours) so there is something to look at, with the $54 result one click away; or keep $54 and put a one-line note on the canvas saying why it's blank and what to move. The second keeps the provenance rule intact. Adam's call.

## 7. Midtown South as the "what if it worked" case

CD5 has a very different stock and the model behaves differently there. A short comparison in the card, or a default that opens on "both," would show that the urban consequence depends on the district, which is itself part of the answer to the brief.

## Not recommended

- A full agent-based model of pedestrian behaviour. The card's playback-not-simulation stance is right; the ambition is met by better rendering and better counting of what is already sourced, not by inventing motives.
- Adding ferry, bus and bike gateways without counts. Ferry ridership by terminal and hour may exist (*unverified*); without it the gateways would be invented.
