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

## The course site

Have a look around, the tabs are:

- [Sandboxes](/sandboxes/) are finished, playable simulations. I have authored these to serve as reference projects, for the type of work that you may want to pursue in this class. In the assignment that follows after this tutorial, I will ask for your suggestions on any others I should build out.
- [Tutorials](/tutorials/) are the weekly how-tos, like this one. 
- [Assignments](/assignments/) holds the prompts. Every assignment page has a `Submit your work` button at the bottom, which is how you hand things in.
- [Student Work](/gallery/) is our pin-up wall. Everything anyone submits shows up there, in a section for each assignment. You can resubmit at any time, and the new version replaces the old one.
- [Resources](/resources/) has precedent projects, and any other notes that may be helpful for the course.

There is also an assistant in the corner of every page, that uses the content of the site as a reference. Many of the assignments will involve tweaking the tutorials with your own data or ambitions. The assistant can point you in the right direction if you get stumped. See [the note on it](/resources/assistant/) for what it does.

## Your submission token

There are no accounts on this site. Instead, each of you has a token, a long random string that I email you at the start of the semester. 

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

Now let's hand something in. [Assignment 1](/assignments/assignment-01/) asks for a bit of info about you, that we will go through in the next class.

Go to the assignment page and click `Submit your work`, and fill out the form.

Click `submit`. If it worked you will see a link to your new page. Follow it, and then go to [Student Work](/gallery/) and find yourself under Assignment 1.

![the upload form][UPLOAD]

## Assignment 1

Due next week, 9/17. Details on the [assignment page](/assignments/assignment-01/).

---
Module by Adam Vosburgh, Fall 2026.

[UPLOAD]: /tutorials/images/w1/upload-form.png
