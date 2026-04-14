# Explore! Children's Museum — Calendar Deployment Guide

**Site:** exploremuseum.org
**Webflow Site ID:** `5632974a224fd5d015056fac`
**Based on:** RTC Calendar (enhanced version with gallery images, add-to-calendar, CMS category colors)

---

## Brand Colors Applied

| Token | Hex | Usage |
|---|---|---|
| Deep Sky Blue | `#00a7e1` | Buttons, toolbar, today highlight, add-to-cal |
| Explore Red | `#d71635` | Modal "View Details" button, close hover |
| Dark Slate Gray | `#353538` | Text, default event color, modal overlay |
| Medium Turquoise | `#45c5d6` | Kids & Family category |
| Medium Violet Red | `#db1464` | Arts & Culture category |
| Crimson | `#d90246` | Mission Mobile category |

**Fonts:** museo-slab (headings/titles), Open Sans (body), Oswald (nav — matches site)

---

## Pre-Deployment Checklist (before Webflow comes back online)

- [x] JS file created (`explore-calendar.js`)
- [x] CSS file created (`explore-calendar.css`)
- [x] Head code snippet ready (`explore-head-code.html`)
- [x] Footer code snippet ready (`explore-footer-code.html`)
- [x] Modal HTML with Add to Calendar dropdown included
- [x] Location set to "Explore! Children's Museum, Fort Totten, Washington, DC"
- [x] Categories mapped to museum programming
- [ ] Push to GitHub and create version tag (v1.0.5)
- [ ] Create "Calendar Events" CMS collection via Webflow API
- [ ] Create `/calendar` page in Webflow Designer
- [ ] Add hidden CMS collection list with data-field attributes
- [ ] Add `#divCalendar` container div
- [ ] Paste head/footer code in Page Settings
- [ ] Add test events (one-time + recurring)
- [ ] Verify calendar renders, modal works, Add to Calendar links work
- [ ] Publish site

---

## Step 1: Create CMS Collection — "Calendar Events"

### Via Webflow API (when available)

```
POST /v2/collections
Site ID: 5632974a224fd5d015056fac
```

### Fields to Create

| Field | Slug | Type | Required | Notes |
|---|---|---|---|---|
| Event Name | `name` | PlainText | Yes | Also page title |
| Slug | `slug` | PlainText | Yes | Auto-generated |
| Start Date/Time | `start-date-time` | DateTime | Yes | Include time in format |
| End Date/Time | `end-date-time` | DateTime | No | Null = 1hr default |
| All Day Event | `all-day-event` | Switch | No | |
| Recurring | `recurring` | Switch | No | |
| Frequency | `frequency` | Option | No | Daily, Weekly, Bi-Weekly, Monthly, Yearly |
| Day of Week | `day-of-week` | Option | No | Mon, Tue, Wed, Thu, Fri, Sat, Sun |
| Week of Month | `week-of-month` | Option | No | 1st, 2nd, 3rd, 4th, Last |
| Recurrence End Date | `recurrence-end-date` | DateTime | No | |
| Category | `category` | Option | No | See categories below |
| Short Summary | `short-summary` | PlainText | No | Modal + list view |
| Full Description | `full-description` | RichText | No | Detail page |
| Hero Image | `hero-image` | Image | No | Modal + detail page |
| Gallery Images | `gallery-images` | MultiImage | No | Random shown in modal |
| Cost | `cost` | PlainText | No | "Free", "$10", etc. |
| External Link | `external-link` | Link | No | |
| RSVP / Ticket Link | `rsvp-ticket-link` | Link | No | |
| Event Status | `event-status` | Option | No | Scheduled, Cancelled, Postponed |
| Featured Event | `featured-event` | Switch | No | Bold in calendar |
| Sort Priority | `sort-priority` | Number | No | Manual sort |
| Publish to Website | `publish-to-website` | Switch | No | Filter in CMS list |
| SEO Title | `seo-title` | PlainText | No | |
| SEO Description | `seo-description` | PlainText | No | |

### Category Options (for the `category` Option field)

1. Classes & Workshops
2. Community Events
3. Kids & Family
4. Arts & Culture
5. Fitness & Movement
6. Music & Entertainment
7. Seasonal & Holiday
8. Mission Mobile
9. Maker Space
10. Other

---

## Step 2: Create Calendar Page

Create a new page at `/calendar` in the Webflow Designer.

### Page Elements

1. **Hidden CMS Collection List** — bound to "Calendar Events"
   - Set `display: none` on wrapper (NOT Webflow "hidden" toggle)
   - Inside each item, add elements with `data-field` attributes:
     - `data-field="name"` → Event Name
     - `data-field="start-date-time"` → Start Date/Time (format MUST include time)
     - `data-field="end-date-time"` → End Date/Time (format MUST include time)
     - `data-field="all-day-event"` → All Day Event (conditional visibility)
     - `data-field="recurring"` → Recurring (conditional visibility)
     - `data-field="frequency"` → Frequency
     - `data-field="day-of-week"` → Day of Week
     - `data-field="week-of-month"` → Week of Month
     - `data-field="recurrence-end-date"` → Recurrence End Date (include time)
     - `data-field="category"` → Category
     - `data-field="short-summary"` → Short Summary
     - `data-field="cost"` → Cost
     - `data-field="hero-image"` → Hero Image (IMG element, bind src)
     - `<a href="{detail page link}">` → Link block to event detail page

2. **Calendar Container** — `<div id="divCalendar">`

3. **Modal** — included in footer code embed (no need to build in Designer)

### Custom Code

- **Head Code:** Paste contents of `explore-head-code.html`
- **Footer Code:** Paste contents of `explore-footer-code.html`

---

## Step 3: CDN Setup

After pushing to GitHub:

```bash
cd /Users/markburlinson/Claude_code/git-repo/Claude-Code-Repo
git add webflow/explore-calendar/
git commit -m "Add Explore! Museum calendar tool"
git tag v1.0.5
git push origin main --tags
```

CDN URLs (after tag push):
- JS: `https://cdn.jsdelivr.net/gh/mburlinson/Claude-Code-Repo@v1.0.5/webflow/explore-calendar/explore-calendar.js`
- CSS: `https://cdn.jsdelivr.net/gh/mburlinson/Claude-Code-Repo@v1.0.5/webflow/explore-calendar/explore-calendar.css`

**Important:** Always create a NEW tag for updates. Reusing/moving tags does NOT bust jsDelivr cache.

---

## Existing Events Page

The site already has an `/events` page with CMS-driven event cards (collection ID `5845caa5b2c8cdca6c2a2d99`). The new calendar can either:
- **Option A:** Add to the existing `/events` page alongside the card grid
- **Option B:** Create a separate `/calendar` page and link from nav/events page

The existing Events collection uses different field slugs, so a NEW "Calendar Events" collection is recommended for the calendar tool's structured recurrence fields.
