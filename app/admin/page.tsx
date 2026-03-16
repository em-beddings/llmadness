import { AdminRunner } from "@/components/admin-runner";
import { loadAdminData } from "@/lib/admin";

export default async function AdminPage() {
  const data = await loadAdminData();

  return <AdminRunner configs={data.configs} models={data.models} />;
}
