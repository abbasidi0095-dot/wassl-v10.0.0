/**
 * Light tactile confirmation for primary actions. No-ops on the web: the
 * Capacitor Haptics call rejects outside a native shell and is swallowed.
 */
export function tapFeedback(): void {
  if (typeof window === "undefined") return;
  void import("@capacitor/haptics")
    .then(({ Haptics, ImpactStyle }) =>
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}),
    )
    .catch(() => {});
}
