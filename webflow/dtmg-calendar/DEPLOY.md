# Do The Most Good — Calendar Deployment Guide

**Site:** dothemostgood.org (Montgomery County MD)
**Webflow Site ID:** `68c028bf6ec18e23c4cdbe41`
**Event Types Collection ID:** `68fa73f96e3221988059f754`
**Based on:** rtc-calendar (cloned) + explore-calendar Weekdays/Weekends rrule cases

---

## Brand Colors Applied

| Token | Hex | Usage |
|---|---|---|
| Dark Blue | `#153a43` | Text, modal overlay, toolbar title |
| Blue (primary accent) | `#389bb4` | Toolbar buttons, today highlight, modal CTA |
| Elections category | `#99cffe` | Light blue (from live CMS hsla(208, 97%, 80%)) |
| Community category | `#5fee82` | Green (from live CMS hsla(135, 81%, 65%)) |
| Fundraising category | `#7ed4ea` | Light blue (from live CMS hsla(192, 72%, 71%)) |
| Canvassing category | `#ff4401` | Vermillion (from live CMS hsla(16, 100%, 50%)) |
| Other fallback | `#6b7280` | Neutral gray |

Category colors sourced live from Webflow API on 2026-08-07. Re-fetch if CMS colors change:
```bash
TOKEN=$(grep '^WEBFLOW_PROD_BEARER=' /Users/markburlinson/Claude_code/.env | cut -d= -f2-)
curl -s "https://api.webflow.com/v2/collections/68fa73f96e3221988059f754/items" \
  -H "Authorization: Bearer $TOKEN" -H "accept-version: 2.0.0"
```

---

## Files

| File | Purpose |
|---|---|
| `dtmg-calendar.js` | Main calendar script |
| `dtmg-calendar.css` | Styles (DTMG brand colors) |
| `dtmg-head-code.html` | Paste into Page Settings → Head Code |
| `dtmg-footer-code.html` | Paste into Page Settings → Footer Code |

---

## CDN Release Process

jsDelivr serves files by **immutable git tag** — it caches per tag forever.
Every release requires a **new tag**. Never reuse or move an existing tag.

```bash
# From repo root — after Mark approves and files are committed:
git tag vX.Y.Z
git push origin main --tags
```

CDN URLs after tag push (replace `vX.Y.Z` with actual tag):
- JS:  `https://cdn.jsdelivr.net/gh/mburlinson/Claude-Code-Repo@vX.Y.Z/webflow/dtmg-calendar/dtmg-calendar.js`
- CSS: `https://cdn.jsdelivr.net/gh/mburlinson/Claude-Code-Repo@vX.Y.Z/webflow/dtmg-calendar/dtmg-calendar.css`

Snippets are pinned to `v1.0.10`. For a future release: bump the tag in both `dtmg-head-code.html` and `dtmg-footer-code.html`, re-tag, and purge jsDelivr.

**Cache busting after a hotfix:** If you push a correction under the same tag (not recommended), purge via:
`https://purge.jsdelivr.net/gh/mburlinson/Claude-Code-Repo@vX.Y.Z/webflow/dtmg-calendar/dtmg-calendar.js`

**SRI hashes** for the three pinned npm dependencies are already set in `dtmg-head-code.html`. If you upgrade FullCalendar or rrule versions, recompute:
```bash
curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A
```

---

## Webflow Setup Checklist

- [ ] Push files to GitHub + create version tag
- [x] Snippets pinned to v1.0.10
- [ ] Create `/calendar` page in Webflow Designer
- [ ] Add hidden CMS collection list bound to "Calendar Events" collection
  - Elements need `data-field` attributes (see explore-calendar DEPLOY.md for full field list)
- [ ] Add `<div id="divCalendar">` container on the page
- [ ] Paste `dtmg-head-code.html` into Page Settings → Head Code
- [ ] Paste `dtmg-footer-code.html` into Page Settings → Footer Code
- [ ] Add test events (one-time + recurring, at least one per category)
- [ ] Verify calendar renders, modal opens, Add to Calendar links work
- [ ] Publish site

---

## Frequency Options (for the CMS `frequency` field)

The `buildRRule` function handles these exact option strings:

| Option | RRULE output |
|---|---|
| Daily | `FREQ=DAILY` |
| Weekdays (Mon-Fri) | `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR` |
| Weekends (Sat-Sun) | `FREQ=WEEKLY;BYDAY=SA,SU` |
| Weekly | `FREQ=WEEKLY` (+ day-of-week) |
| Bi-Weekly | `FREQ=WEEKLY;INTERVAL=2` (+ day-of-week) |
| Monthly | `FREQ=MONTHLY` (+ week-of-month + day-of-week) |
| Yearly | `FREQ=YEARLY` |

## Review notes (2026-08-07)

- **Light category pills:** Community (`#5fee82`) and Elections (`#99cffe`) fail WCAG AA as pill backgrounds with white text (~1.5:1 / ~2.1:1). Before launch, either darken those CMS colors with the client or give light pills dark text / a border.
- **Modal placement:** the modal HTML in `dtmg-footer-code.html` should be added as a page-level Embed element (the JS portals it to `<body>`), not literally pasted into footer custom code.
