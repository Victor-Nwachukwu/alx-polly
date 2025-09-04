import { getPollByIdForEdit } from '@/app/lib/actions/poll-actions';
import { notFound } from 'next/navigation';
// Import the client component
import EditPollForm from './EditPollForm';

export default async function EditPollPage({ params }: { params: { id: string } }) {
  const { poll, error } = await getPollByIdForEdit(params.id);

  if (error || !poll) {
    notFound();
  }

  return (
    <div className="max-w-md mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Edit Poll</h1>
      <EditPollForm poll={poll} />
    </div>
  );
}