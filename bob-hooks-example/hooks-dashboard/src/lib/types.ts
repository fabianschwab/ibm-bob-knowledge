/** Payload POSTed by a Bob hook. Only these three fields are guaranteed; the rest depends on the event. */
export interface HookEvent {
	/** Assigned by the dashboard on ingest. */
	id: string;
	/** ISO timestamp assigned by the dashboard on ingest. */
	received_at: string;
	session_id: string;
	hook_event_name: string;
	cwd?: string;
	[key: string]: unknown;
}
