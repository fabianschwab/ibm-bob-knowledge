<script lang="ts">
	import { onMount } from 'svelte';
	import hljs from 'highlight.js';

	let {
		content,
		filename = '',
		onclose
	}: { content: string; filename?: string; onclose: () => void } = $props();

	let dialog: HTMLDialogElement;
	let highlighted = $state('');
	let language = $state('');

	function detectLang(name: string): string {
		const ext = name.split('.').pop()?.toLowerCase() ?? '';
		const map: Record<string, string> = {
			js: 'javascript',
			mjs: 'javascript',
			cjs: 'javascript',
			ts: 'typescript',
			mts: 'typescript',
			svelte: 'xml',
			html: 'html',
			css: 'css',
			scss: 'scss',
			json: 'json',
			md: 'markdown',
			sh: 'bash',
			bash: 'bash',
			zsh: 'bash',
			py: 'python',
			rb: 'ruby',
			go: 'go',
			rs: 'rust',
			java: 'java',
			kt: 'kotlin',
			toml: 'ini',
			yaml: 'yaml',
			yml: 'yaml',
			sql: 'sql',
			xml: 'xml',
			tf: 'hcl',
			hcl: 'hcl'
		};
		return map[ext] ?? '';
	}

	onMount(() => {
		const lang = detectLang(filename);
		try {
			const result = lang
				? hljs.highlight(content, { language: lang, ignoreIllegals: true })
				: hljs.highlightAuto(content);
			highlighted = result.value;
			language = result.language ?? lang;
		} catch {
			highlighted = escapeHtml(content);
			language = '';
		}
		dialog.showModal();
	});

	function escapeHtml(s: string) {
		return s
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

	function handleBackdrop(e: MouseEvent) {
		if (e.target === dialog) onclose();
	}
</script>

<!-- highlight.js github-dark theme, scoped via the dialog -->
<style>
	@import 'highlight.js/styles/github-dark.css';

	dialog {
		background: #0d1117;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		padding: 0;
		width: min(90vw, 900px);
		max-height: 85vh;
		display: flex;
		flex-direction: column;
		color: #e6edf3;
		font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
	}

	dialog::backdrop {
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(2px);
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		flex-shrink: 0;
	}

	.filename {
		font-size: 13px;
		font-weight: 600;
		color: #e6edf3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.lang-badge {
		font-size: 11px;
		padding: 2px 8px;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.08);
		color: #8b949e;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		flex-shrink: 0;
		margin-left: 8px;
	}

	.close-btn {
		margin-left: 12px;
		flex-shrink: 0;
		cursor: pointer;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		color: #8b949e;
		width: 28px;
		height: 28px;
		display: grid;
		place-items: center;
		transition: background 0.15s;
	}

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.12);
		color: #e6edf3;
	}

	.code-scroll {
		overflow: auto;
		flex: 1;
	}

	pre {
		margin: 0;
		padding: 16px;
		font-size: 12.5px;
		line-height: 1.6;
		tab-size: 2;
		/* hljs sets background on .hljs — override so our dialog bg shows */
		background: transparent !important;
	}

	pre code.hljs {
		background: transparent !important;
		padding: 0;
	}
</style>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dialog} onclick={handleBackdrop}>
	<div class="header">
		<span class="filename">{filename || 'content'}</span>
		{#if language}
			<span class="lang-badge">{language}</span>
		{/if}
		<button class="close-btn" onclick={onclose} aria-label="Close">
			<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
				<path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
			</svg>
		</button>
	</div>
	<div class="code-scroll">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<pre><code class="hljs">{@html highlighted}</code></pre>
	</div>
</dialog>
