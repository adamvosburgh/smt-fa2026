---
title: "From a Prompt to a Sandbox"
date: "2026-09-30"
author: Adam Vosburgh
sequence: 4
cat: tutorial
published: true
publish: "2026-10-01"
---

<!-- PROSE DRAFT for Adam. Replaces src/content/tutorials/04-notebook-to-sandbox.md. Keep the slug. Title is a proposal. "## The prompt" is left as bullets for Adam to write from. Image slots are marked IMAGE: ... -->

In this module we're going to take what we made in Tutorial 3, our small model of the street trees of upper Manhattan, and turn it into a sandbox like the [five on this site](/sandboxes/): a page with a map, a clock, and some sliders. The numbers we typed into the notebook last week become sliders, and the clock lets you scrub the run from 2015 to 2045 and watch the totals change.

A page like this is a fairly complex piece of JavaScript, and I don't expect you to write it, so we're going to have an AI coding agent write it for us. You've probably used a chatbot, like the Claude or ChatGPT window, which answers you in a chat. A coding agent is the same kind of model, but it can read and write the files in a folder on your computer and run commands there, and it keeps going on its own until the thing it was asked for runs.

Working this way has come to be called vibe coding: you describe the software you want in writing, the agent writes it, and you check what came out. I use it, and you're welcome to use it in this class. I do want us to be a little more careful about it than the name suggests. We're going to use it to stay in the ideas, which is what your sketch from Assignment 3 is made of, and to get better at describing those ideas precisely enough that a machine can build them. You write the prompt and you check the result.

A note before we start: this is going to be a little different for everyone, since we won't all be using the same agent, and these tools change every few weeks. If something doesn't match what you see on your screen, that's fine, ask, and we'll figure it out.

<div class="gap">

**What the class version has that yours won't.** The sandbox we build here reads the same 12,715 trees your notebook did. A fuller version would take the whole 2015 census, about 666,000 trees. That change doesn't affect the method.

</div>

## Setup

### The tool and the model

One thing first, because the names get confusing. Claude Code, Codex and Gemini CLI are tools. Claude, GPT and Gemini are the models inside them. The tool is the part that reads your files and runs commands; the model is the part that decides what to do. Most tools can be pointed at more than one model, and most models show up in more than one tool, so you'll see the same names in different combinations.

Here are a few of each. I've kept the notes short, since all of this changes every few months and I'm sure I'll be out of date by the time you read this.

Tools (coding agents):

- **Claude Code** (Anthropic). Runs in the terminal, or as an extension inside VS Code.
- **Codex** (OpenAI). The same idea, with OpenAI's models. Terminal and a VS Code extension.
- **Gemini CLI** (Google). Also terminal, and a VS Code extension called Gemini Code Assist.
- **Cursor**. A text editor with an agent built in. It's a modified version of VS Code, so it'll look familiar.
- **Antigravity** (Google). Google's editor, built around Gemini. Also a modified VS Code.
- **OpenCode**. Open source, runs in the terminal, and can use many different models, including ones running on your own computer.

Models:

- **Claude** (Anthropic).
- **GPT** (OpenAI). The models behind ChatGPT.
- **Gemini** (Google).
- **GLM** (Zhipu AI). Released with open weights, which means you can download it and run it yourself.
- **Qwen** (Alibaba). Also open weights.
- **Kimi** (Moonshot AI). Also open weights.

For this tutorial I'm going to run a coding agent inside a text editor, VS Code, so that my files, the agent and the terminal are all in one window. I'll be using Claude Code, because it's what I know best. Codex and Gemini Code Assist both have VS Code extensions too, and Cursor and Antigravity are editors of their own that you'd use instead of VS Code. Any of these should work for this tutorial; only the name of the thing you click changes. Each needs an account with the company that makes the model, and most need a paid plan. If that's a problem for you, come talk to me and we'll sort something out.

### Download VS Code

Let's download VS Code from [code.visualstudio.com](https://code.visualstudio.com/) and install it. It's free. If you've never used a text editor before, don't worry; for our purposes it's a window with your files on the left and a terminal along the bottom.

Then let's install the agent. For Claude Code, open VS Code, click `Extensions` in the left bar, search for `Claude Code`, and click `Install`. It'll ask you to sign in. For the others it's the same, with their name.

<!-- IMAGE: VS Code with the Extensions view open and the Claude Code extension installed; or the agent's panel open on the right. "Your window should look something like this." -->

### Download the course kit

