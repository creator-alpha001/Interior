
import { Container } from "@repo/ui";
/** Skeleton shown while a server-rendered page streams in. */
export default function Loading() {
  return (
    <Container width="wide" className="py-14">
      <div className="animate-pulse space-y-8">
        <div className="space-y-3">
          <div className="h-3 w-40 rounded bg-surface-2" />
          <div className="h-9 w-2/3 max-w-lg rounded bg-surface-2" />
          <div className="h-4 w-full max-w-xl rounded bg-surface-2" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="aspect-[4/3] bg-surface-2" />
              <div className="space-y-2.5 p-4">
                <div className="h-3 w-20 rounded bg-surface-2" />
                <div className="h-4 w-3/4 rounded bg-surface-2" />
                <div className="h-3 w-full rounded bg-surface-2" />
                <div className="h-5 w-24 rounded bg-surface-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </Container>
  );
}
