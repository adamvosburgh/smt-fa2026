---
title: "The Course Assistant"
date: "2026-09-06"
author: Adam Vosburgh
sequence: 1
cat: resource
published: true
# Tells the resources page to print systemPrompt() under "The prompt" below.
renders: assistant-prompt
---

There is an assistant in the corner of every page on this site. It has a short description of each sandbox, the section headings of every tutorial, and the full text of whichever page you have open. So it is most useful when you open it from the tutorial you are working through.

## What it is for

Many of the assignments ask you to take a tutorial and change it, with your own data or toward your own project. If you get stumped somewhere in that, this is a place to ask. The assistant will walk you through the change a step at a time. If that isn't working, it will offer to write the code for you, and it will say so when it does.

Two things it won't do. It won't make up a dataset for you (a language model asked for data will invent it, and this class is partly about that problem). And it can't see or change files on your computer. To build a sandbox, use Claude Code or something like it, as [Tutorial 4](/tutorials/04-notebook-to-sandbox/) describes.

## The prompt

Everything the assistant is told is printed below. It lives in `src/lib/assistant-prompt.js` in the repository, and this is the version running as of this build. The text of the page you are on is added to it when you send a message.

## Limits

The assistant needs your submission token, the same one you hand work in with. If this browser has lost it, there is a field for it at the top of the assistant panel. Each of you has a daily allowance of messages. The site as a whole has a daily cap, and if it is reached the assistant will say so until the next day.

I keep a log of the conversations and read them to see which parts of the tutorials are giving people trouble. If you would rather I not read yours, skip the assistant; nothing in the class depends on it.
