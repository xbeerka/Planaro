import { Hono } from "npm:hono";
import { createAdminClient, createAuthClient, handleError, updateWorkspaceSummary } from './server_utils.tsx';

const supabase = createAdminClient();

export function registerDepartmentsRoutes(app: Hono) {

  // ==================== DEPARTMENTS ====================

  app.get("/make-server-73d66528/departments", async (c) => {
    try {
      const workspaceId = c.req.query('workspace_id');
      console.log('📋 Запрос департаментов для workspace:', workspaceId || 'все');
      
      let query = supabase.from('departments').select('*, resources:resources(count)');
      if (workspaceId) query = query.eq('workspace_id', workspaceId);
      
      const { data: deptsTable, error: deptsError } = await query.order('queue', { ascending: true });
      
      if (!deptsError && deptsTable && deptsTable.length > 0) {
        console.log(`✓ Получено ${deptsTable.length} департаментов из таблицы departments`);
        const departments = deptsTable.map(dept => ({
          id: `d${dept.id}`, name: dept.name, queue: dept.queue ?? 999,
          visible: dept.visible !== undefined ? dept.visible : true,
          color: dept.color || null, usersCount: dept.resources?.[0]?.count ?? 0,
          last_activity_at: dept.last_activity_at
        }));
        return c.json(departments);
      }
      
      console.log('ℹ️ Таблица departments пустая для воркспейса:', workspaceId);
      return c.json([]);
    } catch (error: any) { return handleError(c, 'Fetch Departments', error); }
  });

  app.put("/make-server-73d66528/departments/queue", async (c) => {
    try {
      console.log('🔄 Обновление очередности департаментов...');
      const body = await c.req.json();
      if (!Array.isArray(body.departments)) return c.json({ error: 'Expected departments array' }, 400);
      if (body.departments.length === 0) return c.json({ success: true });
      
      const updates = body.departments.map(async (dept: { id: string, queue: number }) => {
        const numericId = parseInt(dept.id.replace('d', ''));
        const { error } = await supabase.from('departments').update({ queue: dept.queue }).eq('id', numericId);
        if (error) throw new Error(`Failed to update queue for dept ${dept.id}: ${error.message}`);
        console.log(`  ✓ Department ${dept.id}: queue = ${dept.queue}`);
      });
      await Promise.all(updates);
      
      console.log('✅ Все департаменты обновлены');
      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Update Department Queue', error); }
  });

  app.put("/make-server-73d66528/departments/visibility", async (c) => {
    try {
      console.log('🔄 Обновление видимости департаментов...');
      const body = await c.req.json();
      if (!Array.isArray(body.departments)) return c.json({ error: 'Expected departments array' }, 400);
      
      const updates = body.departments.map(async (dept: { id: string, visible: boolean }) => {
        const numericId = parseInt(dept.id.replace('d', ''));
        const { error } = await supabase.from('departments').update({ visible: dept.visible }).eq('id', numericId);
        if (error) throw error;
        console.log(`✅ Обновлен visible для department ${dept.id}: ${dept.visible}`);
      });
      await Promise.all(updates);
      
      console.log('✅ Видимость всех департаментов обновлена');
      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Update Department Visibility', error); }
  });

  app.get("/make-server-73d66528/departments/:id/users-count", async (c) => {
    try {
      const departmentId = c.req.param('id');
      const numericId = parseInt(departmentId.replace('d', ''));
      const { count, error } = await supabase.from('resources').select('*', { count: 'exact', head: true }).eq('department_id', numericId);
      if (error) return c.json({ error: `Failed to count resources: ${error.message}` }, 500);
      console.log(`✓ Департамент ${departmentId} имеет ${count || 0} ресурсов`);
      return c.json({ count: count || 0 });
    } catch (error: any) { return handleError(c, 'Count Department Users', error); }
  });

  app.post("/make-server-73d66528/departments", async (c) => {
    try {
      console.log('➕ Создание нового департамента...');
      const body = await c.req.json();
      const { name, workspace_id, color } = body;
      if (!name) return c.json({ error: 'Department name is required' }, 400);
      if (!workspace_id) return c.json({ error: 'Workspace ID is required' }, 400);
      
      const { data: existingDepts } = await supabase.from('departments').select('queue').eq('workspace_id', workspace_id).order('queue', { ascending: false }).limit(1);
      const maxQueue = existingDepts && existingDepts.length > 0 ? existingDepts[0].queue : 0;
      
      const { data, error } = await supabase.from('departments').insert({ name, workspace_id, queue: maxQueue + 1, visible: true, ...(color ? { color } : {}) }).select().single();
      if (error) return c.json({ error: `Failed to create department: ${error.message}` }, 500);
      
      await updateWorkspaceSummary(workspace_id, 'department created');
      const department = { id: `d${data.id}`, name: data.name, queue: data.queue, visible: data.visible, color: data.color || null, usersCount: 0 };
      console.log(`✅ Департамент создан:`, department);
      return c.json(department);
    } catch (error: any) { return handleError(c, 'Create Department', error); }
  });

  app.put("/make-server-73d66528/departments/:id", async (c) => {
    try {
      const departmentId = c.req.param('id');
      const numericId = parseInt(departmentId.replace('d', ''));
      const body = await c.req.json();
      console.log(`🔄 Обновление департамента ${departmentId}:`, body);
      
      const { data, error } = await supabase.from('departments').update(body).eq('id', numericId).select().single();
      if (error) return c.json({ error: `Failed to update department: ${error.message}` }, 500);
      if (body.workspace_id) await updateWorkspaceSummary(body.workspace_id, 'department updated');
      
      const department = { id: `d${data.id}`, name: data.name, queue: data.queue, visible: data.visible, color: data.color || null };
      console.log(`✅ Департамент обновлен:`, department);
      return c.json(department);
    } catch (error: any) { return handleError(c, 'Update Department', error); }
  });

  app.delete("/make-server-73d66528/departments/:id", async (c) => {
    try {
      const departmentId = c.req.param('id');
      const numericId = parseInt(departmentId.replace('d', ''));
      console.log(`🗑️ Удаление департамента ${departmentId}...`);
      
      const { data: dept } = await supabase.from('departments').select('workspace_id').eq('id', numericId).single();
      const { count } = await supabase.from('resources').select('*', { count: 'exact', head: true }).eq('department_id', numericId);
      
      if (count && count > 0) {
        console.log(`📦 Сброс department_id у ${count} сотрудников департамента ${numericId}...`);
        const { error: resetError } = await supabase.from('resources').update({ department_id: null }).eq('department_id', numericId);
        if (resetError) {
          console.error('❌ Ошибка сброса department_id:', resetError.message);
          return c.json({ error: `Failed to reset users department: ${resetError.message}` }, 500);
        }
      }
      
      const { error } = await supabase.from('departments').delete().eq('id', numericId);
      if (error) return c.json({ error: `Failed to delete department: ${error.message}` }, 500);
      if (dept?.workspace_id) await updateWorkspaceSummary(dept.workspace_id, 'department deleted');
      
      console.log(`✅ епартамент ${departmentId} удален`);
      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Delete Department', error); }
  });

  // ==================== GRADES ====================

  app.get("/make-server-73d66528/grades", async (c) => {
    try {
      const workspaceId = c.req.query('workspace_id');
      console.log('🎓 Запрос грейдов для workspace:', workspaceId || 'все');
      let query = supabase.from('grades').select('*').order('sort_order', { ascending: true });
      if (workspaceId) query = query.eq('workspace_id', workspaceId);
      const { data: grades, error } = await query;
      if (error) return c.json({ error: `Failed to fetch grades: ${error.message}` }, 500);
      console.log(`✓ Получено ${grades?.length || 0} грейдов`);
      return c.json(grades || []);
    } catch (error: any) { return handleError(c, 'Fetch Grades', error); }
  });

  app.post("/make-server-73d66528/grades", async (c) => {
    try {
      const body = await c.req.json();
      const { name, workspace_id } = body;
      if (!name || !workspace_id) return c.json({ error: 'Name and workspace_id are required' }, 400);
      console.log(`➕ Создание грейда: ${name}`);
      const { data: existing } = await supabase.from('grades').select('sort_order').eq('workspace_id', workspace_id).order('sort_order', { ascending: false }).limit(1);
      const maxSort = existing && existing.length > 0 ? existing[0].sort_order : 0;
      const { data, error } = await supabase.from('grades').insert({ name, workspace_id, sort_order: maxSort + 1 }).select().single();
      if (error) return c.json({ error: `Failed to create grade: ${error.message}` }, 500);
      console.log(`✅ Грейд создан:`, data);
      return c.json(data);
    } catch (error: any) { return handleError(c, 'Create Grade', error); }
  });

  app.put("/make-server-73d66528/grades/:id", async (c) => {
    try {
      const gradeId = c.req.param('id');
      const body = await c.req.json();
      console.log(`🔄 Обновление грейда ${gradeId}:`, body);
      const { data, error } = await supabase.from('grades').update(body).eq('id', gradeId).select().single();
      if (error) return c.json({ error: `Failed to update grade: ${error.message}` }, 500);
      console.log(`✅ Грейд обновлен:`, data);
      return c.json(data);
    } catch (error: any) { return handleError(c, 'Update Grade', error); }
  });

  app.delete("/make-server-73d66528/grades/:id", async (c) => {
    try {
      const gradeId = c.req.param('id');
      console.log(`🗑️ Удаление грейда ${gradeId}...`);
      const { error } = await supabase.from('grades').delete().eq('id', gradeId);
      if (error) return c.json({ error: `Failed to delete grade: ${error.message}` }, 500);
      console.log(`✅ Грейд ${gradeId} удален`);
      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Delete Grade', error); }
  });

  app.patch("/make-server-73d66528/grades/sort-order", async (c) => {
    try {
      const body = await c.req.json();
      if (!Array.isArray(body.grades)) return c.json({ error: 'Expected grades array' }, 400);
      const updates = body.grades.map(async (grade: { id: string, sort_order: number }) => {
        const { error } = await supabase.from('grades').update({ sort_order: grade.sort_order }).eq('id', grade.id);
        if (error) throw error;
      });
      await Promise.all(updates);
      console.log('✅ Sort order обновлен для грейдов');
      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Update Grades Sort Order', error); }
  });

  // ==================== COMPANIES ====================

  app.get("/make-server-73d66528/companies", async (c) => {
    try {
      const workspaceId = c.req.query('workspace_id');
      console.log('🏢 Запрос компаний для workspace:', workspaceId || 'все');
      let query = supabase.from('companies').select('*').order('sort_order', { ascending: true });
      if (workspaceId) query = query.eq('workspace_id', workspaceId);
      const { data: companies, error } = await query;
      if (error) return c.json({ error: `Failed to fetch companies: ${error.message}` }, 500);
      console.log(`✓ Получено ${companies?.length || 0} компаний`);
      return c.json(companies || []);
    } catch (error: any) { return handleError(c, 'Fetch Companies', error); }
  });

  app.post("/make-server-73d66528/companies", async (c) => {
    try {
      const body = await c.req.json();
      const { name, workspace_id } = body;
      if (!name || !workspace_id) return c.json({ error: 'Name and workspace_id are required' }, 400);
      console.log(`➕ Создание компании: ${name}`);
      const { data: existing } = await supabase.from('companies').select('sort_order').eq('workspace_id', workspace_id).order('sort_order', { ascending: false }).limit(1);
      const maxSort = existing && existing.length > 0 ? existing[0].sort_order : 0;
      const { data, error } = await supabase.from('companies').insert({ name, workspace_id, sort_order: maxSort + 1 }).select().single();
      if (error) return c.json({ error: `Failed to create company: ${error.message}` }, 500);
      console.log(`✅ Компания создана:`, data);
      return c.json(data);
    } catch (error: any) { return handleError(c, 'Create Company', error); }
  });

  app.put("/make-server-73d66528/companies/:id", async (c) => {
    try {
      const companyId = c.req.param('id');
      const body = await c.req.json();
      console.log(`🔄 Обновление компании ${companyId}:`, body);
      const { data, error } = await supabase.from('companies').update(body).eq('id', companyId).select().single();
      if (error) return c.json({ error: `Failed to update company: ${error.message}` }, 500);
      console.log(`✅ Компания обновлена:`, data);
      return c.json(data);
    } catch (error: any) { return handleError(c, 'Update Company', error); }
  });

  app.delete("/make-server-73d66528/companies/:id", async (c) => {
    try {
      const companyId = c.req.param('id');
      console.log(`🗑️ Удаление компании ${companyId}...`);
      const { error: unlinkError } = await supabase.from('resources').update({ company_id: null }).eq('company_id', companyId);
      if (unlinkError) return c.json({ error: `Failed to unlink resources: ${unlinkError.message}` }, 500);
      const { error } = await supabase.from('companies').delete().eq('id', companyId);
      if (error) return c.json({ error: `Failed to delete company: ${error.message}` }, 500);
      console.log(`✅ Компания ${companyId} удалена`);
      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Delete Company', error); }
  });

  app.patch("/make-server-73d66528/companies/sort-order", async (c) => {
    try {
      const body = await c.req.json();
      if (!Array.isArray(body.companies)) return c.json({ error: 'Expected companies array' }, 400);
      const updates = body.companies.map(async (company: { id: string, sort_order: number }) => {
        const { error } = await supabase.from('companies').update({ sort_order: company.sort_order }).eq('id', company.id);
        if (error) throw error;
      });
      await Promise.all(updates);
      console.log('✅ Sort order обновлен для компаний');
      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Update Companies Sort Order', error); }
  });

}