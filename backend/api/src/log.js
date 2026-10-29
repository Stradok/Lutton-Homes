const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

// Error's name and message are not enumerable, so JSON.stringify would drop them.
function normalize(value) {
	if (value instanceof Error) return { name: value.name, message: value.message };
	return value;
}

export function createLogger({ level = 'info', write = (line) => process.stdout.write(line + '\n') } = {}) {
	const min = LEVELS[level] ?? LEVELS.info;

	function emit(name, message, fields = {}) {
		if (LEVELS[name] < min) return;
		const time = new Date().toISOString();
		let line;
		try {
			const out = { time, level: name, msg: String(message) };
			for (const [key, value] of Object.entries(fields)) out[key] = normalize(value);
			line = JSON.stringify(out);
		} catch {
			// Circular or unserialisable fields: keep the message so the event is not lost.
			line = JSON.stringify({ time, level: name, msg: String(message) });
		}
		try {
			write(line);
		} catch {
			// A broken sink must never take down the request that logged.
		}
	}

	return {
		debug: (message, fields) => emit('debug', message, fields),
		info: (message, fields) => emit('info', message, fields),
		warn: (message, fields) => emit('warn', message, fields),
		error: (message, fields) => emit('error', message, fields),
	};
}

export const log = createLogger({ level: process.env.LOG_LEVEL || 'info' });

export default log;
