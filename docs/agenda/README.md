# Calendar UI (#11)

The calendar provides year (12 months), month and day views. Use minus/plus to change level; wheel scrolling does not change level. Clicking any day opens its complete, time-sorted list, including simultaneous appointments. Previous/next follow the current level; Today selects the local current date.

Appointment buttons and `?appointmentId=...` links open a native modal dialog with date, time, type, status, client, owner and job. Escape closes the dialog. Contact opens the selected client's email composer, without sending mail automatically. Open job navigates to the linked job. Appointment links from clients/jobs match IDs rather than names.

All calendar UI labels use `src/front/i18n/agenda.js` (English, Spanish, Portuguese). Locale-aware dates use Intl; appointment titles and names remain source data. The existing application shell is outside this ticket's translation scope.

## Data boundary

This is the frontend calendar ticket. Data comes from sharedAppointments; additions/deletions last only while this page is mounted, as disclosed in the UI. Persistence, availability and scheduling conflict detection belong to #28. New demo appointments select an actual fixture client and a matching fixture job. Job cards created by the existing demo modal pass their record to the detail route; an unknown ID no longer silently opens a different job.

## Verification

- `npm run build`
- `TZ=Europe/Madrid node --test tests/frontend/calendar.test.mjs`
- `TZ=Pacific/Auckland node --test tests/frontend/calendar.test.mjs`
- Check all 12 months, leap February, midnight/DST date round trips, chronological ordering and simultaneous appointments.
- Browser: year/month/day controls, empty days, appointment deep link, detail dialog, contact/job targets and language selector.

The session/subscription guard from #55 remains unchanged. For integrated testing run Flask on the configured VITE_BACKEND_URL and use a real account with a valid subscription. Connection refused means the browser cannot reach that backend; do not remove the guard to work around it.
