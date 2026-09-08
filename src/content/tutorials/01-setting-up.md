---
title: "Setting Up and Handing In"
date: "2026-09-06"
author: Adam Vosburgh
sequence: 1
cat: tutorial
published: true
publish: "2026-09-10"
---

This module covers the two pieces of infrastructure you will use every week: this website, where all of your work is handed in and shown, and Google Colab, where we will write code for the first few weeks. After completing it you will have made a test submission and seen it appear under [Student Work](/gallery/).

There is no Canvas and no Miro in this class. Everything goes on this site. If any part of it does not work for you, tell me right away.

## The course site

Have a look around before you do anything else. The tabs are:

- [Sandboxes](/sandboxes/) are finished, playable simulations. There are five of them, and each one can be changed with a small set of controls. You do not need to be in the class to use them. Later in the semester you will submit your own versions of them.
- [Tutorials](/tutorials/) are the weekly how-tos, like this one. Each sandbox also has its own dev notes (what went into it, and where it got stuck) linked from its page.
- [Assignments](/assignments/) holds the prompts. Every assignment page has a `Submit your work` button at the bottom, which is how you hand things in.
- [Student Work](/gallery/) is our pin-up wall. Everything anyone submits shows up there, in a section for each assignment. This page is public. You can resubmit at any time, and the new version replaces the old one.
- [Resources](/resources/) has readings by week, precedent projects, data sources, and instructions for running Python on your own computer if you would rather not use Colab.

There is also an assistant in the corner of every page. It knows the sandboxes and the tutorials. It is optional, and nothing in this class requires it. See [the note on it](/resources/assistant/) for what it does.

## Your submission token

There are no accounts on this site. Instead, each of you has a token, a long random string that I email you at the start of the semester. The first time you submit anything, the form will ask for it. Paste it once and your browser keeps it (in `localStorage`), so you should not need it again on that computer.

Your token is what puts your work under your name. It can write to your folder on the site and nowhere else. Don't share it. If you lose it, email me and I will issue a new one. If you switch computers you will be asked for it again.

## Google Colab

For the first three weeks we will write Python in [Google Colab](https://colab.research.google.com/). Colab is a programming environment that allows for the execution of Python code in the browser, so there is nothing to install. It has most of the libraries we need already, and we will add the one or two that it doesn't as we go.

In the spirit of this class, while the service provided by Google is great, it's best if you learn how to use these tools in a way that doesn't leave you reliant on the services of one of the most powerful entities in the world. If you would rather run all of this on your own machine, [here is how](/resources/local-python/). The code in the tutorials is the same either way, apart from how you get files in.

To set up:

1. Sign in to Colab with a Google account. Your Columbia account works.
2. `File` > `New notebook in Drive`. Rename it something like `smt-test`.
3. In the first cell, type `print("hello")` and press `shift` + `enter`. You should see `hello` appear below the cell.

That's it. The notebook is saved in your Google Drive. Next week's tutorial starts from a fresh one.

One thing worth knowing now: Colab forgets any files you upload when the session ends (after some hours of inactivity). This is why every tutorial starts with an upload step, and why you should keep your datasets in a folder on your own computer, not only in Colab.

## A test submission

Now let's hand something in. [Assignment 1](/assignments/assignment-01/) asks for one image and two sentences. It is graded on completion. It exists so that you use the submission form once before something real is due.

Go to the assignment page and click `Submit your work`. The form asks for:

- **Your token**, the first time only.
- **Title.** Anything you like, but short.
- **Gallery text.** Two sentences, written as if they were on the wall next to the work in a gallery. This is a recurring requirement in this class. The [V&A's guide](https://www.vam.ac.uk/__data/assets/pdf_file/0009/238077/Gallery-Text-at-the-V-and-A-Ten-Point-Guide-Aug-2013.pdf) to writing gallery text is the reference.
- **Description.** Optional here. In later assignments this is where your sources and the longer text go.
- **The work.** For Assignment 1, one image (PNG or JPG). Later assignments accept PDFs, and Assignment 4 accepts an HTML file.
- **Anything else.** Optional extra files. The whole submission has to stay under 15MB.

Click `submit`. If it worked you will see a link to your new page. Follow it, and then go to [Student Work](/gallery/) and find yourself under Assignment 1.

![the upload form][UPLOAD]

## When it doesn't work

The site checks every submission before it accepts it. If something is wrong, the form shows a list of the problems, and each item has a `Fix` link that points to the part of the assignment or tutorial that explains it. The most common problems are a missing gallery text, a file type the assignment does not accept, and a submission over 15MB. The check only looks at whether the gallery will be able to show the file. It does not look at the work.

If the form says your token is not recognized, check for a stray space at either end of it. If you have tried twice and it still won't go through, email me the files and a screenshot of the error and I will put it up for you. Your grade does not depend on the upload form working.

## Assignment 1

Due next week, 9/17. One image of something you have made, in any medium, and two sentences of gallery text. Details on the [assignment page](/assignments/assignment-01/).

---
Module by Adam Vosburgh, Fall 2026.

[UPLOAD]: /tutorials/images/w1/upload-form.png
