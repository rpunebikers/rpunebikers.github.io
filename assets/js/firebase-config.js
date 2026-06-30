/**
 * PuneBikers — Firebase config
 * Fill in your project values from Firebase Console → Project Settings → Your apps
 * Used by:  rides.html (read upcoming rides)
 *           contact.html (save registrations)
 *           admin.html   (full ride + registration management)
 */
window.PB_FIREBASE = {
  // Realtime Database URL  (required for rides + registrations)
  databaseURL:  'https://rpbmodapp-478617-default-rtdb.asia-southeast1.firebasedatabase.app',

  // These four are only needed for admin.html (Firebase Auth)
  apiKey:       'AIzaSyCVLEZJUchFys-GKd7uujFNYwImiGW10Rc',
  authDomain:   'rpbmodapp-478617.firebaseapp.com',
  projectId:    'rpbmodapp-478617',
  appId:        '1:159976337146:android:01863d0fb7baf79b1c6343',
};
