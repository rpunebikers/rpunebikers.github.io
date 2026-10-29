/**
 * PuneBikers — rider sign-in with Google on the public pages.
 *
 * Independent of admin.html, which has its own organiser sign-in.
 * Adds a "Sign in" / account button to the navbar, loads the Firebase Auth SDK
 * once the page is idle (right away on the contact form), and exposes:
 *
 *   window.PBUser.ready      Promise<firebase.User|null> — first known auth state
 *   window.PBUser.session()  Promise<{ uid, email, name, token }|null> — for REST writes
 *   window.PBUser.signIn() / window.PBUser.signOut()
 *
 * Every auth change also fires a `pb:user` event on document (detail: user or null).
 */
(() => {
  const cfg = window.PB_FIREBASE;
  if (!cfg || !cfg.apiKey || !document.body || document.body.dataset.chrome === 'off') return;

  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const icon = name => '<svg class="icon" aria-hidden="true"><use href="assets/images/icons.svg#tabler-' + name + '"></use></svg>';

  // ── Firebase Auth (lazy) ──
  const loadScript = src => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });

  let authPromise = null;
  const getAuth = () => authPromise || (authPromise =
    (window.firebase ? Promise.resolve() : loadScript(SDK + 'firebase-app-compat.js'))
      .then(() => (window.firebase.auth ? null : loadScript(SDK + 'firebase-auth-compat.js')))
      .then(() => {
        const app = firebase.apps.find(a => a.name === 'pb-user') || firebase.initializeApp(cfg, 'pb-user');
        const auth = app.auth();
        // Test hook: only a page script can set this; production never does.
        if (window.PB_EMULATORS && window.PB_EMULATORS.auth) auth.useEmulator(window.PB_EMULATORS.auth);
        return auth;
      }));

  let current = null;
  let started = false;
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });

  const start = () => {
    if (started) return;
    started = true;
    getAuth().then(auth => {
      auth.getRedirectResult().catch(err => {
        console.error('Google sign-in failed:', err);
        toast('Sign-in failed — please try again.');
      });
      auth.onAuthStateChanged(user => {
        current = user;
        render();
        resolveReady(user);
        document.dispatchEvent(new CustomEvent('pb:user', { detail: user }));
      });
    }).catch(err => {
      console.error('Sign-in is unavailable:', err);
      resolveReady(null);
    });
  };

  const signIn = () => {
    start();
    return getAuth().then(auth => {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return auth.signInWithPopup(provider).catch(err => {
        if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
          return auth.signInWithRedirect(provider);
        }
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return null;
        throw err;
      });
    }).catch(err => {
      console.error('Google sign-in failed:', err);
      toast('Sign-in failed — please try again.');
    });
  };

  const signOut = () => getAuth().then(auth => auth.signOut()).then(() => toast('Signed out'));

  const session = () => ready.then(() => current
    ? current.getIdToken().then(token => ({
        uid: current.uid,
        email: current.email || '',
        name: current.displayName || '',
        token,
      }))
    : null);

  window.PBUser = { ready, session, signIn, signOut };

  // ── Toast (same markup and styles as the site toast) ──
  function toast(msg) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.innerHTML = '<span class="toast-ico">' + icon('check') + '</span><span class="toast-text"></span>';
      document.body.appendChild(el);
    }
    el.querySelector('.toast-text').textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ── Navbar account control ──
  const navInner = document.querySelector('.navbar .nav-inner');
  if (!navInner) { start(); return; }

  const wrap = document.createElement('div');
  wrap.className = 'nav-account';
  wrap.innerHTML =
    '<button type="button" class="nav-account-btn" aria-expanded="false" aria-controls="nav-account-panel"></button>' +
    '<div class="nav-account-panel glass-card" id="nav-account-panel" hidden>' +
      '<p class="nav-account-name"></p>' +
      '<p class="nav-account-email"></p>' +
      '<button type="button" class="nav-account-signout">' + icon('logout') + ' Sign out</button>' +
    '</div>';
  const themeToggle = navInner.querySelector('.theme-toggle');
  navInner.insertBefore(wrap, themeToggle || navInner.querySelector('.nav-toggle'));

  const btn = wrap.querySelector('.nav-account-btn');
  const panel = wrap.querySelector('.nav-account-panel');

  const setOpen = open => {
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) panel.querySelector('.nav-account-signout').focus();
  };

  function render() {
    if (current) {
      const name = current.displayName || current.email || 'Rider';
      btn.innerHTML = '<span class="nav-account-initial" aria-hidden="true">' + escapeHtml(name.trim().charAt(0).toUpperCase()) + '</span>';
      btn.setAttribute('aria-label', 'Account: ' + name);
      btn.setAttribute('aria-expanded', 'false');
      btn.classList.add('is-signed-in');
      panel.querySelector('.nav-account-name').textContent = current.displayName || 'Signed in';
      panel.querySelector('.nav-account-email').textContent = current.email || '';
    } else {
      btn.innerHTML = icon('user') + '<span class="nav-account-label">Sign in</span>';
      btn.setAttribute('aria-label', 'Sign in with Google');
      btn.removeAttribute('aria-expanded');
      btn.classList.remove('is-signed-in');
      panel.hidden = true;
    }
  }

  btn.addEventListener('click', () => {
    if (current) setOpen(panel.hidden);
    else signIn();
  });
  panel.querySelector('.nav-account-signout').addEventListener('click', () => {
    setOpen(false);
    btn.focus();
    signOut();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panel.hidden) { setOpen(false); btn.focus(); }
  });
  document.addEventListener('click', e => {
    if (!panel.hidden && !wrap.contains(e.target)) setOpen(false);
  });

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  render();

  // The contact form needs the session immediately; elsewhere wait until the page is idle.
  if (document.querySelector('.contact-form')) start();
  else if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 3000 });
  else setTimeout(start, 1500);
})();
