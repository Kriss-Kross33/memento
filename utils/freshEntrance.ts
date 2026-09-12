/**
 * One-shot flag so the Home screen knows the app just came from onboarding
 * and should play its staggered entrance. Consumed exactly once — regular
 * tab visits never re-trigger the animation.
 */
let freshEntrance = false;

export const markFreshEntrance = (): void => {
  freshEntrance = true;
};

export const consumeFreshEntrance = (): boolean => {
  const value = freshEntrance;
  freshEntrance = false;
  return value;
};
