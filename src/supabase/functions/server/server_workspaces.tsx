import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createAdminClient, createAuthClient, handleError, getWeeksInYear } from './server_utils.tsx';

const supabase = createAdminClient();
const supabaseAuth = createAuthClient();
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

export function registerWorkspacesRoutes(app: Hono) {

  // Get all workspaces for current user (org-based + direct shares)
  app.get("/make-server-73d66528/workspaces", async (c) => {
    try {
      console.log('📁 Запрос списка workspaces...');
      
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      
      if (!accessToken) {
        console.error('❌ Токен не предоставлен');
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      });
      
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      
      if (authError || !user) {
        console.error('❌ Ошибка авторизации:', authError);
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      // 1. Get user's organization memberships
      const { data: orgMemberships } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id);
      
      const orgRoleMap = new Map<string, string>();
      const orgIds: number[] = [];
      if (orgMemberships && orgMemberships.length > 0) {
        for (const m of orgMemberships) {
          orgRoleMap.set(String(m.organization_id), m.role);
          orgIds.push(m.organization_id);
        }
      }

      // 2. Get org names
      const orgNameMap = new Map<string, string>();
      if (orgIds.length > 0) {
        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', orgIds);
        if (orgs) {
          for (const o of orgs) {
            orgNameMap.set(String(o.id), o.name);
          }
        }
      }

      // 3. Get workspaces from all user's organizations
      let orgWorkspaces: any[] = [];
      if (orgIds.length > 0) {
        const { data: ws } = await supabase
          .from('workspaces')
          .select('*')
          .in('organization_id', orgIds)
          .order('created_at', { ascending: false });
        orgWorkspaces = ws || [];
      }

      // 4. Get workspaces owned directly (created_by, NOT in any org) — legacy/personal
      const { data: ownedWorkspaces, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('created_by', user.id)
        .is('organization_id', null)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Ошибка загрузки workspaces:', error);
        return c.json({ error: `Failed to fetch workspaces: ${error.message}` }, 500);
      }

      // 5. Get workspaces via workspace_members (direct share)
      let memberWorkspaces: any[] = [];
      const allWsMemberRoleMap = new Map<string, string>(); // workspace_id → role (for ALL memberships)
      try {
        const { data: memberships } = await supabase
          .from('workspace_members')
          .select('workspace_id, role')
          .eq('user_id', user.id);
        
        if (memberships && memberships.length > 0) {
          // Build a map of ALL workspace memberships (used for per-workspace role override in org workspaces)
          for (const m of memberships) {
            allWsMemberRoleMap.set(String(m.workspace_id), m.role);
          }
          
          const alreadyIds = new Set([
            ...orgWorkspaces.map((w: any) => String(w.id)),
            ...(ownedWorkspaces || []).map((w: any) => String(w.id))
          ]);
          const memberEntries = memberships.filter((m: any) => !alreadyIds.has(String(m.workspace_id)));
          
          if (memberEntries.length > 0) {
            const { data: extraWs } = await supabase
              .from('workspaces')
              .select('*')
              .in('id', memberEntries.map((m: any) => m.workspace_id))
              .order('created_at', { ascending: false });
            
            const wsRoleMap = new Map<string, string>();
            for (const m of memberEntries) {
              wsRoleMap.set(String(m.workspace_id), m.role);
            }
            memberWorkspaces = (extraWs || []).map((w: any) => ({
              ...w,
              _ws_role: wsRoleMap.get(String(w.id)) || 'viewer'
            }));
          }
        }
      } catch (e) {
        console.log('ℹ️ workspace_members not available yet');
      }

      // 6. Merge and deduplicate, annotate with source
      const seen = new Set<string>();
      const allWorkspaces: any[] = [];

      for (const w of orgWorkspaces) {
        const wId = String(w.id);
        if (seen.has(wId)) continue;
        seen.add(wId);
        const orgId = String(w.organization_id);
        const wsOverrideRole = allWsMemberRoleMap.get(wId); // per-workspace role override
        allWorkspaces.push({
          ...w,
          _source: 'organization',
          _org_id: w.organization_id,
          _org_name: orgNameMap.get(orgId) || 'Организация',
          _org_role: orgRoleMap.get(orgId) || 'member',
          _ws_role: wsOverrideRole || undefined, // per-workspace override if exists
          _is_creator: w.created_by === user.id
        });
      }

      for (const w of (ownedWorkspaces || [])) {
        const wId = String(w.id);
        if (seen.has(wId)) continue;
        seen.add(wId);
        allWorkspaces.push({
          ...w,
          _source: 'owned',
          _is_creator: true
        });
      }

      for (const w of memberWorkspaces) {
        const wId = String(w.id);
        if (seen.has(wId)) continue;
        seen.add(wId);
        allWorkspaces.push({
          ...w,
          _source: 'shared',
          _ws_role: w._ws_role || 'viewer',
          _is_creator: false
        });
      }

      console.log(`✓ Получено ${allWorkspaces.length} workspaces (org: ${orgWorkspaces.length}, owned: ${ownedWorkspaces?.length || 0}, shared: ${memberWorkspaces.length})`);

      // 7. Enrich with _shared_count (non-owner members + pending invites per workspace)
      try {
        const wsIds = allWorkspaces.map((w: any) => parseInt(w.id)).filter(Boolean);
        if (wsIds.length > 0) {
          const [{ data: memberCounts }, { data: inviteCounts }] = await Promise.all([
            supabase.from('workspace_members')
              .select('workspace_id')
              .in('workspace_id', wsIds)
              .neq('role', 'owner'),
            supabase.from('workspace_invites')
              .select('workspace_id')
              .in('workspace_id', wsIds)
              .is('accepted_at', null),
          ]);

          const countMap = new Map<string, number>();
          (memberCounts || []).forEach((r: any) => {
            const key = String(r.workspace_id);
            countMap.set(key, (countMap.get(key) || 0) + 1);
          });
          (inviteCounts || []).forEach((r: any) => {
            const key = String(r.workspace_id);
            countMap.set(key, (countMap.get(key) || 0) + 1);
          });

          for (const w of allWorkspaces) {
            w._shared_count = countMap.get(String(w.id)) || 0;
          }
        }
      } catch (e) {
        console.warn('⚠️ Failed to enrich _shared_count:', e);
      }

      return c.json(allWorkspaces);
    } catch (error: any) {
      return handleError(c, 'Fetch Workspaces', error);
    }
  });

  // Get workspace summary
  app.get("/make-server-73d66528/workspaces/:id/summary", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const workspaceId = c.req.param('id');
      console.log(`📊 Загрузка summary для workspace ${workspaceId}`);

      const { data: summary, error } = await supabase
        .from('workspaces_summary')
        .select('*')
        .eq('id', workspaceId)
        .maybeSingle();

      if (error) {
        console.error('❌ Ошибка загрузки summary:', error);
        return c.json({ error: `Failed to load summary: ${error.message}` }, 500);
      }

      if (!summary) {
        console.warn(`⚠️ Summary не найден для workspace ${workspaceId}`);
        return c.json(null);
      }

      // If view returns zeros, do manual count
      if (!summary.projects_count && !summary.users_count && !summary.department_count) {
        console.warn(`⚠️ View вернула нули, делаем ручной подсчет для workspace ${workspaceId}...`);
        
        const { count: projectsCount } = await supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId);
        
        const { count: usersCount } = await supabase
          .from('resources')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId);
        
        const { count: visibleCount } = await supabase
          .from('resources')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('is_visible', true);
        
        const hiddenCount = (usersCount || 0) - (visibleCount || 0);
        
        const { count: departmentsCount } = await supabase
          .from('departments')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId);
        
        const mappedSummary = {
          id: summary.id,
          project_count: projectsCount || 0,
          member_count: usersCount || 0,
          visible_count: visibleCount || 0,
          hidden_count: hiddenCount || 0,
          department_count: departmentsCount || 0,
          last_activity_at: summary?.last_activity_at || null,
          last_updated: summary?.last_updated || null,
          updated_at: summary?.updated_at || null,
          summary_json: summary?.summary_json || null
        };
        
        return c.json(mappedSummary);
      }

      // Count visible and hidden resources
      const { count: visibleCount } = await supabase
        .from('resources')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('is_visible', true);
      
      const totalUsers = summary.users_count || 0;
      const hiddenCount = totalUsers - (visibleCount || 0);
      
      const mappedSummary = {
        id: summary.id,
        project_count: summary.projects_count || 0,
        member_count: totalUsers,
        visible_count: visibleCount || 0,
        hidden_count: hiddenCount || 0,
        department_count: summary.department_count || 0,
        last_activity_at: summary?.last_activity_at || null,
        last_updated: summary?.last_updated || null,
        updated_at: summary?.updated_at || null,
        summary_json: summary?.summary_json || null
      };

      return c.json(mappedSummary);
    } catch (error: any) {
      return handleError(c, 'Load Summary', error);
    }
  });

  // Get workspace users (members) — returns resources for this workspace
  app.get("/make-server-73d66528/workspaces/:id/users", async (c) => {
    try {
      const workspaceId = c.req.param('id');
      console.log('👥 Запрос ресурсов для workspace:', workspaceId);
      
      const { data: rows, error } = await supabase
        .from('resources')
        .select('*')
        .eq('workspace_id', workspaceId);
      
      if (error) {
        console.error('❌ Ошибка загрузки ресурсов workspace:', error);
        return c.json({ error: `Failed to fetch workspace resources: ${error.message}` }, 500);
      }
      
      console.log(`✓ Получено ${rows?.length || 0} ресурсов для workspace ${workspaceId}`);
      
      // Format for frontend
      const formattedUsers = rows?.map(row => {
        const fullName = row.fullName || '';
        const position = row.position || '';
        
        return {
          id: String(row.id),
          fullName,
          position,
          email
        };
      }) || [];
      
      // Sort by fullName
      formattedUsers.sort((a, b) => a.fullName.localeCompare(b.fullName));
      
      return c.json(formattedUsers);
    } catch (error: any) {
      return handleError(c, 'Fetch Workspace Users', error);
    }
  });

  // Get single workspace
  app.get("/make-server-73d66528/workspaces/:id", async (c) => {
    try {
      const workspaceId = c.req.param('id');
      console.log('📁 Запрос workspace:', workspaceId);
      
      const { data: workspace, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .maybeSingle();
      
      if (error) {
        console.error('❌ Ошибка загрузки workspace:', error);
        return c.json({ error: `Failed to fetch workspace: ${error.message}` }, 500);
      }
      
      if (!workspace) {
        console.warn('⚠️ Workspace not found:', workspaceId);
        return c.json({ error: 'Workspace not found' }, 404);
      }
      
      // 🔐 Determine role for the requesting user
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (accessToken) {
        try {
          const { data: { user } } = await supabaseAuth.auth.getUser(accessToken);
          if (user) {
            const userId = user.id;
            
            // 1. Creator = owner
            if (workspace.created_by === userId) {
              workspace._source = 'owned';
              workspace._is_creator = true;
              console.log(`🔐 Workspace ${workspaceId}: role=owner (creator)`);
            } else if (workspace.organization_id) {
              // 2. Organization member
              const { data: orgMember } = await supabase
                .from('organization_members')
                .select('role')
                .eq('organization_id', workspace.organization_id)
                .eq('user_id', userId)
                .single();
              
              if (orgMember) {
                workspace._source = 'organization';
                workspace._org_role = orgMember.role;
                console.log(`🔐 Workspace ${workspaceId}: role=${orgMember.role} (organization)`);
                
                // Check for per-workspace role override
                const { data: wsOverride } = await supabase
                  .from('workspace_members')
                  .select('role')
                  .eq('workspace_id', workspaceId)
                  .eq('user_id', userId)
                  .maybeSingle();
                if (wsOverride) {
                  workspace._ws_role = wsOverride.role;
                  console.log(`🔐 Workspace ${workspaceId}: ws_role override=${wsOverride.role}`);
                }
              }
            }
            
            // 3. Direct share (if not already determined)
            if (!workspace._source) {
              const { data: wsMember } = await supabase
                .from('workspace_members')
                .select('role')
                .eq('workspace_id', workspaceId)
                .eq('user_id', userId)
                .single();
              
              if (wsMember) {
                workspace._source = 'shared';
                workspace._ws_role = wsMember.role;
                console.log(`🔐 Workspace ${workspaceId}: role=${wsMember.role} (shared)`);
              }
            }
          }
        } catch (authErr) {
          console.warn('⚠️ Не удалось определить роль пользователя:', authErr);
        }
      }
      
      console.log(`✓ Workspace получен:`, workspace.name);
      return c.json(workspace);
    } catch (error: any) {
      return handleError(c, 'Fetch Workspace', error);
    }
  });

  // Create new workspace
  app.post("/make-server-73d66528/workspaces", async (c) => {
    try {
      console.log('➕ Создание нового workspace...');
      
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      
      if (!accessToken) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      });
      
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      
      if (authError || !user) {
        console.error('❌ Auth error:', authError);
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      const body = await c.req.json();
      const name = body.name;
      const year = body.year || body.timeline_year;
      
      if (!name) {
        return c.json({ error: 'Workspace name is required' }, 400);
      }
      
      if (!year) {
        return c.json({ error: 'Year is required' }, 400);
      }
      
      console.log(`📝 Данные: name="${name}", year=${year}`);
      console.log(`👤 Создается для пользователя: ${user.email} (${user.id})`);
      
      // Determine target organization
      let targetOrgId = body.organization_id;
      
      if (targetOrgId) {
        const { data: membership } = await supabase
          .from('organization_members')
          .select('role')
          .eq('user_id', user.id)
          .eq('organization_id', targetOrgId)
          .single();
        
        if (!membership) {
          console.error('❌ Пользователь не является участником организации:', targetOrgId);
          return c.json({ error: 'You are not a member of this organization' }, 403);
        }
        
        if (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'editor') {
          console.error('❌ Недостаточно прав для создания в организации:', targetOrgId, 'role:', membership.role);
          return c.json({ error: 'Insufficient permissions to create workspace in this organization' }, 403);
        }
        
        console.log(`🏢 Целевая организация (из запроса): ${targetOrgId}, роль: ${membership.role}`);
      } else {
        const { data: ownOrg } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('role', 'owner')
          .limit(1)
          .single();
        
        if (ownOrg) {
          targetOrgId = ownOrg.organization_id;
          console.log(`🏢 Своя организация: ${targetOrgId}`);
        } else {
          console.log(`🏢 Автоматическое создание личной организации для ${user.email}...`);
          const displayName = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
          const orgName = `${displayName}`;
          
          const { data: newOrg, error: orgError } = await supabase
            .from('organizations')
            .insert({
              name: orgName,
              created_by: user.id,
              created_at: new Date().toISOString(),
            })
            .select()
            .single();
          
          if (orgError || !newOrg) {
            console.error('❌ Ошибка создания организации:', orgError?.message);
            return c.json({ error: 'Failed to create personal organization' }, 500);
          }
          
          const { error: memberError } = await supabase
            .from('organization_members')
            .insert({
              organization_id: newOrg.id,
              user_id: user.id,
              role: 'owner',
              created_at: new Date().toISOString(),
            });
          
          if (memberError) {
            console.error('❌ Ошибка добавления owner в организацию:', memberError.message);
          }
          
          targetOrgId = newOrg.id;
          console.log(`✅ Личная организация создана: ${newOrg.id} (${orgName})`);
        }
      }
      
      const totalWeeks = getWeeksInYear(year);
      console.log(`📅 Год ${year} содержит ${totalWeeks} недель`);
      
      const { data: workspace, error } = await supabase
        .from('workspaces')
        .insert({
          name,
          timeline_year: year,
          organization_id: targetOrgId,
          created_by: user.id,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Ошибка создания workspace:', error);
        
        if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('workspaces_name_key')) {
          return c.json({ error: `Рабочее пространство с именем "${name}" уже существует. Пожалуйста, выберите другое имя.` }, 409);
        }
        
        return c.json({ error: `Failed to create workspace: ${error.message}` }, 500);
      }
      
      // If base_workspace_id is provided, copy data
      if (body.base_workspace_id && workspace?.id) {
        console.log(`📋 Начало копирования данных из workspace ${body.base_workspace_id} в ${workspace.id}...`);
        
        const safeCopy = async (name: string, fn: () => Promise<void>) => {
          try {
            console.log(`  ▶ ${name} start...`);
            await fn();
            console.log(`  ✅ ${name} completed`);
          } catch (e: any) {
            console.error(`  ❌ Ошибка в этапе ${name}:`, e.message);
          }
        };

        const deptMap = new Map<any, any>();
        const gradeMap = new Map<any, any>();
        const companyMap = new Map<any, any>();

        const tasks = [];

        // 1. Copy Departments
        tasks.push(safeCopy('Departments', async () => {
          const { data: sourceDepartments, error: fetchError } = await supabase
            .from('departments').select('*').eq('workspace_id', body.base_workspace_id);
          if (fetchError) throw fetchError;
          if (!sourceDepartments || sourceDepartments.length === 0) return;
          console.log(`    - Найдено ${sourceDepartments.length} департаментов`);
          
          const insertPromises = sourceDepartments.map(async (dept) => {
            const { data: newDept, error: insertError } = await supabase
              .from('departments')
              .insert({ name: dept.name, queue: dept.queue, visible: dept.visible, workspace_id: workspace.id })
              .select('id').single();
            if (insertError) { console.error(`    ❌ Не удалось скопировать департамент ${dept.name}:`, insertError.message); return; }
            if (newDept) deptMap.set(dept.id, newDept.id);
          });
          await Promise.all(insertPromises);
        }));
        
        // 2. Copy Grades
        tasks.push(safeCopy('Grades', async () => {
          const { data: sourceGrades, error: fetchError } = await supabase
            .from('grades').select('*').eq('workspace_id', body.base_workspace_id);
          if (fetchError) throw fetchError;
          if (!sourceGrades || sourceGrades.length === 0) return;
          console.log(`    - Найдено ${sourceGrades.length} грейдов`);
          
          const insertPromises = sourceGrades.map(async (grade) => {
            const { data: newGrade, error: insertError } = await supabase
              .from('grades')
              .insert({ name: grade.name, sort_order: grade.sort_order, workspace_id: workspace.id })
              .select('id').single();
            if (insertError) { console.error(`    ❌ Не удалось скопировать грейд ${grade.name}:`, insertError.message); return; }
            if (newGrade) gradeMap.set(grade.id, newGrade.id);
          });
          await Promise.all(insertPromises);
        }));
        
        // 3. Copy Companies
        tasks.push(safeCopy('Companies', async () => {
          const { data: sourceCompanies, error: fetchError } = await supabase
            .from('companies').select('*').eq('workspace_id', body.base_workspace_id);
          if (fetchError) throw fetchError;
          if (!sourceCompanies || sourceCompanies.length === 0) return;
          console.log(`    - Найдено ${sourceCompanies.length} компаний`);
          
          const insertPromises = sourceCompanies.map(async (company) => {
            const { data: newCompany, error: insertError } = await supabase
              .from('companies')
              .insert({ name: company.name, sort_order: company.sort_order, workspace_id: workspace.id })
              .select('id').single();
            if (insertError) { console.error(`    ❌ Не удалось скопировать компанию ${company.name}:`, insertError.message); return; }
            if (newCompany) companyMap.set(company.id, newCompany.id);
          });
          await Promise.all(insertPromises);
        }));

        // 4. Copy Projects
        tasks.push(safeCopy('Projects', async () => {
          const { data: sourceProjects, error: fetchError } = await supabase
            .from('projects').select('*').eq('workspace_id', body.base_workspace_id);
          if (fetchError) throw fetchError;
          if (!sourceProjects || sourceProjects.length === 0) return;
          console.log(`    - Найдено ${sourceProjects.length} проектов`);
          
          const projectsToInsert = sourceProjects.map(p => {
            const bgColor = p.backgroundColor || p.background_color || '#3B82F6';
            const txtColor = p.textColor || p.text_color || '#FFFFFF';
            const patId = p.pattern_id;
            if (patId) console.log(`      > Проект "${p.name}" копируется с паттерном ID: ${patId}`);
            return { name: p.name, workspace_id: workspace.id, backgroundColor: bgColor, textColor: txtColor, pattern_id: patId };
          });
          
          const { error: insertError } = await supabase.from('projects').insert(projectsToInsert);
          if (insertError) throw insertError;
        }));
        
        console.log('⏳ Запуск параллельного копирования справочников...');
        await Promise.all(tasks);
        console.log('✅ Справочники скопированы, приступаем к пользователям...');
        
        // 5. Copy Resources - MUST be after maps are populated
        await safeCopy('Resources', async () => {
          const { data: sourceResources, error: fetchError } = await supabase
            .from('resources').select('*').eq('workspace_id', body.base_workspace_id);
          if (fetchError) throw fetchError;
          if (!sourceResources || sourceResources.length === 0) return;
          console.log(`    - Найдено ${sourceResources.length} ресурсов`);
          
          const resourcesToInsert = sourceResources.map(res => {
            const newDeptId = res.department_id ? deptMap.get(res.department_id) : null;
            let newGradeId = res.grade_id;
            if (res.grade_id && gradeMap.has(res.grade_id)) newGradeId = gradeMap.get(res.grade_id);
            let newCompanyId = res.company_id;
            if (res.company_id && companyMap.has(res.company_id)) newCompanyId = companyMap.get(res.company_id);

            return {
              workspace_id: workspace.id, fullName: res.fullName, position: res.position,
              department_id: newDeptId, grade_id: newGradeId, company_id: newCompanyId,
              avatar_url: res.avatar_url, is_visible: res.is_visible, sort_order: res.sort_order || 0
            };
          });
          
          const BATCH_SIZE = 50;
          const batches = [];
          for (let i = 0; i < resourcesToInsert.length; i += BATCH_SIZE) {
            const batch = resourcesToInsert.slice(i, i + BATCH_SIZE);
            batches.push(
              (async () => {
                console.log(`    - Вставка батча ресурсов ${i + 1}-${Math.min(i + BATCH_SIZE, resourcesToInsert.length)}...`);
                const { error: batchError } = await supabase.from('resources').insert(batch);
                if (batchError) console.error(`    ❌ Ошибка вставки батча ресурсов:`, batchError.message);
              })()
            );
          }
          await Promise.all(batches);
        });
        
        console.log('🏁 Копирование данных завершено');
      } else if (workspace?.id) {
        console.log('✨ Создание департамента по умолчанию...');
        await supabase.from('departments').insert({
          name: 'Разработка', workspace_id: workspace.id, queue: 1, visible: true
        });
      }
      
      // Add creator as workspace owner in workspace_members
      if (workspace?.id) {
        const { error: memberError } = await supabase
          .from('workspace_members')
          .upsert({
            workspace_id: workspace.id, user_id: user.id, role: 'owner',
            created_at: new Date().toISOString()
          }, { onConflict: 'workspace_id,user_id' });
        
        if (memberError) {
          console.error('⚠️ Ошибка добавления owner в workspace_members:', memberError.message);
        } else {
          console.log('👤 Owner добавлен в workspace_members');
        }
      }
      
      // Enrich response with _source metadata
      let orgName = 'Организация';
      try {
        const { data: orgRow } = await supabase
          .from('organizations').select('name').eq('id', targetOrgId).single();
        if (orgRow) orgName = orgRow.name;
      } catch (e) {}

      const { data: creatorMembership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', targetOrgId)
        .single();

      const enrichedWorkspace = {
        ...workspace,
        _source: 'organization',
        _org_id: targetOrgId,
        _org_name: orgName,
        _org_role: creatorMembership?.role || 'member',
        _is_creator: true,
      };

      console.log(`✅ Workspace создан в орг "${orgName}" (${targetOrgId}), роль: ${creatorMembership?.role}`);
      return c.json(enrichedWorkspace);
    } catch (error: any) {
      return handleError(c, 'Create Workspace', error);
    }
  });

  // Update workspace
  app.put("/make-server-73d66528/workspaces/:id", async (c) => {
    try {
      const workspaceId = c.req.param('id');
      const body = await c.req.json();
      console.log(`🔄 Обновление workspace ${workspaceId}:`, body);
      
      const { data: workspace, error } = await supabase
        .from('workspaces').update(body).eq('id', workspaceId).select().single();
      
      if (error) {
        console.error('❌ Ошибка обновления workspace:', error);
        return c.json({ error: `Failed to update workspace: ${error.message}` }, 500);
      }
      
      // 📡 Broadcast workspace change to org members
      if (workspace.organization_id) {
        const channelName = `workspaces:org:${workspace.organization_id}`;
        await supabase.channel(channelName).send({
          type: 'broadcast',
          event: 'workspace_updated',
          payload: { workspace_id: workspaceId, name: workspace.name, timeline_year: workspace.timeline_year },
        }).catch((e: any) => console.warn('⚠️ Broadcast workspace_updated failed:', e));
      }
      
      console.log(`✅ Workspace обновлен:`, workspace);
      return c.json(workspace);
    } catch (error: any) {
      return handleError(c, 'Update Workspace', error);
    }
  });

  // Update workspace (PATCH method)
  app.patch("/make-server-73d66528/workspaces/:id", async (c) => {
    try {
      const workspaceId = c.req.param('id');
      const body = await c.req.json();
      console.log(`🔄 PATCH workspace ${workspaceId}:`, body);
      
      const { data: workspace, error } = await supabase
        .from('workspaces').update(body).eq('id', workspaceId).select().single();
      
      if (error) {
        console.error('❌ Ошибка PATCH workspace:', error);
        return c.json({ error: `Failed to update workspace: ${error.message}` }, 500);
      }
      
      // 📡 Broadcast workspace change to org members
      if (workspace.organization_id) {
        const channelName = `workspaces:org:${workspace.organization_id}`;
        await supabase.channel(channelName).send({
          type: 'broadcast',
          event: 'workspace_updated',
          payload: { workspace_id: workspaceId, name: workspace.name, timeline_year: workspace.timeline_year },
        }).catch((e: any) => console.warn('⚠️ Broadcast workspace_updated failed:', e));
      }
      
      console.log(`✅ Workspace обновлен (PATCH):`, workspace);
      return c.json(workspace);
    } catch (error: any) {
      return handleError(c, 'Patch Workspace', error);
    }
  });

  // Delete workspace
  app.delete("/make-server-73d66528/workspaces/:id", async (c) => {
    try {
      const workspaceId = c.req.param('id');
      console.log(`🗑️ Удаление workspace ${workspaceId}...`);
      
      // Fetch workspace first to get organization_id for broadcast
      const { data: wsData } = await supabase
        .from('workspaces').select('organization_id').eq('id', workspaceId).maybeSingle();
      
      const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId);
      
      if (error) {
        console.error('❌ Ошибка удаления workspace:', error);
        return c.json({ error: `Failed to delete workspace: ${error.message}` }, 500);
      }
      
      // 📡 Broadcast workspace deletion to org members
      if (wsData?.organization_id) {
        const channelName = `workspaces:org:${wsData.organization_id}`;
        await supabase.channel(channelName).send({
          type: 'broadcast',
          event: 'workspace_deleted',
          payload: { workspace_id: workspaceId },
        }).catch((e: any) => console.warn('⚠️ Broadcast workspace_deleted failed:', e));
      }
      
      console.log(`✅ Workspace ${workspaceId} удален`);
      return c.json({ success: true });
    } catch (error: any) {
      return handleError(c, 'Delete Workspace', error);
    }
  });
}