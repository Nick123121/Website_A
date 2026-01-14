(function(){
  function ensureIndex(p){
    if(!p || p === '/') return '/index.html';
    return p;
  }

  function updateLangLinks(){
    const raw = window.location.pathname || '/';
    let path = raw;
    if(path === '' ) path = '/';
    // normalize multiple slashes
    path = path.replace(/\/+/g, '/');

    // treat '/eng' prefix as english
    const isEng = path.startsWith('/eng/');

    // build target hrefs
    const engHref = isEng ? ensureIndex(path) : ensureIndex('/eng' + (path === '/' ? '/index.html' : path));
    const trHref = isEng ? ensureIndex(path.replace(/^\/eng/, '') || '/') : ensureIndex(path);

    const container = document.querySelector('.top-lang-switch');
    if(!container) return;

    container.querySelectorAll('.lang-flag').forEach(a => {
      const lang = a.dataset.lang;
      if(!lang) return;
      if(lang === 'en') a.href = engHref;
      if(lang === 'tr') a.href = trHref;
      a.classList.toggle('active', (lang === 'en' && isEng) || (lang === 'tr' && !isEng));
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateLangLinks);
  else updateLangLinks();

  // header might be injected after load; observe and update once present
  const observer = new MutationObserver((mutations, obs) => {
    if(document.querySelector('.top-lang-switch')){
      updateLangLinks();
      obs.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
