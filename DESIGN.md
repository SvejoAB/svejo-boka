---
name: Svejo Boka
description: Johan's booking widget and owner calendar, built on Google Calendar's working conventions with shadcn/ui.
colors:
  primary: "#0b57d0"
  primary-foreground: "#ffffff"
  shell: "#f8fafd"
  background: "#ffffff"
  foreground: "#1f1f1f"
  muted-foreground: "#5f6368"
  muted: "#f1f3f4"
  secondary: "#e9eef6"
  border: "#dadce0"
  input: "#c4c7c5"
  selected: "#c2e7ff"
  selected-foreground: "#001d35"
  now: "#ea4335"
  destructive: "#b3261e"
  ev-booked: "#0b57d0"
  ev-free: "#e8f0fe"
  ev-free-fg: "#0842a0"
  ev-school: "#e8e6f6"
  ev-school-fg: "#3c3489"
  ev-busy: "#d4efe9"
  ev-busy-fg: "#00574b"
  ev-sport: "#e3f3e6"
  ev-sport-fg: "#0d652d"
  ev-gap: "#f1f3f4"
  ev-gap-fg: "#5f6368"
  ev-closed: "#f6e7e6"
  ev-closed-fg: "#8c1d18"
  ev-holiday: "#fce8e6"
  ev-holiday-fg: "#a50e0e"
typography:
  display:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\" 1, \"cv11\" 1"
  headline:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    fontFeature: "\"tnum\" 1, \"cv11\" 1"
  title:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.375
  title-sm:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
  body:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
    fontFeature: "\"tnum\" 1, \"cv11\" 1"
  event:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "18px"
  label:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0.025em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  half-hour: "24px"
  gutter: "56px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "36px"
  button-ghost-destructive:
    textColor: "{colors.destructive}"
    rounded: "{rounded.full}"
    padding: "0 12px"
    height: "32px"
  time-slot:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    height: "44px"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "4px 12px"
  day-cell-today:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.full}"
    size: "44px"
  event-booked:
    backgroundColor: "{colors.ev-booked}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  event-free:
    backgroundColor: "{colors.ev-free}"
    textColor: "{colors.ev-free-fg}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  card:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.xl}"
---

# Design System: Svejo Boka

## Overview

**Creative North Star: "The Calendar You Already Read"**

Both screens borrow the working conventions of Google Calendar so nobody has to learn them. The owner view at `/admin` reads like a normal week or month calendar: a pale shell with a top bar and sidebar, a white rounded canvas, a half-hour grid with an hour gutter, rounded event blocks tinted by kind, and a red now-line. The public widget follows Google's appointment booking page: one white card on the shell, person and meeting facts on the left, a month calendar in the middle, the day's times as outlined buttons on the right, then the form in the same card.

The system is light, calm and dense where the job is reading (the week grid) and roomy where the job is choosing (the widget). One blue carries every primary action, the selection and today. Everything is built from shadcn/ui (new-york) components with Tailwind tokens; the look is Google-familiar, never Google-branded. It replaced an almanac-styled first version that Johan rejected; nothing from that world remains.

**Key Characteristics:**
- Pale shell (`shell`) around white working surfaces.
- One blue accent for primary actions, selection and today.
- Every closed time in the owner grid is a named, tinted block with a reason.
- Round day cells everywhere a date is pickable or marked.
- Pill-shaped action buttons; Inter with tabular figures; no display face.
- No Google logos, product marks or brand assets.

## Colors

A neutral grey-white ground with one saturated blue and a family of soft event tints, each tint paired with a dark ink of the same hue.

### Primary
- **Calendar Blue** (`primary`): primary buttons, the today date circle, the selected day in the widget calendar, time-slot text, the brand tile in the top bar, booked event blocks (`ev-booked`), focus rings (`ring`) and the input caret.

### Neutral
- **Shell Grey** (`shell`): the app ground behind the admin canvas and sidebar, and behind the widget card. Never used inside a card.
- **White** (`background`): the week/month canvas, cards, popovers, inputs.
- **Ink** (`foreground`): body text and dates.
- **Secondary Grey Text** (`muted-foreground`): gutter times, weekday labels, hints, reasons in popovers.
- **Hairline** (`border`): grid lines, card and column borders. **Input Stroke** (`input`): field and time-slot outlines, scrollbar thumb.
- **Pale Blue-Grey** (`secondary` / `accent`): hover fill on ghost and outline buttons, the widget's chosen-time summary box.
- **Selection Blue** (`selected` on `selected-foreground`): text selection.

### Signal
- **Now Red** (`now`): the now-line and its 12px dot on today's column. Nothing else.
- **Destructive Red** (`destructive`): cancel ("Avboka") actions, destructive confirm buttons, inline error text and the 10% error banners.

