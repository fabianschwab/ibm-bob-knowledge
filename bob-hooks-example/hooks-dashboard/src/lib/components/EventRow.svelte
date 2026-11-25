<script lang="ts">
	import {
		fmtDuration,
		fmtTime,
		metaFor,
		summarise,
		toolArg,
		type TimelineItem
	} from '#lib/events.ts';
	import type { HookEvent } from '#lib/types.ts';
	import ContentViewer from './ContentViewer.svelte';

	let { item, start, last }: { item: TimelineItem; start: number; last: boolean } = $props();

	const meta = $derived(
		item.kind === 'tool'
			? metaFor(item.post ? 'PostToolUse' : 'PreToolUse')
			: metaFor(item.event.hook_event_name)
	);
	const pending = $derived(item.kind === 'tool' && !item.post);

	// Strip `content` from tool_input before showing raw payload
	function stripContent(ev: HookEvent | undefined): HookEvent | undefined {
		if (!ev) return ev;
		const input = ev.tool_input;
		if (!input || typeof input !== 'object' || !('content' in input)) return ev;
		const { content: _c, ...rest } = input as Record<string, unknown>;
		return { ...ev, tool_input: rest };
	}

	const raw = $derived(
		item.kind === 'tool'
			? [stripContent(item.pre), stripContent(item.post)].filter((e) => !!e)
			: [item.event]
	);
	const toolName = $derived(
		item.kind === 'tool' ? String((item.pre ?? item.post)?.tool_name ?? 'tool') : ''
	);
	const response = $derived(
		item.kind === 'tool' && typeof item.post?.tool_response === 'string'
			? item.post.tool_response
			: ''
	);

	// Content viewer state
	const toolInput = $derived(
		item.kind === 'tool'
			? (((item.pre ?? item.post)?.tool_input as Record<string, unknown>) ?? {})
			: {}
	);
	const contentValue = $derived(
		typeof toolInput.content === 'string' ? toolInput.content : null
	);
	const contentFilename = $derived(
		typeof toolInput.path === 'string'
			? (toolInput.path as string).split('/').pop() ?? ''
			: typeof toolInput.file_path === 'string'
				? (toolInput.file_path as string).split('/').pop() ?? ''
				: ''
	);

	let viewerOpen = $state(false);
</script>

<li class="relative min-w-0 overflow-hidden pl-9">
	{#if !last}
		<span class="absolute top-5 bottom-[-1rem] left-[11px] w-px bg-white/10"></span>
	{/if}
	<span
		class="absolute top-[18px] left-[5px] grid size-3.5 place-items-center rounded-full bg-zinc-950 ring-2 ring-white/10"
	>
		<span class="size-2 rounded-full {meta.dot} {pending ? 'animate-pulse' : ''}"></span>
	</span>

	<details
		class="group min-w-0 rounded-xl border border-white/8 bg-white/3 transition hover:border-white/15 hover:bg-white/5"
	>
		<summary class="flex cursor-pointer list-none items-start gap-3 p-3.5">
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-center gap-2">
					<span
						class="rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide ring-1 ring-inset {meta.badge}"
					>
						{item.kind === 'tool' ? 'Tool call' : meta.label}
					</span>
					{#if item.kind === 'tool'}
						<span class="font-mono text-sm font-semibold text-zinc-100">{toolName}</span>
						{#if pending}
							<span class="text-xs text-amber-300/80">running…</span>
						{:else if item.durationMs !== undefined}
							<span class="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
								{fmtDuration(item.durationMs)}
							</span>
						{/if}
					{/if}
				</div>
				<p class="mt-1.5 line-clamp-2 text-sm break-all text-zinc-300">
					{#if item.kind === 'tool'}
						<span class="font-mono text-[13px] text-zinc-400">{toolArg(item.pre ?? item.post)}</span
						>
					{:else}
						{summarise(item.event)}
					{/if}
				</p>
			</div>
			<div class="shrink-0 text-right font-mono text-[11px] text-zinc-500">
				<div>{fmtTime(item.at)}</div>
				<div class="text-zinc-600">+{fmtDuration(item.at - start)}</div>
			</div>
		</summary>

		<div class="space-y-3 border-t border-white/8 p-3.5">
			{#if contentValue !== null}
				<div>
					<div class="mb-1 text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
						Content
					</div>
					<button
						onclick={() => (viewerOpen = true)}
						class="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300 transition hover:border-white/20 hover:bg-white/8 hover:text-zinc-100"
					>
						<svg width="13" height="13" viewBox="0 0 16 16" fill="none" class="shrink-0 text-zinc-400">
							<rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.3"/>
							<path d="M5 6l2.5 2L5 10M8.5 10h2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
						<span class="font-mono">{contentFilename || 'View content'}</span>
						<span class="ml-auto text-zinc-600">{contentValue.length.toLocaleString()} chars</span>
					</button>
				</div>
			{/if}
			{#if response}
				<div class="min-w-0">
					<div class="mb-1 text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
						Tool response
					</div>
					<pre
						class="max-h-60 max-w-full overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 font-mono text-xs text-zinc-300">{response}</pre>
				</div>
			{/if}
			{#each raw as ev (ev.id)}
				<div class="min-w-0">
					<div class="mb-1 text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
						{ev.hook_event_name} · raw payload
					</div>
					<pre
						class="max-h-72 max-w-full overflow-x-auto whitespace-pre rounded-lg bg-black/40 p-3 font-mono text-xs text-zinc-400">{JSON.stringify(
							ev,
							null,
							2
						)}</pre>
				</div>
			{/each}
		</div>
	</details>
</li>

{#if viewerOpen && contentValue !== null}
	<ContentViewer
		content={contentValue}
		filename={contentFilename}
		onclose={() => (viewerOpen = false)}
	/>
{/if}
