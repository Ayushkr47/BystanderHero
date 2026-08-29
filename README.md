# BystanderHero

**Spatial AI for crowdsourced first response.**
Built for RescueHacks.

An ambulance takes 4 to 8 minutes. Survival from cardiac arrest falls roughly 10% for every
minute nobody acts. The people who could act are already standing there — they just don't know
what to do, or they assume someone else will.

BystanderHero listens to the scene, identifies the emergency, and gives **every person present a
different job**, synchronised live across all of their phones.

---

## Run it

```bash
npm install
npm start
```

Then open <http://localhost:4173>. `npm start` builds the React app and serves it from the same
Node process that holds the incident state — **one process, one port**, nothing to orchestrate
while you are recording a demo. Node 18 or newer.

For iteration with hot reload, run the API and Vite side by side:

```bash
npm run api
npm run dev
```

Vite serves on 5173 and proxies `/api` (including the SSE stream) through to 4173.

| URL | What it is |
| --- | --- |
| `/` | The app. Open a scene, or join one nearby. |
| `/demo` | Two-phone stage for the demo video. Both frames are real clients on the real server. |
| `/incident?id=…&r=…` | A responder's console for one scene. |

### Optional: Claude triage

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

With a key set, panicked speech is classified by `claude-opus-5`, which handles broken,
half-finished sentences far better than keywords. Without a key the server falls back to a
deterministic cue engine that runs entirely offline. **Both paths work.** The header chip on the
landing page tells you which one is live.

---

## The idea

The bystander effect is a **coordination failure**, not apathy. Ten people who each assume someone
else is handling it produce the same outcome as an empty street. The fix is not motivation — it is
assignment.

So BystanderHero never asks anybody to volunteer for anything. Every phone that arrives is handed
the next unfilled role in survival order:

| # | Role (cardiac arrest) | Why it is ranked there |
| --- | --- | --- |
| 1 | Chest compressions | Circulation stops first, and stays stopped without hands |
| 2 | Call 112, stay on the line | The operator outranks the app and needs a dedicated human |
| 3 | Find the AED | ~10% survival per minute, and someone must physically run |
| 4 | Clear the way, flag the ambulance | Seconds lost at the door are lost for good |
| 5 | Relief compressor (×2) | Compression quality collapses at about 2 minutes |

Five protocols ship: **cardiac arrest, choking, severe bleeding, seizure, suspected overdose.**

### What makes it more than a checklist app

- **Live shared session.** One incident, one clock, one checklist, over server-sent events. Tick a
  step on one phone and it appears on every other phone in about a second.
- **Roles refill themselves.** If the person doing compressions walks away, the app pulls someone
  up from a lower-priority role rather than leaving the chest unattended. An unattended crowd is
  survivable; an unattended chest is not.
- **Relief rotation actually swaps.** "I am tiring" moves the role to another device. If nobody is
  idle, it strips the least critical job to cover the most critical one.
- **Protocol switching rebriefs everyone.** Choking victim goes limp → one tap moves the whole
  scene to CPR and reassigns all roles.
- **110 bpm metronome**, audio and visual, generated with an oscillator so there is no audio file
  to fail to load.
- **Reconnect resilience.** A phone that locks, drops signal, or restores a tab rejoins and takes a
  role again instead of standing there roleless.

---

## Safety design

This is the part that mattered most, and it is enforced in code rather than promised in a README.

- **The AI cannot invent an instruction.** Every word of guidance is written in advance in
  `server/protocols.mjs`, following published lay-rescuer first aid. The model's only job is to
  choose one of five protocol ids. It routes; it does not practise medicine.
- **The dispatcher outranks the app.** Said on screen, in the safety bar, and inside the role that
  holds the phone call.
- **Low confidence blocks dispatch.** Under 60% the scene will not open until a human confirms, and
  the confidence figure is shown, not hidden.
- **Any responder can override at any time**, before or during an incident.
- **Audio never leaves the device** until someone commits to opening a scene. Speech-to-text runs
  in the browser; only the resulting transcript is ever sent.
- **Guidance stays inside what untrained hands can safely do**: no blind finger sweeps, no
  restraining a seizure, no lifting a dressing to check a bleed.

---

## Locale — India

Built for India. **112** is the all-India emergency number (ERSS); **108** reaches an ambulance
directly in most states and is often faster for a medical call, so both are offered — 112 as the
primary and 108 beside it in the role that holds the phone.

The number lives in exactly one file, `server/locale.mjs`, and every protocol step, safety bar and
dial button reads from it. Nothing hardcodes a number. Shipping to another country is a change to
that one file.

One protocol detail is specific to the country rather than cosmetic: **AEDs are still uncommon in
India**, so the "Find the AED" role is capped at roughly two minutes of looking and then explicitly
sends that person back to take over compressions. Sending someone on a five-minute hunt for a
defibrillator that does not exist costs a life; the protocol says so on screen.

