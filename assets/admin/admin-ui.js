/**
 * Organiser dashboard — UI: rendering and events. Business rules live in
 * admin-logic.js; every Firebase call goes through admin-data.js.
 */
import * as data from './admin-data.js';
import * as L from './admin-logic.js';

const $ = id => document.getElementById(id);
const SPRITE = 'assets/images/icons.svg#tabler-';
const STATUS_LABEL = { scheduled: 'Scheduled', active: 'Live', cancelled: 'Cancelled', completed: 'Completed' };

const state = {
  user: null,
  rides: {},
  contacts: {},
  enquiries: {},
  organisers: {},
  ridesLoaded: false,
  rideFilter: 'open',
  enquiryFilter: 'open',
  openRideId: null,      // riders drawer
  editingRideId: null,   // ride dialog
  editingRawDate: '',
  unsubscribers: [],
};

// ── DOM helpers ───────────────────────────────────────────────────────────────

/** el('a', { class: 'x', href: '…', text: 'hi', onclick: fn }, child, …) — never parses HTML. */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) if (c !== null && c !== undefined && c !== false) node.append(c);
  return node;
}

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', SPRITE + name);
  svg.append(use);
  return svg;
}

/** Re-renders a container without losing keyboard focus (live data updates arrive any time). */
function renderInto(container, nodes) {
  const fk = container.contains(document.activeElement) ? document.activeElement.dataset.fk : null;
  container.replaceChildren(...nodes);
  if (fk) {
    const again = container.querySelector(`[data-fk="${CSS.escape(fk)}"]`);
    if (again) again.focus();
  }
}

let toastTimer;
function toast(message, isError = false) {
  const t = $('toast');
  t.textContent = message;
  t.classList.toggle('is-error', isError);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), isError ? 6000 : 3500);
}

function failed(action) {
  return err => {
    console.error(action + ' failed:', err);
    toast(`${action} failed — ${err && err.code === 'PERMISSION_DENIED' ? 'you no longer have organiser access' : 'please try again'}.`, true);
  };
}

function confirmAction({ title, text, ok }) {
  const dlg = $('confirm-dialog');
  $('confirm-title').textContent = title;
  $('confirm-text').textContent = text;
  $('confirm-ok').textContent = ok;
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise(resolve => dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true }));
}

function download(filename, text) {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const today = () => new Date().toISOString().slice(0, 10);
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'ride';

// ── Theme ─────────────────────────────────────────────────────────────────────

function initTheme() {
  const btn = $('theme-btn');
  const sync = () => {
    const dark = document.documentElement.dataset.theme !== 'light';
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    btn.replaceChildren(icon(dark ? 'sun' : 'moon'));
  };
  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('pb-theme', next); } catch (e) { /* storage blocked */ }
    sync();
  });
  // Follow the system theme until the organiser picks one.
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  mq.addEventListener('change', e => {
    let stored = null;
    try { stored = localStorage.getItem('pb-theme'); } catch (err) { /* storage blocked */ }
    if (!stored) { document.documentElement.dataset.theme = e.matches ? 'light' : 'dark'; sync(); }
  });
  sync();
}

// ── Tabs (roving tabindex, arrow keys) ───────────────────────────────────────

function initTabs() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const select = tab => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute('aria-controls')).hidden = !on;
    }
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', e => {
      const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      const target = tabs[(next + tabs.length) % tabs.length];
      select(target);
      target.focus();
    });
  });
}

// ── Sign-in ───────────────────────────────────────────────────────────────────

function loginStatus(text) { $('login-status').textContent = text; }
function loginError(text) { $('login-error').textContent = text; }

function showLoginError(e) {
  console.error('Sign-in failed:', e);
  loginStatus('');
  loginError(e && e.code === 'auth/unauthorized-domain'
    ? 'This site is not yet an authorised sign-in domain in Firebase.'
    : 'Sign-in failed — please try again.');
  $('signin-btn').disabled = false;
}

