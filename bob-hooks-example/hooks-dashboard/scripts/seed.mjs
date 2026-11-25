// Posts a few realistic Bob hook payloads to the dashboard. Usage: npm run seed [-- http://localhost:5173]
const base = process.argv[2] ?? 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const post = (payload) =>
	fetch(`${base}/api/hooks`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	}).then((r) => {
		if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
	});

async function session(id, cwd, prompt, tools) {
	const base = { session_id: id, cwd };
	await post({ ...base, hook_event_name: 'SessionStart', source: 'startup' });
	await sleep(150);
	await post({ ...base, hook_event_name: 'UserPromptSubmit', prompt });
	for (const [i, [tool_name, tool_input, tool_response, ms]] of tools.entries()) {
		const tool_use_id = `${id}-tool-${i}`;
		await post({ ...base, hook_event_name: 'PreToolUse', tool_name, tool_input, tool_use_id });
		await sleep(ms);
		await post({
			...base,
			hook_event_name: 'PostToolUse',
			tool_name,
			tool_input,
			tool_use_id,
			tool_response
		});
		await sleep(100);
	}
	await post({
		...base,
		hook_event_name: 'Stop',
		last_assistant_message: 'Done. All changes are in place and checks pass.'
	});
}

await Promise.all([
	session(
		'task-7f3a91c2',
		'/Users/me/projects/shop-api',
		'Add rate limiting to the /orders endpoint',
		[
			['read_file', { path: 'src/routes/orders.ts' }, 'export const orders = …', 300],
			['apply_diff', { path: 'src/routes/orders.ts' }, 'Edited file', 700],
			['execute_command', { command: 'npm test' }, '12 passed', 1800]
		]
	),
	session('task-b21e04d8', '/Users/me/projects/hooks-dashboard', 'Fix the sidebar layout bug', [
		['grep', { pattern: 'sidebar' }, '3 matches', 250],
		['write_file', { path: 'src/lib/Sidebar.svelte' }, 'Created file', 500]
	])
]);

// A session that is still running: PreToolUse with no PostToolUse yet.
const live = { session_id: 'task-live-5c8d', cwd: '/Users/me/projects/infra' };
await post({ ...live, hook_event_name: 'SessionStart', source: 'startup' });
await post({ ...live, hook_event_name: 'UserPromptSubmit', prompt: 'Plan the VPC migration' });
await post({
	...live,
	hook_event_name: 'PreToolUse',
	tool_name: 'execute_command',
	tool_input: { command: 'terraform plan' },
	tool_use_id: 'live-1'
});
console.log(`Seeded sample events to ${base}`);
