// Run from the repo root: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRideDate, formatRideDate, toDatetimeLocal, summarizeRide, sortRides, computeStats,
  registrationRows, filterRows, promotionUpdates, rideFromForm, validateRide, enquiryRows,
  phoneLinks, decodeEmailKey, registerUrl, toCsv,
} from '../assets/admin/admin-logic.js';

const NOW = new Date(2026, 10, 2, 10, 0); // Mon 2 Nov 2026, 10:00

test('parses the app format (no year) into this year or next', () => {
  assert.deepEqual(parseRideDate('Sun 8 Nov, 5:30 AM', NOW), new Date(2026, 10, 8, 5, 30));
  assert.deepEqual(parseRideDate('Sat 31 Oct, 6:00 PM', NOW), new Date(2026, 9, 31, 18, 0)); // recent past stays
  assert.deepEqual(parseRideDate('Sun 10 Jan, 7:00 AM', NOW), new Date(2027, 0, 10, 7, 0)); // far past → next year
});

test('parses the other stored formats', () => {
  assert.deepEqual(parseRideDate('12 Dec 2026, 09:15 AM', NOW), new Date(2026, 11, 12, 9, 15));
  assert.deepEqual(parseRideDate('Sat, 12 Dec 2026', NOW), new Date(2026, 11, 12));
  assert.deepEqual(parseRideDate('2026-12-12', NOW), new Date(2026, 11, 12));
  assert.deepEqual(parseRideDate('12/12/2026', NOW), new Date(2026, 11, 12));
  assert.deepEqual(parseRideDate('December 12, 2026', NOW), new Date(2026, 11, 12));
  assert.deepEqual(parseRideDate('12 Dec 2026, 21:05', NOW), new Date(2026, 11, 12, 21, 5));
});

test('rejects nonsense', () => {
  for (const s of ['', 'soon', '31 Feb 2026', '12 Foo 2026', '5 Nov, 13:00 PM', null]) assert.equal(parseRideDate(s, NOW), null, String(s));
});

test('formats in the app format and round-trips', () => {
  const d = new Date(2026, 10, 8, 5, 30);
  assert.equal(formatRideDate(d), 'Sun 8 Nov, 5:30 AM');
  assert.equal(formatRideDate(new Date(2026, 10, 8, 12, 5)), 'Sun 8 Nov, 12:05 PM');
  assert.deepEqual(parseRideDate(formatRideDate(d), NOW), d);
  assert.equal(toDatetimeLocal(d), '2026-11-08T05:30');
});

const rides = {
  a: { rideName: 'Tamhini', rideDate: 'Sun 8 Nov, 5:30 AM', status: 'scheduled', maxRiders: 2,
       registrations: { Amy: { name: 'Amy', bike: 'Duke', registeredAt: NOW - 1000 }, Bo: { name: 'Bo', registeredAt: NOW - 10 * 864e5 } },
       waitlist: { Cy: { name: 'Cy', bike: 'R15', joinedAt: NOW - 500 } } },
  b: { rideName: 'Lavasa', rideDate: 'Sat 7 Nov, 6:00 AM', status: 'scheduled' },
  c: { rideName: 'Old', rideDate: '2026-10-01', status: 'completed', registrations: { Dee: { name: 'Dee', registeredAt: NOW - 100 } } },
  d: { rideName: 'Capped empty', rideDate: 'Sat 14 Nov, 6:00 AM', status: 'active', maxRiders: 5 },
};
const contacts = { a: { Amy: { phone: '9876543210', email: 'amy@x.in', uid: 'u1' } } };
const list = Object.entries(rides).map(([id, r]) => summarizeRide(id, r, contacts[id], NOW));

test('summarizes a ride with private contacts merged', () => {
  const a = list.find(r => r.id === 'a');
  assert.equal(a.registered.length, 2);
  assert.equal(a.registered[0].name, 'Bo'); // oldest sign-up first
  assert.equal(a.registered[1].phone, '9876543210');
  assert.equal(a.registered[1].linked, true);
  assert.equal(a.spotsLeft, 0);
  assert.equal(a.fill, 1);
  assert.equal(a.waitlist[0].name, 'Cy');
});

