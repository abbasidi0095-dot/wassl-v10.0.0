"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Next 16 keeps the previous scroll position on client-side navigation in this
 * app. Tabs should always open at the top of the new page, so reset the window
 * scroll on every pathname change. Browser back/forward is left alone so the
 * browser can restore the previous position.
 */
export function ScrollToTop() {
  const pathname = usePathname();
  const popping = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    function onPopState() {
      popping.current = true;
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (popping.current) {
      popping.current = false;
      return;
    }

    function reset() {
      const html = document.documentElement;
      const previous = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
      html.style.scrollBehavior = previous;
    }

    reset();
    // iOS can move the page after focus settles; a second reset on the next
    // tick keeps the new tab at the top.
    const settle = window.setTimeout(reset, 80);
    return () => window.clearTimeout(settle);
  }, [pathname]);

  return null;
}
