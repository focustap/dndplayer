import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { CinematicEvent, CinematicStep } from "../../domain/types";
import "./cinematic.css";

interface CinematicLayerProps {
  event: CinematicEvent | null;
  onFinished(): void;
}

interface CinematicFrame {
  elapsed: number;
  event: CinematicEvent | null;
}

const isActive = (step: CinematicStep, elapsed: number) => elapsed >= step.at && elapsed <= step.at + (step.duration ?? 600);

export function CinematicLayer({ event, onFinished }: CinematicLayerProps) {
  const [frame, setFrame] = useState<CinematicFrame>({ elapsed: 0, event: null });

  useEffect(() => {
    if (!event) return;
    const startedAt = performance.now();
    let animationFrame = 0;
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      if (elapsed >= event.duration) { setFrame({ elapsed: event.duration, event }); onFinished(); return; }
      setFrame({ elapsed, event });
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [event, onFinished]);

  const view = useMemo(() => {
    const activeFrame = event && frame.event?.id === event.id ? frame : null;
    if (!activeFrame?.event) return null;
    const steps = activeFrame.event.steps.filter((step) => isActive(step, activeFrame.elapsed));
    const find = (type: CinematicStep["type"]) => steps.filter((step) => step.type === type);
    const shake = find("SCREEN_SHAKE").reduce((total, step) => total + (step.intensity ?? .35), 0);
    const flash = find("FLASH").at(-1) as (CinematicStep & { color?: string }) | undefined;
    const darken = find("DARKEN").at(-1);
    const vignette = find("VIGNETTE").at(-1);
    const interactionLocked = find("LOCK_INTERACTION").length > 0;
    const title = find("TITLE").at(-1) as (CinematicStep & { text?: string }) | undefined;
    const uiStep = [...activeFrame.event.steps].filter((step) => (step.type === "UI_FADE_OUT" || step.type === "UI_FADE_IN") && step.at <= activeFrame.elapsed).at(-1);
    let uiOpacity = 1;
    if (uiStep) {
      const progress = Math.min(1, Math.max(0, (activeFrame.elapsed - uiStep.at) / (uiStep.duration ?? 500)));
      uiOpacity = uiStep.type === "UI_FADE_OUT" ? 1 - progress : progress;
    }
    return { shake, flash, darken, vignette, title, uiOpacity, interactionLocked };
  }, [event, frame]);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".tabletop-shell");
    if (!shell) return;
    shell.classList.toggle("cinematic-screen-shake", Boolean(view?.shake));
    shell.classList.toggle("cinematic-ui-muted", (view?.uiOpacity ?? 1) < .2);
    shell.classList.toggle("cinematic-interaction-lock", Boolean(view?.interactionLocked));
    shell.style.setProperty("--cinematic-shake", `${Math.min(1, view?.shake ?? 0) * 10}px`);
    return () => {
      shell.classList.remove("cinematic-screen-shake", "cinematic-ui-muted", "cinematic-interaction-lock");
      shell.style.removeProperty("--cinematic-shake");
    };
  }, [view?.shake, view?.uiOpacity, view?.interactionLocked]);

  if (!view) return null;
  const overlayStyle = {
    "--cinematic-flash": view.flash?.color ?? "#fff6d9",
    "--cinematic-flash-alpha": view.flash ? String(Math.max(.12, 1 - (frame.elapsed - view.flash.at) / (view.flash.duration ?? 350))) : "0",
    "--cinematic-darkness": String(view.darken?.intensity ?? 0),
    "--cinematic-vignette": String(view.vignette?.intensity ?? 0),
  } as CSSProperties;

  return <div className="cinematic-layer" style={overlayStyle} aria-live="polite" aria-atomic="true">
    <div className="cinematic-darkness" />
    <div className="cinematic-vignette" />
    <div className="cinematic-flash" />
    {view.title?.text && <div className="cinematic-title"><span>{view.title.text}</span></div>}
  </div>;
}
