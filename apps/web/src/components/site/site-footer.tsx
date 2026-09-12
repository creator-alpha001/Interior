import Link from "next/link";
import { listCities } from "@repo/data";
import { Media } from "@repo/ui";

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
      { name: "Our work", href: "/our-work" },
      { name: "Browse professionals", href: "/professionals" },
      { name: "Estimate a budget", href: "/estimate" },
      { name: "How it works", href: "/how-it-works" },
      { name: "Sign in", href: "/login" },
    ],
  },
  {
    title: "For professionals",
    links: [
      { name: "Join as a professional", href: "/join-as-professional" },
      { name: "Professional sign in", href: "/login" },
      { name: "How assignment works", href: "/how-it-works#professionals" },
      { name: "Commission & invoicing", href: "/how-it-works#commission" },
      { name: "Guides", href: "/blog" },
    ],
  },
  {
    /*
     * Everything a person looks for when deciding whether to trust a
     * platform with their address — who runs it, how to reach a human, and
     * what happens to their data. Both app stores also expect the policy and
     * the deletion route to be reachable from anywhere on the site, not only
     * from the small print at the bottom.
     */
    title: "Company",
    links: [
      { name: "About us", href: "/about" },
      { name: "Contact us", href: "mailto:hello@decorashine.com" },
      { name: "Terms of use", href: "/terms" },
      { name: "Privacy policy", href: "/privacy" },
      { name: "Delete your account", href: "/delete-account" },
    ],
  },
];

/** A strip of rooms, each leading to the trade that makes it. */
const ideas = [
  { src: "/images/stock/interior/1.jpg", label: "Living rooms", href: "/catalogue/interior-design" },
  { src: "/images/stock/interior/5.jpg", label: "Kitchens", href: "/catalogue/interior-design" },
  { src: "/images/stock/furniture/7.jpg", label: "Beds & wardrobes", href: "/catalogue/furniture" },
  { src: "/images/stock/furniture/4.jpg", label: "Dining", href: "/catalogue/furniture" },
  { src: "/images/stock/fabrication/4.jpg", label: "Railings & gates", href: "/catalogue/fabrication" },
  { src: "/images/stock/painting/7.jpg", label: "Wall colours", href: "/catalogue/painting" },
];

/**
 * The site footer.
 *
 * Dark, so the page has an end: the light footer it replaced ran on from the
 * last section in the same colours and read as more page. It opens with the one
 * action that matters and a row of rooms, then the directory of links.
 *
 * The cities come from the API rather than a string typed here, which went
 * stale the first time a city was added.
 */
export async function SiteFooter() {
  const cities = await listCities().catch(() => []);

  return (
    <footer className="bg-ink text-white">
      <div className="border-b border-white/10">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-5 pt-14 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/50">
              Homes that feel like you
            </p>
            <h2 className="mt-2 max-w-[28ch] text-[26px] leading-tight text-white sm:text-[32px]">
              Tell us about your home. We will bring three professionals to quote.
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/submit-requirement"
              className="inline-flex h-12 items-center whitespace-nowrap rounded-full bg-white px-6 text-[15px] font-medium text-brand transition-colors hover:bg-white/90"
            >
              Get free design quotes
            </Link>
            <Link
              href="/our-work"
              className="inline-flex h-12 items-center whitespace-nowrap rounded-full border border-white/30 px-6 text-[15px] font-medium text-white transition-colors hover:bg-white/10"
            >
              Explore designs
            </Link>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-7xl grid-cols-3 gap-3 px-5 py-10 sm:px-8 md:grid-cols-6">
          {ideas.map((idea) => (
            <Link
              key={idea.label}
              href={idea.href}
              className="group relative isolate block aspect-[4/3] overflow-hidden rounded-lg sm:aspect-square"
            >
              <div className="absolute inset-0 -z-10 transition-transform duration-500 group-hover:scale-105">
                <Media src={idea.src} alt="" rounded={false} />
              </div>
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 p-2.5 text-[13px] font-medium leading-tight text-white">
                {idea.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            {/* On a white panel: the artwork is drawn for a light ground, and
                its transparent house would fill with the footer's dark. */}
            <Link
              href="/"
              aria-label="Decora Shine home"
              className="inline-flex items-center gap-2.5 rounded-xl bg-white px-4 py-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/decora-shine-mark.png"
                alt=""
                width={231}
                height={256}
                className="h-10 w-auto"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/decora-shine-wordmark.png"
                alt="Decora Shine"
                width={667}
                height={96}
                className="h-[22px] w-auto"
              />
            </Link>
            <p className="mt-4 max-w-sm text-[14.5px] leading-relaxed text-white/65 sm:text-[13.5px]">
              Interiors, furniture, fabrication and painting on one platform. Tell us what you need,
              meet three professionals, and compare their quotes side by side before you commit to
              anything.
            </p>

            {cities.length > 0 ? (
              <div className="mt-6">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/45">
                  Districts we serve
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {cities.map((city) => (
                    <span
                      key={city.id}
                      className="rounded-full border border-white/15 px-2.5 py-1 text-[12.5px] text-white/75"
                    >
                      {city.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/45">
                {col.title}
              </h3>
              <ul className="mt-3 space-y-0.5 sm:mt-4 sm:space-y-2">
                {col.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="-mx-2 inline-block rounded px-2 py-1.5 text-[14.5px] text-white/80 transition-colors hover:text-white sm:mx-0 sm:px-0 sm:py-0.5 sm:text-[13.5px]"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-[13.5px] text-white/50 sm:flex-row sm:items-center sm:justify-between sm:text-[12.5px]">
          {/*
           * The legal entity, named beside the brand. Meta's business verification
           * checks that the name on the registration documents and the name on the
           * site are visibly the same business, so this line is load-bearing: keep
           * it in step with the GST certificate if either ever changes.
           */}
          {/*
            "Prototype — all data on this site is sample data" sat here while
            that was true. It is not any more: the platform serves real
            customers and real professionals, and telling visitors otherwise
            cost trust exactly where trust is being asked for.
          */}
          <p>
            © {new Date().getFullYear()} Decora Shine, a brand of Intellihive Solutions.
            <br className="sm:hidden" /> Faridabad, Haryana, India.
          </p>
          <div className="flex gap-5">
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/delete-account" className="hover:text-white">
              Delete account
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
