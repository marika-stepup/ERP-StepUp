import { createClient } from '@supabase/supabase-js';

let supabaseInstance = null;

export function getSupabaseClient() {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables (SUPABASE_URL, SUPABASE_ANON_KEY).');
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
}

/**
 * Verifies the Supabase JWT token from the Authorization header and validates user role.
 * 
 * @param {Request} req - Next.js/Vercel API request object
 * @param {string[]} allowedRoles - List of authorized roles (e.g. ['employee', 'hr'])
 * @returns {Promise<{ user: object | null, error: { status: number, message: string } | null }>}
 */
export async function verifyRole(req, allowedRoles = []) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        user: null,
        error: { status: 401, message: 'Missing or malformed Authorization header.' }
      };
    }

    const token = authHeader.substring(7); // Extract the JWT token
    const supabase = getSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return {
        user: null,
        error: { status: 401, message: error?.message || 'Invalid or expired authentication token.' }
      };
    }

    // Role check: we check both app_metadata (secure) and user_metadata (fallback)
    const userRole = user.app_metadata?.role || user.user_metadata?.role;

    if (!userRole) {
      return {
        user: null,
        error: { status: 403, message: 'No role assigned to this user in Supabase.' }
      };
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      return {
        user: null,
        error: { status: 403, message: `Access denied. Role "${userRole}" is not authorized. Required: [${allowedRoles.join(', ')}]` }
      };
    }

    // Add role explicitly to the user object for convenience in handlers
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
        role: userRole
      },
      error: null
    };
  } catch (err) {
    console.error('Supabase verification error:', err);
    return {
      user: null,
      error: { status: 500, message: 'Internal server error during authentication.' }
    };
  }
}
