<script lang="ts">
	import { onMount } from 'svelte';
	import { dashboard as d } from '#lib/dashboard.svelte.ts';
	import SessionList from '#lib/components/SessionList.svelte';
	import SessionDetail from '#lib/components/SessionDetail.svelte';

	onMount(() => {
		d.start();
		return () => d.stop();
	});

	const activeCount = $derived(
		d.sessions.filter((s) => s.lastEventName !== 'Stop' && d.now - s.end < 120_000).length
	);
	const toolTotal = $derived(d.sessions.reduce((n, s) => n + s.toolCalls, 0));
	const endpoint = $derived(`${location.origin}/api/hooks`);
</script>

<svelte:head>
	<title>Bob hooks dashboard</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-200 antialiased">
	<div
		class="pointer-events-none fixed inset-0 bg-[radial-gradient(60rem_30rem_at_20%_-10%,--alpha(var(--color-indigo-500)/15%),transparent),radial-gradient(40rem_25rem_at_90%_0%,--alpha(var(--color-fuchsia-500)/10%),transparent)]"
	></div>

	<header class="sticky top-0 z-10 border-b border-white/8 bg-zinc-950/80 backdrop-blur">
		<div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5">
			<div class="flex items-center gap-2.5">
				<div
					class="grid size-8 place-items-center rounded-lg bg-linear-to-br from-indigo-500 to-fuchsia-500 text-sm font-bold text-white"
				>
					B
				</div>
				<h1 class="text-base font-semibold text-zinc-50">Bob hooks</h1>
			</div>

			<div class="flex items-center gap-5 text-xs text-zinc-400">
				<span><b class="font-mono text-zinc-100">{d.sessions.length}</b> sessions</span>
				<span><b class="font-mono text-emerald-300">{activeCount}</b> active</span>
				<span><b class="font-mono text-zinc-100">{d.events.length}</b> events</span>
				<span
					><b class="font-mono text-zinc-100">{toolTotal}</b> tool {toolTotal === 1
						? 'call'
						: 'calls'}</span
				>
			</div>

			<div class="ml-auto flex items-center gap-3">
				<span class="flex items-center gap-1.5 text-xs text-zinc-400">
					<span class="size-2 rounded-full {d.connected ? 'bg-emerald-400' : 'bg-rose-500'}"></span>
					{d.connected ? 'Live' : 'Reconnecting…'}
				</span>
				<button
					type="button"
					onclick={() => confirm('Delete all captured events?') && d.clear()}
					disabled={!d.events.length}
					class="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/5 disabled:opacity-40"
				>
					Clear
				</button>
			</div>
		</div>
	</header>

	<main class="relative mx-auto max-w-7xl px-5 py-6">
		{#if !d.loaded}
			<p class="py-24 text-center text-sm text-zinc-500">Loading…</p>
		{:else if !d.sessions.length}
			<div
				class="mx-auto mt-16 max-w-xl rounded-2xl border border-dashed border-white/15 p-10 text-center"
			>
				<div class="mx-auto mb-4 size-3 animate-pulse rounded-full bg-indigo-400"></div>
				<h2 class="text-lg font-semibold text-zinc-100">Waiting for hook events…</h2>
				<p class="mt-2 text-sm text-zinc-400">POST Bob hook payloads as JSON to</p>
				<code class="mt-3 block rounded-lg bg-black/40 px-3 py-2 font-mono text-sm text-indigo-300">
					{endpoint}
				</code>
				<p class="mt-4 text-xs text-zinc-500">
					Or run <code class="font-mono text-zinc-300">npm run seed</code> to load sample data.
				</p>
			</div>
		{:else}
			<div class="grid gap-6 lg:grid-cols-[22rem_1fr]">
				<aside
					class="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-1"
				>
					<h2 class="mb-3 text-xs font-medium tracking-wider text-zinc-500 uppercase">Sessions</h2>
					<SessionList
						sessions={d.sessions}
						selectedId={d.selected?.id}
						now={d.now}
						onselect={(id) => (d.selectedId = id)}
					/>
				</aside>
				{#if d.selected}
					<div class="min-w-0">
						{#key d.selected.id}
							<SessionDetail session={d.selected} now={d.now} />
						{/key}
					</div>
				{/if}
			</div>
		{/if}
	</main>
</div>
