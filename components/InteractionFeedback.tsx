"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const QUICK_FEEDBACK_MS = 420;
const NAVIGATION_TIMEOUT_MS = 8000;

export default function InteractionFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const active = useRef(new Map<HTMLElement, number>());
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const clear = (element: HTMLElement, force = false) => {
      const timer = active.current.get(element);
      if (timer) window.clearTimeout(timer);
      const region = element.closest<HTMLElement>("[data-loading-region]");
      const started = Number(element.dataset.interactionStarted || Date.now());
      if (!force && region?.getAttribute("aria-busy") === "true" && Date.now() - started < NAVIGATION_TIMEOUT_MS) {
        active.current.set(element, window.setTimeout(() => clear(element), 160));
        return;
      }
      active.current.delete(element);
      element.removeAttribute("data-interaction-loading");
      element.removeAttribute("data-interaction-started");
      element.removeAttribute("aria-busy");
      if (!active.current.size) setAnnouncement("");
    };
    const begin = (event: MouseEvent) => {
      const origin = event.target;
      if (!(origin instanceof Element)) return;
      const element = origin.closest<HTMLElement>("button, a[href]");
      if (!element || element.matches(":disabled, [aria-disabled='true'], [data-skip-loading-feedback]") || event.defaultPrevented) return;
      if (element.dataset.interactionLoading === "true") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const anchor = element instanceof HTMLAnchorElement ? element : null;
      const href = anchor?.getAttribute("href") || "";
      const modifiedClick = event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
      const internalLink = !!anchor && !anchor.target && !anchor.hasAttribute("download") && !modifiedClick && (href.startsWith("/") || href.startsWith("?"));
      const destination = internalLink ? new URL(href, window.location.href) : null;
      const sameLocation = destination ? `${destination.pathname}${destination.search}` === `${window.location.pathname}${window.location.search}` : false;
      const internalNavigation = internalLink && !sameLocation;
      element.dataset.interactionLoading = "true";
      element.dataset.interactionStarted = String(Date.now());
      element.setAttribute("aria-busy", "true");
      setAnnouncement(internalNavigation ? "Loading page" : "Working");
      const timer = window.setTimeout(() => clear(element, internalNavigation), internalNavigation ? NAVIGATION_TIMEOUT_MS : QUICK_FEEDBACK_MS);
      active.current.set(element, timer);
    };
    document.addEventListener("click", begin);
    return () => {
      document.removeEventListener("click", begin);
      active.current.forEach(timer => window.clearTimeout(timer));
      active.current.forEach((_, element) => { element.removeAttribute("data-interaction-loading"); element.removeAttribute("data-interaction-started"); element.removeAttribute("aria-busy"); });
      active.current.clear();
    };
  }, []);

  useEffect(() => {
    active.current.forEach((timer, element) => {
      window.clearTimeout(timer);
      element.removeAttribute("data-interaction-loading");
      element.removeAttribute("data-interaction-started");
      element.removeAttribute("aria-busy");
    });
    active.current.clear();
    setAnnouncement("");
  }, [routeKey]);

  return <span className="interaction-status" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>;
}
