"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { googleSignInAction, type GoogleState } from "@/app/(site)/login/actions";

/**
 * Google's own rendered button, not one of ours.
 *
 * Their identity library draws it into a container, and that is the supported
 * path: it satisfies Google's branding rules, it carries the wording and locale
 * they require, and it means no OAuth popup or redirect has to be written and
 * kept working here. The cost is that it will never quite match the buttons
 * beside it, which is the trade every site with this button has made.
 *
 * The credential handed back is an ID token. It goes straight to a server
 * action — the browser never learns the API's address, and the session cookie
 * is set by a server response because it is httpOnly.
 */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }): void;
          renderButton(
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "small" | "medium" | "large";
              text?: "signin_with" | "signup_with" | "continue_with";
              shape?: "rectangular" | "pill";
              width?: number;
              logo_alignment?: "left" | "center";
            },
          ): void;
        };
      };
    };
  }
}

interface Props {
  /** Where they were headed before being asked to sign in. */
  next?: string;
  /**
   * Called when this Google account has no mobile number against it yet.
   *
   * The parent owns the OTP stage, so it takes over from here rather than this
   * component growing a second form of its own.
   */
  onMobileRequired: (state: GoogleState) => void;
  onError: (message: string) => void;
}

export function GoogleSignInButton({ next, onMobileRequired, onError }: Props) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const container = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleCredential = useCallback(
    (response: { credential?: string }) => {
      if (!response.credential) {
        onError("Google did not return a sign-in. Please try again.");
        return;
      }

      setBusy(true);
      void googleSignInAction(response.credential, next)
        .then((result) => {
          // A completed sign-in redirects inside the action and never resolves,
          // so anything arriving here is either the mobile step or a failure.
          if (!result) return;
          if (result.error) onError(result.error);
          else if (result.linkToken) onMobileRequired(result);
        })
        .catch(() => onError("That Google sign-in did not work. Please try again."))
        .finally(() => setBusy(false));
    },
    [next, onError, onMobileRequired],
  );

  useEffect(() => {
    if (!ready || !clientId || !container.current) return;

    window.google?.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential,
      // No One Tap and no automatic sign-in. Signing somebody in because they
      // happened to load the page is a surprise, and this site is readable
      // without an account by design.
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    window.google?.accounts.id.renderButton(container.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      logo_alignment: "center",
      // Google's library will not read a CSS width, so it is given a number.
      // 320 is the widest it accepts and matches the card this sits in.
      width: 320,
    });
  }, [ready, clientId, handleCredential]);

  // Not configured is not an error. The site is meant to run with Google off —
  // it is an addition to the OTP path, never a replacement for it.
  if (!clientId) return null;

  return (
    <div className="mt-6">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={() => onError("Google sign-in could not load. Use your mobile number instead.")}
      />

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[12.5px] uppercase tracking-[0.12em] text-ink-4">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="mt-5 flex justify-center">
        {/* Kept mounted while busy: unmounting it mid-request would take
            Google's iframe with it and lose the callback. */}
        <div ref={container} aria-busy={busy} className={busy ? "pointer-events-none opacity-60" : undefined} />
      </div>
    </div>
  );
}
