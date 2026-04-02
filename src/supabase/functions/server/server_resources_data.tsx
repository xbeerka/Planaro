import { Hono } from "npm:hono";
import { createAdminClient, handleError, updateWorkspaceSummary } from './server_utils.tsx';

const supabase = createAdminClient();

export function registerResourcesDataRoutes(app: Hono) {

  // Get all resources (users)
  app.get("/make-server-73d66528/resources", async (c) => {
    try {
      const workspaceId = c.req.query('workspace_id');
      console.log('👥 Запрос ресурсов для workspace:', workspaceId || 'все');
      
      let retries = 3;
      let lastError;
      
      while (retries > 0) {
        try {
          let query = supabase.from('resources').select(`*, department:departments(id, name), grade:grades(id, name), company:companies(id, name)`);
          if (workspaceId) query = query.eq('workspace_id', workspaceId);
          
          const { data: rows, error } = await query.order('sort_order', { ascending: true, nullsFirst: false }).order('id', { ascending: true });
          if (error) throw error;
          
          console.log(`✓ Получено ${rows?.length || 0} ресурсов`);
          
          const resources = rows?.map(row => ({
            id: `r${row.id}`, fullName: row.fullName || '', position: row.position || '',
            departmentId: row.department_id ? `d${row.department_id}` : null,
            grade: row.grade?.name || '', gradeId: row.grade_id ? String(row.grade_id) : undefined,
            companyId: row.company_id ? String(row.company_id) : null,
            avatarUrl: row.avatar_url || null, isVisible: row.is_visible !== undefined ? row.is_visible : true,
            sortOrder: row.sort_order ?? 0, size: row.size || null, authUserId: row.auth_user_id || null,
            department: row.department, company: row.company
          })) || [];
          
          return c.json(resources);
        } catch (error: any) {
          lastError = error;
          console.warn(`⚠️ Ошибка загрузки ресурсов (попытка ${4 - retries}/3):`, error.message);
          if (error.message && (error.message.includes('connection error') || error.message.includes('connection reset') || error.message.includes('network error'))) {
            retries--;
            if (retries > 0) { await new Promise(resolve => setTimeout(resolve, 1000)); continue; }
          } else { break; }
        }
      }
      
      console.error('❌ Ошибка загрузки ресурсов (все попытки исчерпаны):', lastError);
      return c.json({ error: `Failed to fetch resources: ${lastError?.message}` }, 500);
    } catch (error: any) { return handleError(c, 'Fetch Resources', error); }
  });

  // Create new user
  app.post("/make-server-73d66528/resources", async (c) => {
    try {
      console.log('➕ Создание нового пользователя...');
      const body = await c.req.json();
      const { name, position, departmentId, gradeId, companyId, avatarUrl, isVisible, workspace_id } = body;
      if (!name) return c.json({ error: 'Name is required' }, 400);
      if (!workspace_id) return c.json({ error: 'Workspace ID is required' }, 400);
      
      const numericDeptId = departmentId ? parseInt(departmentId.replace('d', '')) : null;
      
      let retries = 3; let lastError; let data;
      while (retries > 0) {
        try {
          const result = await supabase.from('resources').insert({
            fullName: name, position: position || '', department_id: numericDeptId,
            grade_id: gradeId ? parseInt(gradeId) : null, company_id: companyId,
            avatar_url: avatarUrl, is_visible: isVisible !== undefined ? isVisible : true,
            size: body.size || null, workspace_id
          }).select(`*, department:departments(id, name), grade:grades(id, name), company:companies(id, name)`).single();
          if (result.error) throw result.error;
          data = result.data; break;
        } catch (error: any) {
          lastError = error;
          if (error.message && (error.message.includes('connection error') || error.message.includes('connection reset') || error.message.includes('network error'))) {
            retries--;
            if (retries > 0) { await new Promise(resolve => setTimeout(resolve, 1000)); continue; }
          } else { break; }
        }
      }
      
      if (!data) return c.json({ error: `Failed to create resource: ${lastError?.message}` }, 500);
      await updateWorkspaceSummary(workspace_id, 'resource created');
      
      const resource = {
        id: `r${data.id}`, fullName: data.fullName || '', position: data.position || '',
        departmentId: data.department_id ? `d${data.department_id}` : null,
        grade: data.grade?.name || '', gradeId: data.grade_id ? String(data.grade_id) : undefined,
        companyId: data.company_id ? String(data.company_id) : null, avatarUrl: data.avatar_url,
        isVisible: data.is_visible, size: data.size || null, sortOrder: data.sort_order ?? 0,
        authUserId: data.auth_user_id || null, department: data.department, company: data.company
      };
      console.log(`✅ Ресурс создан:`, resource);
      return c.json(resource);
    } catch (error: any) { return handleError(c, 'Create Resource', error); }
  });

  // Update user
  app.put("/make-server-73d66528/resources/:id", async (c) => {
    try {
      const resourceId = c.req.param('id');
      const numericId = parseInt(resourceId.replace('r', ''));
      const body = await c.req.json();
      const { name, position, departmentId, gradeId, companyId, avatarUrl, isVisible, size } = body;
      console.log(`🔄 Обновление ресурса ${resourceId}`);
      
      const numericDeptId = departmentId ? parseInt(departmentId.replace('d', '')) : null;
      const updateData: any = {};
      if (name !== undefined) updateData.fullName = name;
      if (position !== undefined) updateData.position = position;
      if (departmentId !== undefined) updateData.department_id = numericDeptId;
      if (gradeId !== undefined) updateData.grade_id = gradeId ? parseInt(gradeId) : null;
      if (companyId !== undefined) updateData.company_id = companyId;
      if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl;
      if (isVisible !== undefined) updateData.is_visible = isVisible;
      if (size !== undefined) updateData.size = size || null;
      
      let retries = 3; let lastError; let data;
      while (retries > 0) {
        try {
          const result = await supabase.from('resources').update(updateData).eq('id', numericId)
            .select(`*, department:departments(id, name), grade:grades(id, name), company:companies(id, name)`).single();
          if (result.error) throw result.error;
          data = result.data; break;
        } catch (error: any) {
          lastError = error;
          if (error.message && (error.message.includes('connection error') || error.message.includes('connection reset') || error.message.includes('network error'))) {
            retries--;
            if (retries > 0) { await new Promise(resolve => setTimeout(resolve, 1000)); continue; }
          } else { break; }
        }
      }
      
      if (!data) return c.json({ error: `Failed to update resource: ${lastError?.message}` }, 500);
      
      const resource = {
        id: `r${data.id}`, fullName: data.fullName || '', position: data.position || '',
        departmentId: data.department_id ? `d${data.department_id}` : null,
        grade: data.grade?.name || '', gradeId: data.grade_id ? String(data.grade_id) : undefined,
        companyId: data.company_id ? String(data.company_id) : null, avatarUrl: data.avatar_url,
        isVisible: data.is_visible, size: data.size || null, sortOrder: data.sort_order ?? 0,
        authUserId: data.auth_user_id || null, department: data.department, company: data.company
      };
      console.log(`✅ Ресурс обновлен:`, resource);
      return c.json(resource);
    } catch (error: any) { return handleError(c, 'Update Resource', error); }
  });

  // Batch update users
  app.post("/make-server-73d66528/resources/batch", async (c) => {
    try {
      console.log('🔄 Пакетное обновление пользователей...');
      const body = await c.req.json();
      const { updates } = body;
      if (!Array.isArray(updates)) return c.json({ error: 'Updates must be an array' }, 400);
      
      console.log(`📦 Получено ${updates.length} обновлений`);
      const results: any[] = [];
      const errors: any[] = [];
      const CONCURRENCY = 5;
      
      for (let i = 0; i < updates.length; i += CONCURRENCY) {
        const chunk = updates.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(async (update: any) => {
          try {
            const { id, name, position, departmentId, gradeId, companyId, avatarUrl, isVisible, size } = update;
            const numericId = parseInt(id.replace('r', ''));
            const numericDeptId = departmentId ? parseInt(departmentId.replace('d', '')) : null;
            
            const updateData: any = {};
            if (name !== undefined) updateData.fullName = name;
            if (position !== undefined) updateData.position = position;
            if (departmentId !== undefined) updateData.department_id = numericDeptId;
            if (gradeId !== undefined) updateData.grade_id = gradeId ? parseInt(gradeId) : null;
            if (companyId !== undefined) updateData.company_id = companyId;
            if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl;
            if (isVisible !== undefined) updateData.is_visible = isVisible;
            if (size !== undefined) updateData.size = size || null;
            
            if (Object.keys(updateData).length === 0) {
              results.push({ id, success: true, skipped: true, reason: 'No fields to update' });
              return;
            }
            
            const { data, error } = await supabase.from('resources').update(updateData).eq('id', numericId).select();
            if (error) throw error;
            if (!data || data.length === 0) throw new Error('Database returned no data after update');
            results.push({ id, success: true });
          } catch (err: any) {
            console.error(`❌ Ошибка обновления resource ${update.id}:`, err);
            errors.push({ id: update.id, error: err.message });
          }
        }));
      }
      
      console.log(`✅ Пакетная обработка завершена: ${results.length} успешно, ${errors.length} ошибок`);
      if (errors.length > 0) return c.json({ success: true, results, errors, warning: "Some updates failed" });
      return c.json({ success: true, results });
    } catch (error: any) { return handleError(c, 'Batch Update Users', error); }
  });

  // Toggle user visibility
  app.put("/make-server-73d66528/resources/:id/visibility", async (c) => {
    try {
      const resourceId = c.req.param('id');
      const numericId = parseInt(resourceId.replace('r', ''));
      const { data: currentResource, error: fetchError } = await supabase.from('resources').select('is_visible').eq('id', numericId).single();
      if (fetchError || !currentResource) return c.json({ error: `Failed to fetch resource: ${fetchError?.message}` }, 500);
      
      const newVisibility = !currentResource.is_visible;
      const { data, error } = await supabase.from('resources').update({ is_visible: newVisibility }).eq('id', numericId).select().single();
      if (error) return c.json({ error: `Failed to update visibility: ${error.message}` }, 500);
      
      console.log(`✅ Видимость изменена для ресурса ${resourceId}: ${newVisibility}`);
      return c.json({ success: true, isVisible: data.is_visible });
    } catch (error: any) { return handleError(c, 'Toggle User Visibility', error); }
  });

  // Delete user
  app.delete("/make-server-73d66528/resources/:id", async (c) => {
    try {
      const resourceId = c.req.param('id');
      const numericId = parseInt(resourceId.replace('r', ''));
      console.log(`🗑️ Удаление ресурса ${resourceId}...`);
      
      const { data: res } = await supabase.from('resources').select('workspace_id').eq('id', numericId).single();
      const { error } = await supabase.from('resources').delete().eq('id', numericId);
      if (error) return c.json({ error: `Failed to delete resource: ${error.message}` }, 500);
      if (res?.workspace_id) await updateWorkspaceSummary(res.workspace_id, 'resource deleted');
      
      console.log(`✅ Ресурс ${resourceId} удален`);
      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Delete Resource', error); }
  });

  // Batch create resources
  app.post("/make-server-73d66528/resources/batch-create", async (c) => {
    try {
      const body = await c.req.json();
      const { resources: newResources, workspace_id } = body;
      if (!Array.isArray(newResources) || newResources.length === 0) return c.json({ error: 'Resources must be a non-empty array' }, 400);
      if (!workspace_id) return c.json({ error: 'workspace_id is required' }, 400);
      
      console.log(`➕ Пакетное создание ${newResources.length} ресурсов для workspace ${workspace_id}...`);
      
      const rowsToInsert = newResources.map((r: any) => ({
        fullName: r.name, position: r.position || '',
        department_id: r.departmentId ? parseInt(r.departmentId.replace('d', '')) : null,
        grade_id: r.gradeId ? parseInt(r.gradeId) : null, company_id: r.companyId || null,
        avatar_url: r.avatarUrl || null, is_visible: r.isVisible !== undefined ? r.isVisible : true,
        size: r.size || null, workspace_id,
      }));
      
      const { data, error } = await supabase.from('resources').insert(rowsToInsert)
        .select(`*, department:departments(id, name), grade:grades(id, name), company:companies(id, name)`);
      if (error) return c.json({ error: `Failed to batch create: ${error.message}` }, 500);
      
      await updateWorkspaceSummary(workspace_id, 'resources batch created');
      
      const created = (data || []).map((d: any) => ({
        id: `r${d.id}`, fullName: d.fullName || '', position: d.position || '',
        departmentId: d.department_id ? `d${d.department_id}` : null,
        grade: d.grade?.name || '', gradeId: d.grade_id ? String(d.grade_id) : undefined,
        companyId: d.company_id ? String(d.company_id) : null, avatarUrl: d.avatar_url,
        isVisible: d.is_visible, size: d.size || null, sortOrder: d.sort_order ?? 0,
        authUserId: d.auth_user_id || null, department: d.department, company: d.company,
      }));
      
      console.log(`✅ Пакетно создано ${created.length} ресурсов`);
      return c.json({ success: true, created });
    } catch (error: any) { return handleError(c, 'Batch Create Resources', error); }
  });

  // Batch delete resources
  app.post("/make-server-73d66528/resources/batch-delete", async (c) => {
    try {
      const body = await c.req.json();
      const { ids } = body;
      if (!Array.isArray(ids) || ids.length === 0) return c.json({ error: 'ids must be a non-empty array' }, 400);
      
      const numericIds = ids.map((id: string) => parseInt(id.replace('r', '')));
      console.log(`🗑️ Пакетное удаление ${numericIds.length} ресурсов`);
      
      const { data: firstRes } = await supabase.from('resources').select('workspace_id').eq('id', numericIds[0]).single();
      const { error } = await supabase.from('resources').delete().in('id', numericIds);
      if (error) return c.json({ error: `Failed to batch delete: ${error.message}` }, 500);
      if (firstRes?.workspace_id) await updateWorkspaceSummary(firstRes.workspace_id, 'resources batch deleted');
      
      console.log(`✅ Пакетно удалено ${numericIds.length} ресурсов`);
      return c.json({ success: true, deletedCount: numericIds.length });
    } catch (error: any) { return handleError(c, 'Batch Delete Resources', error); }
  });

}
