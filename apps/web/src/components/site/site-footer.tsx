import Link from "next/link";

const columns = [
  {
    title: "Services",
    links: [
      { name: "Interior Design", href: "/catalogue/interior-design" },
      { name: "Furniture Work", href: "/catalogue/furniture" },
      { name: "Fabrication", href: "/catalogue/fabrication" },
      { name: "Painting", href: "/catalogue/painting" },
      { name: "All packages", href: "/packages" },
    ],
  },
  {
    title: "For customers",
    links: [
      { name: "Get free quotes", href: "/submit-requirement" },
      { name: "How it works", href: "/how-it-works" },
      { name: "Browse professionals", href: "/professionals" },
      { name: "My requirements", href: "/account" },
      { name: "Blog", href: "/blog" },
    ],
  },
  {
    title: "For professionals",
    links: [
      { name: "Join as a professional", href: "/join-as-professional" },
      { name: "Professional sign in", href: "/partner" },
      { name: "How assignment works", href: "/how-it-works#professionals" },
      { name: "Commission & invoicing", href: "/how-it-works#commission" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
                <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden="true">
                  <path d="M10 2L2 8v10h5v-6h6v6h5V8l-8-6z" />
                </svg>
              </span>
              <span className="font-display text-[21px] leading-none">Aangan</span>
            </div>
            <p className="mt-4 max-w-xs text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-3">
              One platform for interiors, furniture, fabrication and painting. Tell us what you
              need, meet three verified professionals, and compare their quotes side by side before
              you commit to anything.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-sans text-[13px] sm:text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                {col.title}
              </h3>
              <ul className="mt-3 space-y-0.5 sm:mt-4 sm:space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="-mx-2 inline-block rounded px-2 py-1.5 text-[14.5px] text-ink-2 transition-colors hover:text-brand sm:mx-0 sm:px-0 sm:py-0.5 sm:text-[13.5px]"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-[13.5px] sm:text-[12.5px] text-ink-4 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Aangan. Prototype — all data on this site is sample data.</p>
          <div className="flex gap-5">
            <Link href="/how-it-works" className="hover:text-ink-2">
              Terms
            </Link>
            <Link href="/how-it-works" className="hover:text-ink-2">
              Privacy
            </Link>
            <span>Lucknow · Kanpur · Noida · Bengaluru · Pune · Hyderabad</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
