import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createAdminClient, createAuthClient, handleError, updateWorkspaceSummary, getWeeksInYear } from './server_utils.tsx';

// Initialize clients
const supabase = createAdminClient();
const supabaseAuth = createAuthClient();

// Get Supabase URL and keys from environment
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

export function registerDataRoutes(app: Hono) {

  // ==================== WORKSPACES ====================

  // Get all workspaces for current user
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
      
      // Try to get workspaces - support both owner_id and user_id columns
      let workspacesQuery = supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false });
      
      let { data: workspaces, error } = await workspacesQuery.eq('owner_id', user.id);
      
      // If owner_id doesn't exist, try user_id
      if (error && error.message?.includes('owner_id does not exist')) {
        console.log('⚠️ Колонка owner_id не найдена, пробуем user_id...');
        workspacesQuery = supabase
          .from('workspaces')
          .select('*')
          .order('created_at', { ascending: false });
        const result = await workspacesQuery.eq('user_id', user.id);
        workspaces = result.data;
        error = result.error;
      }
      
      // If both fail, just get all workspaces (for development)
      if (error && (error.message?.includes('user_id does not exist') || error.message?.includes('owner_id does not exist'))) {
        console.log('⚠️ Колонки owner_id и user_id не найдены, получаем все workspaces...');
        const result = await supabase
          .from('workspaces')
          .select('*')
          .order('created_at', { ascending: false });
        workspaces = result.data;
        error = result.error;
      }
      
      if (error) {
        console.error('❌ Ошибка загрузки workspaces:', error);
        return c.json({ error: `Failed to fetch workspaces: ${error.message}` }, 500);
      }
      
      console.log(`✓ Получено ${workspaces?.length || 0} workspaces для пользователя ${user.email}`);
      return c.json(workspaces || []);
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
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId);
        
        const { count: visibleCount } = await supabase
          .from('users')
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

      // Count visible and hidden users
      const { count: visibleCount } = await supabase
        .from('users')
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

  // Get workspace users (members)
  app.get("/make-server-73d66528/workspaces/:id/users", async (c) => {
    try {
      const workspaceId = c.req.param('id');
      console.log('👥 Запрос пользователей для workspace:', workspaceId);
      
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('workspace_id', workspaceId);
      
      if (error) {
        console.error('❌ Ошибка загрузки пользователей workspace:', error);
        return c.json({ error: `Failed to fetch workspace users: ${error.message}` }, 500);
      }
      
      console.log(`✓ Получено ${users?.length || 0} пользователей для workspace ${workspaceId}`);
      
      // Format users for frontend
      const formattedUsers = users?.map(user => {
        const firstName = user.firstName || user.first_name || '';
        const lastName = user.lastName || user.last_name || '';
        const fullName = user.fullName || user.full_name || user.name || 
                        (firstName || lastName ? `${firstName} ${lastName}`.trim() : '');
        const position = user.position || '';
        const email = user.email || '';
        
        return {
          id: String(user.id),
          firstName,
          lastName,
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
      // Support both year and timeline_year (legacy/compat)
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
      
      // Calculate weeks in year
      const totalWeeks = getWeeksInYear(year);
      console.log(`📅 Год ${year} содержит ${totalWeeks} недель`);
      
      // Try to create with owner_id
      let insertData: any = {
        name,
        timeline_year: year,
        created_at: new Date().toISOString()
      };
      
      // Try owner_id first
      insertData.owner_id = user.id;
      let { data: workspace, error } = await supabase
        .from('workspaces')
        .insert(insertData)
        .select()
        .single();
      
      // If owner_id fails, try user_id
      if (error && error.message?.includes('owner_id')) {
        console.log('⚠️ Колонка owner_id не существует, пробуем user_id...');
        delete insertData.owner_id;
        insertData.user_id = user.id;
        
        const result = await supabase
          .from('workspaces')
          .insert(insertData)
          .select()
          .single();
        
        workspace = result.data;
        error = result.error;
      }
      
      // If both fail, try without owner/user column
      if (error && (error.message?.includes('user_id') || error.message?.includes('owner_id'))) {
        console.log('⚠️ Колонки owner_id и user_id не существуют, создаем без них...');
        delete insertData.owner_id;
        delete insertData.user_id;
        
        const result = await supabase
          .from('workspaces')
          .insert(insertData)
          .select()
          .single();
        
        workspace = result.data;
        error = result.error;
      }
      
      if (error) {
        console.error('❌ Ошибка создания workspace:', error);
        
        // Handle duplicate name error explicitly
        if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('workspaces_name_key')) {
          return c.json({ error: `Рабочее пространство с именем "${name}" уже существует. Пожалуйста, выберите другое имя.` }, 409);
        }
        
        return c.json({ error: `Failed to create workspace: ${error.message}` }, 500);
      }
      
      // If base_workspace_id is provided, copy data
      if (body.base_workspace_id && workspace?.id) {
        console.log(`📋 Начало копирования данных из workspace ${body.base_workspace_id} в ${workspace.id}...`);
        
        // Helper to safe copy
        const safeCopy = async (name: string, fn: () => Promise<void>) => {
          try {
            console.log(`  ▶ ${name} start...`);
            await fn();
            console.log(`  ✅ ${name} completed`);
          } catch (e: any) {
            console.error(`  ❌ Ошибка в этапе ${name}:`, e.message);
          }
        };

        const deptMap = new Map<any, any>(); // oldId -> newId
        const gradeMap = new Map<any, any>(); // oldId -> newId
        const companyMap = new Map<any, any>(); // oldId -> newId

        // Prepare independent tasks
        const tasks = [];

        // 1. Copy Departments
        tasks.push(safeCopy('Departments', async () => {
          const { data: sourceDepartments, error: fetchError } = await supabase
            .from('departments')
            .select('*')
            .eq('workspace_id', body.base_workspace_id);
            
          if (fetchError) throw fetchError;
          if (!sourceDepartments || sourceDepartments.length === 0) return;
            
          console.log(`    - Найдено ${sourceDepartments.length} департаментов`);
          
          // Use Promise.all for parallel insertion of departments
          const insertPromises = sourceDepartments.map(async (dept) => {
            const { data: newDept, error: insertError } = await supabase
              .from('departments')
              .insert({
                name: dept.name,
                queue: dept.queue,
                visible: dept.visible,
                workspace_id: workspace.id
              })
              .select('id')
              .single();
              
            if (insertError) {
              console.error(`    ❌ Не удалось скопировать департамент ${dept.name}:`, insertError.message);
              return;
            }
              
            if (newDept) {
              deptMap.set(dept.id, newDept.id);
            }
          });

          await Promise.all(insertPromises);
        }));
        
        // 2. Copy Grades
        tasks.push(safeCopy('Grades', async () => {
          const { data: sourceGrades, error: fetchError } = await supabase
            .from('grades')
            .select('*')
            .eq('workspace_id', body.base_workspace_id);

          if (fetchError) throw fetchError;
          if (!sourceGrades || sourceGrades.length === 0) return;
            
          console.log(`    - Найдено ${sourceGrades.length} грейдов`);
          
          // Use Promise.all for parallel insertion
          const insertPromises = sourceGrades.map(async (grade) => {
            const { data: newGrade, error: insertError } = await supabase
              .from('grades')
              .insert({
                name: grade.name,
                sort_order: grade.sort_order,
                workspace_id: workspace.id
              })
              .select('id')
              .single();

            if (insertError) {
               console.error(`    ❌ Не удалось скопировать грейд ${grade.name}:`, insertError.message);
               return;
            }
              
            if (newGrade) {
              gradeMap.set(grade.id, newGrade.id);
            }
          });

          await Promise.all(insertPromises);
        }));
        
        // 3. Copy Companies
        tasks.push(safeCopy('Companies', async () => {
          const { data: sourceCompanies, error: fetchError } = await supabase
            .from('companies')
            .select('*')
            .eq('workspace_id', body.base_workspace_id);

          if (fetchError) throw fetchError;
          if (!sourceCompanies || sourceCompanies.length === 0) return;

          console.log(`    - Найдено ${sourceCompanies.length} компаний`);
          
          // Use Promise.all for parallel insertion
          const insertPromises = sourceCompanies.map(async (company) => {
            const { data: newCompany, error: insertError } = await supabase
              .from('companies')
              .insert({
                name: company.name,
                sort_order: company.sort_order,
                workspace_id: workspace.id
              })
              .select('id')
              .single();

            if (insertError) {
               console.error(`    ❌ Не удалось скопировать компанию ${company.name}:`, insertError.message);
               return;
            }
              
            if (newCompany) {
              companyMap.set(company.id, newCompany.id);
            }
          });

          await Promise.all(insertPromises);
        }));

        // 4. Copy Projects
        tasks.push(safeCopy('Projects', async () => {
          const { data: sourceProjects, error: fetchError } = await supabase
            .from('projects')
            .select('*')
            .eq('workspace_id', body.base_workspace_id);
            
          if (fetchError) throw fetchError;
          if (!sourceProjects || sourceProjects.length === 0) return;

          console.log(`    - Найдено ${sourceProjects.length} проектов`);
            
          const projectsToInsert = sourceProjects.map(p => {
            // Robust property access (handle both camelCase and snake_case inputs)
            const bgColor = p.backgroundColor || p.background_color || '#3B82F6';
            const txtColor = p.textColor || p.text_color || '#FFFFFF';
            // Explicitly check for pattern_id
            const patId = p.pattern_id;
            
            // Log if pattern is found to verify it's being copied
            if (patId) {
               console.log(`      > Проект "${p.name}" копируется с паттерном ID: ${patId}`);
            }

            return {
              name: p.name,
              workspace_id: workspace.id,
              backgroundColor: bgColor,
              textColor: txtColor,
              pattern_id: patId
            };
          });
            
          // Batch insert for projects is efficient enough
          const { error: insertError } = await supabase.from('projects').insert(projectsToInsert);
          if (insertError) throw insertError;
        }));
        
        // Execute independent tasks in parallel
        console.log('⏳ Запуск параллельного копирования справочников...');
        await Promise.all(tasks);
        console.log('✅ Справочники скопированы, приступаем к пользователям...');
        
        // 5. Copy Users (Resources) - MUST be after maps are populated
        await safeCopy('Users', async () => {
          const { data: sourceUsers, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('workspace_id', body.base_workspace_id);
            
          if (fetchError) throw fetchError;
          if (!sourceUsers || sourceUsers.length === 0) return;

          console.log(`    - Найдено ${sourceUsers.length} пользователей`);
            
          const usersToInsert = sourceUsers.map(user => {
            // Map old department ID to new department ID
            const newDeptId = user.department_id ? deptMap.get(user.department_id) : null;
            
            let newGradeId = user.grade_id;
            if (user.grade_id && gradeMap.has(user.grade_id)) {
              newGradeId = gradeMap.get(user.grade_id);
            }
            
            let newCompanyId = user.company_id;
            if (user.company_id && companyMap.has(user.company_id)) {
              newCompanyId = companyMap.get(user.company_id);
            }

            // Based on schema: 
            // "fullName" text not null
            // position, department_id, grade_id, company_id, avatar_url, is_visible
            // NO email, first_name, last_name, grade
            return {
              workspace_id: workspace.id,
              fullName: user.fullName, 
              position: user.position,
              department_id: newDeptId,
              grade_id: newGradeId,
              company_id: newCompanyId,
              avatar_url: user.avatar_url,
              is_visible: user.is_visible
            };
          });
          
          // Insert in batches to avoid payload limits
          // AND execute batches in parallel for speed!
          const BATCH_SIZE = 50;
          const userBatches = [];
          
          for (let i = 0; i < usersToInsert.length; i += BATCH_SIZE) {
            const batch = usersToInsert.slice(i, i + BATCH_SIZE);
            userBatches.push(
              (async () => {
                console.log(`    - Вставка батча пользователей ${i + 1}-${Math.min(i + BATCH_SIZE, usersToInsert.length)}...`);
                const { error: batchError } = await supabase.from('users').insert(batch);
                if (batchError) {
                  console.error(`    ❌ Ошибка вставки батча пользователей:`, batchError.message);
                }
              })()
            );
          }
          
          await Promise.all(userBatches);
        });
        
        console.log('🏁 Копирование данных завершено');
      } else if (workspace?.id) {
        // Create default department "Разработка" for new workspaces
        console.log('✨ Создание департамента по умолчанию...');
        await supabase.from('departments').insert({
          name: 'Разработка',
          workspace_id: workspace.id,
          queue: 1,
          visible: true
        });
      }
      
      console.log(`✅ Workspace создан:`, workspace);
      return c.json(workspace);
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
        .from('workspaces')
        .update(body)
        .eq('id', workspaceId)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Ошибка обновления workspace:', error);
        return c.json({ error: `Failed to update workspace: ${error.message}` }, 500);
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
        .from('workspaces')
        .update(body)
        .eq('id', workspaceId)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Ошибка PATCH workspace:', error);
        return c.json({ error: `Failed to update workspace: ${error.message}` }, 500);
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
      
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceId);
      
      if (error) {
        console.error('❌ Ошибка удаления workspace:', error);
        return c.json({ error: `Failed to delete workspace: ${error.message}` }, 500);
      }
      
      console.log(`✅ Workspace ${workspaceId} удален`);
      return c.json({ success: true });
    } catch (error: any) {
      return handleError(c, 'Delete Workspace', error);
    }
  });

  // ==================== DEPARTMENTS ====================

  // Get all departments
  app.get("/make-server-73d66528/departments", async (c) => {
    try {
      const workspaceId = c.req.query('workspace_id');
      console.log('📋 Запрос департаментов для workspace:', workspaceId || 'все');
      
      let query = supabase
        .from('departments')
        .select('*, users:users(count)');
      
      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }
      
      const { data: deptsTable, error: deptsError } = await query.order('id', { ascending: false });
      
      if (!deptsError && deptsTable && deptsTable.length > 0) {
        console.log(`✓ Получено ${deptsTable.length} департаментов из таблицы departments`);
        
        const departments = deptsTable.map(dept => ({
          id: `d${dept.id}`,
          name: dept.name,
          queue: dept.queue || 999,
          visible: dept.visible !== undefined ? dept.visible : true,
          usersCount: dept.users?.[0]?.count ?? 0
        }));
        
        return c.json(departments);
      }
      
      console.log('⚠️ Таблица departments пустая для воркспейса:', workspaceId);
      return c.json([]);
      
    } catch (error: any) {
      return handleError(c, 'Fetch Departments', error);
    }
  });

  // Update department queue (batch)
  app.put("/make-server-73d66528/departments/queue", async (c) => {
    try {
      console.log('🔄 Обновление очередности департаментов...');
      
      const body = await c.req.json();
      
      if (!Array.isArray(body.departments)) {
        return c.json({ error: 'Expected departments array' }, 400);
      }
      
      if (body.departments.length === 0) {
        console.log('⚠️ Пустой массив департаментов');
        return c.json({ success: true });
      }
      
      const updates = body.departments.map(async (dept: { id: string, queue: number }) => {
        const numericId = parseInt(dept.id.replace('d', ''));
        
        const { error } = await supabase
          .from('departments')
          .update({ queue: dept.queue })
          .eq('id', numericId);
        
        if (error) {
          console.error(`❌ Ошибка обновления department ${dept.id}:`, error);
          throw new Error(`Failed to update queue for dept ${dept.id}: ${error.message}`);
        }
        
        console.log(`  ✓ Department ${dept.id}: queue = ${dept.queue}`);
      });
      
      await Promise.all(updates);
      
      console.log('✅ Все департаменты обновлены');
      return c.json({ success: true });
    } catch (error: any) {
      return handleError(c, 'Update Department Queue', error);
    }
  });

  // Update department visibility (batch)
  app.put("/make-server-73d66528/departments/visibility", async (c) => {
    try {
      console.log('🔄 Обновление видимости департаментов...');
      
      const body = await c.req.json();
      
      if (!Array.isArray(body.departments)) {
        return c.json({ error: 'Expected departments array' }, 400);
      }
      
      const updates = body.departments.map(async (dept: { id: string, visible: boolean }) => {
        const numericId = parseInt(dept.id.replace('d', ''));
        
        const { error } = await supabase
          .from('departments')
          .update({ visible: dept.visible })
          .eq('id', numericId);
        
        if (error) {
          console.error(`❌ Ошибка обновления visibility для department ${dept.id}:`, error);
          throw error;
        }
        
        console.log(`✅ Обновлен visible для department ${dept.id}: ${dept.visible}`);
      });
      
      await Promise.all(updates);
      
      console.log('✅ Видимость всех департаментов обновлена');
      return c.json({ success: true });
    } catch (error: any) {
      return handleError(c, 'Update Department Visibility', error);
    }
  });

  // Get department users count
  app.get("/make-server-73d66528/departments/:id/users-count", async (c) => {
    try {
      const departmentId = c.req.param('id');
      const numericId = parseInt(departmentId.replace('d', ''));
      
      const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('department_id', numericId);
      
      if (error) {
        console.error(`❌ Ошибка подсчета пользователей:`, error);
        return c.json({ error: `Failed to count users: ${error.message}` }, 500);
      }
      
      console.log(`✓ Департамент ${departmentId} имеет ${count || 0} пользователей`);
      return c.json({ count: count || 0 });
    } catch (error: any) {
      return handleError(c, 'Count Department Users', error);
    }
  });

  // Create department
  app.post("/make-server-73d66528/departments", async (c) => {
    try {
      console.log('➕ Создание нового департамента...');
      
      const body = await c.req.json();
      const { name, workspace_id } = body;
      
      if (!name) {
        return c.json({ error: 'Department name is required' }, 400);
      }
      
      if (!workspace_id) {
        return c.json({ error: 'Workspace ID is required' }, 400);
      }
      
      // Get max queue for this workspace
      const { data: existingDepts } = await supabase
        .from('departments')
        .select('queue')
        .eq('workspace_id', workspace_id)
        .order('queue', { ascending: false })
        .limit(1);
      
      const maxQueue = existingDepts && existingDepts.length > 0 ? existingDepts[0].queue : 0;
      const newQueue = maxQueue + 1;
      
      const { data, error } = await supabase
        .from('departments')
        .insert({
          name,
          workspace_id,
          queue: newQueue,
          visible: true
        })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Ошибка создания департамента:', error);
        return c.json({ error: `Failed to create department: ${error.message}` }, 500);
      }
      
      await updateWorkspaceSummary(workspace_id, 'department created');
      
      const department = {
        id: `d${data.id}`,
        name: data.name,
        queue: data.queue,
        visible: data.visible,
        usersCount: 0
      };
      
      console.log(`✅ Департамент создан:`, department);
      return c.json(department);
    } catch (error: any) {
      return handleError(c, 'Create Department', error);
    }
  });

  // Update single department (for renaming)
  app.put("/make-server-73d66528/departments/:id", async (c) => {
    try {
      const departmentId = c.req.param('id');
      const numericId = parseInt(departmentId.replace('d', ''));
      
      const body = await c.req.json();
      
      console.log(`🔄 О��новление департамента ${departmentId}:`, body);
      
      const { data, error } = await supabase
        .from('departments')
        .update(body)
        .eq('id', numericId)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Ошибка обновления департамента:', error);
        return c.json({ error: `Failed to update department: ${error.message}` }, 500);
      }
      
      if (body.workspace_id) {
        await updateWorkspaceSummary(body.workspace_id, 'department updated');
      }
      
      const department = {
        id: `d${data.id}`,
        name: data.name,
        queue: data.queue,
        visible: data.visible
      };
      
      console.log(`✅ Департамент обновлен:`, department);
      return c.json(department);
    } catch (error: any) {
      return handleError(c, 'Update Department', error);
    }
  });

  // Delete department
  app.delete("/make-server-73d66528/departments/:id", async (c) => {
    try {
      const departmentId = c.req.param('id');
      const numericId = parseInt(departmentId.replace('d', ''));
      
      console.log(`🗑️ Удаление департамента ${departmentId}...`);
      
      // Get workspace_id before deletion
      const { data: dept } = await supabase
        .from('departments')
        .select('workspace_id')
        .eq('id', numericId)
        .single();
      
      // Check if department has users
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('department_id', numericId);
      
      if (count && count > 0) {
        console.error(`��� Нельзя удалить департамент ${departmentId}: содержит ${count} пользователей`);
        return c.json({ 
          error: `Нельзя удалить департамент, содержащий ${count} сотрудников. Сначала переместите или удалите сотрудников.` 
        }, 400);
      }
      
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', numericId);
      
      if (error) {
        console.error('❌ Ошибка удаления департамента:', error);
        return c.json({ error: `Failed to delete department: ${error.message}` }, 500);
      }
      
      if (dept?.workspace_id) {
        await updateWorkspaceSummary(dept.workspace_id, 'department deleted');
      }
      
      console.log(`✅ Департамент ${departmentId} удален`);
      return c.json({ success: true });
    } catch (error: any) {
      return handleError(c, 'Delete Department', error);
    }
  });

  // ==================== GRADES ====================

  // Get all grades
  app.get("/make-server-73d66528/grades", async (c) => {
    try {
      const workspaceId = c.req.query('workspace_id');
      console.log('🎓 Запрос грейдов для workspace:', workspaceId || 'все');
      
      let query = supabase
        .from('grades')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }
      
      const { data: grades, error } = await query;
      
      if (error) {
        console.error('❌ Ошибка загрузки грейдов:', error);
        return c.json({ error: `Failed to fetch grades: ${error.message}` }, 500);
      }
      
      console.log(` Получено ${grades?.length || 0} грейдов`);
      return c.json(grades || []);
    } catch (error: any) {
      return handleError(c, 'Fetch Grades', error);
    }
  });

  // Create grade
  app.post("/make-server-73d66528/grades", async (c) => {
    try {
      const body = await c.req.json();
      const { name, workspace_id } = body;
      
      if (!name || !workspace_id) {
        return c.json({ error: 'Name and workspace_id are required' }, 400);
      }
      
      console.log(`➕ Создание грейда: ${name}`);
      
      // Get max sort_order
      const { data: existing } = await supabase
        .from('grades')
        .select('sort_order')
        .eq('workspace_id', workspace_id)
        .order('sort_order', { ascending: false })
        .limit(1);
      
      const maxSort = existing && existing.length > 0 ? existing[0].sort_order : 0;
      
      const { data, error } = await supabase
        .from('grades')
        .insert({
          name,
          workspace_id,
          sort_order: maxSort + 1
        })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Ошибка создания грейда:', error);
        return c.json({ error: `Failed to create grade: ${error.message}` }, 500);
      }
      
      console.log(`✅ Грейд создан:`, data);
      return c.json(data);
    } catch (error: any) {
      return handleError(c, 'Create Grade', error);
    }
  });

  // Update grade
  app.put("/make-server-73d66528/grades/:id", async (c) => {
    try {
      const gradeId = c.req.param('id');
      const body = await c.req.json();
      
      console.log(`🔄 Обновление грейда ${gradeId}:`, body);
      
      const { data, error } = await supabase
        .from('grades')
        .update(body)
        .eq('id', gradeId)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Ошибка обновления грейда:', error);
        return c.json({ error: `Failed to update grade: ${error.message}` }, 500);
      }
      
      console.log(`✅ Грейд обновлен:`, data);
      return c.json(data);
    } catch (error: any) {
      return handleError(c, 'Update Grade', error);
    }
  });

  // Delete grade
  app.delete("/make-server-73d66528/grades/:id", async (c) => {
    try {
      const gradeId = c.req.param('id');
      console.log(`🗑️ Удаление грейда ${gradeId}...`);
      
      const { error } = await supabase
        .from('grades')
        .delete()
        .eq('id', gradeId);
      
      if (error) {
        console.error('❌ Ошибка удаления грейда:', error);
        return c.json({ error: `Failed to delete grade: ${error.message}` }, 500);
      }
      
      console.log(`✅ Грейд ${gradeId} удален`);
      return c.json({ success: true });
    } catch (error: any) {
      return handleError(c, 'Delete Grade', error);
    }
  });

  // Batch update grades sort order
  app.patch("/make-server-73d66528/grades/sort-order", async (c) => {
    try {
      const body = await c.req.json();
      
      if (!Array.isArray(body.grades)) {
        return c.json({ error: 'Expected grades array' }, 400);
      }
      
      const updates = body.grades.map(async (grade: { id: string, sort_order: number }) => {
        const { error } = await supabase
          .from('grades')
          .update({ sort_order: grade.sort_order })
          .eq('id', grade.id);
        
        if (error) throw error;
      });
      
      await Promise.all(updates);
      
      console.log('✅ Sort order обновлен для грейдов');
      return c.json({ success: true });
    } catch (error: any) {
      return handleError(c, 'Update Grades Sort Order', error);
    }
  });

  // ==================== COMPANIES ====================

  // Get all companies
  app.get("/make-server-73d66528/companies", async (c) => {
    try {
      const workspaceId = c.req.query('workspace_id');
      console.log('🏢 Запрос компаний для workspace:', workspaceId || 'все');
      
      let query = supabase
        .from('companies')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }
      
      const { data: companies, error } = await query;
      
      if (error) {
        console.error('❌ Ошибка загрузки компаний:', error);
        return c.json({ error: `Failed to fetch companies: ${error.message}` }, 500);
      }
      
      console.log(`✓ Получено ${companies?.length || 0} компаний`);
      return c.json(companies || []);
    } catch (error: any) {
      return handleError(c, 'Fetch Companies', error);
    }
  });

  // Create company
  app.post("/make-server-73d66528/companies", async (c) => {
    try {
      const body = await c.req.json();
      const { name, workspace_id } = body;
      
      if (!name || !workspace_id) {
        return c.json({ error: 'Name and workspace_id are required' }, 400);
      }
      
      console.log(`➕ Создание компании: ${name}`);
      
      // Get max sort_order
      const { data: existing } = await supabase
        .from('companies')
        .select('sort_order')
        .eq('workspace_id', workspace_id)
        .order('sort_order', { ascending: false })
        .limit(1);
      
      const maxSort = existing && existing.length > 0 ? existing[0].sort_order : 0;
      
      const { data, error } = await supabase
        .from('companies')
        .insert({
          name,
          workspace_id,
          sort_order: maxSort + 1
        })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Ошибка создания компании:', error);
        return c.json({ error: `Failed to create company: ${error.message}` }, 500);
      }
      
      console.log(`✅ Компания создана:`, data);
      return c.json(data);
    } catch (error: any) {
      return handleError(c, 'Create Company', error);
    }
  });

  // Update company
  app.put("/make-server-73d66528/companies/:id", async (c) => {
    try {
      const companyId = c.req.param('id');
      const body = await c.req.json();
      
      console.log(`🔄 Обновление компании ${companyId}:`, body);
      
      const { data, error } = await supabase
        .from('companies')
        .update(body)
        .eq('id', companyId)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Ошибка обновления компании:', error);
        return c.json({ error: `Failed to update company: ${error.message}` }, 500);
      }
      
      console.log(`✅ Компания обновлена:`, data);
      return c.json(data);
    } catch (error: any) {
      return handleError(c, 'Update Company', error);
    }
  });

  // Delete company
  app.delete("/make-server-73d66528/companies/:id", async (c) => {
    try {
      const companyId = c.req.param('id');
      console.log(`🗑️ Удаление компании ${companyId}...`);
      
      // 1. Unlink users from this company first (fix foreign key constraint)
      const { error: unlinkError } = await supabase
        .from('users')
        .update({ company_id: null })
        .eq('company_id', companyId);

      if (unlinkError) {
         console.error('❌ Ошибка отвязки пользователей от компании:', unlinkError);
         return c.json({ error: `Failed to unlink users: ${unlinkError.message}` }, 500);
      }
      
      // 2. Delete the company
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId);
      
      if (error) {
        console.error('❌ Ошибка удаления компании:', error);
        return c.json({ error: `Failed to delete company: ${error.message}` }, 500);
      }
      
      console.log(`✅ Компания ${companyId} удалена`);
      return c.json({ success: true });
    } catch (error: any) {
      return handleError(c, 'Delete Company', error);
    }
  });

  // Batch update companies sort order
  app.patch("/make-server-73d66528/companies/sort-order", async (c) => {
    try {
      const body = await c.req.json();
      
      if (!Array.isArray(body.companies)) {
        return c.json({ error: 'Expected companies array' }, 400);
      }
      
      const updates = body.companies.map(async (company: { id: string, sort_order: number }) => {
        const { error } = await supabase
          .from('companies')
          .update({ sort_order: company.sort_order })
          .eq('id', company.id);
        
        if (error) throw error;
      });
      
      await Promise.all(updates);
      
      console.log('✅ Sort order обновлен для компаний');
      return c.json({ success: true });
    } catch (error: any) {
      return handleError(c, 'Update Companies Sort Order', error);
    }
  });

  // ==================== RESOURCES/USERS ====================

  // Get all resources (users)
  app.get("/make-server-73d66528/resources", async (c) => {
    try {
      const workspaceId = c.req.query('workspace_id');
      console.log('👥 Запрос ресурсов для workspace:', workspaceId || 'все');
      
      let query = supabase
        .from('users')
        .select(`
          *,
          department:departments(id, name),
          grade:grades(id, name),
          company:companies(id, name)
        `);
      
      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }
      
      const { data: users, error } = await query.order('id', { ascending: true });
      
      if (error) {
        console.error('❌ Ошибка загрузки ресурсов:', error);
        return c.json({ error: `Failed to fetch resources: ${error.message}` }, 500);
      }
      
      console.log(`✓ Получено ${users?.length || 0} ресурсов`);
      
      // 🔍 DEBUG: Log first user to see DB structure
      if (users && users.length > 0) {
        console.log('🔍 ПЕРВЫЙ ПОЛЬЗОВАТЕЛЬ ИЗ БД:', JSON.stringify(users[0], null, 2));
      }
      
      // Map to frontend format
      const resources = users?.map(user => {
        // Split full name into first/last (если есть пробел)
        const fullName = user.full_name || user.fullName || user.name || '';  // ✅ ИСПРАВЛЕНО: читаем full_name/fullName из БД
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        return {
          id: `u${user.id}`,
          firstName,           // ✅ Разбиваем fullName на части
          lastName,            // ✅ Все после первого пробела
          fullName,            // ✅ Полное имя из БД
          position: user.position || '',  // ✅ Должность из БД
          departmentId: user.department_id ? `d${user.department_id}` : null,
          grade: user.grade?.name || '',  // ✅ Название грейда
          companyId: user.company_id || null,
          avatarUrl: user.avatar_url || null,
          isVisible: user.is_visible !== undefined ? user.is_visible : true,
          department: user.department,
          company: user.company
        };
      }) || [];
      
      return c.json(resources);
    } catch (error: any) {
      return handleError(c, 'Fetch Resources', error);
    }
  });

  // Create new user
  app.post("/make-server-73d66528/resources", async (c) => {
    try {
      console.log('➕ Создание нового пользователя...');
      
      const body = await c.req.json();
      const { name, position, departmentId, gradeId, companyId, avatarUrl, isVisible, workspace_id } = body;
      
      if (!name) {
        return c.json({ error: 'Name is required' }, 400);
      }
      
      if (!workspace_id) {
        return c.json({ error: 'Workspace ID is required' }, 400);
      }
      
      console.log('🔍 DEBUG CREATE USER:', { name, position, gradeId });
      
      // Convert departmentId from "d123" to 123
      const numericDeptId = departmentId ? parseInt(departmentId.replace('d', '')) : null;
      
      const { data, error } = await supabase
        .from('users')
        .insert({
          fullName: name,  // ✅ БД использует camelCase 'fullName'!
          position: position || '',  // ✅ КРИТИЧНО: сохраняем должность!
          department_id: numericDeptId,
          grade_id: gradeId ? parseInt(gradeId) : null,  // ✅ КРИТИЧНО: используем gradeId (число)!
          company_id: companyId,
          avatar_url: avatarUrl,
          is_visible: isVisible !== undefined ? isVisible : true,
          workspace_id
        })
        .select(`
          *,
          department:departments(id, name),
          grade:grades(id, name),
          company:companies(id, name)
        `)
        .single();
      
      if (error) {
        console.error('❌ Ошибка создания пользователя:', error);
        return c.json({ error: `Failed to create user: ${error.message}` }, 500);
      }
      
      await updateWorkspaceSummary(workspace_id, 'user created');
      
      const user = {
        id: `u${data.id}`,
        fullName: data.fullName || data.full_name || data.name,  // ✅ Читаем fullName из БД
        position: data.position || '',  // ✅ Возвращаем должность
        name: data.fullName || data.full_name || data.name, // backward compatibility
        departmentId: data.department_id ? `d${data.department_id}` : null,
        grade: data.grade?.name || '',  // ✅ Название грейда для отображения
        gradeId: data.grade_id,  // ✅ ID грейда
        companyId: data.company_id,
        avatarUrl: data.avatar_url,
        isVisible: data.is_visible,
        department: data.department,
        company: data.company
      };
      
      console.log(`✅ Пользователь создан:`, user);
      return c.json(user);
    } catch (error: any) {
      return handleError(c, 'Create User', error);
    }
  });

  // Update user
  app.put("/make-server-73d66528/resources/:id", async (c) => {
    try {
      const userId = c.req.param('id');
      const numericId = parseInt(userId.replace('u', ''));
      
      const body = await c.req.json();
      const { name, position, departmentId, gradeId, companyId, avatarUrl, isVisible } = body;
      
      console.log(`🔄 Обновление пользователя ${userId}:`, body);
      
      // Convert departmentId from "d123" to 123
      const numericDeptId = departmentId ? parseInt(departmentId.replace('d', '')) : null;
      
      const updateData: any = {};
      if (name !== undefined) updateData.fullName = name;  // ✅ БД использует 'fullName'
      if (position !== undefined) updateData.position = position;  // ✅ КРИТИЧНО: обновляем должность!
      if (departmentId !== undefined) updateData.department_id = numericDeptId;
      if (gradeId !== undefined) updateData.grade_id = gradeId ? parseInt(gradeId) : null;  // ✅ КРИТИЧНО: используем gradeId!
      if (companyId !== undefined) updateData.company_id = companyId;
      if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl;
      if (isVisible !== undefined) updateData.is_visible = isVisible;
      
      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', numericId)
        .select(`
          *,
          department:departments(id, name),
          grade:grades(id, name),
          company:companies(id, name)
        `)
        .single();
      
      if (error) {
        console.error('❌ Ошибка обновления пользователя:', error);
        return c.json({ error: `Failed to update user: ${error.message}` }, 500);
      }
      
      const user = {
        id: `u${data.id}`,
        fullName: data.fullName || data.full_name || data.name,  // ✅ Читаем fullName из БД
        position: data.position || '',  // ✅ Возвращаем должность
        name: data.fullName || data.full_name || data.name, // backward compatibility
        departmentId: data.department_id ? `d${data.department_id}` : null,
        grade: data.grade?.name || '',  // ✅ Название грейда для отображения
        gradeId: data.grade_id,  // ✅ ID грейда
        companyId: data.company_id,
        avatarUrl: data.avatar_url,
        isVisible: data.is_visible,
        department: data.department,
        company: data.company
      };
      
      console.log(`✅ Пользователь обновлен:`, user);
      return c.json(user);
    } catch (error: any) {
      return handleError(c, 'Update User', error);
    }
  });

  // Toggle user visibility
  app.put("/make-server-73d66528/resources/:id/visibility", async (c) => {
    try {
      const userId = c.req.param('id');
      const numericId = parseInt(userId.replace('u', ''));
      
      console.log(`🔄 Переключение видимости пользователя ${userId}...`);
      
      // Получаем текущее состояние
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('is_visible')
        .eq('id', numericId)
        .single();
      
      if (fetchError || !currentUser) {
        console.error('❌ Ошибка получения текущего состояния:', fetchError);
        return c.json({ error: `Failed to fetch user: ${fetchError?.message}` }, 500);
      }
      
      // Инвертируем текущее значение
      const newVisibility = !currentUser.is_visible;
      
      console.log(`   Текущее: ${currentUser.is_visible} → Новое: ${newVisibility}`);
      
      const { data, error } = await supabase
        .from('users')
        .update({ is_visible: newVisibility })
        .eq('id', numericId)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Ошибка изменения видимости:', error);
        return c.json({ error: `Failed to update visibility: ${error.message}` }, 500);
      }
      
      console.log(`✅ Видимость изменена для пользователя ${userId}: ${newVisibility}`);
      return c.json({ success: true, isVisible: data.is_visible });
    } catch (error: any) {
      return handleError(c, 'Toggle User Visibility', error);
    }
  });

  // Delete user
  app.delete("/make-server-73d66528/resources/:id", async (c) => {
    try {
      const userId = c.req.param('id');
      const numericId = parseInt(userId.replace('u', ''));
      
      console.log(`🗑️ Удаление пользователя ${userId}...`);
      
      // Get workspace_id before deletion
      const { data: user } = await supabase
        .from('users')
        .select('workspace_id')
        .eq('id', numericId)
        .single();
      
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', numericId);
      
      if (error) {
        console.error('❌ Ошибка удаления пользователя:', error);
        return c.json({ error: `Failed to delete user: ${error.message}` }, 500);
      }
      
      if (user?.workspace_id) {
        await updateWorkspaceSummary(user.workspace_id, 'user deleted');
      }
      
      console.log(`✅ Пользователь ${userId} удален`);
      return c.json({ success: true });
    } catch (error: any) {
      return handleError(c, 'Delete User', error);
    }
  });

  // ==================== PROJECTS ====================

  // Get all projects
  app.get("/make-server-73d66528/projects", async (c) => {
    try {
      const workspaceId = c.req.query('workspace_id');
      console.log('📂 Запрос проектов для workspace:', workspaceId || 'все');
      
      let query = supabase
        .from('projects')
        .select('*');
      
      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }
      
      const { data: projects, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Ошибка загрузки проектов:', error);
        return c.json({ error: `Failed to fetch projects: ${error.message}` }, 500);
      }
      
      console.log(`✓ Получено ${projects?.length || 0} проектов`);
      
      // 🔍 DEBUG: Log first project to see DB structure
      if (projects && projects.length > 0) {
        console.log('🔍 ПЕРВЫЙ ПРОЕКТ ИЗ БД:', JSON.stringify(projects[0], null, 2));
      }
      
      // Map to frontend format
      const mappedProjects = projects?.map(p => ({
        id: `p${p.id}`,
        name: p.name,
        backgroundColor: p.backgroundColor || p.background_color || '#3B82F6',
        textColor: p.textColor || p.text_color || '#FFFFFF',
        patternId: p.pattern_id ? `ep${p.pattern_id}` : undefined  // ✅ Добавляем patternId если есть
      })) || [];
      
      return c.json(mappedProjects);
    } catch (error: any) {
      return handleError(c, 'Fetch Projects', error);
    }
  });

  // Create new project
  app.post("/make-server-73d66528/projects", async (c) => {
    try {
      console.log('➕ Создание нового проекта...');
      
      const body = await c.req.json();
      const { name, backgroundColor, textColor, patternId, workspace_id } = body;
      
      if (!name) {
        return c.json({ error: 'Project name is required' }, 400);
      }
      
      if (!workspace_id) {
        return c.json({ error: 'Workspace ID is required' }, 400);
      }
      
      // Convert patternId from "ep123" to 123 or null
      const numericPatternId = patternId ? parseInt(patternId.replace('ep', '')) : null;
      
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name,
          backgroundColor: backgroundColor || '#3B82F6',
          textColor: textColor || '#FFFFFF',
          pattern_id: numericPatternId,  // ✅ Добавляем pattern_id
          workspace_id
        })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Ошибка создания проекта:', error);
        return c.json({ error: `Failed to create project: ${error.message}` }, 500);
      }
      
      await updateWorkspaceSummary(workspace_id, 'project created');
      
      const project = {
        id: `p${data.id}`,
        name: data.name,
        backgroundColor: data.backgroundColor || data.background_color || '#3B82F6',
        textColor: data.textColor || data.text_color || '#FFFFFF',
        patternId: data.pattern_id ? `ep${data.pattern_id}` : undefined  // ✅ Возвращаем patternId
      };
      
      console.log(`✅ Проект создан:`, project);
      return c.json(project);
    } catch (error: any) {
      return handleError(c, 'Create Project', error);
    }
  });

  // Update project
  app.put("/make-server-73d66528/projects/:id", async (c) => {
    try {
      const projectId = c.req.param('id');
      const numericId = parseInt(projectId.replace('p', ''));
      
      const body = await c.req.json();
      
      console.log(`🔄 Обновление проекта ${projectId}:`, body);
      
      // ✅ Явно указываем только валидные поля для БД
      const updateData: any = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.backgroundColor !== undefined) updateData.backgroundColor = body.backgroundColor;
      if (body.textColor !== undefined) updateData.textColor = body.textColor;
      if (body.patternId !== undefined) {
        // Convert patternId from "ep123" to 123 or null
        updateData.pattern_id = body.patternId ? parseInt(body.patternId.replace('ep', '')) : null;
        console.log(`🔍 DEBUG: patternId="${body.patternId}" → pattern_id=${updateData.pattern_id}`);
      }
      
      console.log(`🔍 DEBUG: updateData =`, updateData);
      
      const { data, error } = await supabase
        .from('projects')
        .update(updateData)  // ✅ Только валидные поля
        .eq('id', numericId)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Ошибка обновления проекта:', error);
        return c.json({ error: `Failed to update project: ${error.message}` }, 500);
      }
      
      const project = {
        id: `p${data.id}`,
        name: data.name,
        backgroundColor: data.backgroundColor || data.background_color || '#3B82F6',
        textColor: data.textColor || data.text_color || '#FFFFFF',
        patternId: data.pattern_id ? `ep${data.pattern_id}` : undefined  // ✅ Возвращаем patternId
      };
      
      console.log(`✅ Проект обновлен:`, project);
      return c.json(project);
    } catch (error: any) {
      return handleError(c, 'Update Project', error);
    }
  });

  // Delete project
  app.delete("/make-server-73d66528/projects/:id", async (c) => {
    try {
      const projectId = c.req.param('id');
      const numericId = parseInt(projectId.replace('p', ''));
      
      console.log(`🗑️ Удаление проекта ${projectId}...`);
      
      // Get workspace_id before deletion
      const { data: project } = await supabase
        .from('projects')
        .select('workspace_id')
        .eq('id', numericId)
        .single();
      
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', numericId);
      
      if (error) {
        console.error('❌ Ошибка удаления проекта:', error);
        return c.json({ error: `Failed to delete project: ${error.message}` }, 500);
      }
      
      if (project?.workspace_id) {
        await updateWorkspaceSummary(project.workspace_id, 'project deleted');
      }
      
      console.log(`✅ Проект ${projectId} удален`);
      return c.json({ success: true });
    } catch (error: any) {
      return handleError(c, 'Delete Project', error);
    }
  });

}