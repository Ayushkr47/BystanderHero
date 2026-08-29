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
node server/index.mjs
```

Then open <http://localhost:4173>. That is the whole setup — no `npm install`, no build step, no
database. Node 18 or newer.

| URL | What it is |
| --- | --- |
| `/` | The app. Open a scene, or join one nearby. |
| `/demo` | Two-phone stage for the demo video. Both frames are real clients on the real server. |
| `/incident?id=…&r=…` | A responder's console for one scene. |

### Optional: Claude triage

```bash
ANTHROPIC_API_KEY=sk-ant-... node server/index.mjs
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
| 2 | Call 911, stay on the line | The dispatcher outranks the app and needs a dedicated human |
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

## Architecture

```
server/
  index.mjs       HTTP + SSE, zero dependencies
  incidents.mjs   In-memory registry: roles, assignment, rotation, broadcast
  classify.mjs    Claude with an offline deterministic fallback
  protocols.mjs   The five protocols. All medical content lives here and only here
public/
  index.html      Landing, listening, AI confirmation, join
  incident.html   The responder console
  demo.html       Two-phone stage
  js/             ES modules, no framework, no build
```

State is in-process by design: nothing to provision, and an incident is meaningless once EMS
arrives. Incidents self-expire after two hours.

### Honest about what is simulated

- **"Nearby" is not geospatial yet.** Any active incident is listed as nearby. Real proximity needs
  a geofenced query plus push notification, which is the first thing on the production list below.
- **Two phones on one machine.** The demo stage runs two real clients side by side. Nothing is
  mocked, but they are frames rather than separate devices.
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
