import { useEffect } from 'react';

/**
 * Reveals elements as they scroll into view.
 *
 * Deliberately a geometry check on scroll rather than an IntersectionObserver. An observer
 * delivers nothing while a tab is hidden or prerendering, and because the pre-reveal state is
 * `opacity: 0`, a callback that never arrives leaves the page blank rather than un-animated.
 * A page about reliability should not have a decorative effect as a single point of failure.
 *
 * Reading a rect is cheap at this scale, the work is rAF-throttled, and every listener is
 * dropped as soon as the last element has appeared.
 */
export function useReveal(deps = []) {
  useEffect(() => {
    const pending = new Set(document.querySelectorAll('.reveal, .reveal-3d'));
    if (!pending.size) return undefined;

    const reveal = (el) => { el.classList.add('is-in'); pending.delete(el); };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      pending.forEach(reveal);
      return undefined;
    }

    let frame = 0;

    const check = () => {
      frame = 0;
      const trigger = window.innerHeight * 0.88; // Fire a little before the true bottom edge.
      pending.forEach((el) => {
        const { top, bottom } = el.getBoundingClientRect();
        if (top < trigger && bottom > 0) reveal(el);
      });
      if (!pending.size) stop();
    };

    const schedule = () => {
      // requestAnimationFrame is paused while the document is hidden, so falling back to a
      // direct call keeps correctness independent of it. rAF is only ever the throttle here.
      if (document.hidden) { check(); return; }
      if (!frame) frame = requestAnimationFrame(check);
    };

    function stop() {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', schedule);
      if (frame) cancelAnimationFrame(frame);
    }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', schedule);
    check();

    return stop;
  }, deps);
}