### Event kinds (owner week grid)
Each kind is a tint plus a same-hue ink. The legend in the sidebar lists them in this order.
- **booked** (Bokad): solid `ev-booked`, white text. The only filled-solid block.
- **free** (Bokbar): `ev-free` on `ev-free-fg`.
- **free-school** (Övning, Handledning): same look as free, labelled with the session name.
- **short** (Ledig men för kort): white with a dashed `ev-free-fg` 40% border.
- **opened** (Öppnad av dig): `ev-free` with a 2px solid `ev-free-fg` border.
- **closed** (Stängd av dig): `ev-closed` with red-grey diagonal stripes (`destructive` at 25%, 2px on 6px, -45deg), ink `ev-closed-fg`.
- **school** (Skola): grey-violet `ev-school`.
- **busy** (Upptagen, own calendar): teal `ev-busy`.
- **sport** (Träning): green `ev-sport`.
- **gap** (Lunch, Restid): `ev-gap` with a 6px dot grid (black at 16%).
- **allday** (Heldag): `muted` on `muted-foreground`; also shown as chips in the all-day row.
- **beyond** (Utanför 4 veckor): `muted` at 60%, no action.
- **holiday** chips in the all-day row and month cells use `ev-holiday` on `ev-holiday-fg`.

### Named Rules
**The One Blue Rule.** Blue means "act here", "chosen" or "today". Do not use it for decoration or for a second meaning.

**The Tint-and-Ink Rule.** An event kind is a pale tint with a dark ink of the same hue, never a saturated fill, except booked, which is solid blue so a booking always stands out.

**The Past-Is-Faded Rule.** Time that has started keeps its kind and label at 45% opacity and offers no open/close action; only bookings stay clickable.

## Typography

**Display Font:** Inter Variable (with ui-sans-serif, system-ui)
**Body Font:** Inter Variable
**Label Font:** Inter Variable

**Character:** One neutral sans in two weights (400 and 500; 600 only for bookable widget days and shadcn dialog titles) and tabular figures everywhere (`tnum` and `cv11` set on `html`), so times and dates line up in columns. Hierarchy comes from size and grey level, not weight.

### Hierarchy
- **Display** (400, 24px, tight tracking): widget and manage-page headings ("Boka ett möte", "Bokat"), and the date numbers in the week header circles.
- **Headline** (400, 22px): the top-bar product name "Bokningar" and the date range title; drops to 16px on small screens.
- **Title** (400, 18px, 1.375): the heading inside an event popover.
- **Title small** (500, 16px): section headings in the widget ("Välj en tid", the day name, "Dina uppgifter").
- **Body** (400 or 500, 14px): sidebar, popovers, form labels, buttons, legend, upcoming bookings. Inputs are 16px on mobile, 14px from `md`.
- **Event** (500 label / 400 time at 80%, 12px, 18px line): text in event blocks, chips in all-day rows and month cells, small dates in the month grid.
- **Label** (500, 11px, uppercase, 0.025em): weekday names over the week and month columns, and the hour gutter times (11px, 400, not uppercase).

### Named Rules
**The Tabular Rule.** Every time, date and count is set in tabular figures. Never switch them off.

**The No Display Face Rule.** Inter only. Headings are larger, not heavier or different.

## Layout

Admin: a full-height shell with a 64px top bar (menu, brand tile and "Bokningar", Idag, prev/next, date range, Vecka/Månad select, open-booking-page icon, avatar menu). Below, a 256px sidebar on the shell (copy-link button, mini month with week numbers, legend, upcoming bookings) and the main canvas, a white panel with 16px corners inset 8–16px from the window edge. Below `lg` the sidebar becomes an overlay with a 20% black scrim.

Week grid: a 56px hour gutter plus seven day columns (min 88px from `md`, a third of the viewport on mobile, scrolling sideways and starting at today). **One half-hour is 24px**; hour lines repeat every 48px in `border`. The day runs 08:00–20:00. Day headers and the gutter stay pinned while the grid scrolls. An all-day row sits between header and grid when a day has holidays or all-day events. Event blocks inset 2px left and 6px right, 1px top and bottom.

Month grid: seven columns with hairline borders, 28px round date, up to two booking chips and a "N till" overflow.

Widget: one card, max 58rem, centered on the shell with 24–40px outer padding; an 18.5rem facts column and a main column (calendar at 40px cells, times list up to 22rem tall with a fade-out mask). Stacks to one column below `md`.

Spacing is Tailwind's 4px scale; 8px and 12px gaps dominate, 24px card padding.

## Elevation & Depth

Mostly flat. Depth comes from the shell-to-white step: the white canvas and cards sit on the pale shell. Shadows are shadcn defaults and appear on lifted things only.

### Shadow Vocabulary
- **Card** (`shadow-sm`): the widget card, the sign-in and manage cards.
- **Field** (`shadow-xs`): outline buttons and inputs.
- **Open block** (`shadow-lg`): an event block whose popover is open; popovers and menus use shadcn's `shadow-md`.
- **Copy-link button** (`0 1px 3px rgb(0 0 0/.2), 0 4px 8px rgb(0 0 0/.08)`, deeper on hover): the one floating action in the sidebar, like Calendar's Create button.
- **Mobile sidebar** (`shadow-xl`): only while it overlays the canvas.

