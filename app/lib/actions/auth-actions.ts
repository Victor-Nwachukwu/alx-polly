'use server';

import { createClient } from '@/lib/supabase/server';
import { LoginFormData, RegisterFormData } from '../types';
import { validateLoginData, validateRegisterData, checkRateLimit } from '@/lib/security/validation';

export async function login(data: LoginFormData) {
  try {
    // Rate limiting
    const rateLimit = checkRateLimit(`login_${data.email}`, 5, 300000); // 5 attempts per 5 minutes
    
    if (!rateLimit.allowed) {
      return { 
        error: `Too many login attempts. Please wait ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} seconds before trying again.` 
      };
    }

    // Validate input
    const validatedData = validateLoginData(data);
    
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password,
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  } catch (error) {
    return { 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    };
  }
}

export async function register(data: RegisterFormData) {
  try {
    // Rate limiting
    const rateLimit = checkRateLimit(`register_${data.email}`, 3, 300000); // 3 registrations per 5 minutes
    
    if (!rateLimit.allowed) {
      return { 
        error: `Too many registration attempts. Please wait ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} seconds before trying again.` 
      };
    }

    // Validate input
    const validatedData = validateRegisterData(data);
    
    const supabase = await createClient();

    const { error } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        data: {
          name: validatedData.name,
          role: 'user', // Default role
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  } catch (error) {
    return { 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    };
  }
}

export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getSession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}
