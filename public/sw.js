self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => {
  self.registration.unregister().then(() => {
    return self.clients.matchAll({ type: 'window' });
  }).then(clients => {
    for (const client of clients) client.navigate(client.url);
  });
});
