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
the submission API or the assistant. `npm run data` regenerates the packed grids
under `static/data/`; they are committed, so you only need it if you change
`scripts/build-data.js`.

See `CLAUDE.md` for the architecture, the sandbox contract, and the freeze path.

## License

GPLv3. Sandbox 3 (A City Simulator, Opened Up) derives from micropolisJS and additionally
carries the Micropolis Public Name License - see that sandbox's model card.
