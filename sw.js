// Service worker: permite instalar o app e abrir sem internet.
// Estratégia "rede primeiro": sempre tenta a versão mais nova; sem internet, usa a última cópia guardada.
// Os dados do usuário NÃO passam por aqui (ficam no localStorage).

const CACHE = 'painel-da-vida-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    for (const nome of await caches.keys()) if (nome !== CACHE) await caches.delete(nome);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  evento.respondWith((async () => {
    try {
      const resposta = await fetch(req, { cache: 'no-cache' });
      if (resposta.ok) (await caches.open(CACHE)).put(req, resposta.clone());
      return resposta;
    } catch {
      const guardada = await caches.match(req, { ignoreSearch: true });
      if (guardada) return guardada;
      if (req.mode === 'navigate') return (await caches.match('./')) || (await caches.match('./index.html'));
      throw new Error('Sem conexão e sem cópia guardada.');
    }
  })());
});
