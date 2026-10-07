# Simulations, Models, Twins

Course site for Simulations, Models, Twins - Columbia GSAPP, Fall 2026.
**simmodeltwin.net**

This course site follows from my previous course site, 
[methods in spatial research](https://methodsinspatialresearch.xyz) in design, but 
builds on it significantly. In addition to serving as an online syllabus, this
site also includes submission infrastructure, a html renderer, a shared 
whiteboard to use for pin-ups, and more.

I have also authored a number of [sandboxes](https://simmodeltwin.net/sandboxes/) 
to serve as examples of work that students may want to pursue. 

This repository is open for others interested in similar topics, or for individuals
looking for similar infrastructural elements in their courses. However, please note 
the license terms cited in this readme, and in LICENSE.

This is the first year of this course, and as such this repository has draft 
material mixed in. Make sure to look for deploy paths and comments to deduce
what is actually in production.

## Quick start

```
npm install
npm run dev
```

No `.env` is needed to run it - copy `.env.example` to `.env` only when you want
the submission API or the assistant. 

The packed grids the sandboxes read are generated into `data/processed/` by the 
Python pipelines in `data/scripts/`; `npm run sync` (run automatically by 
`npm run dev` and `npm run build`) mirrors them into `static/data/`, which is 
not committed.

Deploying: `scripts/deploy.sh`. The upload size limits that live outside the
repo are described beside `BODY_SIZE_LIMIT` in `.env.example`.

## License

- **Code** is licensed under AGPLv3 (see `LICENSE`).
- **Course writing and images** are licensed under
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Credit:
  Adam Vosburgh. *Simulations, Models, Twins*. Columbia GSAPP. Fall 2026. <https://simmodeltwin.net/>
- **Student work** shown on the site belongs to the students. It is not in this
  repo and is not covered by either license.
- **Third-party material** keeps its own terms: the City Simulator sandbox
  derives from micropolisJS (GPLv3 plus the Micropolis Public Name License; see
  its `NOTICE.md`), and the processed data follows each publisher's terms, cited
  in the model cards.
