"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { adminDeletePoll } from "@/app/lib/actions/admin-actions";
import { useRouter } from "next/navigation";

interface Poll {
  id: string;
  question: string;
  user_id: string;
  created_at: string;
  options: string[];
}

interface AdminPollsListProps {
  polls: Poll[];
}

export default function AdminPollsList({ polls }: AdminPollsListProps) {
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async (pollId: string) => {
    if (!confirm("Are you sure you want to delete this poll? This action cannot be undone.")) {
      return;
    }

    setDeleteLoading(pollId);
    setError(null);
    
    const result = await adminDeletePoll(pollId);

    if (result.error) {
      setError(result.error);
    } else {
      // Refresh the page to show updated data
      router.refresh();
    }

    setDeleteLoading(null);
  };

  if (polls.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No polls found in the system.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
      )}
      
      <div className="grid gap-4">
        {polls.map((poll) => (
          <Card key={poll.id} className="border-l-4 border-l-blue-500">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{poll.question}</CardTitle>
                  <CardDescription>
                    <div className="space-y-1 mt-2">
                      <div>
                        Poll ID:{" "}
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                          {poll.id}
                        </code>
                      </div>
                      <div>
                        Owner ID:{" "}
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                          {poll.user_id}
                        </code>
                      </div>
                      <div>
                        Created:{" "}
                        {new Date(poll.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </CardDescription>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(poll.id)}
                  disabled={deleteLoading === poll.id}
                >
                  {deleteLoading === poll.id ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <h4 className="font-medium">Options:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {poll.options.map((option, index) => (
                    <li key={index} className="text-gray-700">
                      {option}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
