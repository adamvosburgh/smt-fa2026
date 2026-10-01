---
title: "Sketch to Sandbox"
date: "2026-09-30"
author: Adam Vosburgh
sequence: 4
cat: assignment
published: true
publish: "2026-10-01"
submit: true
accepts: [html, pdf]
due: "10/8"
# The screenshot and link boxes are new; see the build doc, site changes.
form: [title, gallery_text, work, extras, screenshot, link]
questions:
  - key: process
    label: "What was this process like?"
  - key: result
    label: "How is the result?"
  - key: unexpected
    label: "What was unexpected, or different from what you wanted?"
---

<!-- PROSE DRAFT for Adam. Replaces src/content/assignments/assignment-04.md. -->

### Due: 10/8, for the pin-up

### What

Take your sketch from Assignment 3 and revise it into a prompt: one markdown file that says what your sandbox shows, what data it uses, what the rule is, and what a visitor can change. Then give the prompt to your coding agent, answer the questions it asks you, and upload what came out.

[Tutorial 4](/tutorials/04-notebook-to-sandbox/) does this for the street trees. Do the same for yours.

### How

- Write `prompt.md`. The parts in Tutorial 4 can be your headings: what it shows, the data, the rule, the sliders in order with their starting values, what you should see, what it can't see. Try to put a source next to every number, and where there isn't one, just say it's a placeholder or an assumption. Give the rule units.
- Put the course kit, your data and `prompt.md` in one folder, open it in VS Code, and start your agent. You can give it your sketch from Assignment 3 too, and any images or reference projects you have in mind: save them in the folder and mention them by name in the prompt, or, in Claude Code, hold `shift` and drag them into the prompt box.
- Answer the agent's questions from the prompt. Where the prompt doesn't have the answer, decide, tell the agent, and add the line to the prompt.
- Check it. At its starting values, it should reproduce a number you can check against something outside itself: your notebook, a published figure, a count you made.
- Upload it.

### Requirements

- One self-contained `index.html`: styles, script and data inline, no network requests, under 50MB. It has to open from disk with the wifi off. That means no map tiles; draw your own context from data, or design it so that a basemap isn't necessary...
- Real data only. Prompting an LLM for a dataset will ALWAYS produce fabricated data. If the data you wanted doesn't exist, scale the sandbox to the data that does.
- The sliders follow the order from the tutorial: clock, then how it's drawn, then the main levers, then the finer assumptions.
- It says, on the page, what it's trying to show and what it can't see.

If the file can't be made to fit, or you'd rather work this way, put the sandbox on GitHub Pages and submit the link instead, with a screenshot. Your agent can walk you through setting that up.

### Submit

- `index.html` as the work, with `prompt.md` as an extra file (or the GitHub Pages link, as above)
- a screenshot of the sandbox, for the gallery
- a two-sentence gallery text
- three short reflections, on the form: what was this process like? how is the result? what was unexpected, or different from what you wanted?

If the sandbox doesn't come together, that's ok. Upload the prompt, a PDF of screenshots showing how far it got, and the reflections, and that counts as a complete submission.

### A few things

Use the same kit you used in Tutorial 4, with `AGENTS.md` in the folder.

An AI model produces something like a statistical average of the internet, so unless you give it a lot of context, the work it makes won't really be your own. For this assignment, I'd like 90% of your time to go into the prompt and into answering the agent's follow-up questions. Please don't have an AI model write the prompt for you. And please don't rewrite the prompt and run it again from the start. This is a one-time run, and what came out of it is what you hand in, including the parts that went wrong; the reflections are where you write about those.

### Submission

`Submit your work` below. It appears under [Student Work](/gallery/#assignment-04), which is what we'll pin up in class on 10/8. Graded on completion.
