"use client";

import { useT } from "@/components/locale-provider";
import {
  contactEmail,
  facebookUrl,
  instagramUrl,
  mailtoUrl,
  whatsappUrl,
} from "@/lib/site-contact";

export function SiteSocial() {
  const t = useT();
  const email = contactEmail();
  const ig = instagramUrl();
  const fb = facebookUrl();
  const wa = whatsappUrl();

  return (
    <ul className="mt-4 space-y-2 text-sm">
      <li>
        <a
          href={mailtoUrl(t("store.emailSubject"))}
          className="transition-colors hover:text-[var(--accent)]"
        >
          {email}
        </a>
      </li>
      {wa ? (
        <li>
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-[var(--accent)]"
          >
            {t("store.whatsapp")}
          </a>
        </li>
      ) : null}
      {ig ? (
        <li>
          <a
            href={ig}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-[var(--accent)]"
          >
            Instagram
          </a>
        </li>
      ) : null}
      {fb ? (
        <li>
          <a
            href={fb}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-[var(--accent)]"
          >
            Facebook
          </a>
        </li>
      ) : null}
    </ul>
  );
}
