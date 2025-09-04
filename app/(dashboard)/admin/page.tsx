import { getAllPolls } from "@/app/lib/actions/admin-actions";
import { notFound } from "next/navigation";
import AdminPollsList from "./AdminPollsList";

export default async function AdminPage() {
  const { polls, error } = await getAllPolls();

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-gray-600 mt-2">
          View and manage all polls in the system.
        </p>
      </div>

      <AdminPollsList polls={polls} />
    </div>
  );
}
