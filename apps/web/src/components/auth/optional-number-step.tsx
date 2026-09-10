"use client";

import { useRouter } from "next/navigation";
import { AddMobile } from "@/components/account/add-mobile";

/**
 * The client half of `/welcome/number`: what to do once the number is dealt
 * with, either way.
 *
 * `onDone` and `onSkip` are deliberately the same function. Giving a number and
 * declining to give one land in exactly the same place, because they are
 * equally acceptable answers — a skip that dropped somebody somewhere worse
 * would make the offer a threat.
 */
export function OptionalNumberStep({ destination }: { destination: string }) {
  const router = useRouter();

  function finish() {
    // The header and the account screens above this route were rendered before
    // the number existed, so without a refresh they would still be offering to
    // collect one.
    router.refresh();
    router.push(destination);
  }

  return (
    <AddMobile
      onDone={finish}
      onSkip={finish}
      skipLabel="Skip — I'll add it later"
      submitLabel="Save my number"
      autoFocus
    />
  );
}
