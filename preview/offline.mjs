// Registers only the standalone game scope. Local saves never enter the cache.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'}).catch(() => {});
