// Entry point: node src/server.js. Starts the API and refreshes the Airbnb and Booking.com feeds on a timer.
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createStore } from './store.js';
import { syncAll } from './sync.js';

const config = loadConfig();
const store = createStore(config.dataFile);
createServer(createApp({ config, store })).listen(config.port, () => console.log(`Luton Homes API on :${config.port}`));

const sync = () => syncAll({ store, homes: config.homes }).then((r) => r.length && console.log('sync', JSON.stringify(r))).catch((e) => console.error('sync failed', e));
sync();
setInterval(sync, config.syncMinutes * 60_000).unref();
