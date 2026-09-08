// PM2 process definition for simmodeltwin.net.
//
// Served through the Cloudflare tunnel (docker container "cloudflared"), which
// reaches this process at http://host.docker.internal:3003. Nothing is
// port-forwarded on the router; the tunnel is the only public path in.
//
// .cjs because package.json sets "type": "module" and PM2 needs CommonJS here.
//
// Env comes from .env via node's --env-file, not from an `env` block, so that
// ANTHROPIC_API_KEY and anything else secret stays in the gitignored file and
// out of this one.

module.exports = {
  apps: [
    {
      name: 'smt-fa2026',
      cwd: '/opt/smt-fa2026',
      script: 'build/index.js',
      node_args: '--env-file=/opt/smt-fa2026/.env',

      // Fork, not cluster: /api/submit writes files and shells out to git, and
      // the assistant budget counter in var/ assumes a single writer.
      exec_mode: 'fork',
      instances: 1,

      autorestart: true,
      max_restarts: 10,
      watch: false,
      max_memory_restart: '600M',

      error_file: '/opt/smt-fa2026/var/pm2-error.log',
      out_file: '/opt/smt-fa2026/var/pm2-out.log',
      merge_logs: true,
      time: true
    }
  ]
};
