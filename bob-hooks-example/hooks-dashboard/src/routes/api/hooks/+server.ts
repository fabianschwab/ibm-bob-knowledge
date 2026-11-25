import { error, json } from '@sveltejs/kit';
import { addEvent, clearEvents, getEvents } from '#lib/server/store.ts';
import type { RequestHandler } from './$types';

/** Ingest endpoint for Bob hooks. Accepts one JSON object or an array of them. */
export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		error(400, 'Body must be valid JSON');
	}
	const items = Array.isArray(body) ? body : [body];
	const stored = items.map(addEvent).filter((e) => e !== null);
	if (!stored.length) error(400, 'Body must be a JSON object (or array of objects)');
	return json({ ok: true, stored: stored.length }, { status: 201 });
};

export const GET: RequestHandler = () => json(getEvents());

export const DELETE: RequestHandler = () => {
	clearEvents();
	return json({ ok: true });
};
