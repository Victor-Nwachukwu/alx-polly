import { z } from 'zod';

// Validation schemas
export const PollQuestionSchema = z.string()
  .min(1, 'Question is required')
  .max(500, 'Question must be less than 500 characters')
  .refine(
    (val) => !/<script|javascript:|on\w+=/i.test(val),
    'Question contains potentially malicious content'
  );

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

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const key = identifier;
  const current = rateLimitMap.get(key);
  
  if (!current || now > current.resetTime) {
    // Reset or create new entry
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
  
  if (current.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: current.resetTime,
    };
  }
  
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
