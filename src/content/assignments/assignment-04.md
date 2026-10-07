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
# `mode` asks index.html or hosted site and decides which of work / link /
# screenshot show; `prompt` is the required prompt.md.
form: [title, gallery_text, mode, work, link, screenshot, prompt, extras]
# The whiteboard tile: the live interactive (click to run) and the prompt
# under it. Absent means the usual cover tile.
board_tile: interactive
questions:
  - key: process
    label: "What was this process like?"
  - key: result
    label: "How is the result?"
  - key: unexpected
    label: "What was unexpected, or different from what you wanted?"
---

### Due: 10/8, for the pin-up

### What

Take your sketch from Assignment 3 and revise it into a prompt: one markdown file that says what your sandbox is for, what data it uses, what the rule is, how it runs, and what the page should have. Then give the prompt to your coding agent, answer the questions it asks you, and upload what came out.

[Tutorial 4](/tutorials/04-notebook-to-sandbox/) does this for the street trees. Do the same for yours.

### How

- Write `prompt.md`. If they are useful, the headings of the prompt in Tutorial 4 can be yours: an overview, the data, the objectives, the data prep (the rule), the run, and the interactive. Try to put a source next to every number, and where there isn't one, just say it's a placeholder or an assumption. Give the rule units. An AI model produces something like a statistical average of the internet, so unless you give it a lot of context, the work it makes won't really be your own. I'd like 90% of your time to go into the prompt and into answering the agent's follow-up questions.
- Set up a folder the same way as Tutorial 4: the contents of the course kit you used in Tutorial 4 (including `AGENTS.md`), `prompt.md`, and your data as you downloaded it in `data` > `Original`, with an empty `data` > `Processed` beside it. Open the folder in VS Code and start your agent. You can give it your sketch from Assignment 3 too, and any images or reference projects you have in mind: save them in the folder and mention them by name in the prompt, or, in Claude Code, hold `shift` and drag them into the prompt box.
- Answer the agent's questions, in as much detail as you can.
- Run it on a local server, as in Tutorial 4, and look at what came out. Take note of what's off; that's what the reflections are for.
- Upload it.

### Requirements

- One self-contained `index.html`: styles, script and data inline, no network requests, under 50MB. It has to open from disk with the wifi off. That means no map tiles; draw your own context from data, or design it so that a basemap isn't necessary. If the file can't be made to fit, or you'd rather work this way, host the sandbox as a website (GitHub Pages works) and submit the address of the live site instead, with a screenshot. Use the address of the site (`yourname.github.io/project`), not the address of the repository on github.com. (and don't worry if you don't know what that means)
- Real data only. Prompting an LLM for a dataset will ALWAYS produce fabricated data. If the data you wanted doesn't exist, scale the sandbox to the data that does.
- The sliders follow the order in `AGENTS.md`: clock, then how it's drawn, then the main levers, then the finer assumptions.
- Like the street trees sandbox, it has a title, a description of what it's trying to show, its limitations, and citations for the data it uses.
- You write the prompt. Please don't have an AI model write it for you.
- One run. Please don't rewrite the prompt and run it again from the start. What came out of the run is what you hand in, including the parts that went wrong; the reflections are where you write about those.

### Submit

The form first asks what you are submitting: one `index.html` (the default), or a website you hosted.

- one `index.html`, a screenshot of the sandbox for the gallery, and your `prompt.md`; or
- the link to your hosted site, a screenshot of the sandbox for the gallery, and your `prompt.md`
- a two-sentence gallery text
- three short reflections, on the form: what was this process like? how is the result? what was unexpected, or different from what you wanted?

Your `prompt.md` is shown on your page beside the work.

If the sandbox doesn't come together, that's ok. Upload the prompt, a PDF of screenshots showing how far it got, and the reflections, and that counts as a complete submission.

### Submission

`Submit your work` below. It appears under [Student Work](/gallery/#assignment-04), which is what we'll pin up in class on 10/8. Graded on completion.
