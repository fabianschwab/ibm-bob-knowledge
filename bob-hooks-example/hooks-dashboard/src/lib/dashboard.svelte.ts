import { groupSessions } from '#lib/events.ts';
import type { HookEvent } from '#lib/types.ts';

class Dashboard {
	events = $state.raw<HookEvent[]>([]);
	connected = $state(false);
	loaded = $state(false);
	selectedId = $state<string | null>(null);
	now = $state(Date.now());

	sessions = $derived(groupSessions(this.events));
	selected = $derived(
		this.sessions.find((s) => s.id === this.selectedId) ?? this.sessions[0] ?? null
	);

	#source?: EventSource;
	#tick?: ReturnType<typeof setInterval>;

	start() {
		this.#tick = setInterval(() => (this.now = Date.now()), 1000);
		fetch('/api/hooks')
			.then((r) => r.json())
			.then((initial: HookEvent[]) => {
				// Merge: SSE events may have arrived while the snapshot was in flight.
				const seen = new Set(initial.map((e) => e.id));
				this.events = [...initial, ...this.events.filter((e) => !seen.has(e.id))];
				this.loaded = true;
			});
		this.#source = new EventSource('/api/stream');
		this.#source.onopen = () => (this.connected = true);
		this.#source.onerror = () => (this.connected = false);
		this.#source.onmessage = (m) => {
			const e: HookEvent = JSON.parse(m.data);
			if (!this.events.some((x) => x.id === e.id)) this.events = [...this.events, e];
		};
	}

	stop() {
		this.#source?.close();
		clearInterval(this.#tick);
	}

	async clear() {
		await fetch('/api/hooks', { method: 'DELETE' });
		this.events = [];
		this.selectedId = null;
	}
}

export const dashboard = new Dashboard();
