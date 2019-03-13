// workbox plugin file. Include this file to enrich your service worker.
// see: https://collab.mow.vlaanderen.be/gitlab/Groen/elisa-ng/blob/develop/modules/elisa-ng-ui/WORKBOX.md

// initialise modules: see https://developers.google.com/web/tools/workbox/modules/workbox-sw#avoid_async_imports
const { strategies, routing, core } = workbox;

self.addEventListener('message', event => {
  const { data: { action, payload } } = event;
  switch (action) {
    case 'REGISTER_ROUTE':
      const { requestPattern, cacheName } = payload;
      info(`Routing ${requestPattern} to cache ${cacheName}`);
      const handler = strategies.cacheFirst({
          cacheName: cacheName,
          plugins: ngKaartRoutePlugins ? ngKaartRoutePlugins : []
      });
      routing.registerRoute(new RegExp(requestPattern), handler);
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
