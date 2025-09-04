import { createClient } from '@/lib/supabase/server';
import { User } from '@supabase/supabase-js';

export interface UserRole {
  role: 'user' | 'admin';
  permissions: string[];
}

export interface SecurityContext {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

/**
 * Get current user with role information
 */
export async function getSecurityContext(): Promise<SecurityContext> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return {
      user: null,
      role: null,
      isAuthenticated: false,
      isAdmin: false,
    };
  }

  // Get user role from metadata or default to 'user'
  const role = user.user_metadata?.role || 'user';
  const isAdmin = role === 'admin';
  
  return {
    user,
    role: {
      role: isAdmin ? 'admin' : 'user',
      permissions: isAdmin 
        ? ['read:all', 'write:all', 'delete:all', 'admin:access']
        : ['read:own', 'write:own', 'delete:own']
    },
    isAuthenticated: true,
    isAdmin,
  };
}

/**
 * Check if user has permission for specific action
 */
export function hasPermission(
  context: SecurityContext, 
  action: string, 
  resource?: string
): boolean {
  if (!context.isAuthenticated) return false;
  
  const { permissions } = context.role!;
  
  // Admin has all permissions
  if (permissions.includes('admin:access')) return true;
  
  // Check specific permissions
  return permissions.some(permission => {
    if (permission === action) return true;
    if (permission.startsWith(action.split(':')[0] + ':')) return true;
    return false;
  });
}

/**
 * Verify user owns a resource
 */
export async function verifyOwnership(
  resourceType: 'poll',
  resourceId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();
  
  switch (resourceType) {
    case 'poll':
      const { data: poll } = await supabase
        .from('polls')
        .select('user_id')
        .eq('id', resourceId)
        .single();
      
      return poll?.user_id === userId;
    
    default:
      return false;
  }
}

/**
 * Require authentication for action
 */
export async function requireAuth(): Promise<SecurityContext> {
  const context = await getSecurityContext();
  
  if (!context.isAuthenticated) {
    throw new Error('Authentication required');
  }
  
  return context;
}

/**
 * Require admin role for action
 */
export async function requireAdmin(): Promise<SecurityContext> {
  const context = await getSecurityContext();
  
  if (!context.isAuthenticated) {
    throw new Error('Authentication required');
  }
  
  if (!context.isAdmin) {
    throw new Error('Admin access required');
  }
  
  return context;
}

/**
 * Require ownership or admin role
 */
export async function requireOwnershipOrAdmin(
  resourceType: 'poll',
  resourceId: string
): Promise<SecurityContext> {
  const context = await getSecurityContext();
  
  if (!context.isAuthenticated) {
    throw new Error('Authentication required');
  }
  
  if (context.isAdmin) {
    return context;
  }
  
  const isOwner = await verifyOwnership(resourceType, resourceId, context.user!.id);
  
  if (!isOwner) {
    throw new Error('Access denied: You can only access your own resources');
  }
  
  return context;
}