test('sorts open rides soonest first, then closed', () => {
  assert.deepEqual(sortRides(list).map(r => r.id), ['b', 'a', 'd', 'c']);
});

test('stats count only open rides', () => {
  assert.deepEqual(computeStats(list, NOW.getTime()), { openRides: 3, signupsThisWeek: 2, waitlisted: 1, openSpots: 5 });
  assert.equal(computeStats([summarizeRide('x', { status: 'scheduled' })], NOW.getTime()).openSpots, null);
});

test('registration rows and filters', () => {
  const rows = registrationRows(list);
  assert.equal(rows.length, 4); // a: 2 registered + 1 waitlist, c: 1
  assert.equal(filterRows(rows, { query: 'AMY@x' }).length, 1);
  assert.equal(filterRows(rows, { rideId: 'a' }).length, 3);
});

test('promotion copies public fields only', () => {
  const cy = list.find(r => r.id === 'a').waitlist[0];
  assert.deepEqual(promotionUpdates('a', { ...cy, phone: '9' }, 7), {
    'scheduledRides/a/registrations/Cy': { name: 'Cy', bike: 'R15', registeredAt: 7 },
    'scheduledRides/a/waitlist/Cy': null,
  });
});

test('ride form → ride fields', () => {
  const ride = rideFromForm({ rideName: ' X ', meetingPoint: 'A', destination: 'B', rideDate: 'Sun 8 Nov, 5:30 AM', maxRiders: '', distance: '120', emoji: '', notes: ' n ' });
  assert.deepEqual(ride, { rideName: 'X', meetingPoint: 'A', destination: 'B', rideDate: 'Sun 8 Nov, 5:30 AM', type: 'general', emoji: '🏍️', status: 'scheduled', maxRiders: 0, distance: 120, notes: 'n' });
  assert.equal(rideFromForm({ rideName: 'X', meetingPoint: 'A', destination: 'B', rideDate: 'd', distance: '' }).distance, null);
  assert.deepEqual(validateRide(rideFromForm({ rideName: '', meetingPoint: 'A', destination: '', rideDate: '' })), ['ride name', 'destination', 'date and time']);
});

test('enquiries', () => {
  const rows = enquiryRows({ e1: { name: 'A', registeredAt: 1, gear: ['Helmet: Yes'] }, e2: { name: 'B', registeredAt: 2, handled: true }, bad: 'x' });
  assert.deepEqual(rows.map(r => [r.id, r.handled]), [['e2', true], ['e1', false]]);
  assert.deepEqual(rows[1].gear, ['Helmet: Yes']);
});

test('phone links', () => {
  assert.deepEqual(phoneLinks('98765 43210'), { tel: 'tel:+919876543210', whatsapp: 'https://wa.me/919876543210' });
  assert.deepEqual(phoneLinks('+91-98765-43210'), { tel: 'tel:+919876543210', whatsapp: 'https://wa.me/919876543210' });
  assert.equal(phoneLinks('12'), null);
});

test('misc helpers', () => {
  assert.equal(decodeEmailKey('boss@gmail,com'), 'boss@gmail.com');
  assert.equal(registerUrl('https://rpunebikers.github.io/admin.html', { id: 'r1', name: 'Ghats & Co' }),
    'https://rpunebikers.github.io/contact.html?ride=Ghats+%26+Co&rideId=r1');
});

test('CSV quotes and defuses formulas', () => {
  const csv = toCsv([{ a: '=HYPERLINK("x")', b: 'Pune, MH' }, { a: '+91 98765', b: 'ok' }],
    [{ label: 'A', value: r => r.a }, { label: 'B', value: r => r.b }]);
  assert.equal(csv, 'A,B\r\n"\'=HYPERLINK(""x"")","Pune, MH"\r\n\'+91 98765,ok');
});
