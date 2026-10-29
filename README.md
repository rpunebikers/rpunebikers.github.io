# PuneBikers — rpunebikers.github.io

Premium motorcycle touring community website for PuneBikers, Pune's riding brotherhood.

## Pages

- `index.html` — Homepage with hero, featured rides, events, gallery preview
- `about.html` — Story, mission, timeline, riding philosophy, safety culture
- `rides.html` — Ride archive with filter by type (upcoming + past)
- `gallery.html` — Photo gallery with category filter and lightbox
- `routes.html` — Curated route library: Ghats, Coastal, Himalayan, Weekend
- `events.html` — Event listings, registration cards, workshops
- `members.html` — Core team, rider testimonials, member roster
- `contact.html` — Social channels, contact form, membership steps
- `privacy.html` — Privacy Policy (covers this website and the Android app)
- `terms.html` — Terms of Service (covers this website and the Android app)

## Tech Stack

- HTML5, CSS3, Vanilla JavaScript
- Google Fonts: Bebas Neue + Inter
- GitHub Pages hosting

## Design

Dark theme · Glassmorphism UI · WCAG 2.2 AA accessible · Mobile-first · Reduced-motion support

## Firebase

The site shares the `rpbmodapp-478617` Realtime Database with the [rpbmodapp](https://github.com/pranavpankhawala/rpbmodapp) Android app:

- `rides.html` reads `scheduledRides/` (public read)
- `contact.html?rideId=…` sends one atomic PATCH: `scheduledRides/{rideId}/registrations/{name}` gets only `name`, `bike`, `registeredAt` (public — `rides.html` lists it), and email / phone / Instagram / notes go to `rideContacts/{rideId}/{name}` (create-only, admins read). The rules reject any other field in the public entry.
- `contact.html` enquiries append to `registrations/` (create-only; admins read)
- `admin.html` — organisers **Sign in with Google**. Access is the same `admins/` email list the app uses: a listed, verified Google account claims `adminUids/{uid}` on first sign-in (the rules allow nothing else), and any other account is signed out
- `assets/js/user-auth.js` — optional rider **Sign in with Google** on public pages (navbar button). Signed-in ride registrations prefill name/email, send the ID token, and store the rider's `uid` on their `rideContacts` record so it is linked to their account. Independent of `admin.html`.

Google sign-in needs, in Firebase Console → Authentication: the Google provider enabled, and `rpunebikers.github.io` under **Settings → Authorized domains**. Register a **Web app** (Project settings) and put its `apiKey` / `appId` in `assets/js/firebase-config.js` if the current Android key is restricted to Android apps.

The database security rules live **only** in `rpbmodapp/database.rules.json` and are deployed from that repo (`firebase deploy --only database`). Don't keep a copy here — the last deploy wins, so two copies overwrite each other.

## Legal

`privacy.html` and `terms.html` are the canonical policy URLs for both the website and the app (Play Console, OAuth consent screen and the app's login screen all link here). When you change either document, update its "Last updated" date and bump `LegalLinks.VERSION` in the app so signed-in riders are asked to accept the new version.
