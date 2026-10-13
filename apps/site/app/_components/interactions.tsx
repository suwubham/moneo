"use client";

import { useEffect } from "react";

export function Interactions() {
  useEffect(() => {
    const body = document.body;
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            reveal.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    document.querySelectorAll(".rv").forEach((el) => reveal.observe(el));

    const links = document.querySelectorAll<HTMLElement>("[data-nav]");
    const scenes = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          if (el.dataset.scene) body.dataset.scene = el.dataset.scene;
          else delete body.dataset.scene;
          links.forEach((l) => {
            if (l.dataset.nav === el.id) l.dataset.active = "";
            else delete l.dataset.active;
          });
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    document.querySelectorAll("[data-sec]").forEach((el) => scenes.observe(el));

    let raf = 0;
    const root = document.documentElement;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = root.scrollHeight - innerHeight;
        root.style.setProperty("--p", String(max > 0 ? scrollY / max : 0));
      });
    };
    const needsFallback = !CSS.supports("animation-timeline: scroll()");
    if (needsFallback) {
      onScroll();
      addEventListener("scroll", onScroll, { passive: true });
    }

    return () => {
      reveal.disconnect();
      scenes.disconnect();
      if (needsFallback) removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      delete body.dataset.scene;
    };
  }, []);

  return null;
}
