import { z } from 'zod';

/**
 * Zod schema for validating poll questions
 * 
 * WHAT: Defines validation rules for poll questions including length limits and XSS protection.
 * 
 * WHY: Poll questions are user-facing content that needs protection against abuse and attacks.
 * Length limits prevent database bloat and UI breaking. XSS protection prevents malicious
 * scripts from executing when questions are displayed to other users. The character limit
 * also ensures questions remain readable and focused, improving user experience.
 * 
 * @constant {z.ZodString} PollQuestionSchema
 */
export const PollQuestionSchema = z.string()
  .min(1, 'Question is required')
  .max(500, 'Question must be less than 500 characters')
  .refine(
    (val) => !/<script|javascript:|on\w+=/i.test(val),
    'Question contains potentially malicious content'
  );

/**
 * Zod schema for validating poll options
 * 
 * Validation rules:
 * - Required field (minimum 1 character)
 * - Maximum 200 characters per option
 * - XSS protection: blocks script tags, javascript: protocol, and event handlers
 * 
 * @constant {z.ZodString} PollOptionSchema
 */
export const PollOptionSchema = z.string()
  .min(1, 'Option cannot be empty')
  .max(200, 'Option must be less than 200 characters')
  .refine(
    (val) => !/<script|javascript:|on\w+=/i.test(val),
    'Option contains potentially malicious content'
  );

export const PollOptionsSchema = z.array(PollOptionSchema)
  .min(2, 'At least 2 options are required')
  .max(10, 'Maximum 10 options allowed')
  .refine(
    (options) => new Set(options).size === options.length,
    'Options must be unique'
  );

export const CreatePollSchema = z.object({
  question: PollQuestionSchema,
  options: PollOptionsSchema,
});

export const UpdatePollSchema = CreatePollSchema;

export const VoteSchema = z.object({
  pollId: z.string().uuid('Invalid poll ID'),
  optionIndex: z.number().int().min(0, 'Invalid option index'),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const RegisterSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .refine(
      (val) => !/<script|javascript:|on\w+=/i.test(val),
      'Name contains potentially malicious content'
    ),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .refine(
      (val) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(val),
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  }
);

// Sanitization functions
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .slice(0, 1000); // Limit length
}

export function sanitizePollData(data: {
  question: string;
  options: string[];
}): { question: string; options: string[] } {
  return {
    question: sanitizeString(data.question),
    options: data.options.map(option => sanitizeString(option)),
  };
}

/**
 * In-memory rate limiting storage
 * Maps identifiers to their request counts and reset times
 * 
 * Note: In production, consider using Redis or a database for distributed rate limiting
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Implements rate limiting to prevent abuse and DoS attacks
 * 
 * WHAT: Tracks requests per identifier within a time window and blocks requests that exceed
 * the maximum allowed limit. Uses an in-memory Map for fast lookups and automatic cleanup.
 * 
 * WHY: Rate limiting is essential for protecting against abuse, spam, and DoS attacks.
 * Without rate limiting, malicious users could overwhelm the system with requests,
 * causing service degradation or complete unavailability. The sliding window approach
 * provides fair usage while preventing bursts of malicious activity. In-memory storage
 * ensures fast response times, though production systems should consider Redis for
 * distributed rate limiting across multiple server instances.
 * 
 * @function checkRateLimit
 * @param {string} identifier - Unique identifier for rate limiting (e.g., IP address, user ID)
 * @param {number} maxRequests - Maximum number of requests allowed in the time window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {{allowed: boolean, remaining: number, resetTime: number}} Rate limit status
 * 
 * @example
 * ```typescript
 * const rateLimit = checkRateLimit('user-123', 5, 60000); // 5 requests per minute
 * if (!rateLimit.allowed) {
 *   console.log(`Rate limit exceeded. Try again in ${rateLimit.resetTime}ms`);
 * }
 * ```
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const key = identifier;
  const current = rateLimitMap.get(key);
  
  // If no existing entry or window has expired, create/reset entry
  if (!current || now > current.resetTime) {
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: now + windowMs,
    };
  }
  
  // Check if rate limit exceeded
  if (current.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: current.resetTime,
    };
  }
  
  // Increment counter and allow request
  current.count++;
  return {
    allowed: true,
    remaining: maxRequests - current.count,
    resetTime: current.resetTime,
  };
}

// Validation helper functions
export function validatePollData(data: unknown) {
  try {
    return CreatePollSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors.map(e => e.message).join(', '));
    }
    throw error;
  }
}

export function validateVoteData(data: unknown) {
  try {
    return VoteSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors.map(e => e.message).join(', '));
    }
    throw error;
  }
}

export function validateLoginData(data: unknown) {
  try {
    return LoginSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors.map(e => e.message).join(', '));
    }
    throw error;
  }
}

export function validateRegisterData(data: unknown) {
  try {
    return RegisterSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors.map(e => e.message).join(', '));
    }
    throw error;
  }
}
