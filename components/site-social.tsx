"use client";

import type { ComponentType } from "react";
import { useT } from "@/components/locale-provider";
import {
  contactEmail,
  facebookUrl,
  instagramUrl,
  mailtoUrl,
  whatsappUrl,
} from "@/lib/site-contact";
import { cn } from "@/lib/utils";

function IconMail({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 6.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 16V8A1.5 1.5 0 0 1 4 6.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="m4 8 8 5.5L20 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.04 2C6.58 2 2.15 6.4 2.15 11.82c0 1.96.52 3.8 1.44 5.4L2 22l4.95-1.54a10 10 0 0 0 5.09 1.37h.01c5.46 0 9.89-4.4 9.89-9.83C21.94 6.4 17.5 2 12.04 2Zm5.75 14.08c-.24.68-1.4 1.24-1.94 1.32-.5.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.93-4.36-.14-.2-1.16-1.54-1.16-2.94 0-1.4.73-2.08 1-2.36.26-.27.57-.34.76-.34h.55c.18 0 .42-.07.65.5.24.58.81 2 .88 2.14.07.14.12.3.02.49-.1.2-.15.32-.3.5-.14.17-.3.38-.43.51-.14.14-.29.29-.12.56.16.27.72 1.18 1.55 1.91 1.06.94 1.96 1.23 2.24 1.37.27.14.43.12.59-.07.16-.2.68-.79.86-1.06.18-.27.36-.22.61-.13.24.09 1.55.73 1.81.86.27.14.45.2.51.31.07.11.07.64-.17 1.32Z" />
    </svg>
  );
}

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3.75" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17.25" cy="6.75" r="1" fill="currentColor" />
    </svg>
  );
}

function IconFacebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M14 9h3V6h-3c-1.9 0-3.5 1.6-3.5 3.5V12H8v3h2.5v7H14v-7h2.6l.4-3H14V9.5c0-.3.2-.5.5-.5H14Z" />
    </svg>
  );
}

type SocialIcon = ComponentType<{ className?: string }>;

export function SiteSocial({
  variant = "list",
  className,
}: {
  variant?: "list" | "icons";
  className?: string;
}) {
  const t = useT();
  const email = contactEmail();
  const ig = instagramUrl();
  const fb = facebookUrl();
  const wa = whatsappUrl();

  const links: {
    href: string;
    label: string;
    short: string;
    icon: SocialIcon;
    external: boolean;
  }[] = [
    {
      href: mailtoUrl(t("store.emailSubject")),
      label: email,
      short: "Email",
      icon: IconMail,
      external: false,
    },
  ];

  if (wa) {
    links.push({
      href: wa,
      label: t("store.whatsapp"),
      short: t("store.whatsapp"),
      icon: IconWhatsApp,
      external: true,
    });
  }
  if (ig) {
    links.push({
      href: ig,
      label: "Instagram",
      short: "Instagram",
      icon: IconInstagram,
      external: true,
    });
  }
  if (fb) {
    links.push({
      href: fb,
      label: "Facebook",
      short: "Facebook",
      icon: IconFacebook,
      external: true,
    });
  }

  if (variant === "icons") {
    return (
      <ul className={cn("flex flex-wrap items-center gap-2", className)}>
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <a
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noreferrer" : undefined}
                aria-label={item.short}
                title={item.label}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--accent)] transition-[border-color,background-color,transform] duration-200 hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white active:scale-95"
              >
                <Icon className="h-4 w-4" />
              </a>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className={cn("mt-4 space-y-2 text-sm", className)}>
      {links.map((item) => (
        <li key={item.href}>
          <a
            href={item.href}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noreferrer" : undefined}
            className="transition-colors hover:text-[var(--accent)]"
          >
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
