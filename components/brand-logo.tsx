import Image from "next/image";
import { cn } from "@/lib/utils";

const SRC = {
  lockup: { src: "/brand/rappi-logo-v2.png", width: 776, height: 478 },
  mark: { src: "/brand/rappi-mark-v2.png", width: 512, height: 512 },
  banner: { src: "/brand/rappi-banner.png", width: 1024, height: 640 },
} as const;

export function BrandLogo({
  variant = "lockup",
  className,
  priority = false,
}: {
  variant?: keyof typeof SRC;
  className?: string;
  priority?: boolean;
}) {
  const img = SRC[variant];
  return (
    <Image
      src={img.src}
      alt="RAPPI SPORTS HUB"
      width={img.width}
      height={img.height}
      className={cn("brand-logo max-w-none object-contain", className)}
      style={variant === "mark" ? undefined : { width: "auto" }}
      sizes="200px"
      priority={priority}
    />
  );
}