function initAuth() {
  if (!data.init(window.PB_FIREBASE)) {
    $('config-warn').hidden = false;
    $('signin-btn').disabled = true;
    return;
  }
  data.redirectResult().catch(showLoginError);

  $('signin-btn').addEventListener('click', () => {
    loginError('');
    loginStatus('Opening Google sign-in…');
    data.signIn().then(() => loginStatus('')).catch(showLoginError);
  });
  $('signout-btn').addEventListener('click', () => data.signOut());

  data.onAuthChange(async user => {
    if (!user) { stopWatching(); showLogin(); return; }
    $('signin-btn').disabled = true;
    loginError('');
    loginStatus('Checking organiser access…');
    let allowed = false;
    try {
      allowed = await data.verifyOrganiser(user);
    } catch (e) {
      console.error('Organiser check failed:', e);
    }
    if (allowed) { showDashboard(user); return; }
    const email = user.email || 'This account';
    await data.signOut();
    loginStatus('');
    loginError(`${email} is not an organiser account.`);
  });
}

function showLogin() {
  state.user = null;
  $('dash-view').hidden = true;
  $('account').hidden = true;
  $('login-view').hidden = false;
  $('signin-btn').disabled = false;
  if ($('riders-dialog').open) $('riders-dialog').close();
  if ($('ride-dialog').open) $('ride-dialog').close();
}

function showDashboard(user) {
  state.user = user;
  loginStatus('');
  $('login-view').hidden = true;
  $('dash-view').hidden = false;
  $('account').hidden = false;
  const name = user.displayName || user.email || 'Organiser';
  $('account-initial').textContent = name.trim().charAt(0).toUpperCase();
  $('account-email').textContent = user.email || name;
  $('main').focus();
  startWatching();
}

// ── Live data ─────────────────────────────────────────────────────────────────

let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; renderAll(); });
}

function startWatching() {
  stopWatching();
  const listen = (fn, key, label) => state.unsubscribers.push(fn(
    value => { state[key] = value; if (key === 'rides') state.ridesLoaded = true; scheduleRender(); },
    err => { console.error(label, err); toast(`Couldn't load ${label}.`, true); }));
  listen(data.watchRides, 'rides', 'rides');
  listen(data.watchContacts, 'contacts', 'rider contact details');
  listen(data.watchEnquiries, 'enquiries', 'enquiries');
  listen(data.watchOrganisers, 'organisers', 'organisers');
}

function stopWatching() {
  state.unsubscribers.forEach(off => off());
  state.unsubscribers = [];
  Object.assign(state, { rides: {}, contacts: {}, enquiries: {}, organisers: {}, ridesLoaded: false });
}

function summaries() {
  return L.sortRides(Object.entries(state.rides).map(([id, r]) => L.summarizeRide(id, r, state.contacts[id])));
}

