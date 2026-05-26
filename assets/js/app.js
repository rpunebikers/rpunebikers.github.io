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

  // ── Digital odometer ──
  const buildOdometer = el => {
    const target = parseInt(el.dataset.count, 10);
    const suffix = el.dataset.suffix || '';
    if (isNaN(target)) return;

    const digits = String(target).split('');
    const wrap = document.createElement('span');
    wrap.className = 'odo-wrap';

    const reels = digits.map((d, i) => {
      const slot = document.createElement('span');
      slot.className = 'odo-digit';
      const reel = document.createElement('span');
      reel.className = 'odo-reel';
      for (let n = 0; n <= 9; n++) {
        const s = document.createElement('span');
        s.textContent = n;
        reel.appendChild(s);
      }
      slot.appendChild(reel);
      wrap.appendChild(slot);
      return { reel, d: parseInt(d, 10), delay: i * 0.07 };
    });

    if (suffix) {
      const s = document.createElement('span');
      s.textContent = suffix;
      wrap.appendChild(s);
    }

    el.textContent = '';
    el.appendChild(wrap);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      reels.forEach(({ reel, d, delay }) => {
        reel.style.transitionDelay = delay + 's';
        reel.style.transform = 'translateY(-' + d + 'em)';
      });
    }));
  };

  const counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    if ('IntersectionObserver' in window) {
      const counterIO = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          buildOdometer(entry.target);
          counterIO.unobserve(entry.target);
        });
      }, { threshold: 0.5 });
      counters.forEach(el => counterIO.observe(el));
    } else {
      counters.forEach(buildOdometer);
    }
  }

  // ── Filter buttons (rides page) — year + distance ──
  const yearBtns = document.querySelectorAll('.filter-btn[data-filter]');
  const distBtns = document.querySelectorAll('.filter-btn[data-dist]');
  if (yearBtns.length) {
    let activeYear = 'all';
    let activeDist = 'all';

    const parseKm = card => {
      const txt = card.querySelector('.ride-card-meta')?.textContent || '';
      const m = txt.match(/([\d,]+)\s*km/i);
      return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
    };
    const distOk = (km, f) => {
      if (f === 'all') return true;
      if (f === 'short') return km > 0 && km < 200;
      if (f === 'mid')   return km >= 200 && km < 300;
      if (f === 'long')  return km >= 300;
      return true;
    };
    const applyFilters = () => {
      document.querySelectorAll('.ride-card').forEach(card => {
        const yearMatch = activeYear === 'all' || card.dataset.type === activeYear;
        const distMatch = distOk(parseKm(card), activeDist);
        card.style.display = yearMatch && distMatch ? '' : 'none';
      });
    };

    yearBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        yearBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        activeYear = btn.dataset.filter;
        applyFilters();
      });
    });
    distBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        distBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        activeDist = btn.dataset.dist;
        applyFilters();
      });
    });
  }

  // ── Theme toggle ──
  const themeToggle = document.getElementById('theme-toggle');
  const applyTheme = theme => {
    if (theme === 'light') {
      document.documentElement.dataset.theme = 'light';
    } else {
      delete document.documentElement.dataset.theme;
    }
    if (themeToggle) themeToggle.textContent = theme === 'light' ? '☀️' : '🌙';
  };
  applyTheme(localStorage.getItem('pb-theme') || 'dark');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('pb-theme', next);
      applyTheme(next);
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

  // ── Back to top ──
  const btt = document.createElement('button');
  btt.className = 'back-to-top';
  btt.setAttribute('aria-label', 'Back to top');
  btt.innerHTML = `<svg class="btt-ring" viewBox="0 0 54 54" aria-hidden="true">
    <circle class="btt-ring-track" cx="27" cy="27" r="24"/>
    <circle class="btt-ring-fill"  cx="27" cy="27" r="24"/>
  </svg><span class="btt-arrow">↑</span>`;
  document.body.appendChild(btt);

  const ringFill = btt.querySelector('.btt-ring-fill');
  const circumference = 2 * Math.PI * 24; // ≈ 150.80
  ringFill.style.strokeDasharray  = circumference;
  ringFill.style.strokeDashoffset = circumference;

  const updateBtt = () => {
    const scrolled = window.scrollY;
    const total = document.documentElement.scrollHeight - window.innerHeight;
    const progress = total > 0 ? scrolled / total : 0;
    ringFill.style.strokeDashoffset = circumference * (1 - progress);
    btt.classList.toggle('visible', scrolled > 400);
  };
  window.addEventListener('scroll', updateBtt, { passive: true });
  btt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // ── Reddit live subscriber count ──
  const redditCountEl = document.querySelector('.hero-stat-num[data-reddit-live]');
  if (redditCountEl) {
    fetch('https://www.reddit.com/r/PuneBikers/about.json')
      .then(r => r.json())
      .then(d => {
        const subs = d.data.subscribers;
        if (!subs) return;
        redditCountEl.dataset.count = subs >= 1000 ? Math.floor(subs / 1000) : subs;
        redditCountEl.dataset.suffix = subs >= 1000 ? 'k+' : '+';
        buildOdometer(redditCountEl);
        const liveEl = redditCountEl.closest('.hero-stat').querySelector('.reddit-live');
        if (liveEl) liveEl.style.display = 'inline-flex';
      })
      .catch(() => {});
  }

  // ── Rides page dot TOC ──
  const ridesToc = document.querySelector('.rides-toc');
  if (ridesToc) {
    const dots = Array.from(ridesToc.querySelectorAll('.rides-toc-dot'));
    const targets = dots.map(d => document.getElementById(d.dataset.target)).filter(Boolean);

    const setActive = () => {
      let idx = 0;
      targets.forEach((el, i) => {
        if (window.scrollY + 180 >= el.offsetTop) idx = i;
      });
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    };

    window.addEventListener('scroll', setActive, { passive: true });
    setActive();

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        const el = targets[i];
        if (el) window.scrollTo({ top: el.offsetTop - 100, behavior: 'smooth' });
      });
    });
  }

  // ── Page tabs (combined hub) ──
  const pageTabs = document.querySelectorAll('.page-tab-btn');
  if (pageTabs.length) {
    const VALID = ['about', 'routes', 'rides'];
    const switchTab = id => {
      pageTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === id));
      document.querySelectorAll('.page-tab-section').forEach(s =>
        s.classList.toggle('active', s.id === 'tab-' + id)
      );
      history.replaceState(null, '', location.pathname + (id !== 'rides' ? '#' + id : ''));
    };
    pageTabs.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    const hash = location.hash.replace('#', '');
    switchTab(VALID.includes(hash) ? hash : 'rides');
  }

  // ── Card flip → map preview (all .ride-card elements) ──
  document.querySelectorAll('.ride-card').forEach(card => {
    card.classList.add('flip-enabled');

    const inner = document.createElement('div');
    inner.className = 'ride-card-inner';
    const front = document.createElement('div');
    front.className = 'ride-card-front';
    while (card.firstChild) front.appendChild(card.firstChild);

    // Prefer explicit 📍 meta span, fall back to stripping "Pune - X - Pune"
    const locationSpan = Array.from(front.querySelectorAll('.ride-card-meta span'))
      .find(s => s.textContent.trim().startsWith('📍'));
    const rawTitle = front.querySelector('.ride-card-title')?.textContent.trim() || '';
    const dest = locationSpan
      ? locationSpan.textContent.replace('📍', '').trim()
      : rawTitle.replace(/^Pune\s*[-–]\s*/i, '').replace(/\s*[-–]\s*Pune\s*$/i, '').trim() || rawTitle;
    const q = encodeURIComponent(dest + ', Maharashtra, India');

    const back = document.createElement('div');
    back.className = 'ride-card-back';

    const iframe = document.createElement('iframe');
    iframe.title = 'Map: ' + dest;
    iframe.loading = 'lazy';
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');

    const label = document.createElement('div');
    label.className = 'ride-card-map-label';
    label.textContent = '📍 ' + dest + ' · tap again to close';

    back.appendChild(iframe);
    back.appendChild(label);
    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);

    card.addEventListener('click', e => {
      if (e.target.closest('a')) return;
      const flipping = !card.classList.contains('flipped');
      if (flipping && !iframe.src) {
        iframe.src = 'https://maps.google.com/maps?q=' + q + '&output=embed&z=11';
      }
      card.classList.toggle('flipped');
    });
  });

})();
