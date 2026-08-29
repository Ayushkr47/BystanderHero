/**
 * Where this deployment is running.
 *
 * The emergency number is the one thing in this app that must never be wrong, so it lives in
 * exactly one place and everything else — protocol text, safety bars, the dial button — reads
 * from here. Shipping to another country is a change to this file and nothing else.
 */

export const LOCALE = {
  country: 'India',

  /** Single emergency number. ERSS-112 reaches police, fire and medical nationwide. */
  emergency: '112',

  /** Direct ambulance line, free and available in most states. Often faster than 112 for medical. */
  ambulance: '108',

  emergencyNote: '112 is the all-India emergency number. 108 reaches an ambulance directly in most states.',

  /** What to call the person on the other end of the line, in protocol text. */
  operator: '112 operator'
};

export const EMERGENCY = LOCALE.emergency;