function renderAll() {
  if (!state.user) return;
  const rides = summaries();
  renderStats(rides);
  renderRides(rides);
  renderRiderTab(rides);
  renderEnquiries();
  renderOrganisers();
  if (state.openRideId) renderRidersDrawer(rides.find(r => r.id === state.openRideId));
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function renderStats(rides) {
  const s = L.computeStats(rides);
  $('stat-open').textContent = s.openRides;
  $('stat-week').textContent = s.signupsThisWeek;
  $('stat-wait').textContent = s.waitlisted;
  $('stat-spots').textContent = s.openSpots === null ? '—' : s.openSpots;
  $('stat-spots-sub').textContent = s.openSpots === null ? 'No open ride has a rider cap' : 'On rides with a rider cap';
}

// ── Rides ─────────────────────────────────────────────────────────────────────

function renderRides(rides) {
  const grid = $('ride-grid');
  if (!state.ridesLoaded) return;
  grid.setAttribute('aria-busy', 'false');
  const shown = rides.filter(r => (state.rideFilter === 'open' ? r.open : !r.open));
  if (!shown.length) {
    renderInto(grid, [el('div', { class: 'empty' },
      el('strong', { text: state.rideFilter === 'open' ? 'No open rides' : 'No past or cancelled rides' }),
      state.rideFilter === 'open' ? 'Plan the next one — it shows up on the website and in the app right away.' : 'Completed and cancelled rides will appear here.',
      state.rideFilter === 'open' ? el('div', {}, el('button', { type: 'button', class: 'btn btn-primary', 'data-fk': 'empty-new', onclick: () => openRideForm() }, icon('plus'), 'New ride')) : null)]);
    return;
  }
  renderInto(grid, shown.map(rideCard));
}

function rideCard(r) {
  const titleId = 'ride-title-' + r.id;
  const regCount = r.registered.length;
  const fillText = r.max ? `${regCount} of ${r.max} riders` : `${regCount} rider${regCount === 1 ? '' : 's'}`;
  const sideText = [
    r.max ? (r.spotsLeft ? `${r.spotsLeft} left` : 'Full') : 'No limit',
    r.waitlist.length ? `${r.waitlist.length} waitlisted` : null,
  ].filter(Boolean).join(' · ');

  return el('article', { class: 'ride-card glass', 'aria-labelledby': titleId },
    el('div', { class: 'ride-head' },
      el('span', { class: 'ride-emoji', 'aria-hidden': 'true', text: r.emoji }),
      el('div', { class: 'ride-title' },
        el('h3', { id: titleId, text: r.name }),
        el('p', { class: 'ride-when', text: r.dateText || 'Date not set' })),
      el('span', { class: `chip chip-${STATUS_LABEL[r.status] ? r.status : 'scheduled'}`, text: STATUS_LABEL[r.status] || r.status })),
    (r.meetingPoint || r.destination) ? el('p', { class: 'ride-route' }, icon('pin'),
      [r.meetingPoint, r.destination && r.destination !== r.meetingPoint ? r.destination : null].filter(Boolean).join(' → ') +
      (r.distance ? ` · ${r.distance} km` : '')) : null,
    el('div', {},
      el('p', { class: 'fill-label' }, el('span', { text: fillText }), el('span', { class: 'muted', text: sideText })),
      r.max ? el('div', {
        class: 'fill-track', role: 'progressbar', 'aria-label': `Spots filled on ${r.name}`,
        'aria-valuemin': '0', 'aria-valuemax': String(r.max), 'aria-valuenow': String(Math.min(regCount, r.max)),
      }, el('div', { class: 'fill-bar' + (r.fill >= 1 ? ' is-full' : ''), style: `transform: scaleX(${r.fill})` })) : null),
    el('div', { class: 'ride-actions' },
      el('button', { type: 'button', class: 'btn btn-primary btn-sm', 'data-fk': r.id + ':riders', onclick: () => openRiders(r.id) },
        icon('users'), `Riders (${regCount + r.waitlist.length})`),
      el('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'data-fk': r.id + ':edit', onclick: () => openRideForm(r.id) },
        icon('pencil'), 'Edit'),
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': `Share registration link for ${r.name}`, title: 'Share link', 'data-fk': r.id + ':share', onclick: () => shareRide(r) },
        icon('share')),
      r.open
        ? el('button', { type: 'button', class: 'icon-btn', 'aria-label': `Cancel ${r.name}`, title: 'Cancel ride', 'data-fk': r.id + ':cancel', onclick: () => cancelRide(r) }, icon('ban'))
        : el('button', { type: 'button', class: 'icon-btn', 'aria-label': `Reopen ${r.name}`, title: 'Reopen ride', 'data-fk': r.id + ':reopen', onclick: () => reopenRide(r) }, icon('arrow-up')),
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': `Delete ${r.name}`, title: 'Delete ride', 'data-fk': r.id + ':delete', onclick: () => deleteRide(r) },
        icon('trash'))));
}

