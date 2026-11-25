import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { HookEvent } from '#lib/types.ts';

const FILE = process.env.HOOKS_DATA_FILE ?? 'data/events.jsonl';
// ponytail: whole history lives in memory, capped; swap for SQLite if you need more.
const MAX_EVENTS = 5000;

type Listener = (event: HookEvent) => void;
interface State {
	events: HookEvent[];
	listeners: Set<Listener>;
}

// Survive Vite HMR: one state object per process.
const g = globalThis as unknown as { __hooksState?: State };

function load(): State {
	const events: HookEvent[] = [];
	if (existsSync(FILE)) {
		for (const line of readFileSync(FILE, 'utf8').split('\n')) {
			if (!line.trim()) continue;
			try {
				events.push(JSON.parse(line));
			} catch {
				// skip corrupt line
			}
		}
	}
	return { events: events.slice(-MAX_EVENTS), listeners: new Set() };
}

const state = (g.__hooksState ??= load());

export function getEvents(): HookEvent[] {
	return state.events;
}

/** Normalise an arbitrary JSON payload into a stored event. Returns null if it isn't an object. */
export function addEvent(payload: unknown): HookEvent | null {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
	const p = payload as Record<string, unknown>;
	const event: HookEvent = {
		...p,
		id: crypto.randomUUID(),
		received_at: new Date().toISOString(),
		session_id: typeof p.session_id === 'string' && p.session_id ? p.session_id : 'unknown',
		hook_event_name:
			typeof p.hook_event_name === 'string' && p.hook_event_name ? p.hook_event_name : 'Unknown'
	};
	state.events.push(event);
	if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
	mkdirSync(dirname(FILE), { recursive: true });
	appendFileSync(FILE, JSON.stringify(event) + '\n');
	for (const fn of state.listeners) fn(event);
	return event;
}

export function clearEvents() {
	state.events.length = 0;
	mkdirSync(dirname(FILE), { recursive: true });
	writeFileSync(FILE, '');
}

export function subscribe(fn: Listener): () => void {
	state.listeners.add(fn);
	return () => state.listeners.delete(fn);
}
