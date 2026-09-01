import { listNotifications } from "@repo/data";
import { DEMO_USER_ID } from "@/lib/session";
import { MarkNotificationsRead } from "@/components/account/mark-read";
import { Badge, EmptyState, cn, formatDateTime } from "@repo/ui";

const typeLabel: Record<string, string> = {
  professional_assigned: "Professionals assigned",
  meeting_confirmed: "Site visit",
  quote_uploaded: "New quote",
  agreement_ready: "Agreement",
  agreement_signed: "Agreement",
  project_started: "Project",
  project_completed: "Project",
  new_lead: "Lead",
  commission_due: "Invoice",
  message_received: "Message",
  review_received: "Review",
};

export default async function NotificationsPage() {
  const notifications = await listNotifications(DEMO_USER_ID);
  const unread = notifications.filter((n) => !n.isRead).length;

  if (notifications.length === 0) {
    return (
      <EmptyState
        title="Nothing here yet"
        description="You will be notified when professionals are assigned, quotes arrive, and work progresses."
      />
    );
  }

  return (
    <div className="space-y-3">
      <MarkNotificationsRead unread={unread} />
      {notifications.map((n) => (
        <div
          key={n.id}
          className={cn(
            "flex items-start gap-4 rounded-xl border bg-surface p-5",
            n.isRead ? "border-line" : "border-brand-line bg-brand-soft/40",
          )}
        >
          <span
            className={cn(
              "mt-1.5 h-2 w-2 shrink-0 rounded-full",
              n.isRead ? "bg-line-strong" : "bg-clay",
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{typeLabel[n.type] ?? n.type}</Badge>
              <span className="text-[13px] sm:text-[12px] text-ink-4">{formatDateTime(n.createdAt)}</span>
            </div>
            <h3 className="mt-2 text-[15px] font-semibold text-ink">{n.title}</h3>
            <p className="mt-1 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-3">{n.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
