"use client";

import Image from "next/image";
import type { SpringOptions } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "motion/react";
import { productImageLoader } from "@/lib/product-image-loader";
import { cn } from "@/lib/utils";

interface TiltedCardProps {
  imageSrc?: React.ComponentProps<"img">["src"];
  /** Ordered fallbacks when the primary remote URL fails. */
  imageSrcs?: string[];
  altText?: string;
  captionText?: string;
  containerHeight?: React.CSSProperties["height"];
  containerWidth?: React.CSSProperties["width"];
  imageHeight?: React.CSSProperties["height"];
  imageWidth?: React.CSSProperties["width"];
  scaleOnHover?: number;
  rotateAmplitude?: number;
  showMobileWarning?: boolean;
  showTooltip?: boolean;
  overlayContent?: React.ReactNode;
  displayOverlayContent?: boolean;
  className?: string;
  imageClassName?: string;
  onImageError?: () => void;
}

const springValues: SpringOptions = {
  damping: 26,
  stiffness: 120,
  mass: 1.6,
};

export default function TiltedCard({
  imageSrc,
  imageSrcs,
  altText = "Tilted card image",
  captionText = "",
  containerHeight = "auto",
  containerWidth = "100%",
  imageHeight = "auto",
  imageWidth = "100%",
  scaleOnHover = 1.1,
  rotateAmplitude = 14,
  showMobileWarning = true,
  showTooltip = true,
  overlayContent = null,
  displayOverlayContent = false,
  className,
  imageClassName,
  onImageError,
}: TiltedCardProps) {
  const ref = useRef<HTMLElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);
  const rotateX = useSpring(useMotionValue(0), springValues);
  const rotateY = useSpring(useMotionValue(0), springValues);
  const scale = useSpring(1, springValues);
  const opacity = useSpring(0);
  const glareOpacity = useSpring(0, { damping: 28, stiffness: 160 });
  const rotateFigcaption = useSpring(0, {
    stiffness: 350,
    damping: 30,
    mass: 1,
  });
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.12) 28%, transparent 58%)`;

  const [lastY, setLastY] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const candidates = useMemo(
    () =>
      (imageSrcs?.length ? imageSrcs : imageSrc ? [String(imageSrc)] : []).filter(
        Boolean,
      ),
    [imageSrc, imageSrcs],
  );
  const [srcIndex, setSrcIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const activeSrc = !exhausted ? candidates[srcIndex] : undefined;

  useEffect(() => {
    setSrcIndex(0);
    setExhausted(false);
  }, [candidates]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  function handleMouse(e: React.MouseEvent<HTMLElement>) {
    if (!ref.current || reduceMotion) return;

    const rect = ref.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;

    const rotationX = (offsetY / (rect.height / 2)) * -rotateAmplitude;
    const rotationY = (offsetX / (rect.width / 2)) * rotateAmplitude;

    rotateX.set(rotationX);
    rotateY.set(rotationY);

    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);
    glareX.set(((e.clientX - rect.left) / rect.width) * 100);
    glareY.set(((e.clientY - rect.top) / rect.height) * 100);

    const velocityY = offsetY - lastY;
    rotateFigcaption.set(-velocityY * 0.6);
    setLastY(offsetY);
  }

  function handleMouseEnter() {
    if (reduceMotion) return;
    scale.set(scaleOnHover);
    opacity.set(1);
    glareOpacity.set(1);
  }

  function handleMouseLeave() {
    opacity.set(0);
    glareOpacity.set(0);
    scale.set(1);
    rotateX.set(0);
    rotateY.set(0);
    rotateFigcaption.set(0);
    glareX.set(50);
    glareY.set(50);
  }

  function handleImageError() {
    if (srcIndex + 1 < candidates.length) {
      setSrcIndex((i) => i + 1);
      return;
    }
    setExhausted(true);
    onImageError?.();
  }

  return (
    <figure
      ref={ref}
      className={cn("relative w-full [perspective:700px]", className)}
      style={{
        height: containerHeight,
        width: containerWidth,
      }}
      onMouseMove={handleMouse}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {showMobileWarning ? (
        <div className="absolute top-4 block text-center text-sm sm:hidden">
          This effect is not optimized for mobile. Check on desktop.
        </div>
      ) : null}

      <motion.div
        className="product-card-volume relative w-full [transform-style:preserve-3d]"
        style={{
          width: imageWidth,
          rotateX,
          rotateY,
          scale,
        }}
      >
        {activeSrc ? (
          <motion.div
            className={cn(
              "relative z-0 aspect-square w-full overflow-hidden rounded-2xl will-change-transform [transform:translateZ(24px)]",
              imageClassName,
            )}
            style={{
              width: imageWidth,
              height: imageHeight === "auto" ? undefined : imageHeight,
            }}
          >
            <Image
              key={activeSrc}
              src={activeSrc}
              alt={altText}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
              quality={75}
              className="object-contain"
              loader={/^https?:\/\//i.test(activeSrc) ? productImageLoader : undefined}
              onError={handleImageError}
            />
          </motion.div>
        ) : (
          <div
            className={cn(
              "relative z-0 aspect-square w-full rounded-2xl bg-[var(--bg-elevated)] [transform:translateZ(24px)]",
              imageClassName,
            )}
            style={{ width: imageWidth }}
            aria-hidden
          />
        )}

        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1] rounded-2xl mix-blend-soft-light will-change-transform [transform:translateZ(36px)]"
          style={{ opacity: glareOpacity, background: glareBackground }}
        />

        {displayOverlayContent && overlayContent ? (
          <motion.div className="absolute inset-0 z-[2] will-change-transform [transform:translateZ(52px)]">
            {overlayContent}
          </motion.div>
        ) : null}
      </motion.div>

      {showTooltip ? (
        <motion.figcaption
          className="pointer-events-none absolute top-0 left-0 z-[3] hidden rounded-md bg-[var(--accent)] px-2.5 py-1 text-[10px] font-semibold tracking-wide text-[var(--on-accent)] opacity-0 shadow-[var(--shadow-soft)] sm:block"
          style={{
            x,
            y,
            opacity,
            rotate: rotateFigcaption,
          }}
        >
          {captionText}
        </motion.figcaption>
      ) : null}
    </figure>
  );
}
