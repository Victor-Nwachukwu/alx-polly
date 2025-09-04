import { getPollById, getPollResults } from '@/app/lib/actions/poll-actions';
import { notFound } from 'next/navigation';
import PollDetailClient from './PollDetailClient';

export default async function PollDetailPage({ params }: { params: { id: string } }) {
  const { poll, error: pollError } = await getPollById(params.id);
  const { results, error: resultsError } = await getPollResults(params.id);

  if (pollError || !poll) {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PollDetailClient 
        poll={poll} 
        results={results} 
        pollId={params.id}
        resultsError={resultsError}
      />
    </div>
  );
}