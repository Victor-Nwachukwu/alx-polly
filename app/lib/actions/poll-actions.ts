"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/security/auth-utils";
import { validatePollData, sanitizePollData, checkRateLimit } from "@/lib/security/validation";
import { validateCSRFToken } from "@/lib/security/csrf";

/**
 * Creates a new poll with comprehensive security validation
 * 
 * WHAT: Handles poll creation with multiple security layers including CSRF protection,
 * rate limiting, authentication verification, input validation, and XSS prevention.
 * 
 * WHY: Poll creation is a critical operation that needs protection against various attacks.
 * CSRF tokens prevent malicious sites from creating polls on behalf of users.
 * Rate limiting prevents abuse and DoS attacks by limiting poll creation frequency.
 * Input validation ensures data integrity and prevents injection attacks.
 * XSS prevention protects against malicious content that could harm other users.
 * Authentication ensures only logged-in users can create polls, maintaining accountability.
 * 
 * @async
 * @function createPoll
 * @param {FormData} formData - Form data containing poll question and options
 * @returns {Promise<{error: string | null, data?: any}>} Result object with error status and optional poll data
 * 
 * @example
 * ```typescript
 * const formData = new FormData();
 * formData.append('question', 'What is your favorite color?');
 * formData.append('options', 'Red');
 * formData.append('options', 'Blue');
 * 
 * const result = await createPoll(formData);
 * if (!result.error) {
 *   console.log('Poll created successfully');
 * }
 * ```
 */
export async function createPoll(formData: FormData) {
  try {
    // CSRF protection - prevents cross-site request forgery attacks
    // WHY: CSRF tokens ensure requests come from legitimate forms, not malicious sites
    const isValidCSRF = await validateCSRFToken(formData);
    if (!isValidCSRF) {
      return { error: "Invalid CSRF token. Please refresh the page and try again." };
    }

    // Rate limiting - prevents abuse and DoS attacks
    // WHY: Rate limiting protects against spam and ensures fair resource usage
    const clientIP = formData.get("clientIP") as string || "unknown";
    const rateLimit = checkRateLimit(`create_poll_${clientIP}`, 5, 60000); // 5 polls per minute
    
    if (!rateLimit.allowed) {
      return { 
        error: `Rate limit exceeded. Please wait ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} seconds before creating another poll.` 
      };
    }

    // Authentication check - ensures only logged-in users can create polls
    // WHY: Authentication maintains accountability and prevents anonymous abuse
    const context = await requireAuth();

    // Extract and validate data - prevents malformed requests
    // WHY: Form data extraction must be done carefully to prevent injection attacks
    const question = formData.get("question") as string;
    const options = formData.getAll("options").filter(Boolean) as string[];

    if (!question || options.length < 2) {
      return { error: "Please provide a question and at least two options." };
    }

    // Validate and sanitize input - ensures data integrity and prevents XSS
    // WHY: Validation prevents database corruption; sanitization removes malicious content
    const pollData = validatePollData({ question, options });
    const sanitizedData = sanitizePollData(pollData);

    const supabase = await createClient();

    // Database insertion with proper error handling
    // WHY: Database operations need error handling to ensure data persistence
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

    // Revalidate cache to show new poll immediately
    // WHY: Cache invalidation ensures users see updated data without manual refresh
    revalidatePath("/polls");
    return { error: null, data };
  } catch (error) {
    return { 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    };
  }
}

/**
 * Retrieves all polls created by the authenticated user
 * 
 * This function fetches polls with security considerations:
 * - Requires user authentication
 * - Only returns polls owned by the current user
 * - Limits returned data to essential fields for security
 * - Handles errors gracefully without exposing sensitive information
 * 
 * @async
 * @function getUserPolls
 * @returns {Promise<{polls: any[], error: string | null}>} Object containing user's polls and any error
 * 
 * @example
 * ```typescript
 * const { polls, error } = await getUserPolls();
 * if (!error) {
 *   polls.forEach(poll => console.log(poll.question));
 * }
 * ```
 */
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

/**
 * Submits a vote for a poll with comprehensive security and deduplication
 * 
 * WHAT: Handles voting with multiple security measures including rate limiting,
 * input validation, poll existence verification, and duplicate vote prevention
 * for both authenticated and anonymous users.
 * 
 * WHY: Voting integrity is crucial for poll accuracy and user trust. Rate limiting
 * prevents vote manipulation and DoS attacks. Input validation ensures only valid
 * votes are recorded. Duplicate prevention maintains poll integrity by ensuring
 * each user/IP can only vote once. The dual tracking system (user-based for
 * authenticated users, IP-based for anonymous users) provides comprehensive
 * protection while allowing anonymous participation. Poll existence verification
 * prevents votes on non-existent polls, which could be used for attacks.
 * 
 * @async
 * @function submitVote
 * @param {string} pollId - The unique identifier of the poll
 * @param {number} optionIndex - The index of the selected option (0-based)
 * @param {string} [clientIP] - Optional client IP address for anonymous vote tracking
 * @returns {Promise<{error: string | null}>} Result object with error status
 * 
 * @example
 * ```typescript
 * const result = await submitVote('poll-123', 1, '192.168.1.1');
 * if (!result.error) {
 *   console.log('Vote submitted successfully');
 * } else {
 *   console.error('Vote failed:', result.error);
 * }
 * ```
 */
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
