/**
 * PuneBikers — Firebase config
 * Fill in your project values from Firebase Console → Project Settings → Your apps
 * Used by:  rides.html    (read upcoming rides)
 *           contact.html  (save registrations)
 *           user-auth.js  (rider Google sign-in on public pages)
 *           admin.html    (organiser Google sign-in, ride + registration management)
 * These values are public identifiers, not secrets: access is enforced by the
 * database rules (rpbmodapp/database.rules.json).
 */
window.PB_FIREBASE = {
  // Realtime Database URL  (required for rides + registrations)
  databaseURL:  'https://rpbmodapp-478617-default-rtdb.asia-southeast1.firebasedatabase.app',

  // Firebase Auth (Google sign-in for riders and organisers).
  // appId should be the *Web* app's ID — register one in Firebase Console → Project settings.
  apiKey:       'AIzaSyCVLEZJUchFys-GKd7uujFNYwImiGW10Rc',
  authDomain:   'rpbmodapp-478617.firebaseapp.com',
  projectId:    'rpbmodapp-478617',
  appId:        '1:159976337146:android:01863d0fb7baf79b1c6343',
};
