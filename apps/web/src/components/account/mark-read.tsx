"use client";

import { useEffect } from "react";
import { markNotificationsReadAction } from "@/app/actions";

/**
 * Opening the notifications screen is the act of reading them, so the badge
 * clears on view rather than making the user hunt for a "mark all read" button.
 */
export function MarkNotificationsRead({ unread }: { unread: number }) {
  useEffect(() => {
    if (unread > 0) {
      const timer = setTimeout(() => {
        void markNotificationsReadAction();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [unread]);

  return null;
}
