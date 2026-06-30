/**
 * PuneBikers — Firebase config
 * Fill in your project values from Firebase Console → Project Settings → Your apps
 * Used by:  rides.html (read upcoming rides)
 *           contact.html (save registrations)
 *           admin.html   (full ride + registration management)
 */
window.PB_FIREBASE = {
  // Realtime Database URL  (required for rides + registrations)
  databaseURL:  'https://YOUR-PROJECT-default-rtdb.firebaseio.com',

  // These four are only needed for admin.html (Firebase Auth)
  apiKey:       'YOUR-API-KEY',
  authDomain:   'YOUR-PROJECT.firebaseapp.com',
  projectId:    'YOUR-PROJECT-ID',
  appId:        'YOUR-APP-ID',
};
