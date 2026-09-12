/**
 * The one place vendor-written HTML is made safe.
 *
 * A vendor writes the details of a job in a rich text editor, and what the
 * editor sends is HTML. Storing it as typed and trusting each reader to be
 * careful is how a `<script>` in a job description ends up running in a
 * customer's browser, in the app's web build, and in the ops panel — three
 * places, three chances to forget.
 *
 * So it is cleaned **on the way in**. What is stored is already safe, every
 * reader is safe by default, and the one that matters most — the phone, which
 * renders HTML through a different engine entirely — cannot be the one that
 * was overlooked.
 *
 * The allowlist is deliberately small: the formatting a tradesperson needs to
 * describe a job, and nothing that loads or executes anything. No `img`
 * (photographs are `media_assets` rows, uploaded and owned properly), no
 * `style`, no `class`, no `id`, no event handlers, and links are rewritten to
 * open safely.
 */
import sanitizeHtml from "sanitize-html";

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "ul",
    "ol",
    "li",
    "h3",
    "h4",
    "blockquote",
    "a",
  ],
  allowedAttributes: { a: ["href", "target", "rel"] },
  // `http`, `https` and `mailto` only: `javascript:` in an href is the oldest
  // injection there is, and a relative link out of a vendor's description has
  // no meaning anyway.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener", target: "_blank" }),
    // The editor's toolbar offers two heading levels; a vendor's description
    // sits inside somebody else's page, where an `h1` would outrank the page's
    // own title and confuse both readers and screen readers.
    h1: "h3",
    h2: "h3",
    div: "p",
  },
  // Comments can carry markup that some parsers later resurrect.
  allowedIframeHostnames: [],
};

/** Vendor-written HTML, reduced to the tags we are willing to render. */
export function cleanHtml(value: string): string {
  return sanitizeHtml(value, OPTIONS).trim();
}

/**
 * True when the HTML says nothing.
 *
 * An empty editor still sends `<p></p>` or `<p><br></p>`, and a description
 * that is technically non-empty but renders as blank should be stored as the
 * empty string — otherwise every "does this have details" check is wrong.
 */
export function isBlankHtml(value: string): boolean {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).replace(/\s|&nbsp;/g, "")
    .length === 0;
}