Now download [smt-kit.zip](/kit/smt-kit.zip) and unzip it. Inside is a folder with a file called `AGENTS.md` and a couple of others. `AGENTS.md` is a set of instructions I've written for your agent: what a sandbox is in this class, what the file it makes has to look like, and how I'd like it to work with you. Every coding agent reads a file with this name when it starts up in a folder, so you don't have to do anything with it except leave it where it is. Feel free to read it, though.

Rename the folder to `street-trees` if you like. Then, in VS Code, `File` > `Open Folder` and choose it.

### Download the data

The sandbox needs the trees, the blocks, the species equations, and a list of places on the sidewalk where a new tree could go. I've exported all of that from the Tutorial 3 notebook into one file, `street-trees.json`. It's in the course folder, under the name of this tutorial. Download it and put it in your `street-trees` folder, next to `AGENTS.md`.

It's about 1.3 megabytes, and most of that is the planting sites. I made those from the city's street centerline file: every ordinary street, 3 feet behind the curb, a site every 25 feet, clear of corners and of trees that are already there. Those distances are my assumptions, not a planting standard, and the prompt below says so.

<!-- IMAGE: the VS Code file tree showing street-trees/ with AGENTS.md, CLAUDE.md, README.txt, street-trees.json. "You should end up with a folder that looks like this." -->

### Start the agent

Open the terminal in VS Code (`Terminal` > `New Terminal`) and start your agent. For Claude Code that's typing `claude` and pressing enter, or clicking its icon in the left bar and typing in the panel that opens.

The first time you send it something, it'll read `AGENTS.md` and introduce itself, and it'll tell you it's going to ask you more questions than it usually would. That's on purpose.

## The prompt

<!-- ADAM WRITES THIS SECTION. Below: the parts of the street tree sandbox, drawn from the brief in the current tutorial, for you to write from. Keep or drop the wireframe. -->

![wireframe of the street tree sandbox][WIRE]

The parts:

- **What it shows.** The street trees of a piece of upper Manhattan (roughly 105th to 141st Street), each run through its species' equations for the rain it intercepts and the CO2 it takes in, summed by census block, and grown forward one year at a time from 2015 to 2045. A planting lever adds trees each year. The method follows i-Tree Streets via the Northeast Community Tree Guide and the Urban Tree Database.
- **The data.** `street-trees.json`: `blocks` (GeoJSON, 580 blocks, property `BCTCB2010`), `trees` (parallel arrays: `lon`, `lat`, `dbh_in`, `sp`, `block`; 12,715 trees, 0 dbh means unknown), `equations` (one row per species per equation: `SpCode`, `common_name`, `predicts`, `form`, `a`–`d`, `x_max`; 21 Queens species), `sites` (parallel arrays: `lon`, `lat`, `block`; 15,787 sidewalk sites). Nothing else is fetched.
- **The equations.** Evaluated on dbh in cm or age in years, capped at `x_max`. Forms: lin, quad, cub, loglogw1, loglogw2, expow1, power. Predicts: age from dbh, dbh from age, crown diameter, height, dry weight.
- **The rule, per tree, per year.** dbh in → cm; crown diameter → crown area; stormwater = crown area × rain × interception fraction × 264.17 gal/m³; CO2 stored from dry weight × 1.28 × 0.5 × 3.67; age from dbh; grow one year (dbh from age + 1 minus dbh from age); CO2 per year = the difference in stored CO2; value = kg × 2.2046 × price per lb.
- **Deaths.** 2.8% a year under age 5, 0.57% after (Northeast guide p. 94). Off, average (multiply a standing share), or random (seeded).
- **Planting.** N trees a year, of one species at one starting dbh, only on a free site; which block gets them first: fewest trees, lowest per-tree benefit, or evenly. A site holds one tree for good (assumption).
- **Order of a year step.** Deaths, then growth, then planting.
- **Sliders and switches, in order, with starting values.** Clock: year 2015–2045, play/pause. Drawing: what tints the blocks (stormwater, CO2, count, per tree), draw trees / blocks / both. Main levers: planted per year (0–500, starts at 0), planting rule, planting dbh (2–4 in, starts at 3), planted species (starts at honeylocust), mortality (starts at average). Finer: rain (30–60 in, starts at 41.0, JFK 2000), interception (0.15 or 0.27, starts at 0.15, Xiao et al. 2000), carbon price (0.00334 / 0.0231 / 0.0862 $ per lb, starts at the first). Mark the ones that are assumptions or placeholders: planted per year, planting dbh, planted species, the zoom limits.
- **Numbers on the page.** Trees standing, total gal/yr, total kg CO2/yr, $/yr, median per-tree stormwater, blocks with zero trees, free sites left, share of stormwater in the top 10% of blocks.
- **What you should see.** The 2015 baseline from your notebook's Step 10 (about 25.3 million gal/yr); 2045 with average mortality (about 64.6 million); 2045 with mortality off (about 77.0 million). Put your own exact numbers in.
- **What it can't see.** Species beyond the 21; hourly rain; sidewalk width and what's really at a site; utilities and budgets; park and yard trees; storms, disease; anything that actually happened after 2015.
- **Constraints on the file.** One `index.html`, everything inline, no network, under 50MB, opens from disk.

