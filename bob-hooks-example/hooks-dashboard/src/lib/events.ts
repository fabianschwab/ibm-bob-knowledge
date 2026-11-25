import type { HookEvent } from '#lib/types.ts';

export interface EventMeta {
	label: string;
	hint: string;
	/** Full class strings so Tailwind can see them. */
	dot: string;
	text: string;
	badge: string;
}

export const EVENT_META: Record<string, EventMeta> = {
	SessionStart: {
		label: 'Session start',
		hint: 'A task started, resumed or finished compaction',
		dot: 'bg-emerald-400',
		text: 'text-emerald-300',
		badge: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30'
	},
	UserPromptSubmit: {
		label: 'Prompt',
		hint: 'User submitted a prompt',
		dot: 'bg-sky-400',
		text: 'text-sky-300',
		badge: 'bg-sky-400/10 text-sky-300 ring-sky-400/30'
	},
	PreToolUse: {
		label: 'Pre-tool',
		hint: 'Before a tool runs',
		dot: 'bg-amber-400',
		text: 'text-amber-300',
		badge: 'bg-amber-400/10 text-amber-300 ring-amber-400/30'
	},
	PostToolUse: {
		label: 'Post-tool',
		hint: 'After a tool succeeded',
		dot: 'bg-violet-400',
		text: 'text-violet-300',
		badge: 'bg-violet-400/10 text-violet-300 ring-violet-400/30'
	},
	PreCompact: {
		label: 'Pre-compact',
		hint: 'Before context compaction',
		dot: 'bg-fuchsia-400',
		text: 'text-fuchsia-300',
		badge: 'bg-fuchsia-400/10 text-fuchsia-300 ring-fuchsia-400/30'
	},
	PostCompact: {
		label: 'Post-compact',
		hint: 'After context compaction',
		dot: 'bg-pink-400',
		text: 'text-pink-300',
		badge: 'bg-pink-400/10 text-pink-300 ring-pink-400/30'
	},
	Stop: {
		label: 'Stop',
		hint: 'The task loop finished',
		dot: 'bg-rose-400',
		text: 'text-rose-300',
		badge: 'bg-rose-400/10 text-rose-300 ring-rose-400/30'
	}
};

const FALLBACK: EventMeta = {
	label: 'Event',
	hint: 'Unrecognised hook event',
	dot: 'bg-zinc-400',
	text: 'text-zinc-300',
	badge: 'bg-zinc-400/10 text-zinc-300 ring-zinc-400/30'
};

export const metaFor = (name: string): EventMeta =>
	EVENT_META[name] ?? { ...FALLBACK, label: name };

type ToolItem = {
	kind: 'tool';
	key: string;
	at: number;
	pre?: HookEvent;
	post?: HookEvent;
	durationMs?: number;
};

/** A PreToolUse/PostToolUse pair (joined on tool_use_id), or a lone event. */
export type TimelineItem = ToolItem | { kind: 'event'; key: string; at: number; event: HookEvent };

export type SessionStatus = 'active' | 'idle' | 'completed';

export interface Session {
	id: string;
	events: HookEvent[];
	items: TimelineItem[];
	start: number;
	end: number;
	cwd?: string;
	title: string;
	toolCalls: number;
	prompts: number;
	compactions: number;
	counts: Record<string, number>;
	lastEventName: string;
}

const ACTIVE_WINDOW_MS = 2 * 60_000;

export const ts = (e: HookEvent) => Date.parse(e.received_at);

export function sessionStatus(s: Session, now: number): SessionStatus {
	if (s.lastEventName === 'Stop') return 'completed';
	return now - s.end < ACTIVE_WINDOW_MS ? 'active' : 'idle';
}

const asRecord = (v: unknown): Record<string, unknown> =>
	v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** Pick the most meaningful single field from a tool's input. */
