import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export function useModalAnimations(isOpen: boolean) {
  const cardRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !cardRef.current) return;

    const ctx = gsap.context(() => {
      // Staggered entrance
      gsap.fromTo(
        logoRef.current,
        { y: -20, opacity: 0, scale: 0.8, rotateY: -15 },
        {
          y: 0, opacity: 1, scale: 1, rotateY: 0,
          duration: 0.7, ease: "back.out(1.7)", delay: 0.15,
        }
      );

      gsap.fromTo(
        contentRef.current?.children ?? [],
        { y: 24, opacity: 0, filter: "blur(8px)" },
        {
          y: 0, opacity: 1, filter: "blur(0px)",
          duration: 0.55, ease: "power3.out",
          stagger: 0.08, delay: 0.3,
        }
      );

      gsap.fromTo(
        dividerRef.current,
        { scaleX: 0, opacity: 0 },
        {
          scaleX: 1, opacity: 1,
          duration: 0.6, ease: "power2.out", delay: 0.5,
        }
      );

      // Continuous idle: logo bob
      gsap.to(logoRef.current, {
        y: -4, duration: 3, ease: "sine.inOut",
        repeat: -1, yoyo: true, delay: 1,
      });
    }, cardRef);

    return () => ctx.revert();
  }, [isOpen]);

  return { cardRef, logoRef, contentRef, dividerRef };
}