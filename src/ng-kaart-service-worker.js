importScripts('https://storage.googleapis.com/workbox-cdn/releases/3.6.1/workbox-sw.js');

if (workbox) {
  console.log(`Workbox ingeladen`);
} else {
  console.log(`Workbox werd niet ingeladen`);
}

self.addEventListener('install', event =>  {
  console.log('install event received');
  event.waitUntil(self.skipWaiting()); // Activate worker immediately
});

self.addEventListener('activate', event =>  {
  console.log('activate event received');
  event.waitUntil(self.clients.claim()); // Become available to all pages
});

importScripts('workbox/index.js');
