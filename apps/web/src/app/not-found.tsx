
import { ButtonLink, Container } from "@repo/ui";
export default function NotFound() {
  return (
    <Container width="default" className="py-24 text-center">
      <p className="font-display text-[64px] leading-none text-brand-line">404</p>
      <h1 className="mt-4 text-[32px] sm:text-[38px]">This page does not exist</h1>
      <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-ink-3">
        The link may be old, or the item may have been taken off the catalogue. Most of what we do
        is made to order anyway — tell us what you need and three professionals will quote for it.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">Back to home</ButtonLink>
        <ButtonLink href="/catalogue" variant="secondary">
          Browse the catalogue
        </ButtonLink>
        <ButtonLink href="/submit-requirement" variant="secondary">
          Get free quotes
        </ButtonLink>
      </div>
    </Container>
  );
}
