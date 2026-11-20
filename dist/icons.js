(() => {
  const motifs = {
    crystal: '<path d="m12 1.5 7.5 8.8L15 19l-3 3.5L4.5 12z"/><path d="m12 1.5-1 10.2 8.5-1.4M11 11.7l1 10.8-7.5-10.5M11 11.7l4 7.3"/>',
    shield: '<path d="M12 2 20 5v6.5c0 5.2-4.8 8.7-8 10.5-3.2-1.8-8-5.3-8-10.5V5z"/><path d="M12 5v13M8 10h8"/>',
    swords: '<path d="m4 3 4 1 10 12-2 2L5 7zM15 19l4-4m-2 3 3 3m1-18-4 1-4 5m-4 5-3 3 2 2 4-5m-7 1 5 5m-3-2-3 3"/>',
    sound: '<path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
    mute: '<path d="M3 9h4l5-4v14l-5-4H3zM16 9l6 6m0-6-6 6"/>',
    book: '<path d="M3 4.5c3.5-1 6-.5 9 1.7 3-2.2 5.5-2.7 9-1.7V19c-3.5-1-6-.5-9 1.5-3-2-5.5-2.5-9-1.5zM12 6.5v14"/>',
    pause: '<path d="M7 5h3v14H7zm7 0h3v14h-3z" fill="currentColor" stroke="none"/>',
    play: '<path d="M6 3.8c0-.8.6-1.1 1.3-.7l13 8.1c.6.4.6 1.2 0 1.6l-13 8.1c-.7.4-1.3.1-1.3-.7z" fill="currentColor" stroke="none"/>',
    expand: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6M9 21H3v-6"/>',
    collapse: '<path d="M9 3v6H3m18 0h-6V3m0 18v-6h6M3 15h6v6"/>',
    mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v7"/>',
    compass:'<circle cx="12" cy="12" r="9"/><path d="m16 7-2.2 6.4L7 17l3.5-6.7z"/>',
    turret: '<path d="M3 20h18M6 17h12v3H6zM9 8h6v9H9zM10.5 6C8 4 11 2 12 1c-.2 2.2 3.7 3.8 1 5M6 12h3m6 0h3M5 9v5h3m11-5v5h-3"/>',
    waves:'<path d="m4 9 8-5 8 5m-16 5 8-5 8 5m-16 5 8-5 8 5"/>',
    skull:'<path d="M6 16c-2-1-3-3-3-6 0-4.5 4-7.5 9-7.5s9 3 9 7.5c0 3-1 5-3 6l-1 4H7z"/><path d="M8 11h1m6 0h1m-5 4 1-2 1 2m-3 2v3m3-3v3"/>',
    close:'<path d="m6 6 12 12m0-12L6 18"/>',
    up:'<path d="m4 14 8-8 8 8m-16 5 8-8 8 8"/>',
    check:'<path d="m4 12 5 6L20 6"/>'
  };
  globalThis.gameIcon = (name) => '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">'+(motifs[name] || '')+'</svg>';
  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = gameIcon(el.dataset.icon); });
})();
