---
title: "The Course Assistant"
date: "2026-09-06"
author: Adam Vosburgh
sequence: 1
cat: resource
published: false
---

There is an assistant on this site. It has the five sandboxes, their dev notes, and the weekly tutorials in its context. It is optional. Every tutorial stands on its own, and no tutorial will tell you to ask the assistant instead of explaining something.

## What it does

The assistant is built to explain and to suggest changes. If you are stuck, it will walk you through adapting the worked example one step at a time. If that is not working, it will offer to write the code for you, and it will say so when it does.

It will not produce data for you. Prompting an LLM for a dataset always results in fabricated data, and in this class that is the specific failure we are studying.

It is not the coding agent used in Tutorial 4. It cannot read or write files on your computer. To build a sandbox, use Claude Code or an equivalent, as the tutorial describes.

## The prompt

The system prompt is published. It is in `src/lib/server/assistant-prompt.js` in the repository, and the version currently running is rendered below.

**PLACEHOLDER — wire this page to render `systemPrompt()` verbatim.**

## Limits

Students get a large daily allowance, unlocked by the same token you use to submit. Anyone else gets a small one, enough to see what the assistant is. The site as a whole has a daily ceiling; when it is reached the assistant says so and the rest of the site keeps working.

Conversations are logged. I read them to find out which tutorial sections are confusing, the same way I read the submission checker's output. If you do not want your conversations read, do not use the assistant. Nothing in the course requires it.
