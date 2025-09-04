"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/security/auth-utils";

// GET ALL POLLS (Admin only)
export async function getAllPolls() {
  try {
    const context = await requireAdmin();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("polls")
      .select("id, question, options, created_at, updated_at, user_id")
      .order("created_at", { ascending: false });

    if (error) return { polls: [], error: error.message };
    return { polls: data ?? [], error: null };
  } catch (error) {
    return { 
      polls: [], 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    };
  }
}

// GET POLL VOTES (Admin only)
export async function getPollVotes(pollId: string) {
  try {
    const context = await requireAdmin();
    const supabase = await createClient();

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pollId)) {
      return { votes: [], error: "Invalid poll ID format" };
    }

    const { data, error } = await supabase
      .from("votes")
      .select("id, option_index, created_at, ip_address")
      .eq("poll_id", pollId)
      .order("created_at", { ascending: false });

    if (error) return { votes: [], error: error.message };
    return { votes: data ?? [], error: null };
  } catch (error) {
    return { 
      votes: [], 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    };
  }
}

// GET POLL RESULTS (Public)
export async function getPollResults(pollId: string) {
  try {
    const supabase = await createClient();

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pollId)) {
      return { results: null, error: "Invalid poll ID format" };
    }

    // Get poll data
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select("id, question, options")
      .eq("id", pollId)
      .single();

    if (pollError || !poll) {
      return { results: null, error: "Poll not found" };
    }

    // Get vote counts
    const { data: votes, error: votesError } = await supabase
      .from("votes")
      .select("option_index")
      .eq("poll_id", pollId);

    if (votesError) {
      return { results: null, error: votesError.message };
    }

    // Calculate results
    const voteCounts = new Array(poll.options.length).fill(0);
    votes?.forEach(vote => {
      if (vote.option_index >= 0 && vote.option_index < poll.options.length) {
        voteCounts[vote.option_index]++;
      }
    });

    const totalVotes = voteCounts.reduce((sum, count) => sum + count, 0);

    const results = {
      poll: {
        id: poll.id,
        question: poll.question,
        options: poll.options
      },
      voteCounts,
      totalVotes,
      percentages: voteCounts.map(count => 
        totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
      )
    };

    return { results, error: null };
  } catch (error) {
    return { 
      results: null, 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    };
  }
}

// DELETE ANY POLL (Admin only)
export async function adminDeletePoll(pollId: string) {
  try {
    const context = await requireAdmin();
    const supabase = await createClient();

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pollId)) {
      return { error: "Invalid poll ID format" };
    }

    // Delete associated votes first
    await supabase.from("votes").delete().eq("poll_id", pollId);

    // Delete the poll
    const { error } = await supabase
      .from("polls")
      .delete()
      .eq("id", pollId);

    if (error) return { error: error.message };
    
    return { error: null };
  } catch (error) {
    return { 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    };
  }
}
