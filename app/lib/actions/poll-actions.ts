"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/security/auth-utils";
import { validatePollData, sanitizePollData, checkRateLimit } from "@/lib/security/validation";
import { validateCSRFToken } from "@/lib/security/csrf";

// CREATE POLL
export async function createPoll(formData: FormData) {
  try {
    // CSRF protection
    const isValidCSRF = await validateCSRFToken(formData);
    if (!isValidCSRF) {
      return { error: "Invalid CSRF token. Please refresh the page and try again." };
    }

    // Rate limiting
    const clientIP = formData.get("clientIP") as string || "unknown";
    const rateLimit = checkRateLimit(`create_poll_${clientIP}`, 5, 60000); // 5 polls per minute
    
    if (!rateLimit.allowed) {
      return { 
        error: `Rate limit exceeded. Please wait ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} seconds before creating another poll.` 
      };
    }

    // Authentication check
    const context = await requireAuth();

    // Extract and validate data
    const question = formData.get("question") as string;
    const options = formData.getAll("options").filter(Boolean) as string[];

    if (!question || options.length < 2) {
      return { error: "Please provide a question and at least two options." };
    }

    // Validate and sanitize input
    const pollData = validatePollData({ question, options });
    const sanitizedData = sanitizePollData(pollData);

    const supabase = await createClient();

    const { data, error } = await supabase.from("polls").insert([
      {
        user_id: context.user!.id,
        question: sanitizedData.question,
        options: sanitizedData.options,
        created_at: new Date().toISOString(),
      },
    ]).select().single();

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/polls");
    return { error: null, data };
  } catch (error) {
    return { 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    };
  }
}

// GET USER POLLS
export async function getUserPolls() {
  try {
    const context = await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("polls")
      .select("id, question, options, created_at, updated_at")
      .eq("user_id", context.user!.id)
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

// GET POLL BY ID (Public access for voting)
export async function getPollById(id: string) {
  try {
    const supabase = await createClient();
    
    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return { poll: null, error: "Invalid poll ID format" };
    }

    const { data, error } = await supabase
      .from("polls")
      .select("id, question, options, created_at")
      .eq("id", id)
      .single();

    if (error) return { poll: null, error: error.message };
    return { poll: data, error: null };
  } catch (error) {
    return { 
      poll: null, 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    };
  }
}

// GET POLL BY ID WITH OWNERSHIP CHECK (For editing)
export async function getPollByIdForEdit(id: string) {
  try {
    const context = await requireOwnershipOrAdmin('poll', id);
    const supabase = await createClient();
    
    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return { poll: null, error: "Invalid poll ID format" };
    }

    const { data, error } = await supabase
      .from("polls")
      .select("id, question, options, created_at, updated_at, user_id")
      .eq("id", id)
      .single();

    if (error) return { poll: null, error: error.message };
    return { poll: data, error: null };
  } catch (error) {
    return { 
      poll: null, 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    };
  }
}

// SUBMIT VOTE
export async function submitVote(pollId: string, optionIndex: number, clientIP?: string) {
  try {
    // Rate limiting
    const identifier = clientIP || "anonymous";
    const rateLimit = checkRateLimit(`vote_${identifier}`, 10, 60000); // 10 votes per minute
    
    if (!rateLimit.allowed) {
      return { 
        error: `Rate limit exceeded. Please wait ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} seconds before voting again.` 
      };
    }

    // Validate input
    const voteData = validateVoteData({ pollId, optionIndex });
    
    const supabase = await createClient();
    
    // Check if poll exists
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select("id, options")
      .eq("id", voteData.pollId)
      .single();

    if (pollError || !poll) {
      return { error: "Poll not found" };
    }

    // Validate option index
    if (voteData.optionIndex < 0 || voteData.optionIndex >= poll.options.length) {
      return { error: "Invalid option selected" };
    }

    // Get current user (optional for voting)
    const { data: { user } } = await supabase.auth.getUser();

    // Check for duplicate votes (if user is logged in)
    if (user) {
      const { data: existingVote } = await supabase
        .from("votes")
        .select("id")
        .eq("poll_id", voteData.pollId)
        .eq("user_id", user.id)
        .single();

      if (existingVote) {
        return { error: "You have already voted on this poll" };
      }
    } else {
      // For anonymous users, check IP-based duplicate prevention
      const { data: existingVote } = await supabase
        .from("votes")
        .select("id")
        .eq("poll_id", voteData.pollId)
        .eq("ip_address", clientIP)
        .single();

      if (existingVote) {
        return { error: "You have already voted on this poll from this device" };
      }
    }

    // Insert vote
    const { error } = await supabase.from("votes").insert([
      {
        poll_id: voteData.pollId,
        user_id: user?.id ?? null,
        option_index: voteData.optionIndex,
        ip_address: clientIP,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) return { error: error.message };
    return { error: null };
  } catch (error) {
    return { 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    };
  }
}

// DELETE POLL
export async function deletePoll(id: string) {
  try {
    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return { error: "Invalid poll ID format" };
    }

    // Check ownership or admin access
    const context = await requireOwnershipOrAdmin('poll', id);
    const supabase = await createClient();

    // Delete associated votes first
    await supabase.from("votes").delete().eq("poll_id", id);

    // Delete the poll
    const { error } = await supabase
      .from("polls")
      .delete()
      .eq("id", id);

    if (error) return { error: error.message };
    
    revalidatePath("/polls");
    return { error: null };
  } catch (error) {
    return { 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    };
  }
}

// UPDATE POLL
export async function updatePoll(pollId: string, formData: FormData) {
  try {
    // CSRF protection
    const isValidCSRF = await validateCSRFToken(formData);
    if (!isValidCSRF) {
      return { error: "Invalid CSRF token. Please refresh the page and try again." };
    }

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pollId)) {
      return { error: "Invalid poll ID format" };
    }

    // Check ownership or admin access
    const context = await requireOwnershipOrAdmin('poll', pollId);

    // Extract and validate data
    const question = formData.get("question") as string;
    const options = formData.getAll("options").filter(Boolean) as string[];

    if (!question || options.length < 2) {
      return { error: "Please provide a question and at least two options." };
    }

    // Validate and sanitize input
    const pollData = validatePollData({ question, options });
    const sanitizedData = sanitizePollData(pollData);

    const supabase = await createClient();

    // Update the poll
    const { error } = await supabase
      .from("polls")
      .update({ 
        question: sanitizedData.question, 
        options: sanitizedData.options,
        updated_at: new Date().toISOString()
      })
      .eq("id", pollId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/polls");
    return { error: null };
  } catch (error) {
    return { 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    };
  }
}
