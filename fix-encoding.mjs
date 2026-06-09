import { readFileSync, writeFileSync } from 'fs';

const file = 'src/routes/admin/index.tsx';
let t = readFileSync(file, 'utf8');

// Fix em-dash (control char \u0014 from broken encoding -> proper em-dash)
t = t.replaceAll('\u0014', '\u2014');

// Fix arrow (from broken encoding)
t = t.replaceAll('Ã¢â Â', '\u2190');

// Fix middle dot sequences
t = t.replaceAll('Ã¢â¬Ã¢â¬', '\u2500\u2500');

// Fix checkmark in "used" column
t = t.replaceAll('Ã¢Å\u001C', '\u2713');

// Fix route arrows shown as two spaces — replace with →
// In schedules table: {s.from}  {s.to}
t = t.replaceAll('{s.from}  {s.to}', '{s.from} \u2192 {s.to}');
// In coach feedback table
t = t.replaceAll('{f.from_station}  {f.to_station}', '{f.from_station} \u2192 {f.to_station}');
// In timetable table
t = t.replaceAll('{String(e.from_station ?? "")}  {String(e.to_station ?? "")}', '{String(e.from_station ?? "")} \u2192 {String(e.to_station ?? "")}');
// In ticket recovery table
t = t.replaceAll('{t.from_station}  {t.to_station}', '{t.from_station} \u2192 {t.to_station}');
// In ticket detail panel
t = t.replaceAll('`${selected.from_station}  ${selected.to_station}`', '`${selected.from_station} \u2192 ${selected.to_station}`');
// In train updates list
t = t.replaceAll('Train #{u.train_no}  {u.station}  {u.line}', 'Train #{u.train_no} \u00b7 {u.station} \u00b7 {u.line}');
// In train detail
t = t.replaceAll('`#${selected.train_no}  ${selected.line}`', '`#${selected.train_no} \u00b7 ${selected.line}`');
// In alerts: line separator
t = t.replaceAll('`${a.line}  `', '`${a.line} \u00b7 `');

// Fix overview table route
t = t.replaceAll('{s.from}  {s.to}', '{s.from} \u2192 {s.to}');

// Fix placeholders with & (these were ellipsis …)
t = t.replaceAll('Select a station&', 'Select a station\u2026');
t = t.replaceAll('e.g. Cable theft, signal failure, track maintenance&', 'e.g. Cable theft, signal failure, track maintenance\u2026');
t = t.replaceAll('{loading ? "Sending&"', '{loading ? "Sending\u2026"');
t = t.replaceAll('"Sending&"', '"Sending\u2026"');
t = t.replaceAll('"Saving&"', '"Saving\u2026"');
t = t.replaceAll('"Searching&"', '"Searching\u2026"');
t = t.replaceAll('transaction ID&"', 'transaction ID\u2026"');
t = t.replaceAll('Search by email or station&"', 'Search by email or station\u2026"');

// Fix ← back to site link  
t = t.replaceAll('\u2190 Public site', '\u2190 Public site');

// Fix Detail label dash values
t = t.replaceAll('?? "\u2014"', '?? "\u2014"');

writeFileSync(file, t, 'utf8');
console.log('Done');
