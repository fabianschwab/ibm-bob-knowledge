<script lang="ts">
	import { fmtDuration, fmtTime, metaFor, sessionStatus, type Session } from '#lib/events.ts';
	import EventRow from './EventRow.svelte';

	let { session, now }: { session: Session; now: number } = $props();

	let newestFirst = $state(false);
	const items = $derived(newestFirst ? [...session.items].reverse() : session.items);
	const status = $derived(sessionStatus(session, now));
	const mix = $derived(Object.entries(session.counts).sort((a, b) => b[1] - a[1]));
	const total = $derived(session.events.length);
	const stats = $derived([
		['Started', fmtTime(session.start)],
		['Duration', fmtDuration(session.end - session.start)],
		['Prompts', session.prompts],
		['Tool calls', session.toolCalls],
		['Compactions', session.compactions]
	]);
</script>

<section>
	<header class="rounded-2xl border border-white/8 bg-white/3 p-5">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="min-w-0">
				<h2 class="text-lg font-semibold text-zinc-50">{session.title}</h2>
				<p class="mt-1 font-mono text-xs break-all text-zinc-500">{session.id}</p>
				{#if session.cwd}
					<p class="mt-0.5 font-mono text-xs break-all text-zinc-600">{session.cwd}</p>
				{/if}
			</div>
			<span
				class="rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset
				{status === 'active'
					? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30'
					: status === 'completed'
						? 'bg-sky-400/10 text-sky-300 ring-sky-400/30'
						: 'bg-zinc-400/10 text-zinc-300 ring-zinc-400/30'}"
			>
				{status}
			</span>
		</div>

		<dl class="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
			{#each stats as [label, value] (label)}
				<div>
					<dt class="text-[11px] tracking-wider text-zinc-500 uppercase">{label}</dt>
					<dd class="mt-0.5 font-mono text-lg text-zinc-100">{value}</dd>
				</div>
			{/each}
		</dl>

		<div class="mt-5 flex h-2 overflow-hidden rounded-full bg-white/5">
			{#each mix as [name, count] (name)}
				<div
					class={metaFor(name).dot}
					style:width="{(count / total) * 100}%"
					title="{name}: {count}"
				></div>
			{/each}
		</div>
		<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400">
			{#each mix as [name, count] (name)}
				<span class="flex items-center gap-1.5">
					<span class="size-2 rounded-full {metaFor(name).dot}"></span>{name}
					<span class="font-mono text-zinc-500">{count}</span>
				</span>
			{/each}
		</div>
	</header>

	<div class="mt-6 mb-3 flex items-center justify-between">
		<h3 class="text-sm font-medium text-zinc-300">Timeline</h3>
		<button
			type="button"
			onclick={() => (newestFirst = !newestFirst)}
			class="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
		>
			{newestFirst ? 'Newest first ↓' : 'Oldest first ↑'}
		</button>
	</div>

	<ol class="space-y-4">
		{#each items as item, i (item.key)}
			<EventRow {item} start={session.start} last={i === items.length - 1} />
		{/each}
	</ol>
</section>
