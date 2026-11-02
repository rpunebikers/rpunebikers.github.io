/**
 * Organiser dashboard — data access. The only module that talks to Firebase
 * (compat SDK, loaded by admin.html). Every write is also enforced by
 * rpbmodapp/database.rules.json; nothing here is a security boundary.
 */

let auth = null;
let db = null;

export function init(cfg) {
  if (!window.firebase || !cfg || !cfg.databaseURL || cfg.databaseURL.includes('YOUR-PROJECT')) return false;
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
  auth = app.auth();
  db = app.database();
  // Test hook: only a page script can set this; production never does.
  const emu = window.PB_EMULATORS;
  if (emu) {
    if (emu.auth) auth.useEmulator(emu.auth);
    if (emu.database) db.useEmulator(...emu.database);
  }
  return true;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const onAuthChange = cb => auth.onAuthStateChanged(cb);
export const redirectResult = () => auth.getRedirectResult();
export const signOut = () => auth.signOut();

export function signIn() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return auth.signInWithPopup(provider).catch(e => {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      return auth.signInWithRedirect(provider);
    }
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return null;
    throw e;
  });
}

const emailKey = email => email.toLowerCase().replace(/\./g, ',');

/**
 * True when the user is an organiser. A verified Google account whose email is listed under
 * admins/ claims adminUids/{uid} on first sign-in — the rules allow exactly that and nothing more.
 */
export async function verifyOrganiser(user) {
  if ((await db.ref('adminUids/' + user.uid).get()).val() === true) return true;
  if (!user.email || !user.emailVerified) return false;
  if ((await db.ref('admins/' + emailKey(user.email)).get()).val() !== true) return false;
  await db.ref('adminUids/' + user.uid).set(true);
  return true;
}

// ── Live data ─────────────────────────────────────────────────────────────────

/** Subscribes to a path; returns an unsubscribe function. */
function watch(path, onData, onError) {
  const ref = db.ref(path);
  const handler = snap => onData(snap.val() || {});
  ref.on('value', handler, err => onError && onError(err));
  return () => ref.off('value', handler);
}

export const watchRides = (onData, onError) => watch('scheduledRides', onData, onError);
export const watchContacts = (onData, onError) => watch('rideContacts', onData, onError);
export const watchEnquiries = (onData, onError) => watch('registrations', onData, onError);
export const watchOrganisers = (onData, onError) => watch('admins', onData, onError);

// ── Writes ────────────────────────────────────────────────────────────────────

export function createRide(ride, adminName) {
  const ref = db.ref('scheduledRides').push();
  return ref.set({ ...ride, rideId: ref.key, adminName: adminName || '', createdAt: Date.now() }).then(() => ref.key);
}

/** update() keeps registrations, waitlist and every app-only field (coordinates, checklist…). */
export const updateRide = (rideId, ride) => db.ref('scheduledRides/' + rideId).update(ride);

/** Same paths the app's cancel writes. The app also sends a push; the website can't. */
export const cancelRide = rideId => db.ref().update({
  [`scheduledRides/${rideId}/status`]: 'cancelled',
  [`scheduledRides/${rideId}/activeRideId`]: '',
});

export const reopenRide = rideId => db.ref(`scheduledRides/${rideId}/status`).set('scheduled');

export const deleteRide = rideId => db.ref().update({
  [`scheduledRides/${rideId}`]: null,
  [`rideContacts/${rideId}`]: null,
});

export const applyUpdates = updates => db.ref().update(updates);

export function setEnquiryHandled(id, handled, by) {
  return db.ref('registrations/' + id).update(handled
    ? { handled: true, handledBy: by || '', handledAt: Date.now() }
    : { handled: null, handledBy: null, handledAt: null });
}
