"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { createGoogleNonce, googleClientId } from "@/lib/auth/google-identity";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleIdApi = {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    nonce: string;
    ux_mode: "popup";
    use_fedcm_for_prompt: boolean;
    auto_select: boolean;
    itp_support: boolean;
    context: "signin";
    cancel_on_tap_outside: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type: "standard";
      theme: "outline";
      size: "large";
      text: "continue_with";
      shape: "rectangular";
      logo_alignment: "left";
      width: number;
      locale: string;
    },
  ) => void;
  prompt: () => void;
  cancel: () => void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

export function GoogleSignInButton({
  locale,
  disabled,
  onCredential,
  onUnavailable,
}: {
  locale: "en" | "fr";
  disabled?: boolean;
  onCredential: (idToken: string, nonce: string) => Promise<void>;
  onUnavailable?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nonceRef = useRef("");
  const onCredentialRef = useRef(onCredential);
  const onUnavailableRef = useRef(onUnavailable);
  const localeRef = useRef(locale);
  const [scriptReady, setScriptReady] = useState(false);
  const failedRef = useRef(false);

  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);
  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  const paint = useCallback(() => {
    const parent = containerRef.current;
    const googleId = window.google?.accounts.id;
    if (!parent || !googleId || !nonceRef.current) return;
    const width = Math.min(400, Math.max(200, Math.floor(parent.getBoundingClientRect().width)));
    parent.replaceChildren();
    googleId.renderButton(parent, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "left",
      width,
      locale: localeRef.current,
    });
  }, []);

  function giveUp() {
    if (failedRef.current) return;
    failedRef.current = true;
    onUnavailableRef.current?.();
  }

  useEffect(() => {
    if (!scriptReady) return;
    let cancelled = false;

    void (async () => {
      const clientId = googleClientId();
      const api = window.google?.accounts.id;
      if (!clientId || !api) {
        if (!cancelled) giveUp();
        return;
      }
      try {
        const { nonce, hashedNonce } = await createGoogleNonce();
        if (cancelled) return;
        const ready = window.google?.accounts.id;
        if (!ready) {
          giveUp();
          return;
        }
        nonceRef.current = nonce;
        ready.initialize({
          client_id: clientId,
          callback: (response) => {
            const token = response.credential;
            const rawNonce = nonceRef.current;
            if (!token || !rawNonce) return;
            void onCredentialRef.current(token, rawNonce);
          },
          nonce: hashedNonce,
          ux_mode: "popup",
          use_fedcm_for_prompt: true,
          auto_select: false,
          itp_support: true,
          context: "signin",
          cancel_on_tap_outside: true,
        });
        paint();
        ready.prompt();
      } catch {
        if (!cancelled) giveUp();
      }
    })();

    return () => {
      cancelled = true;
      window.google?.accounts.id.cancel();
    };
  }, [paint, scriptReady]);

  useEffect(() => {
    if (!scriptReady || failedRef.current) return;
    paint();
  }, [locale, paint, scriptReady]);

  useEffect(() => {
    if (!scriptReady) return;
    const parent = containerRef.current;
    if (!parent) return;
    const observer = new ResizeObserver(() => {
      if (!failedRef.current) paint();
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, [paint, scriptReady]);

  return (
    <div className={`mt-6 ${disabled ? "pointer-events-none opacity-60" : ""}`}>
      <Script
        src={SCRIPT_SRC}
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => giveUp()}
      />
      <div ref={containerRef} className="flex min-h-10 w-full justify-center" />
    </div>
  );
}
