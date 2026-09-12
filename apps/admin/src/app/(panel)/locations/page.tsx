import { getCityUsage, listAllCities, listAllStates } from "@repo/data";
import { LocationManager, type DistrictUsage } from "@/components/location-manager";
import { PageBody, PageHeader } from "@/components/ops-ui";

export const metadata = { title: "Locations" };

/**
 * Where the platform works.
 *
 * Two levels, in the order somebody thinks in: a state, then the districts
 * inside it. Until this screen existed, entering a new market meant an INSERT
 * written by hand against production.
 */
export default async function LocationsPage() {
  const [states, districts] = await Promise.all([listAllStates(), listAllCities()]);

  // Usage is read for every district, because the number that matters is the
  // one on the row somebody is about to switch off.
  const usageEntries = await Promise.all(
    districts.map(async (d) => [d.id, await getCityUsage(d.id)] as const),
  );
  const usage = Object.fromEntries(usageEntries) as Record<string, DistrictUsage>;

  return (
    <>
      <PageHeader
        title="Locations"
        subtitle="The states and districts the platform serves. Adding one is configuration, not a release."
      />

      <PageBody className="space-y-4">
        <div className="rounded-lg border border-brand-line bg-brand-soft p-4">
          <h2 className="text-[13px] font-semibold text-brand">What a district decides</h2>
          <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-ink-2">
            A district is the unit everything else hangs off: which professionals a requirement can
            reach, which areas a vendor may claim, where posted work says it was done, and which
            prices a customer is quoted. Add one and it is immediately selectable by customers and
            vendors.
          </p>
          <p className="mt-2 max-w-3xl text-[12.5px] leading-relaxed text-ink-2">
            Nothing here can be deleted, deliberately. Customers, requirements, service areas and
            prices all point at these rows. Switching one off stops new business reaching a place we
            cannot serve, and leaves every existing record intact.
          </p>
        </div>

        <LocationManager states={states} districts={districts} usage={usage} />
      </PageBody>
    </>
  );
}
