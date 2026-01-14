(function initBurger() {
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.querySelector('.main-nav');

  // Хедер ещё не загружен include.js – подождём
  if (!toggle || !nav) {
    setTimeout(initBurger, 300);
    return;
  }

  // Чтобы не инициализировать несколько раз
  if (toggle.dataset.burgerInit === '1') return;
  toggle.dataset.burgerInit = '1';

  var label = toggle.querySelector('.menu-label');

  // Создаём мобильный портал в body и клонируем навигацию туда.
  // Это гарантирует, что мобильное меню не будет внутри стековых контекстов хедера.
  var portalId = 'mobile-nav-portal';
  var portal = document.getElementById(portalId);
  if (!portal) {
    portal = document.createElement('div');
    portal.id = portalId;
    document.body.appendChild(portal);
  }

  var mobileNav = nav.cloneNode(true);
  mobileNav.classList.add('mobile-portal-nav');
  portal.appendChild(mobileNav);

  // Helper: return the active nav depending on screen size
  function getActiveNav() {
    return window.innerWidth <= 768 ? mobileNav : nav;
  }

  // Toggle handler uses active nav
  toggle.addEventListener('click', function () {
    var activeNav = getActiveNav();
    var isOpen = activeNav.classList.toggle('nav-open');
    toggle.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

    if (label) {
      label.textContent = isOpen ? 'CLOSE' : 'MENU';
    }
  });

  // Закрываем меню при клике по пункту (для мобильного портала и оригинала)
  function attachCloseOnLink(container) {
    container.addEventListener('click', function (e) {
      if (e.target.tagName.toLowerCase() === 'a') {
        container.classList.remove('nav-open');
        toggle.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        if (label) label.textContent = 'MENU';
      }
    });
  }

  attachCloseOnLink(nav);
  attachCloseOnLink(mobileNav);

  // Mobile dropdown toggle: attach to both nav copies
  function attachDropdownToggles(container) {
    var triggers = container.querySelectorAll('.dropdown-trigger');
    triggers.forEach(function(trigger) {
      trigger.addEventListener('click', function(e) {
        // only intercept on mobile portal to avoid changing desktop behaviour
        if (container === mobileNav) {
          e.preventDefault();
          var dropdown = trigger.parentElement;
          var isActive = dropdown.classList.toggle('active');
          trigger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        }
      });
    });
  }

  attachDropdownToggles(nav);
  attachDropdownToggles(mobileNav);

  // Keep portal nav in sync when window is resized (optional cleanup)
  window.addEventListener('resize', function () {
    // close both navs on resize to avoid stuck states
    nav.classList.remove('nav-open');
    mobileNav.classList.remove('nav-open');
    toggle.classList.remove('is-open');
    if (label) label.textContent = 'MENU';
  });
})();