async function shareRide(r) {
  const url = L.registerUrl(location.href, r);
  if (navigator.share) {
    try { await navigator.share({ title: r.name, text: `Register for ${r.name}${r.dateText ? ' — ' + r.dateText : ''}`, url }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Registration link copied.');
  } catch (e) {
    toast('Copy failed — link: ' + url, true);
  }
}

async function cancelRide(r) {
  const ok = await confirmAction({
    title: `Cancel ${r.name}?`,
    text: 'The ride is marked cancelled on the website and in the app. The website can\'t send push notifications, so tell riders in the app or on WhatsApp.',
    ok: 'Cancel ride',
  });
  if (ok) data.cancelRide(r.id).then(() => toast(`${r.name} cancelled.`)).catch(failed('Cancelling the ride'));
}

function reopenRide(r) {
  data.reopenRide(r.id).then(() => toast(`${r.name} is open again.`)).catch(failed('Reopening the ride'));
}

async function deleteRide(r) {
  const ok = await confirmAction({
    title: `Delete ${r.name}?`,
    text: `This permanently removes the ride, its ${r.registered.length + r.waitlist.length} sign-up(s) and their contact details. Cancelling keeps the history instead.`,
    ok: 'Delete',
  });
  if (ok) data.deleteRide(r.id).then(() => toast(`${r.name} deleted.`)).catch(failed('Deleting the ride'));
}

// ── Ride form ─────────────────────────────────────────────────────────────────

function openRideForm(rideId = null) {
  const form = $('ride-form');
  const ride = rideId ? state.rides[rideId] : null;
  state.editingRideId = rideId;
  state.editingRawDate = ride ? String(ride.rideDate || '') : '';
  form.reset();
  form.querySelectorAll('[aria-invalid]').forEach(i => i.removeAttribute('aria-invalid'));
  $('ride-form-error').textContent = '';
  $('ride-dialog-title').textContent = ride ? 'Edit ride' : 'New ride';
  $('ride-save-btn').textContent = ride ? 'Save changes' : 'Create ride';

  const hint = $('when-hint');
  hint.textContent = 'Saved in the app\'s format, e.g. "Sun 8 Nov, 5:30 AM".';
  if (ride) {
    const f = form.elements;
    f.rideName.value = ride.rideName || '';
    f.meetingPoint.value = ride.meetingPoint || '';
    f.destination.value = ride.destination || '';
    f.maxRiders.value = Number(ride.maxRiders) > 0 ? ride.maxRiders : '';
    f.distance.value = ride.distance || '';
    f.type.value = ride.type || 'general';
    f.emoji.value = ride.emoji || '';
    f.status.value = ['scheduled', 'cancelled', 'completed'].includes(ride.status) ? ride.status : 'scheduled';
    f.notes.value = ride.notes || '';
    const when = L.parseRideDate(ride.rideDate);
    if (when) f.when.value = L.toDatetimeLocal(when);
    else if (ride.rideDate) hint.textContent = `Current: "${ride.rideDate}". Leave empty to keep it.`;
    // A live ride's status is managed by the app; keep it unless the organiser picks another.
    if (ride.status === 'active') f.status.append(el('option', { value: 'active', text: 'Live (set by the app)' }));
    if (ride.status === 'active') f.status.value = 'active';
  }
  $('ride-dialog').showModal();
}

function initRideForm() {
  $('new-ride-btn').addEventListener('click', () => openRideForm());
  const dlg = $('ride-dialog');
  dlg.addEventListener('close', () => {
    const live = dlg.querySelector('option[value="active"]');
    if (live) live.remove();
  });

  $('ride-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target.elements;
    const rideDate = f.when.value ? L.formatRideDate(new Date(f.when.value)) : state.editingRawDate;
    const ride = L.rideFromForm({
      rideName: f.rideName.value, meetingPoint: f.meetingPoint.value, destination: f.destination.value,
      rideDate, maxRiders: f.maxRiders.value, distance: f.distance.value, type: f.type.value,
      emoji: f.emoji.value, status: f.status.value, notes: f.notes.value,
    });
    const missing = L.validateRide(ride);
    const fieldFor = { 'ride name': 'rideName', 'meeting point': 'meetingPoint', destination: 'destination', 'date and time': 'when' };
    Object.values(fieldFor).forEach(n => f[n].removeAttribute('aria-invalid'));
    if (missing.length) {
      missing.forEach(m => f[fieldFor[m]].setAttribute('aria-invalid', 'true'));
      $('ride-form-error').textContent = 'Please add the ' + missing.join(', ') + '.';
      f[fieldFor[missing[0]]].focus();
      return;
    }
    const btn = $('ride-save-btn');
    btn.disabled = true;
    try {
      if (state.editingRideId) {
        await data.updateRide(state.editingRideId, ride);
        toast(`${ride.rideName} saved.`);
      } else {
        if (ride.distance === null) delete ride.distance;
        await data.createRide(ride, state.user.displayName || state.user.email);
        toast(`${ride.rideName} created — it's live on the website and in the app.`);
      }
      dlg.close();
    } catch (err) {
      console.error('Saving the ride failed:', err);
      $('ride-form-error').textContent = 'Saving failed — please try again.';
    } finally {
      btn.disabled = false;
    }
  });

  document.querySelectorAll('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
}

// ── Riders drawer ─────────────────────────────────────────────────────────────

function openRiders(rideId) {
  state.openRideId = rideId;
  renderRidersDrawer(summaries().find(r => r.id === rideId));
  $('riders-dialog').showModal();
}

function riderItem(p, ride, onWaitlist) {
  const links = L.phoneLinks(p.phone);
  return el('li', { class: 'rider' },
    el('div', { class: 'rider-main' },
      el('p', { class: 'rider-name' }, p.name, p.linked ? el('span', { class: 'linked', text: ' · account linked' }) : null),
      el('p', { class: 'rider-meta', text: [p.bike, p.at ? 'signed up ' + L.relativeTime(p.at) : null].filter(Boolean).join(' · ') }),
      (p.email || p.instagram) ? el('p', { class: 'rider-meta' },
        p.email ? el('a', { href: 'mailto:' + p.email, text: p.email }) : null,
        p.email && p.instagram ? ' · ' : null,
        p.instagram ? '@' + p.instagram.replace(/^@/, '') : null) : null,
      p.notes ? el('p', { class: 'rider-meta', text: '“' + p.notes + '”' }) : null),
    el('div', { class: 'rider-actions' },
      links ? el('a', { class: 'btn btn-ghost btn-sm', href: links.tel, 'aria-label': `Call ${p.name}` }, icon('phone'), 'Call') : el('span', { class: 'rider-meta', text: 'No phone on file' }),
      links ? el('a', { class: 'btn btn-ghost btn-sm', href: links.whatsapp, target: '_blank', rel: 'noopener', 'aria-label': `WhatsApp ${p.name}` }, icon('whatsapp'), 'WhatsApp') : null,
      onWaitlist ? el('button', { type: 'button', class: 'btn btn-primary btn-sm', 'data-fk': 'promote:' + p.key, onclick: () => promote(ride, p) }, icon('check'), 'Move to ride') : null));
}

function renderRidersDrawer(ride) {
  const body = $('riders-body');
  if (!ride) {
    $('riders-title').textContent = 'Ride removed';
    $('riders-sub').textContent = '';
    renderInto(body, [el('p', { class: 'muted', text: 'This ride no longer exists.' })]);
    return;
  }
  $('riders-title').textContent = ride.name;
  $('riders-sub').textContent = [ride.dateText, ride.max ? `${ride.registered.length} of ${ride.max} riders` : `${ride.registered.length} riders`].filter(Boolean).join(' · ');
  const section = (title, people, onWaitlist) => el('section', { class: 'rider-section', 'aria-label': title },
    el('h3', { text: `${title} (${people.length})` }),
    people.length
      ? el('ul', { class: 'rider-list' }, people.map(p => riderItem(p, ride, onWaitlist)))
      : el('p', { class: 'muted small', text: onWaitlist ? 'Nobody is waiting.' : 'No sign-ups yet. Share the registration link to get riders in.' }));
  renderInto(body, [section('Registered', ride.registered, false), ride.waitlist.length ? section('Waitlist', ride.waitlist, true) : null].filter(Boolean));
}

async function promote(ride, person) {
  if (ride.max && ride.registered.length >= ride.max) {
    const ok = await confirmAction({
      title: 'Ride is full',
      text: `${ride.name} already has ${ride.registered.length} of ${ride.max} riders. Move ${person.name} onto it anyway?`,
      ok: 'Move anyway',
    });
    if (!ok) return;
  }
  data.applyUpdates(L.promotionUpdates(ride.id, person))
    .then(() => toast(`${person.name} moved onto the ride — let them know on WhatsApp.`))
    .catch(failed('Moving the rider'));
}

const RIDER_COLUMNS = [
  { label: 'Ride', value: r => r.ride },
  { label: 'Ride date', value: r => r.rideDate },
  { label: 'Status', value: r => r.list },
  { label: 'Name', value: r => r.name },
  { label: 'Bike', value: r => r.bike },
  { label: 'Phone', value: r => r.phone },
  { label: 'Email', value: r => r.email },
  { label: 'Instagram', value: r => r.instagram },
  { label: 'Notes', value: r => r.notes },
  { label: 'Signed up', value: r => (r.at ? new Date(r.at).toISOString() : '') },
];

function initRidersDrawer() {
  $('riders-dialog').addEventListener('close', () => { state.openRideId = null; });
  $('ride-csv-btn').addEventListener('click', () => {
    const ride = summaries().find(r => r.id === state.openRideId);
    if (!ride) return;
    download(`punebikers-${slug(ride.name)}-${today()}.csv`, L.toCsv(L.registrationRows([ride]), RIDER_COLUMNS));
  });
}

// ── Riders tab ────────────────────────────────────────────────────────────────

function currentRiderRows(rides) {
  return L.filterRows(L.registrationRows(rides), { rideId: $('rider-ride-filter').value, query: $('rider-search').value });
}

function renderRiderTab(rides) {
  const select = $('rider-ride-filter');
  const keep = select.value;
  select.replaceChildren(el('option', { value: '', text: 'All rides' }),
    ...rides.map(r => el('option', { value: r.id, text: r.name + (r.dateText ? ` — ${r.dateText}` : '') })));
  select.value = rides.some(r => r.id === keep) ? keep : '';

  const rows = currentRiderRows(rides);
  const total = rides.reduce((n, r) => n + r.registered.length + r.waitlist.length, 0);
  $('rider-count').textContent = `${rows.length} of ${total} sign-ups`;
  const tbody = $('rider-rows');
  if (!rows.length) {
    renderInto(tbody, [el('tr', {}, el('td', { colspan: '6', class: 'cell-empty muted', text: total ? 'No riders match.' : 'No sign-ups yet.' }))]);
    return;
  }
  renderInto(tbody, rows.map(r => {
    const links = L.phoneLinks(r.phone);
    return el('tr', {},
      el('td', { 'data-label': 'Rider' }, el('span', {}, el('strong', { text: r.name }), el('span', { class: 'sub', text: r.bike || '—' }))),
      el('td', { 'data-label': 'Ride' }, el('span', {}, r.ride, el('span', { class: 'sub', text: r.rideDate }))),
      el('td', { 'data-label': 'Status' }, el('span', { class: 'chip ' + (r.list === 'Waitlist' ? 'chip-completed' : 'chip-scheduled'), text: r.list })),
      el('td', { 'data-label': 'Phone' }, links ? el('a', { href: links.tel, text: r.phone }) : '—'),
      el('td', { 'data-label': 'Email' }, r.email ? el('a', { href: 'mailto:' + r.email, text: r.email }) : '—'),
      el('td', { 'data-label': 'Signed up', text: L.relativeTime(r.at) || '—' }));
  }));
}

function initRiderTab() {
  $('rider-ride-filter').addEventListener('change', scheduleRender);
  $('rider-search').addEventListener('input', scheduleRender);
  $('riders-csv-btn').addEventListener('click', () => {
    const rows = currentRiderRows(summaries());
    if (!rows.length) { toast('Nothing to export.'); return; }
    download(`punebikers-riders-${today()}.csv`, L.toCsv(rows, RIDER_COLUMNS));
  });
}

// ── Enquiries ─────────────────────────────────────────────────────────────────

function renderEnquiries() {
  const rows = L.enquiryRows(state.enquiries);
  const open = rows.filter(r => !r.handled).length;
  const badge = $('enquiry-badge');
  badge.hidden = !open;
  badge.textContent = open;
  $('tab-enquiries').setAttribute('aria-label', open ? `Enquiries, ${open} to do` : 'Enquiries');

  const shown = rows.filter(r => state.enquiryFilter === 'all' || (state.enquiryFilter === 'handled') === r.handled);
  const list = $('enquiry-list');
  if (!shown.length) {
    renderInto(list, [el('div', { class: 'empty' },
      el('strong', { text: state.enquiryFilter === 'open' ? 'All caught up' : 'Nothing here' }),
      'Join requests from the website\'s contact form appear here.')]);
    return;
  }
  renderInto(list, shown.map(enquiryCard));
}

function enquiryCard(q) {
  const links = L.phoneLinks(q.phone);
  const titleId = 'enq-' + q.id;
  const facts = [
    ['Email', q.email ? el('a', { href: 'mailto:' + q.email, text: q.email }) : null],
    ['Phone', q.phone ? (links ? el('a', { href: links.tel, text: q.phone }) : q.phone) : null],
    ['Bike', q.bike],
    ['Experience', q.experience],
    ['Ride', q.ride],
    ['Gear', q.gear.join(', ')],
    ['Received', L.relativeTime(q.at)],
  ].filter(([, v]) => v);
  return el('article', { class: 'enquiry glass' + (q.handled ? ' is-handled' : ''), 'aria-labelledby': titleId },
    el('div', { class: 'enquiry-head' },
      el('h3', { id: titleId, text: q.name || 'No name' }),
      el('span', { class: 'chip ' + (q.handled ? 'chip-completed' : 'chip-scheduled'), text: q.handled ? 'Handled' : q.subject })),
    el('dl', {}, facts.map(([k, v]) => [el('dt', { text: k }), el('dd', {}, v)])),
    q.notes ? el('p', { class: 'enquiry-notes', text: q.notes }) : null,
    el('div', { class: 'enquiry-foot' },
      el('button', {
        type: 'button', class: 'btn btn-sm ' + (q.handled ? 'btn-ghost' : 'btn-primary'), 'aria-pressed': String(q.handled), 'data-fk': 'enq:' + q.id,
        onclick: () => data.setEnquiryHandled(q.id, !q.handled, state.user.email)
          .then(() => toast(q.handled ? 'Moved back to To do.' : 'Marked as handled.')).catch(failed('Updating the enquiry')),
      }, icon('check'), q.handled ? 'Handled' : 'Mark handled'),
      q.email ? el('a', { class: 'btn btn-ghost btn-sm', href: `mailto:${q.email}?subject=${encodeURIComponent('PuneBikers — ' + q.subject)}` }, icon('mail'), 'Reply') : null,
      links ? el('a', { class: 'btn btn-ghost btn-sm', href: links.whatsapp, target: '_blank', rel: 'noopener' }, icon('whatsapp'), 'WhatsApp') : null));
}

// ── Organisers ────────────────────────────────────────────────────────────────

function renderOrganisers() {
  const me = (state.user && state.user.email || '').toLowerCase();
  const emails = Object.entries(state.organisers).filter(([, v]) => v === true).map(([k]) => L.decodeEmailKey(k)).sort();
  renderInto($('organiser-list'), emails.length
    ? emails.map(e => el('li', {}, icon('shield'), e, e.toLowerCase() === me ? el('span', { class: 'muted', text: ' (you)' }) : null))
    : [el('li', { class: 'muted', text: 'No organisers listed.' })]);
}

// ── Filters ───────────────────────────────────────────────────────────────────

function initFilters() {
  document.querySelectorAll('input[name="ride-filter"]').forEach(i => i.addEventListener('change', () => { state.rideFilter = i.value; scheduleRender(); }));
  document.querySelectorAll('input[name="enquiry-filter"]').forEach(i => i.addEventListener('change', () => { state.enquiryFilter = i.value; scheduleRender(); }));
}

// ── Boot ──────────────────────────────────────────────────────────────────────

initTheme();
initTabs();
initRideForm();
initRidersDrawer();
initRiderTab();
initFilters();
initAuth();
