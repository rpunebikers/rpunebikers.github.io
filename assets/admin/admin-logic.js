/**
 * Organiser dashboard — pure business logic (no DOM, no Firebase).
 * Unit-tested with `node --test tests/*.test.mjs` from the repo root.
 */

export const PUBLIC_ENTRY_FIELDS = ['name', 'bike', 'registeredAt', 'joinedAt'];
const ACTIVE_STATUSES = new Set(['scheduled', 'active']);
const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Ride dates ────────────────────────────────────────────────────────────────

/**
 * Parses the ride date strings the app and the old admin page wrote. The app's main
 * format has no year ("Sun 3 Nov, 5:30 AM"); like the app's reminder scheduler, a
 * yearless date is placed in the current year, or the next one if it is over 60 days
 * in the past (rides are planned weeks ahead, not months behind).
 * Returns a Date or null.
 */
export function parseRideDate(text, now = new Date()) {
  if (!text || typeof text !== 'string') return null;
  const s = text.trim();
  let m;

  // yyyy-mm-dd[Thh:mm]
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?$/))) {
    return validDate(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
  }
  // dd/mm/yyyy
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    return validDate(+m[3], +m[2] - 1, +m[1], 0, 0);
  }
  // [Weekday[,]] d Mon [yyyy][, h:mm [AM|PM]]
  m = s.match(/^(?:[A-Za-z]{3,9},?\s+)?(\d{1,2})\s+([A-Za-z]{3,9})\.?(?:\s+(\d{4}))?(?:,?\s+(\d{1,2}):(\d{2})\s*([AaPp][Mm])?)?$/);
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (month < 0) return null;
    let hour = m[4] ? +m[4] : 0;
    const minute = m[5] ? +m[5] : 0;
    if (m[6]) {
      if (hour < 1 || hour > 12) return null;
      const pm = m[6].toLowerCase() === 'pm';
      hour = (hour % 12) + (pm ? 12 : 0);
    }
    if (m[3]) return validDate(+m[3], month, +m[1], hour, minute);
    let d = validDate(now.getFullYear(), month, +m[1], hour, minute);
    if (d && now - d > 60 * DAY_MS) d = validDate(now.getFullYear() + 1, month, +m[1], hour, minute);
    return d;
  }
  // Month dd, yyyy
  if ((m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})$/))) {
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    return month < 0 ? null : validDate(+m[3], month, +m[2], 0, 0);
  }
  return null;
}

function validDate(y, mo, d, h, mi) {
  if (h > 23 || mi > 59) return null;
  const date = new Date(y, mo, d, h, mi);
  return date.getFullYear() === y && date.getMonth() === mo && date.getDate() === d ? date : null;
}

/** The app's ride date format: "Sun 3 Nov, 5:30 AM". */
export function formatRideDate(date) {
  const h12 = date.getHours() % 12 || 12;
  const ampm = date.getHours() < 12 ? 'AM' : 'PM';
  const month = MONTHS[date.getMonth()];
  return `${DAYS[date.getDay()]} ${date.getDate()} ${month[0].toUpperCase()}${month.slice(1)}, ${h12}:${pad(date.getMinutes())} ${ampm}`;
}

