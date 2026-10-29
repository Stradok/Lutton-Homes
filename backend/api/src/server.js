// Entry point: node src/server.js. Starts the API and re-reads the Airbnb and Booking.com calendars on a timer.
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createStore } from './store.js';
import { createRefresher, syncAll } from './sync.js';
import { listHomes } from './homes.js';
import { createNotifier } from './notify.js';
import { assertConfig } from './validate.js';
import { log } from './log.js';

const config = loadConfig();
// In production a bad or missing setting stops the server now, with the reason, instead of failing on the first request.
try { assertConfig(config); } catch (err) { log.error('refusing to start: fix these settings', { problems: err.message.split('\n') }); process.exit(1); }

const store = createStore(config.dataFile);
const notify = createNotifier({ mailer: config.mailProvider, ownerEmail: config.ownerEmail, homes: () => listHomes(store, config.seedHomes) });
const refresh = createRefresher({ store, homes: config.homes, notify });
const server = createServer(createApp({ config, store, notify, refresh }));
server.listen(config.port, () => log.info('api listening', { port: config.port }));

const sync = () => syncAll({ store, homes: config.homes, notify }).then((r) => r.length && log.info('calendars checked', { results: r })).catch((err) => log.error('calendar check failed', { err }));
sync();
const timer = setInterval(sync, config.syncMinutes * 60_000);
timer.unref();

// On a stop signal finish the requests in flight, then exit. Writes are atomic, so a hard stop is also safe.
for (const signal of ['SIGTERM', 'SIGINT']) {
	process.on(signal, () => {
		log.info('stopping', { signal });
		clearInterval(timer);
		server.close(() => process.exit(0));
		setTimeout(() => process.exit(0), 10_000).unref();
	});
}
