# Simulations, Models, Twins

Course site for Simulations, Models, Twins - Columbia GSAPP, Fall 2026.
**simmodeltwin.net**

Seven sandboxes, each running in the browser with a small set of exposed
parameters. Play with any of them; you don't need to be in the class.

## Running it

```
npm install
npm run dev
```

No `.env` is needed to run it - copy `.env.example` to `.env` only when you want
the submission API or the assistant. `npm run data` regenerates the packed grids
under `static/data/`; they are committed, so you only need it if you change
`scripts/build-data.js`.

See `CLAUDE.md` for the architecture, the sandbox contract, and the freeze path.

## License

GPLv3. Sandbox 4 (The Coefficients) derives from micropolisJS and additionally
carries the Micropolis Public Name License - see that sandbox's model card.
