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

  // ── Contact form → Reddit modmail ──
  const form = document.querySelector('.contact-form');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();

      // Basic required-field validation
      const required = form.querySelectorAll('[required]');
      let valid = true;
      required.forEach(field => {
        field.style.borderColor = '';
        if (!field.value.trim()) {
          field.style.borderColor = '#e8520a';
          valid = false;
        }
      });
      if (!valid) return;

      const val = id => form.querySelector(`#${id}`)?.value.trim() || '';
      const sel = id => { const el = form.querySelector(`#${id}`); return el?.options[el.selectedIndex]?.value ? el.options[el.selectedIndex].text : ''; };

      const name       = val('name');
      const email      = val('email');
      const phone      = val('phone');
      const subjectTxt = sel('subject') || 'General Enquiry';
      const bike       = val('bike');
      const experience = sel('experience');
      const helmet     = sel('helmet');
      const jacket     = sel('jacket');
      const pants      = sel('pants');
      const boots      = sel('boots');
      const gloves     = sel('gloves');
      const message    = val('message');

      const gearLines = [
        helmet  ? `Helmet: ${helmet}`         : null,
        jacket  ? `Jacket: ${jacket}`         : null,
        pants   ? `Pants: ${pants}`           : null,
        boots   ? `Boots: ${boots}`           : null,
        gloves  ? `Gloves: ${gloves}`         : null,
      ].filter(Boolean);

      const body = [
        name       ? `Name: ${name}`                        : null,
        email      ? `Email: ${email}`                      : null,
        phone      ? `Phone / WhatsApp: ${phone}`           : null,
        bike       ? `Motorcycle: ${bike}`                  : null,
        experience ? `Riding Experience: ${experience}`     : null,
        gearLines.length ? `\nSafety Gear:\n${gearLines.join('\n')}` : null,
        '',
        message,
      ].filter(l => l !== null).join('\n');

      const subject = `[${subjectTxt}] — ${name}`;
      const url = 'https://www.reddit.com/message/compose/'
        + '?to=/r/PuneBikers'
        + '&subject=' + encodeURIComponent(subject)
        + '&message=' + encodeURIComponent(body);

      window.open(url, '_blank', 'noopener,noreferrer');

      const btn = form.querySelector('button[type="submit"]');
      btn.textContent = 'Opening Reddit…';
      btn.disabled = true;
      btn.style.background = '#22c55e';
      setTimeout(() => {
        btn.textContent = 'Send via Reddit';
        btn.disabled = false;
        btn.style.background = '';
        form.reset();
        required.forEach(f => f.style.borderColor = '');
      }, 3000);
    });
  }

})();
