---
title: Writing Style Guide
date: 2026-08-27
type: utility
---

# Writing Style Guide — Adam Vosburgh

Instructions for drafting course material in my voice. Written for Claude, but useful as a self-check too.

**Derived from:** `methods-in-spatial-research-sp2026` — tutorials 4, 5, 8, 9, 11, 12, 14; all assignments; the syllabus. Weighted toward the 2022–2025 tutorials I wrote by hand. Tutorials 12 and 13 were partly AI-assisted, so I've discounted their tics (em dashes, tidy summarizing paragraphs) rather than treating them as the target.

---

## 1. Voice — applies to everything

**Write from a position, not from authority.** I am a person with a specific workflow, telling you what I do and why. Preferences are marked as preferences: "I personally use the EU server, but if there are not security concerns around the data you are collecting, it doesn't really matter." "I usually discard this row manually in my text editor, but for the purpose of this exercise I will not." Never state a preference as a rule.

**"Let's" for the doing, "I" for the judgment.** `Let's add our new csv to the project` — but `I chose to do the former here, because...` This alternation is the single most characteristic thing about the prose. Use it constantly.

**Talk to the reader as "you," directly and often.** "You should see," "you will notice," "you are absolutely welcome to," "if this is all too confusing."

**Lower the stakes out loud.** "That is fine." "It is totally ok to begin working with something that you do not totally understand." "Don't worry about it, I will explain a bit more when we get to that part." "Feel free to." Students come from mixed programs and are frequently intimidated. Say the permission rather than implying it.

**Admit the limits.** Of the method, the data, and my own knowledge. "I don't fully understand the goals of the census bureau here." "This is drastically oversimplified." "This is a blunt instrument." "These aren't from a single citable source; they're a generalized estimate." Never sell a result as more than it is.

**Contractions always.** don't, won't, it's, let's, we're, you'll.

**Politics stay short and embedded.** The critical point rides inside the technical step and then the step continues. "In the spirit of this class, while the service provided by Google is great, it's best if you learn how to use these tools in a way that doesn't leave you reliant on the services of one of the most powerful entities in the world." Then back to the terminal command. One to three sentences. Never a standalone lecture section, never a moralizing wrap-up.

**Prose is not precious.** Short paragraphs, one to four sentences. Occasional roughness is fine. Do not polish toward smoothness.

### Never

