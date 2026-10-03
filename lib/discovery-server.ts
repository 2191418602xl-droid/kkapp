import { env } from 'cloudflare:workers';
export function discoveryDatabase() { return (env as unknown as { DB: D1Database }).DB; }
