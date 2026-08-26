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

const durationFor = (step: CinematicStep) => step.duration ?? 600;
const progressFor = (step: CinematicStep, elapsed: number) => Math.min(1, Math.max(0, (elapsed - step.at) / durationFor(step)));
const isActive = (step: CinematicStep, elapsed: number) => elapsed >= step.at && elapsed <= step.at + durationFor(step);

export function CinematicLayer({ event, onFinished }: CinematicLayerProps) {
  const [frame, setFrame] = useState<CinematicFrame>({ elapsed: 0, event: null });

  useEffect(() => {
    if (!event || event.completed) return;
    const startedAt = performance.now();
    let animationFrame = 0;
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      if (elapsed >= event.duration) {
        setFrame({ elapsed: event.duration, event });
        onFinished();
        return;
      }
      setFrame({ elapsed, event });
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [event, onFinished]);

  const view = useMemo(() => {
    const activeFrame = event && !event.completed && frame.event?.id === event.id ? frame : null;
    if (!activeFrame?.event) return null;
    const steps = activeFrame.event.steps.filter((step) => isActive(step, activeFrame.elapsed));
    const find = (type: CinematicStep["type"]) => steps.filter((step) => step.type === type);
    const shake = find("SCREEN_SHAKE").reduce((total, step) => total + (step.intensity ?? .35), 0);
    const flash = find("FLASH").at(-1) as (CinematicStep & { color?: string }) | undefined;
    const darken = find("DARKEN").at(-1);
    const vignette = find("VIGNETTE").at(-1);
    const letterbox = find("LETTERBOX").at(-1);
    const colorWash = find("COLOR_WASH").at(-1) as (CinematicStep & { color?: string }) | undefined;
    const blur = find("BLUR").at(-1);
    const interactionLocked = find("LOCK_INTERACTION").length > 0;
    const title = find("TITLE").at(-1) as (CinematicStep & { text?: string }) | undefined;
    const titleProgress = title ? progressFor(title, activeFrame.elapsed) : 0;
    const titleOpacity = title ? Math.sin(titleProgress * Math.PI) : 0;
    const uiStep = [...activeFrame.event.steps].filter((step) => (step.type === "UI_FADE_OUT" || step.type === "UI_FADE_IN") && step.at <= activeFrame.elapsed).at(-1);
    let uiOpacity = 1;
    if (uiStep) {
      const progress = progressFor(uiStep, activeFrame.elapsed);
      uiOpacity = uiStep.type === "UI_FADE_OUT" ? 1 - progress : progress;
    }
    return { shake, flash, darken, vignette, letterbox, colorWash, blur, title, titleOpacity, uiOpacity, interactionLocked };
  }, [event, frame]);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".tabletop-shell");
    if (!shell) return;
    shell.classList.toggle("cinematic-screen-shake", Boolean(view?.shake));
    shell.classList.toggle("cinematic-ui-muted", (view?.uiOpacity ?? 1) < .2);
    shell.classList.toggle("cinematic-interaction-lock", Boolean(view?.interactionLocked));
    shell.classList.toggle("cinematic-map-blur", Boolean(view?.blur));
    shell.style.setProperty("--cinematic-shake", String(Math.min(1, view?.shake ?? 0) * 10) + "px");
    shell.style.setProperty("--cinematic-map-blur", String(Math.max(0, view?.blur?.intensity ?? 0) * 9) + "px");
    return () => {
      shell.classList.remove("cinematic-screen-shake", "cinematic-ui-muted", "cinematic-interaction-lock", "cinematic-map-blur");
      shell.style.removeProperty("--cinematic-shake");
      shell.style.removeProperty("--cinematic-map-blur");
    };
  }, [view?.shake, view?.uiOpacity, view?.interactionLocked, view?.blur]);

  if (!view) return null;
  const overlayStyle = {
    "--cinematic-flash": view.flash?.color ?? "#fff6d9",
    "--cinematic-flash-alpha": view.flash ? String(Math.max(.12, 1 - progressFor(view.flash, frame.elapsed))) : "0",
    "--cinematic-darkness": String(view.darken?.intensity ?? 0),
    "--cinematic-vignette": String(view.vignette?.intensity ?? 0),
    "--cinematic-letterbox": String(Math.max(0, Math.min(1, view.letterbox?.intensity ?? 0))),
    "--cinematic-wash": view.colorWash?.color ?? "#be3434",
    "--cinematic-wash-alpha": String(view.colorWash ? Math.max(0, Math.sin(progressFor(view.colorWash, frame.elapsed) * Math.PI) * (view.colorWash.intensity ?? .45)) : 0),
  } as CSSProperties;
  const titleStyle = { "--cinematic-title-opacity": String(view.titleOpacity) } as CSSProperties;

  return <div className="cinematic-layer" style={overlayStyle} aria-live="polite" aria-atomic="true">
    <div className="cinematic-darkness" />
    <div className="cinematic-vignette" />
    <div className="cinematic-color-wash" />
    <div className="cinematic-flash" />
    <div className="cinematic-letterbox" />
    {view.title?.text && <div className="cinematic-title" style={titleStyle}><span>{view.title.text}</span></div>}
  </div>;
}
