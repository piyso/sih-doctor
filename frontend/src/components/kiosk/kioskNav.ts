import { useEffect } from 'react';

/**
 * Each kiosk step tells the container how the single bottom navigation dock should behave.
 * The dock is the only Back / Next control on the kiosk, so steps with sub-screens (e.g. the body
 * map → symptoms screen in step 3) route Back / Next through these handlers.
 */
export interface StepNavConfig {
  canNext?: boolean;
  /** Replaces the default "Next" label. */
  nextLabel?: string;
  /** Shown above the dock while `canNext` is false. */
  blockedHint?: string;
  /** Overrides the default "go to next step". */
  onNext?: () => void;
  /** Overrides the default "go to previous step". */
  onBack?: () => void;
  /** Called when Next is pressed while blocked (e.g. to reveal validation errors). */
  onBlockedNext?: () => void;
  busy?: boolean;
}

export type RegisterNav = (config: StepNavConfig) => void;

/** Re-registers the step's navigation on every render so handlers always see fresh state. */
export const useStepNav = (registerNav: RegisterNav | undefined, config: StepNavConfig) => {
  useEffect(() => {
    registerNav?.(config);
  });
};
