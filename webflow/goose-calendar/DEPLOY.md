# Goose Creek Village — Calendar Deployment Guide

**Site:** www.goosecreekvillage.com
**Webflow Site ID:** `638509fe04de4c0d1ceb82c2`
**Workspace:** `6310e528fa8518632a5c2b2f`
**Based on:** Explore Museum / RTC enhanced calendar (gallery images, add-to-calendar dropdown, CMS category colors)
**Target page:** `/events` (replaces existing third-party `data-events-calendar-app` embed)

---

## Brand applied

| Token | Hex | Usage |
|---|---|---|
| Peru | `#bc7f43` | Primary buttons, toolbar, today highlight, add-to-calendar accent |
| Saddle Brown | `#5c4024` | Headings, modal "View Details" CTA, default event color |
| Sandy Brown | `#ebac6e` | Family & Kids category, hover accents |
| Dim Grey | `#4d4d4d` | Body text, list view, card titles |

**Fonts (already loaded by site WebFont):** Roboto Serif (headings), Roboto (body), Montserrat (UI buttons), Merriweather (fallback).

---

## Step 1 — CMS Collection ("Calendar Events")

Created via the Webflow API on site `638509fe04de4c0d1ceb82c2`.

### Fields

| Field | Slug | Type | Required | Notes |
|---|---|---|---|---|
| Event Name | `name` | PlainText | Yes | Page title |
| Slug | `slug` | PlainText | Yes | Auto |
| Start Date/Time | `start-date-time` | DateTime | Yes | Time required |
| End Date/Time | `end-date-time` | DateTime | No | Null = +1 hour |
| All Day Event | `all-day-event` | Switch | No | |
| Recurring | `recurring` | Switch | No | |
| Frequency | `frequency` | Option | No | Daily / Weekly / Bi-Weekly / Monthly / Yearly |
| Day of Week | `day-of-week` | Option | No | Mon..Sun |
| Week of Month | `week-of-month` | Option | No | 1st / 2nd / 3rd / 4th / Last |
| Recurrence End Date | `recurrence-end-date` | DateTime | No | |
| Category | `category` | Option | No | See below |
| Short Summary | `short-summary` | PlainText | No | Modal + list |
| Full Description | `full-description` | RichText | No | Detail page |
| Hero Image | `hero-image` | Image | No | Modal + detail |
| Gallery Images | `gallery-images` | MultiImage | No | Random shown in modal |
| Cost | `cost` | PlainText | No | "Free", "$15", etc. |
| External Link | `external-link` | Link | No | |
| RSVP / Ticket Link | `rsvp-ticket-link` | Link | No | |
| Event Status | `event-status` | Option | No | Scheduled / Cancelled / Postponed |
| Featured Event | `featured-event` | Switch | No | Bold in calendar |
| Sort Priority | `sort-priority` | Number | No | |
| Publish to Website | `publish-to-website` | Switch | No | Filter in CMS list |
| SEO Title | `seo-title` | PlainText | No | |
| SEO Description | `seo-description` | PlainText | No | |

### Category options

1. Sales & Promotions
2. Live Music
3. Food & Dining
4. Family & Kids
5. Wellness & Fitness
6. Seasonal & Holiday
7. Community
8. Workshops & Classes
9. Grand Openings
10. Other

---

## Step 2 — `/events` page setup

1. Open `/events` in Webflow Designer.
2. **Remove or disable** the existing third-party embed:
   `<div data-events-calendar-app data-project-id="proj_BDySVVy2NIn31jbCwZrvO">`
3. Add a **CMS Collection List** bound to "Calendar Events":
   - Set wrapper `display: none` via inline style (NOT Webflow's "hidden" toggle, which removes it from the DOM)
   - Inside each item, place elements with these `data-field` attributes:
     - `data-field="name"` → Event Name
     - `data-field="start-date-time"` → Start Date/Time (format MUST include time)
     - `data-field="end-date-time"` → End Date/Time (format MUST include time)
     - `data-field="all-day-event"` → All Day (conditional visibility)
     - `data-field="recurring"` → Recurring (conditional visibility)
     - `data-field="frequency"` → Frequency
     - `data-field="day-of-week"` → Day of Week
     - `data-field="week-of-month"` → Week of Month
     - `data-field="recurrence-end-date"` → Recurrence End Date (with time)
     - `data-field="category"` → Category
     - `data-field="short-summary"` → Short Summary
     - `data-field="cost"` → Cost
     - `data-field="hero-image"` → IMG element bound to Hero Image
     - `<a href="{detail page link}">` → Link block to event detail page
4. Add a `<div id="divCalendar"></div>` where the calendar should render.
5. Page Settings → Custom Code:
   - **Head Code** → paste contents of `goose-head-code.html`
   - **Footer Code** → paste contents of `goose-footer-code.html` (includes config + modal)
6. Publish.

---

## Step 3 — CDN

After committing the new files:

```bash
cd /Users/markburlinson/Claude_code/git-repo/Claude-Code-Repo
git add webflow/goose-calendar/
git commit -m "Add Goose Creek Village calendar tool"
git tag v1.0.6
git push origin main --tags
```

CDN URLs (after tag push):
- JS:  `https://cdn.jsdelivr.net/gh/mburlinson/Claude-Code-Repo@v1.0.6/webflow/goose-calendar/goose-calendar.js`
- CSS: `https://cdn.jsdelivr.net/gh/mburlinson/Claude-Code-Repo@v1.0.6/webflow/goose-calendar/goose-calendar.css`

**Always create a NEW tag for updates.** Reusing or moving a tag does NOT bust jsDelivr cache.