### Named Rules
**The Shell Step Rule.** Separate surfaces by white-on-shell, not by borders or shadows. A shadow means the thing is lifted or floating.

## Shapes

Soft, consistent rounding: 6px on event blocks, inputs and time slots; 12px on cards; 16px on the admin canvas and copy-link button; 4px on chips. Anything a person taps to act or to pick a date is round.

### Named Rules
**The Round Day Rule.** Every day cell is a circle: the week header date (44px), month grid date (28px), and every `[data-day]` button in the mini month and widget calendar. Today and the selected day fill blue. In the widget calendar, bookable days are blue 600-weight numbers on a `secondary` circle; unbookable days are disabled at 50%.

**The Pill Action Rule.** Action buttons in the top bar, popovers, dialogs, the widget, the manage page and the upcoming list are fully round (`rounded-full`). Time-slot buttons and form fields keep the 6px corner.

## Components

### Buttons
- **Shape:** pill (9999px) for actions; shadcn default heights (32px sm, 36px default, 40px for the widget submit and sign-in).
- **Primary:** Calendar Blue, white text, 500 weight, 20px side padding in the widget and manage page.
- **Outline:** white with hairline border and `shadow-xs`; hover fills `secondary`. Used for Idag, the view select, secondary actions.
- **Ghost:** transparent, hover `secondary`. Icon buttons (prev/next, menu, close) are round ghost buttons.
- **Destructive ghost:** red text, hover 10% red fill ("Avboka"). Destructive confirmations use the solid destructive variant in an AlertDialog, never a browser confirm.
- **Focus:** 3px ring in `ring` at 50%.

### Time slots
Full-width outlined buttons, 44px tall, `input` stroke, blue 500 tabular text; hover turns the border blue and the fill `secondary`.

### Chips
4px corners, 6px side padding, 12px text, tinted by kind (holiday, all-day, free, booked). Used in the all-day row and month cells.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** white on the shell.
- **Shadow Strategy:** `shadow-sm` (see Elevation).
- **Border:** hairline.
- **Internal Padding:** 24px; 28–40px on sign-in, manage and the confirmation.

### Inputs / Fields
shadcn new-york input: 36px, 6px corners, `input` stroke, `shadow-xs`. Focus: blue border and 3px 50% blue ring. Error: destructive border, ring and a 14px red message under the field.

### Navigation
The top bar is a 64px row on the shell with round ghost icon buttons and a pill outline "Idag" and view select. The sidebar's legend shows each kind as a 12px round swatch (never a square that reads as a checkbox).

### Event block (signature)
A rounded 6px block positioned on the 24px half-hour grid, labelled with what it is (a name, "Ledig", "Lunch", "Restid", "Stängd av dig", the course event) and, when two or more half-hours tall, its time range. Patterned kinds (gap, closed) put their text on a solid backing of the tint so it stays legible. Clicking opens a 320px popover with a round kind dot, title, day and time, the reason, and pill actions to open, close or clear that half-hour or the whole block; a booking's popover shows email, phone, message, "Gå med i Meet" and "Avboka". Hover darkens by 5% brightness.

**The Named Block Rule.** Every closed time is a named block. No time in the owner grid is blank or unexplained: if it can't be booked, a block says why.

## Do's and Don'ts

### Do:
- **Do** draw every non-bookable stretch as a labelled block of its kind, with its reason in the popover.
- **Do** use the 24px half-hour unit for every vertical measure in the week grid.
- **Do** keep day cells round and action buttons pill-shaped.
- **Do** set times and dates in Inter with tabular figures.
- **Do** keep past time in its kind at 45% opacity with no open/close action.
- **Do** use shadcn/ui components and the theme tokens before writing a custom element.

### Don't:
- **Don't** use Google logos, product marks, the Google Meet icon or any other Google brand asset; follow the conventions only.
- **Don't** use blue for anything but primary actions, selection, today and bookings.
- **Don't** use the now-line red for anything but the now-line.
- **Don't** add a display or serif face, or set calendar text above 500 weight (bookable widget days are the one exception).
- **Don't** show square legend swatches; they read as checkboxes.
- **Don't** bring back the almanac world (paper, cloth, ruled-ledger styling) or the svejo.se look.

### Adaptations from the direction contract
- The contract says "lunch and travel gaps dotted grey, manual closes striped red-grey"; the build matches, with text on a solid backing so the pattern never sits under letters.
- The contract places "copy link" in the top bar; the build puts "Kopiera bokningslänk" in the sidebar as the floating action and gives the top bar an open-booking-page icon button instead.
- The contract's hour gutter "08–20" is built as an 08:00 start with labels from 09:00 (the first line is the grid top).
- The build adds kinds the contract did not name: short (dashed), opened (bordered), allday, beyond and holiday.