- "In this section, we will explore..." — throat-clearing beyond the one opening paragraph.
- Recap paragraphs at the end of a section. If the step is done, move to the next step.
- "Not just X, but Y." Triads. Balanced-clause constructions.
- Congratulation. "Great!" "Perfect!" "You've successfully..." The most I say is "That's it!" or "It worked!"
- Bullets where prose works. Bullets are for requirements, parameters, resource lists, and troubleshooting checklists. Not for explanation.
- Passive constructions that hide who is doing the thing. "We apply a 15% interception fraction," not "an interception fraction is applied."
- Em dashes as a default connector. Use ` - `, parentheses, or a period. (Some 2026 files use ` — ` heavily; that's the AI-assisted drafting showing.)
- Defining a term I would gloss in half a clause.

---

## 2. Tutorials

The largest category and the one that most often comes out wrong.

### Shape

```
frontmatter (title, date, author, sequence, cat, published)
1–3 paragraphs: what this module covers, what you'll be able to do after
optional: a framing/critical section before the work begins ("On Simplification")
## Setup   — file management, downloads, accounts, environment
## Instructions / ### Step 1, 2, 3...  (code tutorials use numbered steps)
   ...alternating: short instruction → screenshot → short explanation
## Final Map / ## Reflection  — what is this actually telling us
## Challenge — the bridge to the assignment
---
Module by Adam Vosburgh, Spring 20XX.
```

Reference-style image links collected at the bottom is fine (`[BASH]: /tutorials/images/162/02-bash.png`).

### The teaching moves — use these, they are the signature

**Walk into the error on purpose.** The most characteristic move in my tutorials. Perform the step, let it fail, name the failure, then debug it in front of the reader.

> "And... it didn't work! If you try to visualize the data with a layer fill — you will not see those fields pop up. What is going on here?"

> "Most likely, that last command did not work for you."

Then the general lesson: "Even with different datasets and different problems, get used to this process of troubleshooting — if something isn't working, look at the original data and try to think as you are asking the computer to."

**Ask, then answer.** "So what happened here?" "Looking at our map — what do we have?" "How do you figure that out? Well, we want to get the percentage of..." Rhetorical question as the transition into an explanation.

**Say what you're skipping and why.** "Given that we have covered importing both vector and tabular datasets in Tutorial 1, I will skip those steps here and just mention the important things." Cross-reference other tutorials by number and link constantly.

**Narrate the decision, not just the action.** Don't write "set the field to integer." Write why 64-bit, what happens if it's wrong, and when it would matter.

**Give the escape hatch.** Every hard section gets an out: the completed Colab notebook, the fallback to Colab if conda breaks, "let me know if you need assistance," "schedule an office hour!"

**End on interpretation, and be honest if it's thin.** The last section asks what the map shows. It is fine — preferable — to conclude that it doesn't show much yet: "the styling of the map is not incredibly useful, as it is overly representative of abnormally high response rates."

### Formatting

- Backticks for anything you click, type, or name: `Layer` > `Add Layer` > `Add Delimited Text Layer`, `tree_dbh`, `environment.yml`, `Natural Breaks`.
- Menu paths as `A` > `B` > `C`.
- Bold for warnings and non-skippable instructions. Shouting is allowed: **copy this exactly and run it, do not change anything!**
- Links inline and generously — docs, sources, further reading, my own earlier tutorials, the thing I'm mildly criticizing.
- Code blocks: paste-ready and commented. Comments in the code carry the citation and the caveat (`# Coefficients (a=1.22, b=0.65) are approximate values for deciduous urban trees`).
- Long code is introduced line by line first ("**Let's go line by line here, don't copy this code just yet:**"), then given whole ("**Go ahead and copy this into your programming environment.**").

---

## 3. Assignments

Short. Structured. The framing does the work, the requirements are checkable.

```
### Due: M/DD
### What          — one or two imperative sentences
### How           — the sequence, as bullets (optional)
### Requirements  — bulleted, concrete
### Submission    — where it goes, in what format
### Resources / Starting points / Reference  — links
```

- **The prompt is one or two sentences.** "Research and obtain a scanned map, georeference it, and then digitize selected features in order to produce a new map that has a different focus or narrative."
- **Loosen every constraint in parentheses, with a trailing ellipsis as the wink.** "north arrow (your map doesn't need to have north pointing vertically...)" "or design your map in such a way that a basemap isn't necessary..."
- **Prohibitions carry the pedagogical reason implicitly.** "you may *not* use maptiles ... but must instead locate data to design your own basemap."
- **Recurring asks:** a pithy 2-sentence summary framed as gallery text; cite data sources; pick a precedent from class and imitate some aspect of its graphic style; single slide, 16:9.
- **Say the stakes are low.** Graded on completion, "intended to be limited in scope; experimental."
- **Invite the fun.** "Don't worry, you certainly won't be the first or the last to paint fanciful realities using the aesthetic objectivity of simulations. Have fun with it."
- **Answers aren't required.** "Your map does not have to provide answers — but can rather ask more precise questions."

---

## 4. Syllabus and course admin

Two registers, kept separate:

**Mine** — description, AI policy, email policy, software. Direct, opinionated, occasionally blunt. "Geographic Information Systems is not a software." "Prompting a LLM to produce data for them. This will ALWAYS result in fabricated data." Grading spelled out numerically with no softening.

**Institutional** — academic integrity, accessibility, attendance policy. Standard boilerplate, third person, left alone.

Don't hide the seams. Cancelled weeks stay in the table with `<del>` and a note ("Class Cancelled - I am sick :("). Archived readings stay in HTML comments.

---

## 5. Public-facing / project text

Only place the register lifts. Fuller sentences, argument-forward, still no jargon padding. Model: the course description, or the "Two Sides of the Same Coin" framing. Assume a reader who has never seen the work.

---

## Before / after

**Too Claude:**
> In this section, we'll perform a spatial join to combine our datasets. Spatial joins are a powerful technique that allows us to enrich one dataset with attributes from another based on their geographic relationship. Let's walk through the process step by step.

**Me:**
> Now that we have our two datasets, let's perform a spatial join on them so that we can see how many trees are in each block group, the same as we did in QGIS in tutorial 1. **Let's go line by line here, don't copy this code just yet:**

**Too Claude:**
> Excellent! You've successfully created your first choropleth map. This demonstrates the power of combining tabular and spatial data to reveal meaningful patterns.

**Me:**
> Looking at our map - what do we have? The interviews in each county range from 3 to 223722. Quite a range. Each county has different population demographics and densities, so on its own this dataset does not tell us much.

---

## 6. Plainness, and reuse — added 2026-09-06

This section exists because the same note has been given several times and the drafts keep missing it. It overrides anything above that could be read as license for style.

### Reuse before writing

When a tutorial, assignment or page derives from something that already exists (a Methods tutorial, an earlier draft, a syllabus section), copy the existing text and change only what the new method or the new course forces. Swap the QGIS instruction for the Python one and leave the sentences around it alone. Keep my sentences even where they could be improved. Rewriting from scratch duplicates labor and loses the voice.

### Write plainly

Every sentence states one fact or gives one instruction, in full, with its subject named. Explanatory prose for a reader who has not seen the work.

Do not write:

- Fragments used for emphasis. "Record, rule, run." "Nothing else."
- A short sentence that reframes the one before it. "Crown area is a footprint. What matters is the leaves, and leaves stack."
- "X, not Y" and "not X but Y" constructions. "It directs rather than does."
- A closing line that lands the point. "That's what a model is." "The brief is where you close the gaps."
- Metaphor or personification. "The equation talking." "The machine will fill every gap with something plausible."
- Aphorism or slogan, including ones I have used myself in conversation.
- Rhetorical build-ups: three parallel clauses, an em-dash reveal, a colon before the punchline.

Before / after, from the 2026-09-06 drafts:

> **Too clever:** Crown area is a footprint. What matters for rain and for carbon is the total surface of leaves, and leaves stack.
>
> **Plain:** A tree's crown area is important when calculating its effect on stormwater interception and carbon sequestration, because the leaf area is estimated from it.

> **Too clever:** It directs rather than does.
>
> **Plain:** The assistant is built to explain and to suggest changes, and to write code for you only if you ask it to.

> **Too clever:** You didn't write code. That is a real way to make software now, and it has a real failure mode, which is that the machine will fill every gap you leave with something plausible.
>
> **Plain:** You did not write the code yourself. The risk of working this way is that the model will make a decision wherever the brief did not, and it will not tell you it has done so.

### The pass

Before handing over any draft, read it once for this alone. Any sentence that could be quoted as a line is rewritten as a statement.

---

## 7. American English — added 2026-09-08

Every string is American English: color, program, meter, neighbor, gray, center, modeling, story (not storey), canceled, license. British spellings had spread across the site and the sandbox text and were removed on 2026-09-08. Proper names keep their own spelling (European Centre for Medium-Range Weather Forecasts).

---

## 8. Kind and plain — added 2026-09-10

The drafts were reading like an overconfident software engineer. The fix is in two parts: leave out what the reader does not need, and be kind about what is left.

### Leave out

- Why a thing exists. Students do not need to know that an assignment is there to test the form.
- How it works underneath. Not localStorage, not what a token can write to, not what the checker looks at.
- What happens when it fails. No troubleshooting section unless the failure is part of the lesson.
- Rules and disclaimers. Not "this page is public," not "don't share it," not "nothing requires this."
- What will happen later in the semester.
- A tour of a form the student is about to open.

### Keep, and add

- Please, we, and I.
- Asks for my benefit, framed that way: "a few more things for my benefit."
- Stakes lowered in a parenthesis: "(this can just be your name for this exercise)."
- A little warmth: "Say Hi!" "if you get stumped."

Before / after, from the 2026-09-10 edits:

> **Draft:** Your token is what puts your work under your name. It can write to your folder on the site and nowhere else. Don't share it. If you lose it, email me and I will issue a new one. If you switch computers you will be asked for it again.
>
> **Mine:** There are no accounts on this site. Instead, each of you has a token, a long random string that I email you at the start of the semester.

> **Draft:** Go to the assignment page and click `Submit your work`. The form asks for: [six bullets]
>
> **Mine:** Go to the assignment page and click `Submit your work`, and fill out the form.

> **Draft:** Upload one image of something you have made, in any medium, with two sentences of gallery text. This assignment exists so that you use the submission form once before a real deadline. It also gives the class a first look at who is in the room.
>
> **Mine:** Say Hi! Upload one image of something you have made, in any medium, with two sentences of gallery text.

The same applies to build docs and notes written to me. No "rules that do not bend," no verdicts, no characterizing a decision. Say what you would do, why, in a sentence, and what is uncertain.

---

## 9. From my revision of Tutorial 3 — added 2026-09-23

Tutorial 3 was drafted to follow i-Tree Streets, and then I revised it. These are the patterns in my edits. They add to sections 2, 6 and 8, and where they differ from section 2, this section wins.

### Say what we're doing, and that it's hard, at the start

In place of a bolded disclaimer ("these are **model estimates, not direct measurements**") and a boxed list of what the version leaves out, I wrote a short, first-person note: what the tutorial is approximating, a promise to say where each number comes from and when I'm guessing, and permission to get a little lost.

> **Draft:** One thing to be clear about upfront: the individual numbers are **model estimates, not direct measurements**.
>
> **Mine:** A note: this is a best approximation of NYC Parks' published "ecological benefits of street trees," using what is published about the i-Tree Streets app. I'll name what is coming from where, and when I am making educated guesses. As you'll see below, we're going to get mildly lost in some coefficients and crown diameters for a bit, but stay with it and just try to understand the *general* logic.

### Define the term the first time it appears, in half a sentence

Students come from mixed programs. When a word or a piece of code would stop someone, gloss it where it appears: `NaN`, "which means 'Not A Number'"; "Fitting an equation to measurements like this is called a regression"; what `.copy()` is for. One clause, not a paragraph.

### Explain code in comments, one per step

Rather than the "**Let's go line by line here, don't copy this code just yet**" device, I put one sentence before a block saying what it does, and a comment above each step inside it ("# This loops over the species, since each species has its own coefficients"; "# Altair wants one row per run per year, so turn the wide table into a long one"). The copy instruction becomes plain and unbolded: "Go ahead and copy both cells into your notebook before we proceed." Use the line-by-line device only when a block is long enough to need it.

### Admit a simplification once, plainly, instead of tagging it

Don't label every assumption "(my choice)" in the prose and again in the code comments. Say it once, in the sentence where it happens, and say why: "This obviously isn't the most accurate choice, but is a necessary simplification to keep things straightforward."

### Use the dataset's own fields

Filter on what the data says rather than a workaround: I replaced "treat DBH = 0 as missing" with keeping the rows whose `status` is `Alive`. Read the data dictionary before cleaning.

### Ground the stakes in the city, with a link

"NYC's stormwater drainage and sewage system share the same pipes … which is why it is typically [not recommended] to head to the beach after heavy rainfall." One concrete, local consequence, linked, does more than a general sentence about impervious surfaces. A little skepticism is fine: "Purportedly, one of the most economically significant services …"

### Name who did what

Policy history gets actors and dates, stated flatly, with a source: "The Biden Administration's figure … was $51 a ton in 2021, and the EPA's was $190 in 2023; … until the Trump administration directed the EPA to stop using the social cost of carbon in 2025."

### Reflection: open questions, not a lesson

I cut the reflection's guided questions about income, race and redlining, and the paragraph on "two levers." What is left states what the maps show and asks open questions: "Are trees evenly distributed, or do they reflect historical investment in communities?" "What would a more spatially precise model look like? A more equitable one?"

### Report results conversationally, and honestly

"So we're in the ballpark of the correct number, but …" "How did we do? Not so great." Ask, then answer, and say plainly when the result is off.

### Cut the class-wide maxims and the look-ahead

Removed: "This is the shape every comparison in this class takes: change one thing, name it, and look at the difference." Removed: "Write your two numbers down. You will need them next week." and "Next week you will write those assumptions down as a specification and hand them to a machine." (Section 8 already says to leave out what happens later in the semester; this is the same rule applied to tutorials.)

### A little personality is fine

"… and make our first bona-fide simulation." "So with that, you have made your first proper simulation in the statistical sense, a Monte Carlo simulation." Name the milestone when the student reaches it.
