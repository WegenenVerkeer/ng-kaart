importScripts('https://storage.googleapis.com/workbox-cdn/releases/3.6.1/workbox-sw.js');

if (workbox) {
  console.log(`Yay! Workbox is loaded 🎉`);
} else {
  console.log(`Boo! Workbox didn't load 😬`);
}

// workbox.setConfig({
//   debug: true
// });

// initialise modules: see https://developers.google.com/web/tools/workbox/modules/workbox-sw#avoid_async_imports
const { strategies, routing, core } = workbox;

core.setLogLevel(core.LOG_LEVELS.debug);

self.addEventListener('install', function(event) {
  log('install event received');
  event.waitUntil(self.skipWaiting()); // Activate worker immediately
});

self.addEventListener('activate', function(event) {
  log('activate event received');
  event.waitUntil(self.clients.claim()); // Become available to all pages
});

self.addEventListener('message', event => {
  const { data: { action, payload } } = event;
  switch (action) {
    case 'REGISTER_ROUTE':
      const { requestPattern, cacheName } = payload;
      info(`Routing ${requestPattern} to cache ${cacheName}`);
      routing.registerRoute(
        new RegExp(requestPattern),
        strategies.cacheFirst({
          cacheName: cacheName
        })
      );
      break;
    case 'DELETE_CACHE':
      info('DELETE_CACHE received');
      caches.delete(payload);
      break;
    default:
      logComm('Unrecognised message received', event.data);
  }
});

const makelog = (f, prefix = '', css = []) => (...args) =>
  f.apply(null, [
    `%cServiceWorker %c${prefix ? ' ' + prefix.padStart(8) + ' ' : ''}%c`,
    `font-weight:bold`,
    `${css.join(';')}`,
    '',
    ...args
  ]);

const [ log, error, warn, info, logComm ] = [
  makelog(console.log),
  makelog(console.error, 'ERR', [ 'background:red', 'color:white' ]),
  makelog(console.warn, 'WARN', [ 'color:orange' ]),
  makelog(console.info, 'INFO', [ 'color:lightblue' ]),
  makelog(console.log, 'RX/TX', [ 'background:black', 'color:magenta' ])
];
