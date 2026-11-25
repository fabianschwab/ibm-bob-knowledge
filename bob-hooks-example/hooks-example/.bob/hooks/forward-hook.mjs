let raw = "";
for await (const chunk of process.stdin) {
  raw += chunk;
}

try {
  await fetch("http://localhost:5173/api/hooks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw,
  });
} catch (_) {
  // Fail open silently if local server is down
}
