import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createAdminClient, handleError, updateWorkspaceSummary } from './server_utils.tsx';

const supabase = createAdminClient();
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

export function registerProjectsRoutes(app: Hono) {

  // ==================== PROJECTS ====================

  app.get("/make-server-73d66528/projects", async (c) => {
    try {
      const workspaceId = c.req.query('workspace_id');
      console.log('📂 Запрос проектов для workspace:', workspaceId || 'все');
      
      let retries = 3; let lastError;
      while (retries > 0) {
        try {
          let query = supabase.from('projects').select('*');
          if (workspaceId) query = query.eq('workspace_id', workspaceId);
          const { data: projects, error } = await query.order('created_at', { ascending: false });
          if (error) throw error;
          
          console.log(`✓ Получено ${projects?.length || 0} проектов`);
          const mappedProjects = projects?.map(p => ({
            id: `p${p.id}`, name: p.name,
            backgroundColor: p.backgroundColor || p.background_color || '#3B82F6',
            textColor: p.textColor || p.text_color || '#FFFFFF',
            patternId: p.pattern_id ? `ep${p.pattern_id}` : undefined
          })) || [];
          return c.json(mappedProjects);
        } catch (error: any) {
          lastError = error;
          if (error.message && (error.message.includes('connection error') || error.message.includes('connection reset') || error.message.includes('network error'))) {
            retries--;
            if (retries > 0) { await new Promise(resolve => setTimeout(resolve, 1000)); continue; }
          } else { break; }
        }
      }
      console.error('❌ Ошибка загрузки проектов:', lastError);
      return c.json({ error: `Failed to fetch projects: ${lastError?.message}` }, 500);
    } catch (error: any) { return handleError(c, 'Fetch Projects', error); }
  });

  app.post("/make-server-73d66528/projects", async (c) => {
    try {
      console.log('➕ Создание нового проекта...');
      const body = await c.req.json();
      const { name, backgroundColor, textColor, patternId, workspace_id } = body;
      if (!name) return c.json({ error: 'Project name is required' }, 400);
      if (!workspace_id) return c.json({ error: 'Workspace ID is required' }, 400);
      
      const numericPatternId = patternId ? parseInt(patternId.replace('ep', '')) : null;
      const { data, error } = await supabase.from('projects').insert({
        name, backgroundColor: backgroundColor || '#3B82F6', textColor: textColor || '#FFFFFF',
        pattern_id: numericPatternId, workspace_id
      }).select().single();
      if (error) return c.json({ error: `Failed to create project: ${error.message}` }, 500);
      
      await updateWorkspaceSummary(workspace_id, 'project created');
      const project = {
        id: `p${data.id}`, name: data.name,
        backgroundColor: data.backgroundColor || data.background_color || '#3B82F6',
        textColor: data.textColor || data.text_color || '#FFFFFF',
        patternId: data.pattern_id ? `ep${data.pattern_id}` : undefined
      };
      console.log(`✅ Проект создан:`, project);
      return c.json(project);
    } catch (error: any) { return handleError(c, 'Create Project', error); }
  });

  app.put("/make-server-73d66528/projects/:id", async (c) => {
    try {
      const projectId = c.req.param('id');
      const numericId = parseInt(projectId.replace('p', ''));
      const body = await c.req.json();
      console.log(`🔄 Обновление проекта ${projectId}:`, body);
      
      const updateData: any = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.backgroundColor !== undefined) updateData.backgroundColor = body.backgroundColor;
      if (body.textColor !== undefined) updateData.textColor = body.textColor;
      if (body.patternId !== undefined) {
        updateData.pattern_id = body.patternId ? parseInt(body.patternId.replace('ep', '')) : null;
      }
      
      const { data, error } = await supabase.from('projects').update(updateData).eq('id', numericId).select().single();
      if (error) return c.json({ error: `Failed to update project: ${error.message}` }, 500);
      
      const project = {
        id: `p${data.id}`, name: data.name,
        backgroundColor: data.backgroundColor || data.background_color || '#3B82F6',
        textColor: data.textColor || data.text_color || '#FFFFFF',
        patternId: data.pattern_id ? `ep${data.pattern_id}` : undefined
      };
      console.log(`✅ Проект обновлен:`, project);
      return c.json(project);
    } catch (error: any) { return handleError(c, 'Update Project', error); }
  });

  app.delete("/make-server-73d66528/projects/:id", async (c) => {
    try {
      const projectId = c.req.param('id');
      const numericId = parseInt(projectId.replace('p', ''));
      console.log(`🗑️ Удаление проекта ${projectId}...`);
      
      const { data: project } = await supabase.from('projects').select('workspace_id').eq('id', numericId).single();
      const { error } = await supabase.from('projects').delete().eq('id', numericId);
      if (error) return c.json({ error: `Failed to delete project: ${error.message}` }, 500);
      if (project?.workspace_id) await updateWorkspaceSummary(project.workspace_id, 'project deleted');
      
      console.log(`✅ Проект ${projectId} удален`);
      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Delete Project', error); }
  });

  // ==================== OFF WEEKS ====================

  app.get("/make-server-73d66528/off-weeks", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

      const workspaceId = c.req.query('workspace_id');
      if (!workspaceId) return c.json({ error: 'workspace_id required' }, 400);
      console.log(`📅 Загрузка выходных недель для workspace ${workspaceId}...`);

      const { data, error } = await supabase.from('workspace_off_weeks').select('*').eq('workspace_id', parseInt(workspaceId)).order('week_number', { ascending: true });
      if (error) throw error;
      console.log(`✅ Загружено ${data?.length || 0} выходных недель`);
      return c.json({ offWeeks: data || [] });
    } catch (error: any) { return handleError(c, 'Get Off Weeks', error); }
  });

  app.post("/make-server-73d66528/off-weeks", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

      const body = await c.req.json();
      const { workspace_id, week_number } = body;
      if (!workspace_id || !week_number) return c.json({ error: 'workspace_id and week_number required' }, 400);
      if (week_number < 1 || week_number > 53) return c.json({ error: 'week_number must be 1-53' }, 400);

      const { data, error } = await supabase.from('workspace_off_weeks').insert({ workspace_id, week_number }).select().single();
      if (error) throw error;
      console.log(`✅ Выходная неделя создана: id=${data.id}`);
      return c.json(data);
    } catch (error: any) { return handleError(c, 'Create Off Week', error); }
  });

  app.delete("/make-server-73d66528/off-weeks/:id", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

      const id = c.req.param('id');
      const { error } = await supabase.from('workspace_off_weeks').delete().eq('id', parseInt(id));
      if (error) throw error;
      console.log(`✅ Выходная неделя удалена`);
      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Delete Off Week', error); }
  });

  app.post("/make-server-73d66528/off-weeks/bulk", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

      const body = await c.req.json();
      const { workspace_id, week_numbers } = body;
      if (!workspace_id || !Array.isArray(week_numbers)) return c.json({ error: 'workspace_id and week_numbers[] required' }, 400);

      const rows = week_numbers.map((wn: number) => ({ workspace_id, week_number: wn }));
      const { data, error } = await supabase.from('workspace_off_weeks').insert(rows).select();
      if (error) throw error;
      console.log(`✅ Создано ${data?.length || 0} выходных недель`);
      return c.json(data || []);
    } catch (error: any) { return handleError(c, 'Bulk Create Off Weeks', error); }
  });

  app.post("/make-server-73d66528/off-weeks/bulk-delete", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'Unauthorized' }, 401);
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

      const body = await c.req.json();
      const { ids } = body;
      if (!Array.isArray(ids)) return c.json({ error: 'ids[] required' }, 400);

      const { error } = await supabase.from('workspace_off_weeks').delete().in('id', ids);
      if (error) throw error;
      console.log(`✅ Удалено ${ids.length} выходных недель`);
      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Bulk Delete Off Weeks', error); }
  });

}