export function toolArg(e: HookEvent | undefined): string {
	const input = asRecord(e?.tool_input);
	for (const k of ['command', 'path', 'file_path', 'pattern', 'query', 'url', 'regex']) {
		if (typeof input[k] === 'string') return input[k] as string;
	}
	const first = Object.values(input).find((v) => typeof v === 'string');
	return typeof first === 'string' ? first : '';
}

export function summarise(e: HookEvent): string {
	switch (e.hook_event_name) {
		case 'SessionStart':
			return `source: ${e.source ?? '—'}`;
		case 'UserPromptSubmit':
			return truncate(String(e.prompt ?? ''), 160);
		case 'PreCompact':
			return `trigger: ${e.trigger ?? '—'}`;
		case 'PostCompact':
			return truncate(String(e.compact_summary ?? `trigger: ${e.trigger ?? '—'}`), 160);
		case 'Stop':
			return truncate(String(e.last_assistant_message ?? 'Task loop ended'), 160);
		case 'PreToolUse':
		case 'PostToolUse':
			return `${e.tool_name ?? 'tool'} ${truncate(toolArg(e), 140)}`;
		default:
			return '';
	}
}

export function buildItems(events: HookEvent[]): TimelineItem[] {
	const items: TimelineItem[] = [];
	const byToolId = new Map<string, ToolItem>();
	for (const e of events) {
		const name = e.hook_event_name;
		const id = typeof e.tool_use_id === 'string' ? e.tool_use_id : undefined;
		if (name === 'PreToolUse' || name === 'PostToolUse') {
			let item = id ? byToolId.get(id) : undefined;
			if (!item) {
				item = { kind: 'tool', key: id ?? e.id, at: ts(e) };
				items.push(item);
				if (id) byToolId.set(id, item);
			}
			if (name === 'PreToolUse') item.pre = e;
			else item.post = e;
			if (item.pre && item.post) item.durationMs = ts(item.post) - ts(item.pre);
		} else {
			items.push({ kind: 'event', key: e.id, at: ts(e), event: e });
		}
	}
	return items;
}

export function groupSessions(events: HookEvent[]): Session[] {
	const groups = new Map<string, HookEvent[]>();
	for (const e of events) {
		const list = groups.get(e.session_id);
		if (list) list.push(e);
		else groups.set(e.session_id, [e]);
	}
	const sessions: Session[] = [];
	for (const [id, evs] of groups) {
		evs.sort((a, b) => ts(a) - ts(b));
		const counts: Record<string, number> = {};
		for (const e of evs) counts[e.hook_event_name] = (counts[e.hook_event_name] ?? 0) + 1;
		const firstPrompt = evs.find((e) => e.hook_event_name === 'UserPromptSubmit');
		const cwd = evs.find((e) => e.cwd)?.cwd;
		sessions.push({
			id,
			events: evs,
			items: buildItems(evs),
			start: ts(evs[0]),
			end: ts(evs[evs.length - 1]),
			cwd,
			title: firstPrompt
				? truncate(String(firstPrompt.prompt ?? ''), 80)
				: cwd
					? (cwd.split('/').filter(Boolean).pop() ?? id)
					: id,
			toolCalls: (counts.PreToolUse ?? 0) || (counts.PostToolUse ?? 0),
			prompts: counts.UserPromptSubmit ?? 0,
			compactions: counts.PostCompact ?? 0,
			counts,
			lastEventName: evs[evs.length - 1].hook_event_name
		});
	}
	return sessions.sort((a, b) => b.end - a.end);
}

export function fmtDuration(ms: number): string {
	if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
	const s = ms / 1000;
	if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ${Math.round(s % 60)}s`;
	return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export const fmtTime = (ms: number) =>
	new Date(ms).toLocaleTimeString([], {
		hour12: false,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});

export function fmtAgo(ms: number, now: number): string {
	const d = now - ms;
	return d < 5000 ? 'just now' : `${fmtDuration(d)} ago`;
}
