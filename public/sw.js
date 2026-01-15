const CACHE_NAME = 'top-brasil-v3';

// Lista de URLs para cache - apenas assets estáticos do app shell
const urlsToCache = [
  '/',
  '/admin/dashboard',
  '/admin/leads',
  '/admin/pipeline',
  '/admin/ranking',
  '/admin/settings',
];

// Lista de padrões de URL que NÃO devem ser cacheados (APIs, backend)
const noCachePatterns = [
  /\.supabase\.co/,           // Todas as chamadas Supabase
  /supabase/,                  // Supabase em geral
  /\/rest\//,                  // APIs REST
  /\/auth\//,                  // Autenticação
  /\/storage\//,               // Storage
  /api\./,                     // APIs externas
  /\/functions\//,             // Edge functions
];

// Verifica se a URL deve ser cacheada
function shouldCache(url) {
  // Nunca cachear APIs e backend
  for (const pattern of noCachePatterns) {
    if (pattern.test(url)) {
      return false;
    }
  }
  return true;
}

// Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('✅ Cache aberto');
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activate - limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch - Network first, cache apenas para assets estáticos
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) return;

  // NÃO cachear chamadas de API/backend - sempre ir direto na rede
  if (!shouldCache(event.request.url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Para assets estáticos: network first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Check if we received a valid response
        if (!response || response.status !== 200) {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request);
      })
  );
});
