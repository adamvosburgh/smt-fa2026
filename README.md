# Simulations, Models, Twins

Course site for Simulations, Models, Twins - Columbia GSAPP, Fall 2026.
**simmodeltwin.net**

## Quick start

```
npm install
npm run dev
```

To run a dev server with un-published content:
```
SMT_SHOW_UNPUBLISHED=1 npm run dev
```

No `.env` is needed to run it - copy `.env.example` to `.env` only when you want
the submission API or the assistant. The packed grids the sandboxes read are
generated into `data/processed/` by the Python pipelines in `data/scripts/`;
`npm run sync` (run automatically by `npm run dev` and `npm run build`) mirrors
them into `static/data/`, which is not committed.

Deploying: `scripts/deploy.sh`. The upload size limits that live outside the
repo are described beside `BODY_SIZE_LIMIT` in `.env.example`.

## License

AGPLv3 - see `LICENSE`. Sandbox 3 (A City Simulator, Opened Up) derives from
micropolisJS, which is GPLv3 and additionally carries the Micropolis Public Name
License - see that sandbox's model card.
