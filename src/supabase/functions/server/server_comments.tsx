import { Hono } from "npm:hono";
import { handleError, createAdminClient, createAuthClient } from './server_utils.tsx';

// Initialize clients
const supabase = createAdminClient();
const supabaseAuth = createAuthClient();

// ==================== HELPERS ====================

// Helper to convert "u123" -> 123
function parseFrontendUserId(frontendId: string): number | null {
  if (!frontendId) return null;
  
  let numericStr = frontendId;
  if (frontendId.startsWith('u')) {
    numericStr = frontendId.substring(1);
  }
  
  const id = parseInt(numericStr, 10);
  if (isNaN(id)) return null;
  return id;
}

// --- Scheduler Date Logic (Matches utils/scheduler.ts) ---

function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getDaysDifference(date1: Date, date2: Date): number {
  const d1 = getStartOfDay(date1);
  const d2 = getStartOfDay(date2);
  return Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
}

// ==================== ROUTES ====================

export function registerCommentsRoutes(app: Hono) {
  
  // Get comments for a workspace
  app.get("/make-server-73d66528/comments", async (c) => {
    try {
      const workspaceId = c.req.query('workspace_id');
      if (!workspaceId) return c.json({ error: 'Workspace ID required' }, 400);
      
      console.log(`💬 Fetching comments for workspace ${workspaceId}`);
      
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('workspace_id', parseInt(workspaceId));
        
      if (error) {
         console.error('❌ Error fetching comments:', error);
         return c.json({ error: error.message }, 500);
      }
      
      // Map to frontend format
      // 1. Collect unique auth_user_ids to minimize API calls
      const authUserIds = new Set<string>();
      data.forEach((row: any) => {
        if (row.auth_user_id) authUserIds.add(row.auth_user_id);
      });

      // 2. Fetch auth users in parallel (with caching)
      const authUserAvatars = new Map<string, string | undefined>();
      await Promise.all(Array.from(authUserIds).map(async (uid) => {
        try {
          const { data: { user }, error } = await supabase.auth.admin.getUserById(uid);
          if (!error && user && user.user_metadata?.avatar_url) {
            authUserAvatars.set(uid, user.user_metadata.avatar_url);
          }
        } catch (e) {
          console.warn(`⚠️ Failed to fetch auth user ${uid}`, e);
        }
      }));

      const mappedComments = await Promise.all(data.map(async (row: any) => {
        let authorAvatarUrl = undefined;
        
        // Strategy 1: Look up by auth_user_id (Correct way)
        if (row.auth_user_id && authUserAvatars.has(row.auth_user_id)) {
          authorAvatarUrl = authUserAvatars.get(row.auth_user_id);
        }
        
        // Strategy 2: Fallback to public.users lookup by display_name (Legacy)
        // Only if Strategy 1 failed
        if (!authorAvatarUrl && row.user_display_name) {
           const { data: author } = await supabase
             .from('users')
             .select('avatar_url')
             .eq('display_name', row.user_display_name)
             .maybeSingle();
           if (author) authorAvatarUrl = author.avatar_url;
        }

        // Calculate weekDate from week_number (approximate, for display if needed)
        // Frontend uses weekIndex mainly. weekDate is mostly for legacy/reference.
        const currentYear = new Date().getFullYear(); // Or get from workspace settings if available
        // Simple approximation
        const d = new Date(currentYear, 0, 1 + (row.week_number * 7));
        const weekDate = d.toISOString().split('T')[0];

        return {
          id: String(row.id),
          workspaceId: String(row.workspace_id),
          userId: `u${row.user_id}`, // Resource ID
          userDisplayName: row.user_display_name,
          authorAvatarUrl: authorAvatarUrl,
          comment: row.comment,
          weekDate: weekDate,
          weekIndex: row.week_number,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      }));
      
      return c.json(mappedComments);
    } catch (error: any) {
      return handleError(c, 'Get Comments', error);
    }
  });

  // Create comment
  app.post("/make-server-73d66528/comments", async (c) => {
    try {
      const body = await c.req.json();
      const { workspaceId, userId, userDisplayName, comment, weekDate, weekIndex } = body;
      
      // Auth Check
      const authHeader = c.req.header('Authorization');
      if (!authHeader) return c.json({ error: 'No authorization header' }, 401);
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
      
      if (authError || !user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      const authUserId = user.id;

      // Determine Week Number
      let weekNumber = weekIndex;
      if (weekNumber === undefined && weekDate) {
         // Fallback calculation if weekIndex is missing
         const d = new Date(weekDate);
         const startOfYear = new Date(d.getFullYear(), 0, 1);
         const days = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
         weekNumber = Math.floor(days / 7);
      }
      
      // Parse Resource ID
      const resourceIdInt = parseFrontendUserId(userId);
      if (resourceIdInt === null) {
        return c.json({ error: 'Invalid User ID format' }, 400);
      }

      console.log(`💬 Creating comment on Resource ${resourceIdInt} (Auth: ${authUserId})`);

      // Insert into DB
      const newCommentData = {
        workspace_id: parseInt(workspaceId),
        user_id: resourceIdInt, 
        auth_user_id: authUserId, // ✅ Added auth_user_id
        user_display_name: userDisplayName || 'Unknown',
        comment: comment,
        week_number: weekNumber
      };
      
      const { data, error } = await supabase
        .from('comments')
        .insert(newCommentData)
        .select()
        .single();
        
      if (error) {
        console.error('❌ Error creating comment:', error);
        return c.json({ error: error.message }, 500);
      }

      // Map back response
      let authorAvatarUrl = undefined;
      
      // Strategy 1: Use current user's avatar (since we just authenticated them)
      if (user && user.user_metadata?.avatar_url) {
        authorAvatarUrl = user.user_metadata.avatar_url;
      }
      
      // Strategy 2: Fallback to public.users lookup
      if (!authorAvatarUrl && userDisplayName) {
        const { data: author } = await supabase
          .from('users')
          .select('avatar_url')
          .eq('display_name', userDisplayName)
          .maybeSingle();
        if (author) authorAvatarUrl = author.avatar_url;
      }
      
      const mappedComment = {
        id: String(data.id),
        workspaceId: String(data.workspace_id),
        userId: `u${data.user_id}`, 
        userDisplayName: data.user_display_name,
        authorAvatarUrl: authorAvatarUrl,
        comment: data.comment,
        weekDate: weekDate,
        weekIndex: data.week_number,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
      
      return c.json(mappedComment);

    } catch (error: any) {
      return handleError(c, 'Create Comment', error);
    }
  });

  // Update comment (text, position, or resource)
  app.put("/make-server-73d66528/comments/:id", async (c) => {
    try {
      const commentId = c.req.param('id');
      const body = await c.req.json();
      const { comment, weekIndex, userId, workspaceId } = body; 
      
      console.log(`🔄 Updating comment ${commentId}`);
      
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      if (comment !== undefined) updateData.comment = comment;
      if (weekIndex !== undefined) updateData.week_number = weekIndex;
      
      // Handle resource move
      if (userId !== undefined) {
          const resourceIdInt = parseFrontendUserId(userId);
          if (resourceIdInt !== null) {
             updateData.user_id = resourceIdInt;
          }
      }

      // Update in DB
      const { data, error } = await supabase
        .from('comments')
        .update(updateData)
        .eq('id', parseInt(commentId))
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating comment:', error);
        return c.json({ error: error.message }, 500);
      }

      // Re-fetch avatar if needed
      let authorAvatarUrl = undefined;
      
      // Strategy 1: Look up by auth_user_id if present
      if (data.auth_user_id) {
        const { data: { user }, error } = await supabase.auth.admin.getUserById(data.auth_user_id);
        if (!error && user && user.user_metadata?.avatar_url) {
          authorAvatarUrl = user.user_metadata.avatar_url;
        }
      }

      // Strategy 2: Fallback to public.users lookup
      if (!authorAvatarUrl && data.user_display_name) {
          const { data: author } = await supabase
          .from('users')
          .select('avatar_url')
          .eq('display_name', data.user_display_name)
          .maybeSingle();
          if (author) authorAvatarUrl = author.avatar_url;
      }

      const mappedComment = {
        id: String(data.id),
        workspaceId: String(data.workspace_id),
        userId: `u${data.user_id}`,
        userDisplayName: data.user_display_name,
        authorAvatarUrl: authorAvatarUrl,
        comment: data.comment,
        weekDate: undefined, // Not critical for update response
        weekIndex: data.week_number,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
      
      return c.json(mappedComment);

    } catch (error: any) {
      return handleError(c, 'Update Comment', error);
    }
  });

  // Delete comment
  app.delete("/make-server-73d66528/comments/:id", async (c) => {
    try {
      const commentId = c.req.param('id');
      console.log(`🗑️ Deleting comment ${commentId}...`);
      
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', parseInt(commentId));
        
      if (error) {
         console.error('❌ Error deleting comment:', error);
         return c.json({ error: error.message }, 500);
      }
      
      return c.json({ success: true });
    } catch (error: any) {
      return handleError(c, 'Delete Comment', error);
    }
  });
}
