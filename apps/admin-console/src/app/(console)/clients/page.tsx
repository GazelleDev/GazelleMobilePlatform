import { ClientManagementTable } from "@/components/ClientManagementTable";
import { listInternalLocations } from "@/lib/internal-api";

export default async function ClientsPage() {
  const response = await listInternalLocations();
  return <ClientManagementTable locations={response.locations} />;
}