/** Value for <input type="datetime-local">. */
export function toDatetimeLocal(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const pad = n => String(n).padStart(2, '0');

// ── Rides ─────────────────────────────────────────────────────────────────────

export const isOpenStatus = status => ACTIVE_STATUSES.has(status || 'scheduled');

/** Registered / waitlisted people of one ride, merged with their private contact records. */
function people(list, contacts) {
  return Object.entries(list || {})
    .filter(([, e]) => e && typeof e === 'object')
    .map(([key, e]) => {
      const c = (contacts && contacts[key]) || {};
      return {
        key,
        name: String(e.name || key),
        bike: String(e.bike || ''),
        at: Number(e.registeredAt || e.joinedAt || 0),
        phone: String(c.phone || ''),
        email: String(c.email || ''),
        instagram: String(c.instagram || ''),
        notes: String(c.notes || ''),
        linked: Boolean(c.uid),
      };
    })
    .sort((a, b) => (a.at || Infinity) - (b.at || Infinity) || a.name.localeCompare(b.name));
}

/** View model for one ride. */
export function summarizeRide(id, ride, contactsForRide, now = new Date()) {
  const r = ride || {};
  const registered = people(r.registrations, contactsForRide);
  const waitlist = people(r.waitlist, contactsForRide);
  const max = Number(r.maxRiders) > 0 ? Number(r.maxRiders) : 0;
  const when = parseRideDate(r.rideDate, now);
  return {
    id,
    name: String(r.rideName || 'Untitled ride'),
    emoji: String(r.emoji || '🏍️'),
    dateText: String(r.rideDate || ''),
    when,
    status: String(r.status || 'scheduled'),
    open: isOpenStatus(r.status),
    meetingPoint: String(r.meetingPoint || ''),
    destination: String(r.destination || ''),
    notes: String(r.notes || ''),
    type: String(r.type || 'general'),
    distance: Math.round(Number(r.totalDistanceKm || r.distance || 0)) || 0,
    max,
    registered,
    waitlist,
    spotsLeft: max ? Math.max(0, max - registered.length) : null,
    fill: max ? Math.min(1, registered.length / max) : null,
  };
}

/** Open rides first (soonest first, undated last), then the rest (most recent first). */
export function sortRides(list) {
  const t = r => (r.when ? r.when.getTime() : null);
  return [...list].sort((a, b) => {
    if (a.open !== b.open) return a.open ? -1 : 1;
    const ta = t(a), tb = t(b);
    if (ta === null || tb === null) return ta === null ? (tb === null ? a.name.localeCompare(b.name) : 1) : -1;
    return a.open ? ta - tb : tb - ta;
  });
}

/** Stat tiles. Open spots counts only capped rides; null when no open ride has a cap. */
export function computeStats(rides, now = Date.now()) {
  const open = rides.filter(r => r.open);
  const weekAgo = now - 7 * DAY_MS;
  const capped = open.filter(r => r.max);
  return {
    openRides: open.length,
    signupsThisWeek: open.reduce((n, r) =>
      n + [...r.registered, ...r.waitlist].filter(p => p.at >= weekAgo).length, 0),
    waitlisted: open.reduce((n, r) => n + r.waitlist.length, 0),
    openSpots: capped.length ? capped.reduce((n, r) => n + r.spotsLeft, 0) : null,
  };
}

/** Flat rows for the Registrations tab and CSV export. */
export function registrationRows(rides) {
  const rows = [];
  for (const r of rides) {
    for (const p of r.registered) rows.push({ ...p, rideId: r.id, ride: r.name, rideDate: r.dateText, list: 'Registered' });
    for (const p of r.waitlist) rows.push({ ...p, rideId: r.id, ride: r.name, rideDate: r.dateText, list: 'Waitlist' });
  }
  return rows.sort((a, b) => b.at - a.at);
}

export function filterRows(rows, { rideId = '', query = '' } = {}) {
  const q = query.trim().toLowerCase();
  return rows.filter(r =>
    (!rideId || r.rideId === rideId) &&
    (!q || [r.name, r.email, r.phone, r.bike, r.instagram, r.ride].some(v => v.toLowerCase().includes(q))));
}

// ── Writes (payloads only; admin-data.js sends them) ─────────────────────────

/** Moves a waitlisted rider onto the ride. Only public fields are copied (rules enforce it). */
export function promotionUpdates(rideId, person, now = Date.now()) {
  return {
    [`scheduledRides/${rideId}/registrations/${person.key}`]: { name: person.name, bike: person.bike, registeredAt: now },
    [`scheduledRides/${rideId}/waitlist/${person.key}`]: null,
  };
}

/** Ride fields written by the dashboard's form (same keys the app reads). */
export function rideFromForm(f) {
  const ride = {
    rideName: f.rideName.trim(),
    meetingPoint: f.meetingPoint.trim(),
    destination: f.destination.trim(),
    rideDate: f.rideDate,
    type: f.type || 'general',
    emoji: (f.emoji || '').trim() || '🏍️',
    status: f.status || 'scheduled',
  };
  const max = parseInt(f.maxRiders, 10);
  ride.maxRiders = max > 0 ? max : 0;
  const distance = parseInt(f.distance, 10);
  ride.distance = distance > 0 ? distance : null; // null clears it on update()
  ride.notes = (f.notes || '').trim();
  return ride;
}

export function validateRide(ride) {
  const missing = [];
  if (!ride.rideName) missing.push('ride name');
  if (!ride.meetingPoint) missing.push('meeting point');
  if (!ride.destination) missing.push('destination');
  if (!ride.rideDate) missing.push('date and time');
  return missing;
}

// ── Enquiries ─────────────────────────────────────────────────────────────────

export function enquiryRows(data) {
  return Object.entries(data || {})
    .filter(([, e]) => e && typeof e === 'object')
    .map(([id, e]) => ({
      id,
      name: String(e.name || ''),
      email: String(e.email || ''),
      phone: String(e.phone || ''),
      bike: String(e.bike || ''),
      experience: String(e.experience || ''),
      subject: String(e.subject || 'General Enquiry'),
      ride: String(e.ride || ''),
      gear: Array.isArray(e.gear) ? e.gear.map(String) : [],
      notes: String(e.notes || ''),
      at: Number(e.registeredAt || 0),
      handled: e.handled === true,
    }))
    .sort((a, b) => b.at - a.at);
}

// ── Formatting helpers ────────────────────────────────────────────────────────

/** tel: and WhatsApp links. 10-digit numbers are treated as Indian mobiles (+91). */
export function phoneLinks(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  const intl = digits.length === 10 ? '91' + digits : digits.replace(/^0+/, '');
  return { tel: 'tel:+' + intl, whatsapp: 'https://wa.me/' + intl };
}

/** Organiser emails are stored as keys with '.' encoded as ','. */
export const decodeEmailKey = key => String(key).replace(/,/g, '.');

/** Public registration link for a ride (the website's contact form). */
export function registerUrl(base, ride) {
  const u = new URL('contact.html', base);
  u.searchParams.set('ride', ride.name);
  u.searchParams.set('rideId', ride.id);
  return u.toString();
}

/**
 * CSV with a header row. Cells starting with = + - @ (or tab / CR) are prefixed with
 * an apostrophe so spreadsheet apps don't run them as formulas (CSV injection).
 */
export function toCsv(rows, columns) {
  const cell = v => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [columns.map(c => cell(c.label)).join(',')];
  for (const row of rows) lines.push(columns.map(c => cell(c.value(row))).join(','));
  return lines.join('\r\n');
}

export function relativeTime(ms, now = Date.now()) {
  if (!ms) return '';
  const diff = Math.round((now - ms) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff} min ago`;
  const h = Math.round(diff / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} d ago` : new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
