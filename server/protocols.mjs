/**
 * Crisis protocols.
 *
 * Each protocol decomposes a public medical emergency into PARALLEL roles so that
 * multiple bystanders act at once instead of all watching one person act (the bystander effect).
 * Roles are listed in dispatch priority order: the first responder on scene takes role 0.
 *
 * Content follows widely published lay-rescuer first aid guidance (AHA / Red Cross style).
 * It is deliberately conservative, and every protocol defers to the emergency operator.
 * The emergency number itself comes from locale.mjs and is never hardcoded here.
 */

import { LOCALE, EMERGENCY } from './locale.mjs';

export const PROTOCOLS = {
  cardiac_arrest: {
    id: 'cardiac_arrest',
    label: 'Cardiac arrest',
    short: 'Not breathing / no pulse',
    severity: 'critical',
    dispatchLine: 'Adult collapsed, unresponsive, not breathing normally. CPR in progress.',
    cues: ['not breathing', 'no pulse', 'collapsed', 'unresponsive', 'heart attack', 'cardiac', 'passed out', 'not moving', 'turning blue', 'cpr', 'no heartbeat'],
    roles: [
      {
        key: 'compressions', title: 'Chest compressions', subtitle: 'You are the pump. Do not stop.',
        color: 'red', slots: 1,
        steps: [
          { key: 'c1', text: 'Lay them flat on their back on a hard surface', detail: 'Floor or ground. Not a bed or a couch.' },
          { key: 'c2', text: 'Heel of one hand on the centre of the chest, other hand on top, fingers laced' },
          { key: 'c3', text: 'Push HARD and FAST, 5 to 6 cm deep', detail: 'Arms locked straight, shoulders over your hands. Let the chest come all the way back up between pushes.', mode: 'metronome' },
          { key: 'c4', text: 'Keep going. Swap with your relief every 2 minutes', detail: 'Good compressions are exhausting. Tap Request relief the moment you start to tire.', mode: 'rotation' },
          { key: 'c5', text: 'Stop only when the AED tells you to, or a paramedic takes over' }
        ]
      },
      {
        key: 'dispatch', title: `Call ${EMERGENCY} and stay on the line`, subtitle: 'You are the link to the ambulance.',
        color: 'blue', slots: 1,
        steps: [
          { key: 'd1', text: `Call ${EMERGENCY} now. Put it on speaker`, detail: `The ${LOCALE.operator} outranks this app. Do what they tell you. For a medical emergency ${LOCALE.ambulance} reaches an ambulance directly and is often faster.` },
          { key: 'd2', text: 'Read the dispatch line below to them, word for word', mode: 'dispatch' },
          { key: 'd3', text: 'Give the exact location: street, building, floor, nearest door' },
          { key: 'd4', text: 'Stay on the line. Relay what the operator says to the compressor' },
          { key: 'd5', text: 'Tell them the moment the AED is attached' }
        ]
      },
      {
        key: 'aed', title: 'Find the AED', subtitle: 'Two minutes of looking, maximum. Then come back and take over.',
        color: 'amber', slots: 1,
        steps: [
          { key: 'a1', text: 'GO NOW. Best odds: metro stations, airports, malls, large offices, hotels, hospitals', detail: 'AEDs are still uncommon in India. If there is no AED within about two minutes, come back and take over compressions instead.' },
          { key: 'a2', text: 'Shout to staff or security: "Is there an AED or defibrillator here?" Do not search silently' },
          { key: 'a3', text: 'Bring it back and switch it on. It speaks the instructions aloud' },
          { key: 'a4', text: 'Pads on bare skin: upper right chest, lower left ribs' },
          { key: 'a5', text: 'Shout CLEAR, check nobody is touching, then press shock if it tells you to' },
          { key: 'a6', text: 'Restart compressions immediately after the shock' }
        ]
      },
      {
        key: 'access', title: 'Clear the way, flag the ambulance', subtitle: 'Seconds saved at the door.',
        color: 'violet', slots: 1,
        steps: [
          { key: 'x1', text: 'Move furniture, bags and people back. Give the rescuer a metre of space' },
          { key: 'x2', text: 'Send someone to hold the lift or prop the entrance open' },
          { key: 'x3', text: 'Stand where the ambulance will arrive and wave them in' },
          { key: 'x4', text: 'Ask the crowd: "Is anyone a nurse, medic or doctor?"' },
          { key: 'x5', text: 'Ask people to stop filming. Help or step back' }
        ]
      },
      {
        key: 'relief', title: 'Relief compressor, stand by', subtitle: 'You take over in under 2 minutes.',
        color: 'teal', slots: 2,
        steps: [
          { key: 'r1', text: 'Kneel on the opposite side of the chest NOW, ready to swap' },
          { key: 'r2', text: 'Watch the rhythm bar so you can match the pace instantly' },
          { key: 'r3', text: 'On the swap call, change over in under 5 seconds' },
          { key: 'r4', text: 'While you wait: loosen tight clothing around the chest and neck' }
        ]
      }
    ]
  },

  choking: {
    id: 'choking',
    label: 'Choking',
    short: 'Airway blocked, cannot speak',
    severity: 'critical',
    dispatchLine: 'Adult choking, cannot speak or cough. Back blows and abdominal thrusts in progress.',
    cues: ['choking', 'choke', 'choked', 'cannot breathe', 'something stuck', 'heimlich', 'swallowed', 'gagging', 'clutching throat', 'food stuck'],
    roles: [
      {
        key: 'thrusts', title: 'Clear the airway', subtitle: 'You are the only one who touches them.',
        color: 'red', slots: 1,
        steps: [
          { key: 't1', text: 'Ask: "Are you choking? Can you speak?"', detail: 'If they can cough or speak, do NOT hit them. Encourage hard coughing and watch closely.' },
          { key: 't2', text: 'No sound, no air: give 5 sharp back blows', detail: 'Lean them forward. Heel of your hand, between the shoulder blades.', mode: 'rhythm5' },
          { key: 't3', text: 'Then 5 abdominal thrusts', detail: 'Fist just above the navel, other hand over it, pull sharply IN and UP.', mode: 'rhythm5' },
          { key: 't4', text: 'Alternate 5 and 5 until the object comes out' },
          { key: 't5', text: 'If they go limp, lower them down and start CPR', detail: 'Tap Switch protocol and this app re-briefs everyone on scene.', mode: 'escalate', escalateTo: 'cardiac_arrest' }
        ]
      },
      {
        key: 'dispatch', title: `Call ${EMERGENCY} and stay on the line`, subtitle: 'Call even if the object comes out.',
        color: 'blue', slots: 1,
        steps: [
          { key: 'd1', text: `Call ${EMERGENCY} now. Speaker on` },
          { key: 'd2', text: 'Read the dispatch line below to them, word for word', mode: 'dispatch' },
          { key: 'd3', text: 'Give the exact location: street, building, floor' },
          { key: 'd4', text: 'Stay on the line and relay the operator to the rescuer' }
        ]
      },
      {
        key: 'watch', title: 'Watch, and be ready for CPR', subtitle: 'If they collapse, you are next.',
        color: 'amber', slots: 1,
        steps: [
          { key: 'w1', text: 'Stand at their side. Be ready to catch them if they drop' },
          { key: 'w2', text: 'Watch the lips and face for blue or grey colour. Call it out loud' },
          { key: 'w3', text: 'If they lose consciousness, shout CPR NOW and lower them to the floor' },
          { key: 'w4', text: 'Look in the mouth only if you can SEE the object. Never sweep blindly' }
        ]
      },
      {
        key: 'access', title: 'Clear space, meet the ambulance', subtitle: 'Keep the area open.',
        color: 'violet', slots: 1,
        steps: [
          { key: 'x1', text: 'Move tables, chairs and onlookers back' },
          { key: 'x2', text: 'Ask loudly: "Is anyone medically trained?"' },
          { key: 'x3', text: 'Go to the entrance and wave the ambulance in' }
        ]
      }
    ]
  },

  severe_bleeding: {
    id: 'severe_bleeding',
    label: 'Severe bleeding',
    short: 'Heavy blood loss',
    severity: 'critical',
    dispatchLine: 'Severe bleeding, direct pressure applied. Possible arterial bleed.',
    cues: ['bleeding', 'blood', 'stabbed', 'gunshot', 'wound', 'haemorrhage', 'hemorrhage', 'gushing', 'laceration', 'deep cut'],
    roles: [
      {
        key: 'pressure', title: 'Direct pressure', subtitle: 'Press hard. Do not peek.',
        color: 'red', slots: 1,
        steps: [
          { key: 'p1', text: 'Protect yourself. Gloves, a plastic bag, anything between you and the blood' },
          { key: 'p2', text: 'Press HARD directly on the wound with cloth or your hands', detail: 'Your body weight through a straight arm. Harder than feels polite.' },
          { key: 'p3', text: 'Do NOT lift the cloth to check. Add more on top if it soaks through' },
          { key: 'p4', text: 'Hold without letting go until EMS takes over', mode: 'timer' },
          { key: 'p5', text: 'Limb still bleeding badly? Tourniquet high and tight above the wound', detail: 'Arms and legs only. Note the time it went on and say it out loud.' }
        ]
      },
      {
        key: 'dispatch', title: `Call ${EMERGENCY} and stay on the line`, subtitle: 'They may talk you through a tourniquet.',
        color: 'blue', slots: 1,
        steps: [
          { key: 'd1', text: `Call ${EMERGENCY} now. Speaker on` },
          { key: 'd2', text: 'Read the dispatch line below to them, word for word', mode: 'dispatch' },
          { key: 'd3', text: 'Give the exact location, and say whether the scene is safe' },
          { key: 'd4', text: 'Say the time a tourniquet was applied, if there is one' }
        ]
      },
      {
        key: 'supplies', title: 'Get the trauma kit', subtitle: 'Cloth, gauze, anything clean.',
        color: 'amber', slots: 1,
        steps: [
          { key: 's1', text: 'Find the first aid kit: reception, kitchen, vehicle boot' },
          { key: 's2', text: 'No kit? Grab clean towels, t-shirts, tea towels. Bring all of it' },
          { key: 's3', text: 'Hand cloth to the presser without breaking their pressure' },
          { key: 's4', text: 'Bring a coat or blanket for warmth' }
        ]
      },
      {
        key: 'care', title: 'Keep them talking and warm', subtitle: 'Shock kills after the bleeding stops.',
        color: 'teal', slots: 1,
        steps: [
          { key: 'k1', text: 'Kneel by their head. Tell them your name and that help is coming' },
          { key: 'k2', text: 'Keep them lying flat and still. Cover them to hold body heat in' },
          { key: 'k3', text: 'Nothing to eat or drink' },
          { key: 'k4', text: 'Watch for pale clammy skin or drowsiness. Say it out loud if it starts' }
        ]
      }
    ]
  },

  seizure: {
    id: 'seizure',
    label: 'Seizure',
    short: 'Convulsing, fitting',
    severity: 'urgent',
    dispatchLine: 'Adult having a seizure, being timed now, area cleared.',
    cues: ['seizure', 'seizing', 'fitting', 'convulsing', 'epileptic', 'epilepsy', 'shaking', 'jerking'],
    roles: [
      {
        key: 'protect', title: 'Protect their head', subtitle: 'Do not restrain them.',
        color: 'red', slots: 1,
        steps: [
          { key: 'p1', text: 'Move hard and sharp objects away from them' },
          { key: 'p2', text: 'Put something soft under the head, a folded jacket' },
          { key: 'p3', text: 'Do NOT hold them down. Do NOT put anything in their mouth', detail: 'They cannot swallow their tongue. Restraint causes injury.' },
          { key: 'p4', text: 'When the jerking stops, roll them onto their side' },
          { key: 'p5', text: 'Stay while they come round. They will be confused and frightened' }
        ]
      },
      {
        key: 'timer', title: 'Time the seizure', subtitle: 'The single most useful number.',
        color: 'amber', slots: 1,
        steps: [
          { key: 't1', text: 'Start the timer from the moment the jerking began', mode: 'timer' },
          { key: 't2', text: 'Call it out at 1, 3 and 5 minutes so everyone hears' },
          { key: 't3', text: 'Past 5 minutes this is an emergency. Tell the caller now' },
          { key: 't4', text: 'Note if it stops and starts again without them waking up' }
        ]
      },
      {
        key: 'dispatch', title: `Call ${EMERGENCY} if any of these`, subtitle: 'Over 5 min, injured, pregnant, first seizure, in water, not waking.',
        color: 'blue', slots: 1,
        steps: [
          { key: 'd1', text: `Check the triggers above. If any apply, call ${EMERGENCY} now` },
          { key: 'd2', text: 'Read the dispatch line below, and add how long it has lasted', mode: 'dispatch' },
          { key: 'd3', text: 'Give the exact location' }
        ]
      },
      {
        key: 'privacy', title: 'Shield their dignity', subtitle: 'They will remember the crowd.',
        color: 'violet', slots: 1,
        steps: [
          { key: 'v1', text: 'Move the crowd back and ask people to stop filming' },
          { key: 'v2', text: 'Hold up coats to screen them from view' },
          { key: 'v3', text: 'Look for a medical ID bracelet or card' }
        ]
      }
    ]
  },

  opioid_overdose: {
    id: 'opioid_overdose',
    label: 'Suspected overdose',
    short: 'Unresponsive, slow breathing',
    severity: 'critical',
    dispatchLine: 'Suspected opioid overdose, unresponsive, breathing very slowly. Naloxone given.',
    cues: ['overdose', 'narcan', 'naloxone', 'opioid', 'heroin', 'fentanyl', 'took pills', 'blue lips', 'not waking up', 'od'],
    roles: [
      {
        key: 'naloxone', title: 'Naloxone and breathing', subtitle: 'Air first, then naloxone.',
        color: 'red', slots: 1,
        steps: [
          { key: 'n1', text: 'Shout their name and rub hard on the breastbone. No response?' },
          { key: 'n2', text: 'Give naloxone if you have it. One spray into one nostril' },
          { key: 'n3', text: 'Tilt the head back, chin up. Give 1 rescue breath every 5 seconds', mode: 'breathing' },
          { key: 'n4', text: 'No improvement after 2 to 3 minutes? Second dose, other nostril' },
          { key: 'n5', text: 'Not breathing at all? Start CPR', mode: 'escalate', escalateTo: 'cardiac_arrest' }
        ]
      },
      {
        key: 'dispatch', title: `Call ${EMERGENCY} and stay on the line`, subtitle: 'Naloxone wears off. They still need the ambulance.',
        color: 'blue', slots: 1,
        steps: [
          { key: 'd1', text: `Call ${EMERGENCY} now. Speaker on` },
          { key: 'd2', text: 'Read the dispatch line below to them, word for word', mode: 'dispatch' },
          { key: 'd3', text: 'Give the exact location' },
          { key: 'd4', text: 'Say how many doses were given and at what time' }
        ]
      },
      {
        key: 'supplies', title: 'Find naloxone', subtitle: 'Pharmacies, transit staff, bars, campus security.',
        color: 'amber', slots: 1,
        steps: [
          { key: 's1', text: 'Shout: "Does anyone have Narcan or naloxone?"' },
          { key: 's2', text: 'Check the nearest pharmacy, security desk, first aid box' },
          { key: 's3', text: 'Bring it back and hand it over. Do not stop to read the box' }
        ]
      },
      {
        key: 'position', title: 'Recovery position and watch', subtitle: 'Once they breathe on their own.',
        color: 'teal', slots: 1,
        steps: [
          { key: 'r1', text: 'Roll them onto their side, top knee forward, head tilted back' },
          { key: 'r2', text: 'Stay beside them. They can stop breathing again' },
          { key: 'r3', text: 'If they wake confused or agitated, stay calm and keep them still' },
          { key: 'r4', text: 'Do not leave them alone, even if they seem fine' }
        ]
      }
    ]
  }
};

export const PROTOCOL_LIST = Object.values(PROTOCOLS).map((p) => ({
  id: p.id, label: p.label, short: p.short, severity: p.severity
}));

export function getProtocol(id) {
  return PROTOCOLS[id] || PROTOCOLS.cardiac_arrest;
}
