"use client";

import Link from "next/link";
import { useAuth } from "@/app/lib/context/auth-context";
import { Button } from "@/components/ui/button";
import { deletePoll } from "@/app/lib/actions/poll-actions";

/**
 * Interface representing a poll object
 * @interface Poll
 */
interface Poll {
  id: string;
  question: string;
  options: any[];
  user_id: string;
}

/**
 * Props interface for the PollActions component
 * @interface PollActionsProps
 */
interface PollActionsProps {
  poll: Poll;
}

/**
 * PollActions Component
 * 
 * WHAT: A client-side component that renders poll cards with action buttons for the user dashboard.
 * It displays poll information and provides edit/delete actions for poll owners.
 * 
 * WHY: This component provides a clean, secure interface for poll management. The client-side
 * ownership check improves UX by only showing action buttons to poll owners, reducing
 * confusion and preventing unnecessary server requests. The confirmation dialog prevents
 * accidental deletions, which is crucial for data integrity. The component separates
 * concerns by handling UI state while delegating security enforcement to server actions.
 * This pattern ensures that even if client-side checks are bypassed, server-side
 * authorization still protects the data.
 * 
 * Security Features:
 * - Client-side ownership check to show/hide action buttons
 * - Confirmation dialog before poll deletion
 * - Server-side authorization enforcement in deletePoll action
 * 
 * @component
 * @param {PollActionsProps} props - Component props
 * @param {Poll} props.poll - The poll object to display
 * 
 * @example
 * ```tsx
 * <PollActions poll={{
 *   id: 'poll-123',
 *   question: 'What is your favorite color?',
 *   options: ['Red', 'Blue', 'Green'],
 *   user_id: 'user-456'
 * }} />
 * ```
 */
export default function PollActions({ poll }: PollActionsProps) {
  // Get current user context for ownership verification
  const { user } = useAuth();
  
  /**
   * Handles poll deletion with user confirmation
   * 
   * WHAT: Shows a confirmation dialog, calls server-side deletePoll action, and reloads the page.
   * 
   * WHY: The confirmation dialog prevents accidental deletions, which is crucial for data integrity.
   * Server-side authorization ensures only poll owners can delete polls, even if client-side
   * checks are bypassed. Page reload ensures UI consistency after deletion. This pattern
   * provides both user experience improvements and security guarantees.
   */
  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this poll?")) {
      await deletePoll(poll.id);
      window.location.reload();
    }
  };

  return (
    <div className="border rounded-md shadow-md hover:shadow-lg transition-shadow bg-white">
      {/* Poll content area - clickable to view poll details
          WHY: Making the entire card clickable improves UX by providing a larger target area
          and clear visual indication that polls are interactive */}
      <Link href={`/polls/${poll.id}`}>
        <div className="group p-4">
          <div className="h-full">
            <div>
              {/* Poll question with hover effect
                  WHY: Hover effects provide visual feedback and indicate interactivity,
                  improving user experience and making the interface feel responsive */}
              <h2 className="group-hover:text-blue-600 transition-colors font-bold text-lg">
                {poll.question}
              </h2>
              {/* Display number of options
                  WHY: Option count gives users a quick overview of poll complexity
                  and helps them decide whether to engage with the poll */}
              <p className="text-slate-500">{poll.options.length} options</p>
            </div>
          </div>
        </div>
      </Link>
      
      {/* Action buttons - only show for poll owner
          WHY: Conditional rendering prevents UI clutter and reduces confusion by only
          showing relevant actions to users who can actually perform them */}
      {user && user.id === poll.user_id && (
        <div className="flex gap-2 p-2">
          {/* Edit button - navigates to edit page
              WHY: Edit functionality allows poll owners to modify their polls,
              providing flexibility and control over their content */}
          <Button asChild variant="outline" size="sm">
            <Link href={`/polls/${poll.id}/edit`}>Edit</Link>
          </Button>
          {/* Delete button - triggers confirmation and deletion
              WHY: Delete functionality allows poll owners to remove unwanted polls,
              but confirmation dialog prevents accidental data loss */}
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}
