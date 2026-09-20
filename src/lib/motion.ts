/** Shared easings. Expo-out for anything that should feel expensive; quart in-out for mechanical moves. */
export const easeOutExpo = [0.16, 1, 0.3, 1] as const;
export const easeInOutQuart = [0.76, 0, 0.24, 1] as const;
export const easeMechanical = [0.2, 0.9, 0.25, 1] as const;

export const reveal = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.8, ease: easeOutExpo },
} as const;

export const revealDelayed = (delay: number) => ({ ...reveal, transition: { ...reveal.transition, delay } });

export const sheet = {
  initial: { y: 24, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: 16, opacity: 0 },
  transition: { duration: 0.42, ease: easeOutExpo },
} as const;
