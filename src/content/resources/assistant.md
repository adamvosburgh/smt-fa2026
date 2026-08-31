---
title: "The Course Assistant"
date: "2026-08-30"
author: Adam Vosburgh
sequence: 1
cat: resource
published: true
---

There's an assistant on this site. It knows the seven sandboxes and the tutorials.
It's additive - every tutorial stands on its own, and no tutorial will ever tell
you to go ask it instead of explaining something.

## What it will and won't do

It directs rather than does. If you're stuck it walks you through adapting the
worked example a step at a time, and if that isn't working it'll offer to write
the thing outright - and say so when it does.

It won't produce data for you. Prompting an LLM for a dataset always results in
fabricated data, and in this class in particular that's the exact failure we're
looking at.

## The prompt

Published, not hidden. It's in `src/lib/server/assistant-prompt.js` in the repo,
and the version running right now is rendered below.

**PLACEHOLDER — wire this page to render `systemPrompt()` verbatim.**

## Limits, and why

Students get a large daily allowance, unlocked by the same token you use to
submit. Anyone else gets a small one - enough to see what the assistant is, not
enough to be worth scripting. The site as a whole has a hard daily ceiling; when
it trips the assistant says so and everything else keeps working.

Conversations are logged. I read them to find out which tutorial sections keep
tripping people up, the same way I read the submission checker's output. If
that's not something you want, don't use the assistant - nothing in the course
requires it.