Save this as `prompt.md` in the root of your `street-trees` folder, next to `AGENTS.md` and `street-trees.json`.

## Refinements

Now let's give the agent the prompt. I typed something like:

> Read prompt.md and street-trees.json in this folder, and build what prompt.md describes. Before you write any code, tell me your plan and ask me whatever you need to.

<!-- IMAGE: the agent's first reply, showing the "ghost of Adam" intro and the first couple of questions. -->

It's going to ask you questions, probably more than you expect. That's because of `AGENTS.md`. In it I've asked the agent to do a few things a coding agent doesn't usually do: to get your idea clearer than it normally would before writing anything, to read your data with you so you both know what's in it, to ask you how you want things drawn (and whether you have a reference project in mind), and to explain what it's doing at every step.

For the street trees, my agent asked me things like:

- Which trees count? (The ones with a recorded trunk diameter. The ones with 0 are left out of everything.)
- What happens to a tree that dies? Does it disappear from the map, or fade?
- When a new tree is planted, how does it pick the block, and then the site within the block?
- What does the clock step in, and what happens at 2045: does it stop or loop?
- What tints the blocks when the page opens, and does a darker color mean more?
- What should happen when there are no free sites left?

Answer from your prompt. If the answer's in there, point the agent to it. If it isn't, that's a gap in the prompt, and it's worth noticing, because otherwise the agent would have filled it in with something plausible and not mentioned it. Decide, tell the agent, and add a line to `prompt.md` so that the prompt stays the record of what you asked for.

Once it has what it needs it'll work for a few minutes and then tell you it's done. It'll also tell you what to check. Something will probably be off the first time, and you're in a good position to see what, because you built the same model by hand last week. Tell it in plain language: "the 2015 total is 40% higher than my notebook's, check the crown step" is more useful than "it's broken." If it starts adding things you didn't ask for, say so.

## Running it

When it's finished there'll be a file called `index.html` in your folder. That's the whole sandbox: the page, the code and the data, all in one file. You can double-click it and it'll open in your browser.

The better way to look at it is through a local server, which is closer to how the course site will run it. In the VS Code terminal, type:

```
python3 -m http.server
```

and open [http://localhost:8000](http://localhost:8000) in your browser. `localhost` is your own computer, acting as a web server for itself; the address only works on your machine and nobody else can reach it. If the command doesn't work (Windows sometimes doesn't have `python3` set up), just ask the agent to start a local server for you and tell you the address.

<!-- IMAGE: the terminal with http.server running, and the sandbox open in a browser tab at localhost:8000. "You should end up with something that looks like the below." -->

Now turn off your wifi and reload the page. It should still work. If it doesn't, the page is fetching something from the internet, and it won't work on the course site either. Tell the agent.

Then check it the way you'd check anything: at the starting values, in 2015, does the total match your notebook? Move a slider and see if the number moves the way you'd expect. It's fine if it's a little off; you'll write about that.

<!-- IMAGE: the finished street tree sandbox at 2045 with planting turned up, for comparison. -->

For the assignment, this `index.html` is what you'll upload to the [Assignment 4](/assignments/assignment-04/) submission, along with your `prompt.md`.

## What you did

You wrote a rule down precisely enough that a machine could build it, and then you checked whether it did. You didn't write the code yourself. The risk of working this way is that the model will make a decision wherever the prompt didn't, and it won't tell you it has done so. The prompt is where you prevent that, and the notebook is how you check whether it happened.

## Assignment 4

Do the same for the forecast you sketched in Assignment 3. Details on the [assignment page](/assignments/assignment-04/). Due 10/8, for the pin-up.

---
Module by Adam Vosburgh, Fall 2026.

[WIRE]: /tutorials/images/w4/street-trees-wireframe.svg#img-full
