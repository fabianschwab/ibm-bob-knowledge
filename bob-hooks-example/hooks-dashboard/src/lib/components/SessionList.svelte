<script lang="ts">
	import { fmtAgo, fmtDuration, sessionStatus, type Session } from '#lib/events.ts';

	let {
		sessions,
		selectedId,
		now,
		onselect
	}: {
		sessions: Session[];
		selectedId: string | undefined;
		now: number;
		onselect: (id: string) => void;
	} = $props();

	const STATUS = {
		active: { dot: 'bg-emerald-400 animate-pulse', text: 'text-emerald-300', label: 'Active' },
		idle: { dot: 'bg-zinc-500', text: 'text-zinc-400', label: 'Idle' },
		completed: { dot: 'bg-sky-400', text: 'text-sky-300', label: 'Completed' }
	} as const;
</script>

<ul class="space-y-2">
	{#each sessions as s (s.id)}
		{@const st = STATUS[sessionStatus(s, now)]}
		<li>
			<button
				type="button"
				onclick={() => onselect(s.id)}
				aria-current={s.id === selectedId}
				class="w-full rounded-xl border p-3.5 text-left transition
					{s.id === selectedId
					? 'border-indigo-400/40 bg-indigo-400/10'
					: 'border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5'}"
			>
				<div class="flex items-center justify-between gap-2 text-[11px]">
					<span class="flex items-center gap-1.5 font-medium {st.text}">
						<span class="size-1.5 rounded-full {st.dot}"></span>{st.label}
					</span>
					<span class="text-zinc-500">{fmtAgo(s.end, now)}</span>
				</div>
				<p class="mt-2 line-clamp-2 text-sm font-medium text-zinc-100">{s.title}</p>
				<p class="mt-1 truncate font-mono text-[11px] text-zinc-500" title={s.id}>{s.id}</p>
				<div class="mt-2.5 flex items-center gap-3 text-[11px] text-zinc-400">
					<span>{s.events.length} events</span>
					<span>{s.toolCalls} {s.toolCalls === 1 ? 'tool' : 'tools'}</span>
					<span class="ml-auto font-mono text-zinc-500">{fmtDuration(s.end - s.start)}</span>
				</div>
			</button>
		</li>
	{/each}
</ul>
