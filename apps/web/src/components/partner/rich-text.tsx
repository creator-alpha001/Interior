"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@repo/ui";

/**
 * The editor a vendor writes job details in.
 *
 * Deliberately small, and deliberately not a library. A tradesperson
 * describing a kitchen needs bold, italic, two kinds of list, a subheading and
 * the occasional link — that is the whole requirement, and the editors that
 * cover it properly bring a document model, a schema and half a megabyte of
 * JavaScript to a page vendors open on a phone.
 *
 * What it produces is HTML, and **the safety is not here**. `lib/html.ts` on
 * the API cleans every field on the way in, so a vendor who pastes markup, or
 * posts straight to the endpoint with no browser at all, cannot put a script
 * on somebody's profile. This side only has to be pleasant to type in.
 */
export function RichText({
  value,
  onChange,
  placeholder,
  rows = 6,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const editor = useRef<HTMLDivElement | null>(null);
  const [empty, setEmpty] = useState(true);

  /**
   * Written into the element rather than rendered.
   *
   * A contentEditable whose innerHTML React controls fights the caret: every
   * keystroke re-renders, the DOM is replaced and the cursor jumps to the
   * start. So the value is pushed in only when it differs from what is already
   * there — which is true on mount, and after the form is cleared to post
   * another job, and at no other time.
   */
  useEffect(() => {
    const node = editor.current;
    if (!node) return;
    if (node.innerHTML !== value) node.innerHTML = value;
    setEmpty(node.textContent?.trim().length === 0);
  }, [value]);

  function publish() {
    const node = editor.current;
    if (!node) return;
    setEmpty(node.textContent?.trim().length === 0);
    onChange(node.innerHTML);
  }

  function run(command: string, argument?: string) {
    editor.current?.focus();
    // Deprecated in the specification, implemented everywhere, and the only
    // way to do this without a document model of our own.
    document.execCommand(command, false, argument);
    publish();
  }

  function link() {
    const href = window.prompt("Link address");
    if (!href) return;
    run("createLink", href);
  }

  return (
    <div className="rounded-md border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-1.5 py-1">
        <ToolButton label="Bold" onClick={() => run("bold")}>
          <span className="font-bold">B</span>
        </ToolButton>
        <ToolButton label="Italic" onClick={() => run("italic")}>
          <span className="italic">I</span>
        </ToolButton>
        <ToolButton label="Subheading" onClick={() => run("formatBlock", "<h3>")}>
          H
        </ToolButton>
        <ToolButton label="Bulleted list" onClick={() => run("insertUnorderedList")}>
          •
        </ToolButton>
        <ToolButton label="Numbered list" onClick={() => run("insertOrderedList")}>
          1.
        </ToolButton>
        <ToolButton label="Link" onClick={link}>
          🔗
        </ToolButton>
        <ToolButton label="Clear formatting" onClick={() => run("removeFormat")}>
          ✕
        </ToolButton>
      </div>

      <div className="relative">
        {empty && placeholder ? (
          <p className="pointer-events-none absolute left-2.5 top-2 text-[13px] text-ink-4">
            {placeholder}
          </p>
        ) : null}
        <div
          ref={editor}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder ?? "Details"}
          onInput={publish}
          onBlur={publish}
          /*
           * Pasted content arrives as plain text on purpose. A paste from Word
           * or a website carries fonts, colours and tracking spans, all of
           * which the API strips anyway — pasting them would show the vendor
           * formatting that silently disappears when they save.
           */
          onPaste={(event) => {
            event.preventDefault();
            const text = event.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, text);
            publish();
          }}
          style={{ minHeight: `${rows * 1.5}rem` }}
          className={cn(
            "prose-vendor w-full px-2.5 py-2 text-[13px] leading-relaxed text-ink outline-none",
            "focus:ring-0",
          )}
        />
      </div>
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // `onMouseDown` rather than `onClick`: clicking a button takes focus out
      // of the editor first, and `execCommand` then has no selection to act on.
      onMouseDown={(event) => {
        event.preventDefault();
        onClick();
      }}
      className="grid h-7 w-7 place-items-center rounded text-[13px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {children}
    </button>
  );
}
