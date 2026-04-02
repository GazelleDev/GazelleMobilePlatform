import { notFound } from "next/navigation";
import { updateClientCapabilitiesAction } from "@/app/actions";
import { getInternalLocation, InternalApiError } from "@/lib/internal-api";

type ClientCapabilitiesPageProps = {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClientCapabilitiesPage({ params, searchParams }: ClientCapabilitiesPageProps) {
  const { locationId } = await params;
  const query = await searchParams;
  const updated = typeof query.updated === "string" ? query.updated : undefined;
  const error = typeof query.error === "string" ? query.error : undefined;

  try {
    const location = await getInternalLocation(locationId);

    return (
      <section className="page-stack">
        <div className="page-header">
          <div>
            <span className="eyebrow">Capabilities</span>
            <h3>{location.brandName}</h3>
            <p>Update the pilot behavior from the same internal bootstrap surface used during onboarding.</p>
          </div>
        </div>

        <section className="panel">
          {updated ? <p className="inline-message inline-message-success">Capabilities updated.</p> : null}
          {error ? <p className="inline-message inline-message-error">{error}</p> : null}

          <form action={updateClientCapabilitiesAction} className="stack-form">
            <input type="hidden" name="brandId" value={location.brandId} />
            <input type="hidden" name="brandName" value={location.brandName} />
            <input type="hidden" name="locationId" value={location.locationId} />
            <input type="hidden" name="locationName" value={location.locationName} />
            <input type="hidden" name="marketLabel" value={location.marketLabel} />

            <div className="field-grid">
              <label className="field">
                <span>Store name</span>
                <input name="storeName" defaultValue={location.storeName} required />
              </label>
              <label className="field">
                <span>Hours</span>
                <input name="hours" defaultValue={location.hours} required />
              </label>
              <label className="field field-wide">
                <span>Pickup instructions</span>
                <input name="pickupInstructions" defaultValue={location.pickupInstructions} required />
              </label>
              <label className="field">
                <span>Menu source</span>
                <select name="menuSource" defaultValue={location.capabilities.menu.source}>
                  <option value="platform_managed">Platform managed</option>
                  <option value="external_sync">External sync</option>
                </select>
              </label>
              <label className="field">
                <span>Fulfillment mode</span>
                <select name="fulfillmentMode" defaultValue={location.capabilities.operations.fulfillmentMode}>
                  <option value="time_based">Time based</option>
                  <option value="staff">Staff managed</option>
                </select>
              </label>
              <label className="toggle-field">
                <input type="checkbox" name="dashboardEnabled" defaultChecked={location.capabilities.operations.dashboardEnabled} />
                <span>Client dashboard enabled</span>
              </label>
              <label className="toggle-field">
                <input
                  type="checkbox"
                  name="liveOrderTrackingEnabled"
                  defaultChecked={location.capabilities.operations.liveOrderTrackingEnabled}
                />
                <span>Live order tracking enabled</span>
              </label>
              <label className="toggle-field">
                <input type="checkbox" name="loyaltyVisible" defaultChecked={location.capabilities.loyalty.visible} />
                <span>Loyalty visible in customer app</span>
              </label>
            </div>

            <div className="form-actions">
              <button type="submit" className="primary-button">
                Save Capabilities
              </button>
            </div>
          </form>
        </section>
      </section>
    );
  } catch (error) {
    if (error instanceof InternalApiError && error.statusCode === 404) {
      notFound();
    }

    throw error;
  }
}
