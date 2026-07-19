import { useEffect, useRef, RefObject } from "react";
import gsap from "gsap";

export function useSpriteAnimator(ref: RefObject<HTMLDivElement | null>) {
  const hoverTweenRef = useRef<gsap.core.Tween | null>(null);
  const activeTimelineRef = useRef<gsap.core.Timeline | null>(null);

  const stopAll = () => {
    if (activeTimelineRef.current) {
      activeTimelineRef.current.kill();
      activeTimelineRef.current = null;
    }
    if (hoverTweenRef.current) {
      hoverTweenRef.current.kill();
      hoverTweenRef.current = null;
    }
    // Reset element
    const el = ref.current;
    if (el) {
      gsap.set(el, { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, clearProps: "transform" });
    }
    // Reset displacement scale
    const mapEl = document.getElementById("wave-displacement-map");
    if (mapEl) {
      gsap.set(mapEl, { attr: { scale: 0 } });
    }
  };

  const playHover = () => {
    stopAll();
    const el = ref.current;
    if (!el) return;

    gsap.set(el, { transformOrigin: "50% 50%" });

    // Infinite gentle vertical bobbing with subtle synced scale pulse
    hoverTweenRef.current = gsap.fromTo(el, 
      { y: -10, scaleX: 0.97, scaleY: 1.03 },
      {
        y: 10,
        scaleX: 1.03,
        scaleY: 0.97,
        duration: 2.0,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      }
    );
  };

  const playJump = () => {
    stopAll();
    const el = ref.current;
    if (!el) return;

    gsap.set(el, { transformOrigin: "50% 100%" });

    const tl = gsap.timeline({
      onComplete: () => {
        playHover();
      }
    });
    activeTimelineRef.current = tl;

    tl.to(el, {
      scaleY: 0.75,
      scaleX: 1.15,
      duration: 0.15,
      ease: "power1.inOut",
    })
    .to(el, {
      y: -160,
      scaleY: 1.25,
      scaleX: 0.85,
      duration: 0.35,
      ease: "power2.out",
    })
    .to(el, {
      scaleX: 1.0,
      scaleY: 1.0,
      duration: 0.05,
    })
    .to(el, {
      y: 0,
      scaleY: 1.1,
      scaleX: 0.9,
      duration: 0.3,
      ease: "power2.in",
    })
    .to(el, {
      scaleY: 0.7,
      scaleX: 1.25,
      duration: 0.1,
      ease: "power1.out",
    })
    .to(el, {
      scaleX: 1.0,
      scaleY: 1.0,
      duration: 0.2,
      ease: "power1.inOut",
    });
  };

  const playWave = () => {
    stopAll();
    const el = ref.current;
    if (!el) return;

    gsap.set(el, { transformOrigin: "50% 90%" });

    const tl = gsap.timeline({
      onComplete: () => {
        playHover();
      }
    });
    activeTimelineRef.current = tl;

    // Fast rotation oscillation between -10 and 10 degrees over 1.5 seconds in total
    tl.fromTo(
      el,
      { rotation: -10 },
      {
        rotation: 10,
        duration: 0.1875, // 8 phases over exactly 1.5s
        repeat: 7, 
        yoyo: true,
        ease: "sine.inOut",
      },
      0
    );

    const mapEl = document.getElementById("wave-displacement-map");
    if (mapEl) {
      tl.to(
        mapEl,
        {
          attr: { scale: 15 },
          duration: 0.5,
          ease: "power1.out",
        },
        0
      ).to(
        mapEl,
        {
          attr: { scale: 0 },
          duration: 1.0,
          ease: "power1.in",
        },
        0.5
      );
    }
  };

  useEffect(() => {
    return () => {
      if (hoverTweenRef.current) hoverTweenRef.current.kill();
      if (activeTimelineRef.current) activeTimelineRef.current.kill();
    };
  }, []);

  return {
    playJump,
    playWave,
    playHover,
    stopAll,
  };
}
