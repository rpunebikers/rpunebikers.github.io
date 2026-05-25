/* PuneBikers — app.js */

(() => {
  'use strict';

  // ── Navbar scroll effect ──
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    const onScroll = () => {
      navbar.classList.toggle('scrolled', window.scrollY > 30);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── Mobile nav toggle ──
  const toggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      navLinks.classList.toggle('open', !expanded);
      document.body.style.overflow = expanded ? '' : 'hidden';
    });

    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        toggle.setAttribute('aria-expanded', 'false');
        navLinks.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  // ── Active nav link ──
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || currentPath.endsWith(href)) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });

  // ── Intersection Observer — fade-up animations ──
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.fade-up').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.fade-up').forEach(el => el.classList.add('visible'));
  }

  // ── Counter animation ──
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    const counterIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10);
        const suffix = el.dataset.suffix || '';
        const duration = 1500;
        const step = target / (duration / 16);
        let current = 0;
        const timer = setInterval(() => {
          current = Math.min(current + step, target);
          el.textContent = Math.floor(current) + suffix;
          if (current >= target) clearInterval(timer);
        }, 16);
        counterIO.unobserve(el);
      });
    }, { threshold: 0.5 });

    counters.forEach(el => counterIO.observe(el));
  }

  // ── Filter buttons (rides page) ──
  const filterBtns = document.querySelectorAll('.filter-btn');
  if (filterBtns.length) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');

        const filter = btn.dataset.filter;
        document.querySelectorAll('.ride-card').forEach(card => {
          if (filter === 'all' || card.dataset.type === filter) {
            card.style.display = '';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  // ── Gallery lightbox (basic) ──
  document.querySelectorAll('.gallery-item').forEach(item => {
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', item.querySelector('.gallery-overlay span')?.textContent || 'View photo');

    const open = () => {
      const label = item.querySelector('.gallery-overlay span')?.textContent || '';
      const overlay = document.createElement('div');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', label);
      overlay.style.cssText = `
        position:fixed;inset:0;z-index:9000;
        background:rgba(0,0,0,0.92);
        display:flex;align-items:center;justify-content:center;
        padding:2rem;cursor:zoom-out;
      `;
      const img = item.querySelector('img');
      if (img) {
        const fullImg = document.createElement('img');
        fullImg.src = img.src;
        fullImg.alt = img.alt;
        fullImg.style.cssText = 'max-width:100%;max-height:90vh;border-radius:8px;object-fit:contain;';
        overlay.appendChild(fullImg);
      } else {
        const msg = document.createElement('p');
        msg.style.cssText = 'color:#fff;font-size:1.2rem;text-align:center;';
        msg.textContent = label || 'Gallery image';
        overlay.appendChild(msg);
      }
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.style.cssText = `
        position:absolute;top:1.5rem;right:1.5rem;
        background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);
        color:#fff;font-size:1.25rem;width:44px;height:44px;border-radius:50%;
        cursor:pointer;display:flex;align-items:center;justify-content:center;
      `;
      overlay.appendChild(closeBtn);
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';
      closeBtn.focus();

      const close = () => {
        overlay.remove();
        document.body.style.overflow = '';
        item.focus();
      };
      closeBtn.addEventListener('click', close);
      overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
      document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
      });
    };

    item.addEventListener('click', open);
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });

  // ── Contact form ──
  const form = document.querySelector('.contact-form');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const original = btn.textContent;
      btn.textContent = 'Message Sent!';
      btn.disabled = true;
      btn.style.background = '#22c55e';
      setTimeout(() => {
        btn.textContent = original;
        btn.disabled = false;
        btn.style.background = '';
        form.reset();
      }, 3000);
    });
  }

})();
