import { subscribe } from '#lib/server/store.ts';
import type { RequestHandler } from './$types';

/** Server-Sent Events feed of newly ingested events. */
export const GET: RequestHandler = () => {
	const enc = new TextEncoder();
	let unsubscribe: (() => void) | undefined;
	let heartbeat: ReturnType<typeof setInterval> | undefined;

	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(enc.encode(': connected\n\n'));
			unsubscribe = subscribe((event) =>
				controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`))
			);
			heartbeat = setInterval(() => controller.enqueue(enc.encode(': ping\n\n')), 15_000);
		},
		cancel() {
			unsubscribe?.();
			clearInterval(heartbeat);
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive'
		}
	});
};
