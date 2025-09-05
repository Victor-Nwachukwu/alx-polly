import { createClient } from '@/lib/supabase/server';
import { User } from '@supabase/supabase-js';

/**
 * User role interface defining available roles and their permissions
 * @interface UserRole
 */
export interface UserRole {
  role: 'user' | 'admin';
  permissions: string[];
}

/**
 * Security context containing user authentication and authorization information
 * @interface SecurityContext
 */
export interface SecurityContext {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

/**
 * Retrieves the current user's security context including authentication status and role
 * 
 * WHAT: Fetches the current user from Supabase and determines their role based on user metadata.
 * It provides a comprehensive security context that includes authentication status, role information, and permissions.
 * 
 * WHY: This centralized function ensures consistent security context across the application.
 * It prevents code duplication and provides a single source of truth for user authentication
 * and authorization state. The role-based permission system allows for flexible access control
 * where admin users have elevated privileges while regular users have limited access.
 * 
 * @async
 * @function getSecurityContext
 * @returns {Promise<SecurityContext>} Complete security context for the current user
 * 
 * @example
 * ```typescript
 * const context = await getSecurityContext();
 * if (context.isAuthenticated) {
 *   console.log(`User ${context.user?.email} has role: ${context.role?.role}`);
 * }
 * ```
 */
export async function getSecurityContext(): Promise<SecurityContext> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  // Return unauthenticated context if user fetch fails
  if (error || !user) {
    return {
      user: null,
      role: null,
      isAuthenticated: false,
      isAdmin: false,
    };
  }

  // Extract role from user metadata, defaulting to 'user' if not specified
  const role = user.user_metadata?.role || 'user';
  const isAdmin = role === 'admin';
  
  return {
    user,
    role: {
      role: isAdmin ? 'admin' : 'user',
      // Assign permissions based on role level
      permissions: isAdmin 
        ? ['read:all', 'write:all', 'delete:all', 'admin:access']
        : ['read:own', 'write:own', 'delete:own']
    },
    isAuthenticated: true,
    isAdmin,
  };
}

/**
 * Checks if a user has permission to perform a specific action
 * 
 * WHAT: Validates user permissions against the requested action using pattern matching.
 * Admin users have all permissions, while regular users have limited permissions based on their role.
 * 
 * WHY: This function implements the principle of least privilege by enforcing granular permissions.
 * It prevents unauthorized actions by checking permissions before allowing operations.
 * The pattern matching system allows for flexible permission checking (e.g., 'read:own' matches 'read:all').
 * This is crucial for security as it ensures users can only perform actions they're authorized for.
 * 
 * @function hasPermission
 * @param {SecurityContext} context - The user's security context
 * @param {string} action - The action to check permission for (e.g., 'read:own', 'delete:all')
 * @param {string} [resource] - Optional resource identifier for context-specific permissions
 * @returns {boolean} True if user has permission, false otherwise
 * 
 * @example
 * ```typescript
 * const context = await getSecurityContext();
 * if (hasPermission(context, 'delete:own')) {
 *   // User can delete their own resources
 * }
 * ```
 */
export function hasPermission(
  context: SecurityContext, 
  action: string, 
  resource?: string
): boolean {
  if (!context.isAuthenticated) return false;
  
  const { permissions } = context.role!;
  
  // Admin users have all permissions
  if (permissions.includes('admin:access')) return true;
  
  // Check specific permissions with pattern matching
  return permissions.some(permission => {
    if (permission === action) return true;
    if (permission.startsWith(action.split(':')[0] + ':')) return true;
    return false;
  });
}

/**
 * Verifies if a user owns a specific resource
 * 
 * WHAT: Checks database ownership by comparing the resource's user_id with the provided user ID.
 * It queries the database to verify ownership before allowing resource modifications.
 * 
 * WHY: This function enforces resource-level access control, preventing users from accessing
 * or modifying resources they don't own. It's essential for data security as it ensures
 * users can only operate on their own data. This prevents data breaches and unauthorized
 * access to sensitive information. The database query ensures the ownership check is
 * authoritative and cannot be bypassed by client-side manipulation.
 * 
 * @async
 * @function verifyOwnership
 * @param {'poll'} resourceType - The type of resource to check (currently only 'poll' supported)
 * @param {string} resourceId - The unique identifier of the resource
 * @param {string} userId - The user ID to verify ownership against
 * @returns {Promise<boolean>} True if user owns the resource, false otherwise
 * 
 * @example
 * ```typescript
 * const isOwner = await verifyOwnership('poll', 'poll-123', 'user-456');
 * if (isOwner) {
 *   // User owns this poll
 * }
 * ```
 */
export async function verifyOwnership(
  resourceType: 'poll',
  resourceId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();
  
  switch (resourceType) {
    case 'poll':
      // Query the polls table to check ownership
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
 * Requires user authentication for protected actions
 * 
 * This function ensures that only authenticated users can access protected resources.
 * It throws an error if the user is not authenticated, providing a clear error message.
 * 
 * @async
 * @function requireAuth
 * @returns {Promise<SecurityContext>} The authenticated user's security context
 * @throws {Error} Throws error if user is not authenticated
 * 
 * @example
 * ```typescript
 * try {
 *   const context = await requireAuth();
 *   // User is authenticated, proceed with action
 * } catch (error) {
 *   // Handle authentication error
 * }
 * ```
 */
export async function requireAuth(): Promise<SecurityContext> {
  const context = await getSecurityContext();
  
  if (!context.isAuthenticated) {
    throw new Error('Authentication required');
  }
  
  return context;
}

/**
 * Requires admin role for administrative actions
 * 
 * This function ensures that only users with admin role can access administrative
 * functions. It performs both authentication and authorization checks.
 * 
 * @async
 * @function requireAdmin
 * @returns {Promise<SecurityContext>} The admin user's security context
 * @throws {Error} Throws error if user is not authenticated or not an admin
 * 
 * @example
 * ```typescript
 * try {
 *   const context = await requireAdmin();
 *   // User is admin, proceed with admin action
 * } catch (error) {
 *   // Handle authorization error
 * }
 * ```
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
 * Requires either resource ownership or admin role for resource access
 * 
 * This function provides flexible authorization that allows access if the user
 * either owns the resource or has admin privileges. This is commonly used for
 * operations like editing or deleting resources.
 * 
 * @async
 * @function requireOwnershipOrAdmin
 * @param {'poll'} resourceType - The type of resource being accessed
 * @param {string} resourceId - The unique identifier of the resource
 * @returns {Promise<SecurityContext>} The authorized user's security context
 * @throws {Error} Throws error if user is not authenticated or lacks access
 * 
 * @example
 * ```typescript
 * try {
 *   const context = await requireOwnershipOrAdmin('poll', 'poll-123');
 *   // User can access this poll (either owns it or is admin)
 * } catch (error) {
 *   // Handle access denied error
 * }
 * ```
 */
export async function requireOwnershipOrAdmin(
  resourceType: 'poll',
  resourceId: string
): Promise<SecurityContext> {
  const context = await getSecurityContext();
  
  if (!context.isAuthenticated) {
    throw new Error('Authentication required');
  }
  
  // Admin users can access any resource
  if (context.isAdmin) {
    return context;
  }
  
  // Regular users can only access their own resources
  const isOwner = await verifyOwnership(resourceType, resourceId, context.user!.id);
  
  if (!isOwner) {
    throw new Error('Access denied: You can only access your own resources');
  }
  
  return context;
}
