import { env } from '$env/dynamic/private';

export const config = {
  // Where submissions land. The repo itself during the semester.
  submissionsDir: env.SMT_SUBMISSIONS_DIR || 'src/submissions',
  stateDir: env.SMT_STATE_DIR || 'var',

  // Hard cap, enforced server-side before anything is written.
  maxSubmissionBytes: Number(env.SMT_MAX_SUBMISSION_BYTES || 15 * 1024 * 1024),

  // Committing to git is OFF by default. Turn it on deliberately once the
  // deploy user has a key and you have watched a few submissions land as plain
  // files first.
  gitCommit: env.SMT_GIT_COMMIT === 'true',
  gitBranch: env.SMT_GIT_BRANCH || 'main',

  origin: env.ORIGIN || 'https://simmodeltwin.net',

  assistant: {
    enabled: env.SMT_ASSISTANT_ENABLED === 'true',
    apiKey: env.ANTHROPIC_API_KEY || '',
    model: env.SMT_ASSISTANT_MODEL || 'claude-sonnet-4-5',
    // Server-side ceilings. The client never chooses any of these.
    maxTokensPerReply: Number(env.SMT_ASSISTANT_MAX_TOKENS || 900),
    maxTurnsPerSession: Number(env.SMT_ASSISTANT_MAX_TURNS || 40),
    maxCharsPerMessage: Number(env.SMT_ASSISTANT_MAX_CHARS || 4000),
    // THE control that matters. Everything else is optimisation on top of it.
    dailyTokenCeiling: Number(env.SMT_ASSISTANT_DAILY_TOKENS || 2_000_000),
    // Daily message allowance per student. There is no anonymous allowance:
    // the assistant refuses a request without a valid token.
    studentDailyMessages: Number(env.SMT_ASSISTANT_STUDENT_MSGS || 200)
  }
};
