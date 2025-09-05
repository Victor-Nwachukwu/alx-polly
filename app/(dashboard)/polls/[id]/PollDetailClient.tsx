'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { submitVote } from '@/app/lib/actions/poll-actions';
import { useAuth } from '@/app/lib/context/auth-context';

/**
 * Interface representing a poll object
 * @interface Poll
 */
interface Poll {
  id: string;
  question: string;
  options: string[];
  created_at: string;
}

/**
 * Interface representing poll results with vote counts and percentages
 * @interface PollResults
 */
interface PollResults {
  poll: {
    id: string;
    question: string;
    options: string[];
  };
  voteCounts: number[];
  totalVotes: number;
  percentages: number[];
}

/**
 * Props interface for the PollDetailClient component
 * @interface PollDetailClientProps
 */
interface PollDetailClientProps {
  poll: Poll;
  results: PollResults | null;
  pollId: string;
  resultsError: string | null;
}

/**
 * PollDetailClient Component
 * 
 * WHAT: A client-side component that handles poll viewing and voting functionality.
 * It provides an interactive interface for users to view polls, submit votes,
 * and see real-time results with visual progress bars.
 * 
 * WHY: This component creates an engaging user experience while maintaining security.
 * The interactive voting interface makes polls accessible and user-friendly.
 * Real-time results with progress bars provide immediate feedback and visual
 * appeal. Social sharing functionality increases poll reach and engagement.
 * The component handles both authenticated and anonymous users, making polls
 * accessible to everyone while maintaining security through server-side validation.
 * Error handling ensures users receive clear feedback when issues occur.
 * 
 * Security Features:
 * - Server-side vote validation and deduplication
 * - Rate limiting protection
 * - Input sanitization
 * - CSRF protection through server actions
 * 
 * @component
 * @param {PollDetailClientProps} props - Component props
 * @param {Poll} props.poll - The poll object to display
 * @param {PollResults | null} props.results - Poll results with vote counts
 * @param {string} props.pollId - The poll ID for voting
 * @param {string | null} props.resultsError - Any error from results fetching
 * 
 * @example
 * ```tsx
 * <PollDetailClient 
 *   poll={pollData}
 *   results={resultsData}
 *   pollId="poll-123"
 *   resultsError={null}
 * />
 * ```
 */
export default function PollDetailClient({ 
  poll, 
  results, 
  pollId, 
  resultsError 
}: PollDetailClientProps) {
  // State management for voting interface
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voteResults, setVoteResults] = useState<PollResults | null>(results);
  
  // Get current user context for ownership verification
  const { user } = useAuth();

  /**
   * Handles vote submission with comprehensive error handling
   * 
   * WHAT: Validates selection, shows loading state, calls server-side submitVote action,
   * handles errors, and refreshes page to show updated results.
   * 
   * WHY: Client-side validation improves UX by providing immediate feedback, but server-side
   * validation ensures security and data integrity. Loading states prevent double-submissions
   * and provide user feedback. Error handling ensures users understand what went wrong.
   * Page refresh ensures results are current and consistent across all users viewing the poll.
   * This pattern balances user experience with security requirements.
   */
  const handleVote = async () => {
    if (selectedOption === null) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Get client IP (simplified - in production, get from headers)
      const clientIP = 'unknown';
      
      // Submit vote with server-side validation
      const result = await submitVote(pollId, selectedOption, clientIP);
      
      if (result.error) {
        setError(result.error);
      } else {
        setHasVoted(true);
        // Refresh results after voting to show updated counts
        window.location.reload();
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Calculates percentage of votes for display
   * @param {number} votes - Number of votes for an option
   * @param {number} total - Total number of votes
   * @returns {number} Percentage rounded to nearest integer
   */
  const getPercentage = (votes: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((votes / total) * 100);
  };

  /**
   * Copies the current poll URL to clipboard
   * Provides user feedback on success/failure
   */
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    } catch (err) {
      alert('Failed to copy link');
    }
  };

  /**
   * Opens Twitter sharing dialog with poll information
   * Uses Twitter's intent URL for sharing
   */
  const shareOnTwitter = () => {
    const text = encodeURIComponent(`Check out this poll: ${poll.question}`);
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <Link href="/polls" className="text-blue-600 hover:underline">
          &larr; Back to Polls
        </Link>
        {user && (
          <div className="flex space-x-2">
            <Button variant="outline" asChild>
              <Link href={`/polls/${pollId}/edit`}>Edit Poll</Link>
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{poll.question}</CardTitle>
          <CardDescription>
            Created on {new Date(poll.created_at).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          {!hasVoted && !resultsError ? (
            <div className="space-y-3">
              {poll.options.map((option, index) => (
                <div 
                  key={index} 
                  className={`p-3 border rounded-md cursor-pointer transition-colors ${
                    selectedOption === index ? 'border-blue-500 bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => setSelectedOption(index)}
                >
                  {option}
                </div>
              ))}
              <Button 
                onClick={handleVote} 
                disabled={selectedOption === null || isSubmitting} 
                className="mt-4"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Vote'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-medium">Results:</h3>
              {voteResults ? (
                <>
                  {poll.options.map((option, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{option}</span>
                        <span>
                          {getPercentage(voteResults.voteCounts[index], voteResults.totalVotes)}% 
                          ({voteResults.voteCounts[index]} votes)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5">
                        <div 
                          className="bg-blue-600 h-2.5 rounded-full" 
                          style={{ 
                            width: `${getPercentage(voteResults.voteCounts[index], voteResults.totalVotes)}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                  <div className="text-sm text-slate-500 pt-2">
                    Total votes: {voteResults.totalVotes}
                  </div>
                </>
              ) : (
                <div className="text-gray-500">
                  {resultsError || 'No results available'}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="pt-4">
        <h2 className="text-xl font-semibold mb-4">Share this poll</h2>
        <div className="flex space-x-2">
          <Button variant="outline" className="flex-1" onClick={copyToClipboard}>
            Copy Link
          </Button>
          <Button variant="outline" className="flex-1" onClick={shareOnTwitter}>
            Share on Twitter
          </Button>
        </div>
      </div>
    </>
  );
}
