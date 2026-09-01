"use client";

import { useState, useTransition } from "react";
import type { RelayView } from "@repo/data";
import { cn, formatDateTime } from "@repo/ui";
import { relayToVendorsAction, replyToClientAction } from "@/app/actions";

/**
 * The relay: the client on the left, every assigned vendor on the right.
 *
 * The point of the layout is that a question only ever arrives from one side,
 * and the useful thing to do with it is put it to all three vendors at once —
 * so their quotes stay comparable. "Ask all vendors" is therefore the primary
 * action, not a bulk-send afterthought.
 */
export function RelayConsole({ relay, leadId }: { relay: RelayView; leadId: string }) {
  const [clientDraft, setClientDraft] = useState("");
  const [vendorDraft, setVendorDraft] = useState("");
  const [pending, startTransition] = useTransition();

  const lastClientMessage = relay.clientThread[relay.clientThread.length - 1];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ---- Client side ---- */}
      <section className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">
            Client · {relay.clientName}
          </h3>
          {relay.clientAwaitingReply ? (
            <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">
              Awaiting your reply
            </span>
          ) : null}
        </header>

        <div className="max-h-[380px] flex-1 space-y-3 overflow-y-auto p-4">
          {relay.clientThread.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-ink-3">No messages yet.</p>
          ) : (
            relay.clientThread.map((message) => {
              const fromUs = message.senderRole === "platform";
              return (
                <div key={message.id} className={cn("flex", fromUs ? "justify-end" : "justify-start")}>
                  <div className="max-w-[85%]">
                    <div
                      className={cn(
                        "rounded-lg px-3 py-2 text-[13px] leading-relaxed",
                        fromUs
                          ? "rounded-br-sm bg-brand text-white"
                          : "rounded-bl-sm bg-surface-2 text-ink-2",
                      )}
                    >
                      {message.body}
                    </div>
                    <div
                      className={cn(
                        "mt-1 text-[11px] text-ink-4",
                        fromUs ? "text-right" : "text-left",
                      )}
                    >
                      {fromUs ? "You" : relay.clientName.split(" ")[0]} ·{" "}
                      {formatDateTime(message.createdAt)}
                      {message.relayedFromMessageId ? " · relayed from a vendor" : ""}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-line p-3">
          <textarea
            value={clientDraft}
            onChange={(e) => setClientDraft(e.target.value)}
            rows={3}
            placeholder="Reply to the client…"
            className="w-full rounded-md border border-line bg-paper px-3 py-2 text-[13px] outline-none placeholder:text-ink-4 focus:border-brand"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {lastClientMessage?.senderRole === "client" ? (
              <button
                type="button"
                onClick={() => setVendorDraft(lastClientMessage.body)}
                className="text-[12px] font-medium text-brand hover:underline"
              >
                Put their question to all vendors →
              </button>
            ) : (
              <span className="text-[11.5px] text-ink-4">Client never sees vendor threads.</span>
            )}
            <button
              type="button"
              disabled={pending || clientDraft.trim().length < 3}
              onClick={() =>
                startTransition(async () => {
                  await replyToClientAction(relay.leadDomainId, clientDraft.trim(), leadId);
                  setClientDraft("");
                })
              }
              className="rounded-full bg-brand px-4 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send to client"}
            </button>
          </div>
        </div>
      </section>

      {/* ---- Vendor side ---- */}
      <section className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">
            Vendors · {relay.vendorThreads.length} assigned
          </h3>
          {relay.vendorThreads.some((t) => t.awaitingReply) ? (
            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
              {relay.vendorThreads.filter((t) => t.awaitingReply).length} need a response
            </span>
          ) : null}
        </header>

        <div className="max-h-[380px] flex-1 space-y-4 overflow-y-auto p-4">
          {relay.vendorThreads.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-ink-3">
              No vendors assigned to this service yet.
            </p>
          ) : (
            relay.vendorThreads.map((thread) => (
              <div key={thread.professional.id} className="rounded-md border border-line">
                <div className="flex items-center justify-between gap-2 border-b border-line bg-surface-2 px-3 py-1.5">
                  <span className="truncate text-[12.5px] font-medium text-ink">
                    {thread.professional.companyName}
                  </span>
                  {thread.awaitingReply ? (
                    <span className="shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-[10.5px] font-medium text-warning">
                      Replied — needs action
                    </span>
                  ) : null}
                </div>
                <div className="space-y-2 p-3">
                  {thread.messages.length === 0 ? (
                    <p className="text-[12px] text-ink-4">Nothing sent to them yet.</p>
                  ) : (
                    thread.messages.map((message) => {
                      const fromUs = message.senderRole === "platform";
                      return (
                        <div key={message.id}>
                          <div
                            className={cn(
                              "rounded-md px-2.5 py-1.5 text-[12.5px] leading-relaxed",
                              fromUs ? "bg-brand-soft text-ink-2" : "bg-surface-2 text-ink-2",
                            )}
                          >
                            {message.body}
                          </div>
                          <div className="mt-0.5 text-[10.5px] text-ink-4">
                            {fromUs ? "You" : thread.professional.name.split(" ")[0]} ·{" "}
                            {formatDateTime(message.createdAt)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-line p-3">
          <textarea
            value={vendorDraft}
            onChange={(e) => setVendorDraft(e.target.value)}
            rows={3}
            placeholder="Message every assigned vendor at once…"
            className="w-full rounded-md border border-line bg-paper px-3 py-2 text-[13px] outline-none placeholder:text-ink-4 focus:border-brand"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11.5px] text-ink-4">
              Goes to all {relay.vendorThreads.length} — keeps quotes comparable.
            </span>
            <button
              type="button"
              disabled={pending || vendorDraft.trim().length < 3 || relay.vendorThreads.length === 0}
              onClick={() =>
                startTransition(async () => {
                  await relayToVendorsAction(relay.leadDomainId, vendorDraft.trim(), leadId);
                  setVendorDraft("");
                })
              }
              className="rounded-full bg-clay px-4 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:brightness-95 disabled:opacity-50"
            >
              {pending ? "Sending…" : "Ask all vendors"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
