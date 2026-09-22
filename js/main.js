/* ==========================================================================
   THE BALD GUY — Prototype interactions
   Vanilla JS. No framework, no backend. Cart state persists in localStorage
   only so the drawer survives a refresh during review; this is NOT a real
   cart and will be replaced by Shopify's cart/ajax API at implementation time.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------------
   * CONFIG — editable prototype values
   * ------------------------------------------------------------------- */
  var CONFIG = {
    FREE_SHIPPING_THRESHOLD: 40, // EUR — fictional, for prototype only
    CURRENCY: '€',
    PRODUCT: {
      id: 'clean-01',
      name: '01 CLEAN',
      variant: 'Daily Scalp Cleanser · 200ml',
      priceOneTime: 24.95,
      priceSubscribe: 22.45
    },
    EMAIL_POPUP_SCROLL_PERCENT: 0.45,
    EMAIL_POPUP_DELAY_MS: 30000
  };

  var money = function (n) {
    return CONFIG.CURRENCY + n.toFixed(2).replace('.', ',');
  };

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------
   * Utilities
   * ------------------------------------------------------------------- */
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function trapFocus(container) {
    var focusable = qsa('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', container)
      .filter(function (el) { return el.offsetParent !== null; });
    if (!focusable.length) return function () {};
    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    function onKeydown(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    container.addEventListener('keydown', onKeydown);
    return function () { container.removeEventListener('keydown', onKeydown); };
  }

  /* ---------------------------------------------------------------------
   * Header scroll state
   * ------------------------------------------------------------------- */
  var header = qs('.site-header');
  if (header) {
    var onScrollHeader = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScrollHeader();
    window.addEventListener('scroll', onScrollHeader, { passive: true });
  }

  /* ---------------------------------------------------------------------
   * Mobile menu
   * ------------------------------------------------------------------- */
  (function mobileMenu() {
    var toggle = qs('[data-menu-toggle]');
    var menu = qs('[data-mobile-menu]');
    if (!toggle || !menu) return;
    var closeBtn = qs('[data-menu-close]', menu);
    var overlay = qs('.mobile-menu__overlay', menu);
    var releaseFocus;
    var lastFocused;

    function open() {
      lastFocused = document.activeElement;
      menu.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      releaseFocus = trapFocus(menu);
      var firstLink = qs('a, button', menu);
      if (firstLink) firstLink.focus();
    }
    function close() {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      if (releaseFocus) releaseFocus();
      if (lastFocused) lastFocused.focus();
    }
    toggle.addEventListener('click', function () {
      menu.classList.contains('is-open') ? close() : open();
    });
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (overlay) overlay.addEventListener('click', close);
    qsa('a', menu).forEach(function (a) { a.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) close();
    });
  })();

  /* ---------------------------------------------------------------------
   * Accordions (FAQ + ingredients) — generic
   * ------------------------------------------------------------------- */
  qsa('.accordion__header').forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) return;
    var inner = qs('.accordion__panel-inner', panel);
    btn.addEventListener('click', function () {
      var expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      if (expanded) {
        panel.style.maxHeight = '0px';
      } else {
        panel.style.maxHeight = inner.offsetHeight + 'px';
      }
    });
  });
  // Recalculate open accordion heights on resize (text reflow)
  window.addEventListener('resize', function () {
    qsa('.accordion__header[aria-expanded="true"]').forEach(function (btn) {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      var inner = panel && qs('.accordion__panel-inner', panel);
      if (panel && inner) panel.style.maxHeight = inner.offsetHeight + 'px';
    });
  });

  /* ---------------------------------------------------------------------
   * Cart state
   * ------------------------------------------------------------------- */
  var Cart = (function () {
    var STORAGE_KEY = 'tbg_cart_v1';
    var state = { qty: 0, plan: null };

    function load() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) state = JSON.parse(raw);
      } catch (e) { /* ignore corrupt storage */ }
    }
    function persist() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
    }
    function unitPrice() {
      return state.plan === 'subscribe' ? CONFIG.PRODUCT.priceSubscribe : CONFIG.PRODUCT.priceOneTime;
    }
    function add(qty, plan) {
      state.qty += qty;
      state.plan = plan;
      persist();
      render();
    }
    function setQty(qty) {
      state.qty = Math.max(0, qty);
      persist();
      render();
    }
    function clear() {
      state = { qty: 0, plan: null };
      persist();
      render();
    }

    function render() {
      var count = state.qty;
      qsa('[data-cart-count]').forEach(function (el) {
        el.textContent = String(count);
        el.hidden = count === 0;
      });

      var body = qs('[data-cart-body]');
      var foot = qs('[data-cart-foot]');
      if (!body || !foot) return;

      if (count === 0) {
        body.innerHTML =
          '<div class="cart-empty">' +
          '<p>Your cart is empty.</p>' +
          '<a href="#shop" class="text-link" data-close-cart>Shop 01 CLEAN</a>' +
          '</div>';
        foot.hidden = true;
        return;
      }

      foot.hidden = false;
      var lineTotal = unitPrice() * count;
      var planLabel = state.plan === 'subscribe' ? 'Subscribe & Save · Every 4 weeks' : 'One-Time Purchase';

      body.innerHTML =
        '<div class="cart-line">' +
        '<div class="cart-line__visual" aria-hidden="true">' + bottleMarkup() + '</div>' +
        '<div>' +
        '<p class="cart-line__name">' + CONFIG.PRODUCT.name + '</p>' +
        '<p class="cart-line__variant">' + planLabel + '</p>' +
        '<div class="cart-line__controls">' +
        '<div class="qty-stepper qty-stepper--sm">' +
        '<button type="button" data-cart-decrease aria-label="Decrease quantity">−</button>' +
        '<input type="text" inputmode="numeric" value="' + count + '" readonly aria-label="Quantity" />' +
        '<button type="button" data-cart-increase aria-label="Increase quantity">+</button>' +
        '</div>' +
        '<button type="button" class="cart-line__remove" data-cart-remove>Remove</button>' +
        '</div>' +
        '</div>' +
        '<p class="cart-line__price">' + money(lineTotal) + '</p>' +
        '</div>';

      var subtotalEl = qs('[data-cart-subtotal]');
      if (subtotalEl) subtotalEl.textContent = money(lineTotal);

      var shipNote = qs('[data-cart-shipping-note]');
      if (shipNote) {
        var remaining = CONFIG.FREE_SHIPPING_THRESHOLD - lineTotal;
        shipNote.textContent = remaining > 0
          ? 'Add ' + money(remaining) + ' more for free shipping'
          : 'You’ve unlocked free shipping';
      }

      qs('[data-cart-increase]', body) && qs('[data-cart-increase]', body).addEventListener('click', function () { setQty(state.qty + 1); });
      qs('[data-cart-decrease]', body) && qs('[data-cart-decrease]', body).addEventListener('click', function () { setQty(state.qty - 1); });
      qs('[data-cart-remove]', body) && qs('[data-cart-remove]', body).addEventListener('click', clear);
    }

    function bottleMarkup() {
      return '<div class="bottle" style="--bottle-scale:0.32">' +
        '<div class="bottle__pump"></div>' +
        '<div class="bottle__neck"></div>' +
        '<div class="bottle__body"><div class="bottle__label">' +
        '<span class="bottle__label-num">01</span>' +
        '</div></div></div>';
    }

    load();
    return { add: add, setQty: setQty, clear: clear, render: render, get state() { return state; } };
  })();

  /* ---------------------------------------------------------------------
   * Cart drawer open/close
   * ------------------------------------------------------------------- */
  var CartDrawer = (function () {
    var drawer = qs('[data-cart-drawer]');
    if (!drawer) return { open: function () {}, close: function () {} };
    var overlay = qs('.cart-drawer__overlay', drawer);
    var closeBtn = qs('[data-cart-close]', drawer);
    var releaseFocus, lastFocused;

    function open() {
      lastFocused = document.activeElement;
      drawer.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      releaseFocus = trapFocus(drawer);
      if (closeBtn) closeBtn.focus();
    }
    function close() {
      drawer.classList.remove('is-open');
      document.body.style.overflow = '';
      if (releaseFocus) releaseFocus();
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }
    if (overlay) overlay.addEventListener('click', close);
    if (closeBtn) closeBtn.addEventListener('click', close);
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-close-cart]')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) close();
    });
    qsa('[data-cart-open]').forEach(function (btn) {
      btn.addEventListener('click', open);
    });

    return { open: open, close: close };
  })();

  /* ---------------------------------------------------------------------
   * Inert placeholder links (social, cookie settings) — no destination yet
   * ------------------------------------------------------------------- */
  qsa('a[href="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); });
  });

  /* ---------------------------------------------------------------------
   * Product purchase selector (homepage product section)
   * ------------------------------------------------------------------- */
  qsa('[data-product-form]').forEach(function (form) {
    var priceEl = qs('[data-price-display]', form);
    var atcBtn = qs('[data-add-to-cart]', form);
    var qtyInput = qs('[data-qty-input]', form);
    var freqWrap = qs('[data-freq-wrap]', form);
    var options = qsa('.purchase-option', form);

    function currentPlan() {
      var checked = qs('input[name="plan"]:checked', form);
      return checked ? checked.value : 'onetime';
    }
    function unitPrice(plan) {
      return plan === 'subscribe' ? CONFIG.PRODUCT.priceSubscribe : CONFIG.PRODUCT.priceOneTime;
    }
    function updatePrice() {
      var plan = currentPlan();
      var qty = parseInt(qtyInput.value, 10) || 1;
      var total = unitPrice(plan) * qty;
      if (priceEl) priceEl.textContent = 'Add to Cart — ' + money(total);
      options.forEach(function (opt) {
        var input = qs('input[name="plan"]', opt);
        opt.classList.toggle('is-selected', input.checked);
      });
      if (freqWrap) freqWrap.hidden = plan !== 'subscribe';
    }

    qsa('input[name="plan"]', form).forEach(function (input) {
      input.addEventListener('change', updatePrice);
    });

    var qtyInc = qs('[data-qty-increase]', form);
    var qtyDec = qs('[data-qty-decrease]', form);
    if (qtyInc) qtyInc.addEventListener('click', function () {
      qtyInput.value = (parseInt(qtyInput.value, 10) || 1) + 1;
      updatePrice();
    });
    if (qtyDec) qtyDec.addEventListener('click', function () {
      qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
      updatePrice();
    });

    if (atcBtn) atcBtn.addEventListener('click', function () {
      var qty = parseInt(qtyInput.value, 10) || 1;
      Cart.add(qty, currentPlan());
      CartDrawer.open();
    });

    updatePrice();
  });

  /* ---------------------------------------------------------------------
   * Sticky mobile add-to-cart (hooks for product page; no-op if absent)
   * ------------------------------------------------------------------- */
  (function stickyAtc() {
    var sticky = qs('[data-sticky-atc]');
    var anchor = qs('[data-atc-anchor]');
    if (!sticky || !anchor) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        sticky.classList.toggle('is-visible', !entry.isIntersecting && entry.boundingClientRect.top < 0);
      });
    }, { threshold: 0 });
    io.observe(anchor);

    var stickyBtn = qs('[data-sticky-add-to-cart]', sticky);
    if (stickyBtn) stickyBtn.addEventListener('click', function () {
      var form = qs('[data-product-form]');
      var qty = form ? (parseInt(qs('[data-qty-input]', form).value, 10) || 1) : 1;
      var plan = form ? (qs('input[name="plan"]:checked', form) || {}).value || 'onetime' : 'onetime';
      Cart.add(qty, plan);
      CartDrawer.open();
    });
  })();

  /* ---------------------------------------------------------------------
   * Checkout placeholder toast
   * ------------------------------------------------------------------- */
  var Toast = (function () {
    var el = qs('[data-toast]');
    var timer;
    function show(message) {
      if (!el) return;
      el.textContent = message;
      el.classList.add('is-visible');
      clearTimeout(timer);
      timer = setTimeout(function () { el.classList.remove('is-visible'); }, 3200);
    }
    return { show: show };
  })();

  qsa('[data-checkout-link]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      Toast.show('Checkout is handled by Shopify — arriving in a later phase of this prototype.');
    });
  });

  /* ---------------------------------------------------------------------
   * Email forms (homepage section + footer) — no backend, local confirm only
   * ------------------------------------------------------------------- */
  qsa('[data-email-form]').forEach(function (form) {
    var status = qs('[data-form-status]', form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = qs('input[type="email"]', form);
      if (!input || !input.checkValidity()) {
        if (status) {
          status.textContent = 'Please enter a valid email address.';
          status.dataset.state = 'error';
        }
        return;
      }
      if (status) {
        status.textContent = 'You’re in. Welcome to the bald side.';
        status.dataset.state = 'success';
      }
      form.reset();
      try { localStorage.setItem('tbg_email_joined', '1'); } catch (e2) { /* ignore */ }
    });
  });

  /* ---------------------------------------------------------------------
   * Email popup — triggers once per session after scroll% or delay
   * ------------------------------------------------------------------- */
  (function emailPopup() {
    var popup = qs('[data-email-popup]');
    if (!popup) return;
    var SESSION_KEY = 'tbg_popup_shown';

    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      if (localStorage.getItem('tbg_email_joined')) return;
    } catch (e) { /* proceed without gating if storage unavailable */ }

    var overlay = qs('.email-popup__overlay', popup);
    var closeBtn = qs('[data-email-popup-close]', popup);
    var shown = false;
    var releaseFocus, lastFocused;

    function markShown() {
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) { /* ignore */ }
    }

    function openPopup() {
      if (shown) return;
      shown = true;
      markShown();
      lastFocused = document.activeElement;
      popup.classList.add('is-open');
      releaseFocus = trapFocus(popup);
      var firstField = qs('input, button', popup);
      if (firstField) firstField.focus();
      window.removeEventListener('scroll', onScroll);
      clearTimeout(delayTimer);
    }
    function closePopup() {
      popup.classList.remove('is-open');
      if (releaseFocus) releaseFocus();
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    function onScroll() {
      var scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      if (scrollPercent >= CONFIG.EMAIL_POPUP_SCROLL_PERCENT) openPopup();
    }

    if (overlay) overlay.addEventListener('click', closePopup);
    if (closeBtn) closeBtn.addEventListener('click', closePopup);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && popup.classList.contains('is-open')) closePopup();
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    var delayTimer = setTimeout(openPopup, CONFIG.EMAIL_POPUP_DELAY_MS);
  })();

  /* ---------------------------------------------------------------------
   * Scroll reveal
   * ------------------------------------------------------------------- */
  (function scrollReveal() {
    var items = qsa('[data-reveal]');
    if (!items.length) return;
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el) { io.observe(el); });
  })();

  /* ---------------------------------------------------------------------
   * Init cart render on load
   * ------------------------------------------------------------------- */
  Cart.render();

  /* ---------------------------------------------------------------------
   * Set current year in footer
   * ------------------------------------------------------------------- */
  var yearEl = qs('[data-current-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
