"use client";

import { useEffect } from "react";
import { Button, ButtonLink, Container } from "@repo/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Wire this to real error reporting when the backend lands.
    console.error(error);
  }, [error]);

  return (
    <Container width="default" className="py-24 text-center">
      <h1 className="text-[32px] sm:text-[38px]">Something went wrong at our end</h1>
      <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-ink-3">
        This is our problem, not yours. Try again — if it keeps happening, raise a ticket and a
        named person from our team will pick it up.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-[13px] sm:text-[12px] text-ink-4">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Back to home
        </ButtonLink>
        <ButtonLink href="/account/support" variant="secondary">
          Raise a ticket
        </ButtonLink>
      </div>
    </Container>
  );
}
