<!-- PROSE DRAFT -->
# Deployment notes

`scripts/deploy.sh` and `ecosystem.config.cjs` cover the routine deploy. This
file is for the settings that live outside the repo.

## Upload size

The submission cap is 50MB (`maxSubmissionBytes` in `src/lib/server/config.js`,
overridden by `SMT_MAX_SUBMISSION_BYTES`). Two things in front of the app also
cap the request body, and neither is in the repo. Both need to be at least 52MB,
which leaves room for the browser-drawn cover (up to 2MB) and the manifest.

- `BODY_SIZE_LIMIT` in `.env`, read by adapter-node. Its default is 512KB. Set
  it to `54525952` (52MB) and set `SMT_MAX_SUBMISSION_BYTES=52428800` beside it.
  PM2 reads `.env` at start, so run `pm2 restart smt-fa2026` after changing it.
- The Cloudflare tunnel (docker container `cloudflared`). Cloudflare limits a
  request body by plan; the Free and Pro plans allow 100MB. Check the plan if
  uploads over some size fail with a Cloudflare 413 page rather than the
  site's own message.

If either is lower than the cap, a large upload fails with a bare 413, and the
upload form shows its generic "too large" message.