---

## Design

The visual language is **emergency signage**, not medical-tech gloss.

In ISO 7010 — and in every airport, factory and station on earth — **green** means "first aid and
safety equipment is here", amber means caution, and **red is reserved for fire and alarm**. So this
interface uses green for covered/done/safe, amber for a role nobody has taken, and red *only* where
something is genuinely live: the hands-on role, the alarm screen, the emergency button. Red is
never decoration, which is what lets it mean something when it appears.

The accent is **hi-vis (#C9F231)** — the colour of the vest worn by the person who turns up to
help. It marks attention and never encodes status, so it can never be confused with a safety
colour. The safety bar carries real hazard-tape hatching along its bottom edge.

Type: **Archivo** for display (a signage/wayfinding grotesque), **Public Sans** for body, and
**JetBrains Mono** for every number that matters — clocks, scene codes, timestamps. All three
degrade to solid system stacks if the font request fails, which matters for an app that claims to
work offline.

Motion is deliberate and unevenly distributed:

- **The landing page** has a hero that performs the product rather than describing it — a shared
  clock over four assignment cards that deal themselves in one at a time, in depth — plus
  scroll-triggered reveals that tilt sections up out of the page.
- **The incident console has almost none.** The only thing that moves is the 110 bpm compression
  metronome, because that motion *is* an instruction. Nobody kneeling on a pavement needs a card
  to animate between them and "push hard and fast".

Reveals are a geometry check on scroll rather than an `IntersectionObserver`. An observer delivers
nothing while a tab is hidden or prerendering, and since the pre-reveal state is `opacity: 0`, a
callback that never arrives leaves the page blank. A product about reliability should not have a
decorative effect as a single point of failure. `prefers-reduced-motion` is honoured throughout.

---

## Architecture

**React 18 + Vite** on the front, a **zero-dependency Node server** behind it.

```
server/                 No dependencies at all
  index.mjs             HTTP + SSE + static, with SPA fallback
  incidents.mjs         In-memory registry: roles, assignment, rotation, broadcast
  classify.mjs          Claude with an offline deterministic fallback
  protocols.mjs         The five protocols. All medical content lives here and only here

src/
  main.jsx              Three routes, no router dependency
  index.css             Design system
  lib/
    api.js              Fetch wrapper
    useIncident.js      SSE subscription, role derivation, reconnect-and-rejoin
    useSpeech.js        Browser speech recognition, restart-on-pause
    router.js           ~20 lines; real URLs, because scene links get texted to people
  components/           StepList, RoleBoard, SceneLog, Metronome, IncomingAlert, SafetyBar
  pages/                Home, Incident, Demo
```

The server pushes a **complete snapshot** once a second and again on every change, so there is no
client-side state merging to get wrong: whatever the scene looks like on the server is exactly
what renders on every phone. `useIncident` is the only place that touches the stream.

Incident state is in-process by design: nothing to provision, and an incident is meaningless once
EMS arrives. Incidents self-expire after two hours.

### Honest about what is simulated

- **"Nearby" is not geospatial yet.** Any active incident is listed as nearby. Real proximity needs
  a geofenced query plus push notification, which is the first thing on the production list below.
- **Two phones on one machine.** The demo stage runs two real clients side by side. Nothing is
  mocked, but they are frames rather than separate devices.
- **Speech recognition is the browser's, and it is cloud-backed.** Chrome's SpeechRecognition
  needs a secure origin and a live connection. The UI shows a real microphone level meter from
  `getUserMedia`, so you can see the mic working even when transcription produces nothing, and
  every failure mode (permission refused, no mic, no network, insecure origin, mic open but
  silent) is named on screen with a retry. Typing sits beside it as an equal path, not a fallback.
- **Nobody is alerted who has not opened the app.** A real deployment needs push, and ideally
  registration with an existing responder network.

---

## Where it goes next

1. **Real proximity + push.** Geofenced dispatch to phones within ~200 m, using the platform push
   services so an alert lands on a locked screen.
2. **Integrate rather than compete.** GoodSAM, PulsePoint and staffel-style responder networks
   already alert trained volunteers. BystanderHero's contribution is *role coordination among
   untrained people*, which those systems do not do. It should plug into them.
3. **AED registry.** Static maps exist in most cities. "Find the AED" should say *which* AED and
   how far, not "check the lobby".
4. **Clinical review before any real use.** Every protocol needs sign-off from a resuscitation
   council, and the app needs a formal evidence base before it goes near a real emergency.
5. **Offline-first.** Service worker plus a local protocol cache, because signal at an incident is
   exactly when networks are worst.
6. **Multilingual.** The protocols are short, imperative and translatable. This matters most where
   the bystander and the patient do not share a language.

---

## Status

Prototype. **Not a medical device**, and not a substitute for emergency services or trained
clinicians. If you are in an emergency, call your local emergency number.
