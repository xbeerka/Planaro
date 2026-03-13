import { Hono } from "npm:hono";
import { createAdminClient, createAuthClient, handleError } from './server_utils.tsx';

// Initialize clients
const supabase = createAdminClient();
const supabaseAuth = createAuthClient();

export function registerSnapshotRoutes(app: Hono) {

  // GET /workspaces/:id/snapshot
  app.get("/make-server-73d66528/workspaces/:id/snapshot", async (c) => {
    try {
      const workspaceIdStr = c.req.param('id');
      const workspaceId = parseInt(workspaceIdStr); // Assuming ID is technically string in URLs but usually int in DB logic for filters if column is int
      
      console.log(`📸 Snapshot requested for workspace: ${workspaceIdStr}`);
      
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);

      // Verify Access / User
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

      const startTime = Date.now();
      
      // Helper for timing
      const measuredQuery = async (name: string, query: Promise<any>) => {
        const start = Date.now();
        const result = await query;
        console.log(`⏱️ DB: ${name} took ${Date.now() - start}ms`);
        return result;
      };

      // Parallel Fetching
      const [
        deptsResult,
        usersResult,
        projectsResult,
        gradesResult,
        companiesResult,
        patternsResult,
        eventsResult,
        commentsResult
      ] = await Promise.all([
        // 1. Departments
        measuredQuery('Departments', supabase.from('departments')
          .select('*, users:users(count)')
          .eq('workspace_id', workspaceId)
          .order('queue', { ascending: true })),

        // 2. Resources (Users)
        measuredQuery('Users', supabase.from('users')
          .select(`
            *,
            department:departments(id, name),
            grade:grades(id, name),
            company:companies(id, name)
          `)
          .eq('workspace_id', workspaceId)
          .order('id', { ascending: true })),

        // 3. Projects
        measuredQuery('Projects', supabase.from('projects')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('name', { ascending: true })),

        // 4. Grades
        measuredQuery('Grades', supabase.from('grades')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('sort_order', { ascending: true })),

        // 5. Companies
        measuredQuery('Companies', supabase.from('companies')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('sort_order', { ascending: true })),

        // 6. Patterns
        measuredQuery('Patterns', supabase.from('event_patterns')
          .select('*')
          .order('id', { ascending: true })),

        // 7. Events
        measuredQuery('Events', supabase.from('events')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('id', { ascending: true })),

        // 8. Comments
        measuredQuery('Comments', supabase.from('comments')
          .select('*')
          .eq('workspace_id', workspaceId))
      ]);

      // Check critical errors (we can tolerate some, but usually if DB is down everything fails)
      if (deptsResult.error) throw new Error(`Departments: ${deptsResult.error.message}`);
      if (usersResult.error) throw new Error(`Resources: ${usersResult.error.message}`);
      // ... check others if needed, or just proceed with empty arrays

      // --- TRANSFORMATIONS ---

      // 1. Departments
      const departments = (deptsResult.data || []).map(dept => ({
        id: `d${dept.id}`,
        name: dept.name,
        queue: dept.queue ?? 999,
        visible: dept.visible !== undefined ? dept.visible : true,
        usersCount: dept.users?.[0]?.count ?? 0,
        last_activity_at: dept.last_activity_at
      }));

      // 2. Resources
      const resources = (usersResult.data || []).map(user => {
        const fullName = user.fullName || user.full_name || user.name || '';
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        return {
          id: `u${user.id}`,
          firstName,
          lastName,
          fullName,
          position: user.position || '',
          departmentId: user.department_id ? `d${user.department_id}` : null,
          grade: user.grade?.name || '',
          companyId: user.company_id || null,
          avatarUrl: user.avatar_url || null,
          isVisible: user.is_visible !== undefined ? user.is_visible : true,
          department: user.department,
          company: user.company
        };
      });

      // 3. Projects
      const projects = (projectsResult.data || []).map(p => ({
        id: `p${p.id}`,
        name: p.name,
        workspaceId: String(p.workspace_id),
        backgroundColor: p.backgroundColor || p.background_color || '#3B82F6',
        textColor: p.textColor || p.text_color || '#FFFFFF',
        patternId: p.pattern_id ? `ep${p.pattern_id}` : undefined
      }));

      // 4. Grades
      const grades = gradesResult.data || []; // No transformation needed

      // 5. Companies
      const companies = companiesResult.data || []; // No transformation needed

      // 6. Patterns
      const eventPatterns = (patternsResult.data || []).map(p => ({
        id: `ep${p.id}`,
        name: p.name,
        pattern: p.pattern
      }));

      // 7. Events
      const events = (eventsResult.data || []).map(event => ({
        id: `e${event.id}`,
        resourceId: `u${event.user_id}`,
        projectId: `p${event.project_id}`,
        startWeek: (event.start_week || 1) - 1,
        weeksSpan: event.weeks_span || 1,
        unitStart: event.unit_start || 0,
        unitsTall: event.units_tall || 1,
        patternId: event.pattern_id ? `ep${event.pattern_id}` : undefined
      }));

      // 8. Comments (Complex processing)
      const commentsData = commentsResult.data || [];
      const authUserIds = new Set<string>();
      commentsData.forEach((row: any) => {
        if (row.auth_user_id) authUserIds.add(row.auth_user_id);
      });

      // Fetch Avatars for Comments
      const authUserAvatars = new Map<string, string | undefined>();
      if (authUserIds.size > 0) {
        await Promise.all(Array.from(authUserIds).map(async (uid) => {
          try {
            const { data: { user } } = await supabase.auth.admin.getUserById(uid);
            if (user && user.user_metadata?.avatar_url) {
              authUserAvatars.set(uid, user.user_metadata.avatar_url);
            }
          } catch (e) {
            // Ignore errors
          }
        }));
      }

      // Map Comments
      // Optimization: Fetch fallback users map in one go if possible, but for now fallback is rare
      const comments = await Promise.all(commentsData.map(async (row: any) => {
        let authorAvatarUrl = undefined;
        if (row.auth_user_id && authUserAvatars.has(row.auth_user_id)) {
          authorAvatarUrl = authUserAvatars.get(row.auth_user_id);
        }
        
        // Fallback for legacy comments (rare)
        if (!authorAvatarUrl && row.user_display_name) {
           // We could try to find it in the 'resources' list we just fetched!
           // Only if the display name matches a resource name...
           // But resources list is by user_id.
           // Let's skip the DB call for fallback to save time, or do it only if absolutely needed.
           // To be safe, let's skip additional DB calls to keep snapshot fast.
           // Or search in loaded resources?
           const resource = resources.find(r => r.fullName === row.user_display_name);
           if (resource) authorAvatarUrl = resource.avatarUrl || undefined;
        }

        const currentYear = new Date().getFullYear(); 
        const d = new Date(currentYear, 0, 1 + (row.week_number * 7));
        const weekDate = d.toISOString().split('T')[0];

        return {
          id: String(row.id),
          workspaceId: String(row.workspace_id),
          userId: `u${row.user_id}`,
          userDisplayName: row.user_display_name,
          authorAvatarUrl: authorAvatarUrl,
          comment: row.comment,
          weekDate: weekDate,
          weekIndex: row.week_number,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      }));

      const duration = Date.now() - startTime;
      console.log(`✅ Snapshot ready in ${duration}ms`);

      return c.json({
        departments,
        resources,
        projects,
        grades,
        companies,
        eventPatterns,
        events,
        comments
      });

    } catch (error: any) {
      return handleError(c, 'Get Snapshot', error);
    }
  });
}
