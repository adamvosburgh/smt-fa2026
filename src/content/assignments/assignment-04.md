---
title: "Sketch to Sandbox"
date: "2026-09-06"
author: Adam Vosburgh
sequence: 4
cat: assignment
published: true
publish: "2026-10-01"
submit: true
accepts: [html, pdf]
due: "10/8"
---

### Due: 10/8, for the pin-up

### What

Turn your Assignment 3 sketch into a working sandbox: write the brief, have an LLM turn it into a build doc, have a coding agent build it, check it, and upload it.

[Tutorial 4](/tutorials/04-notebook-to-sandbox/) does this for the street trees. Do the same for yours.

### Requirements

- The brief is the most important part of the submission. Every number in it has a source or the word "ours" next to it. The rule has units. The controls have ranges and defaults.
- One self-contained `index.html`: styles, script and data inline, no network requests, under 15MB. It has to open from disk with the wifi off. The gallery runs it in a frame that can't fetch anything.
- The controls follow the order from the tutorial: clock, then how it's drawn, then the main levers, then the finer assumptions.
- At its defaults, it reproduces a number you can check against something outside itself (your notebook, a published figure, a count you made). Say what that check is.
- Real data only. Prompting an LLM for a dataset will ALWAYS produce fabricated data. If the data you wanted does not exist, scale the sandbox to the data that does.
- If the sandbox does not come together, upload the brief, the build doc, and a PDF of screenshots showing how far it got. That counts as a complete submission for this assignment.

### Either way, submit:

- `index.html` as the work, with `brief.md` and `build.md` as extra files (or the PDF, as above)
- a two-sentence gallery text
- in the description: what you checked it against, and 150 words on one place where what the agent built disagrees with what you wrote, and what you did about it

### Submission

`Submit your work` below. It appears under [Student Work](/gallery/#assignment-04), which is what we'll pin up in class on 10/8. Graded on completion.
