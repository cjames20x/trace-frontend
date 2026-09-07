# trace-frontend

Static demo console for **TRACE (Temporal Representation & Adaptive Continuous Evaluation)**, illustrating the verification pipeline from the thesis *"Touch-Gesture Continuous Authentication via Siamese LSTM Networks with Temporal Attention."* It presents a Siamese LSTM + temporal-attention model that continuously authenticates smartphone users from raw touch, accelerometer, gyroscope and magnetometer streams (evaluated on the H-MOG dataset).

> **Note:** This is a front-end shell only — there is no model or backend wired in. All scores (match/reject, live similarity) are produced by a deterministic pseudo-random hash (`seededScore()` in `script.js`) so the UI has something believable to render. See [Wiring up a real model](#wiring-up-a-real-model) below.

## Files

| File | Contents |
|---|---|
| `index.html` | Page markup — nav, hero, and the three sections below |
| `styles.css` | All styling (extracted from the original single-file build) |
| `script.js` | CSV parsing, verification mock, config comparison chart, gesture playback |

All three must stay in the same folder — `index.html` references the other two by relative path.

## Running it

No build step or server required — open `index.html` directly in a browser. Everything is self-contained except the two Google Fonts (Space Grotesk, IBM Plex Mono), which load over the network, so you'll need internet access for the intended look. If you'd rather not depend on that, self-host the fonts or drop the `<link>` tags in `<head>` and it'll fall back to the default sans/monospace stack.

## Sections

1. **Verify a session** (`#verify`) — upload a session CSV, pick a claimed identity from the dropdown, and run a mock cosine-similarity check against a 0.72 threshold.
2. **Configuration comparison** (`#compare`) — static bar chart comparing EER / accuracy across four encoder variants (hardcoded in the `configs` array in `script.js`).
3. **Gesture simulation** (`#simulate`) — replay an uploaded session on a phone-shaped canvas, frame by frame or auto-played at 0.5×–4×, with a live similarity readout that updates as playback advances.

## CSV input format

Both the Verify and Simulate dropzones accept two layouts, auto-detected by `parseCsv()`:

**Headerless (HMOG `TouchEvent.csv` layout)** — 11 numeric columns, no header row:

```
system_time,event_time,activity_id,pointer_count,pointer_id,action_id,x,y,pressure,contact_size,phone_orientation
```

Columns 7–10 (`x`, `y`, `pressure`, `contact_size`) are the ones actually used.

**Headered** — any column order, as long as a header row includes `x` and `y`, plus either `pressure` or `contact_size`:

```
x,y,pressure
120.4,880.1,0.42
...
```

Rows that fail to parse to valid numeric `x`/`y` are dropped. If nothing usable is found, both dropzones show an error state and disable the relevant action.

A ready-to-use sample (`session_003.csv`, a synthetic 130-row swipe gesture in the headerless layout) was generated earlier in this conversation if you need something to drop in immediately.

## Wiring up a real model

Everything mock-related is isolated to a few spots in `script.js`:

- `seededScore(seed)` — replace with a real call to your inference endpoint.
- `runVerifyBtn` click handler — where the Verify section's match/reject result is built; swap the `seededScore(...)` call for a real embed-and-compare request, keeping `verifySessionRows` as the parsed session payload.
- `updateLiveScore()` — same idea for the live similarity readout during simulation playback.
- `configs` array — replace the hardcoded EER/accuracy numbers with real evaluation results if you want the comparison chart to reflect an actual run.

## Browser support

Vanilla HTML/CSS/JS, no framework or build tooling — works in any modern evergreen browser. Uses `<canvas>`, `FileReader`, and `requestAnimationFrame`, all broadly supported.
