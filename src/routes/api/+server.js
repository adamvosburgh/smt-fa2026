import { json } from '@sveltejs/kit';
export function GET() {
  return json({ ok: true, routes: ['/api/submit', '/api/assistant', '/api/doctor', '/api/data/*'] });
}
