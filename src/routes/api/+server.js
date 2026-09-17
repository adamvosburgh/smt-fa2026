import { json } from '@sveltejs/kit';
export function GET() {
  return json({
    ok: true,
    routes: [
      '/api/submit',
      '/api/assistant',
      '/api/doctor',
      '/api/data/*',
      '/api/submissions',
      '/api/boards',
      '/api/boards/[slug]',
      '/api/boards/[slug]/exists',
      '/api/boards/[slug]/ops',
      '/api/boards/[slug]/events',
      '/api/boards/[slug]/cursor',
      '/api/boards/[slug]/assets',
      '/api/boards/[slug]/assets/[file]',
      '/api/boards/[slug]/generate'
    ]
  });
}
