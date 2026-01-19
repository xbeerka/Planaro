import { Hono } from "npm:hono";
import { 
  createAdminClient, 
  createAuthClient, 
  handleError, 
  updateWorkspaceSummary, 
  getWeeksInYear, 
  parseCloudflareError,
  retryOperation,
  processInChunks
} from './server_utils.tsx';

// Initialize clients
const supabase = createAdminClient();
const supabaseAuth = createAuthClient();

export function registerEventsRoutes(app: Hono) {

  // ==================== EVENTS ====================

  // Get all events
  app.get("/make-server-73d66528/events", async (c) => {
    try {
      const workspaceId = c.req.query('workspace_id');
      console.log('📅 GET /events - запрос событий из таблицы events');
      console.log(`   Workspace ID: ${workspaceId || 'не указан (все воркспейсы)'}`);
      
      // ✅ PAGINATION: PostgREST возвращает максимум 1000 записей за запрос
      const PAGE_SIZE = 1000;
      const allEvents: any[] = [];
      let currentPage = 0;
      let hasMore = true;
      
      const startTime = Date.now();
      
      while (hasMore) {
        const rangeStart = currentPage * PAGE_SIZE;
        const rangeEnd = rangeStart + PAGE_SIZE - 1;
        
        console.log(`📦 Загрузка страницы ${currentPage + 1}: range(${rangeStart}, ${rangeEnd})...`);
        
        let query = supabase
          .from('events')
          .select('*')  // ✅ ИСПРАВЛЕНО: убран JOIN с event_patterns
          .order('id', { ascending: true })
          .range(rangeStart, rangeEnd);
        
        if (workspaceId) {
          query = query.eq('workspace_id', workspaceId);
        }
        
        const { data: pageEvents, error } = await query;
        
        if (error) {
          const cloudflareError = parseCloudflareError(error.message);
          if (cloudflareError) {
            console.error(`❌ Events (page ${currentPage + 1}): ${cloudflareError}`);
            return c.json({ error: cloudflareError }, 503);
          }
          
          console.error(`❌ Supabase error fetching events (page ${currentPage + 1}):`, error);
          return c.json({ error: `Failed to fetch events: ${error.message.substring(0, 200)}` }, 500);
        }
        
        const pageCount = pageEvents?.length || 0;
        console.log(`   ✅ Страница ${currentPage + 1}: получено ${pageCount} событий`);
        
        if (pageEvents && pageEvents.length > 0) {
          allEvents.push(...pageEvents);
        }
        
        hasMore = pageCount === PAGE_SIZE;
        currentPage++;
        
        // Защита от бесконечного цикла (макс 100 страниц = 100,000 событий)
        if (currentPage >= 100) {
          console.warn(`⚠️ Достигнут лимит пагинации (100 страниц, ${allEvents.length} событий)`);
          break;
        }
      }
      
      const duration = Date.now() - startTime;
      const totalCount = allEvents.length;
      
      console.log(`✅ Загрузка завершена: ${totalCount} событий за ${currentPage} запросов (${duration}ms)`);
      
      if (totalCount === 0) {
        console.warn('⚠️ Ноль событий - возможно воркспейс пустой или неверный workspace_id');
      }
      
      // 🔍 DEBUG: Log first event to see DB structure
      if (allEvents && allEvents.length > 0) {
        console.log('🔍 ПЕРВОЕ СОБЫТИЕ ИЗ БД:', JSON.stringify(allEvents[0], null, 2));
      }
      
      // Transform events to expected format
      // WORKAROUND: Database has constraint start_week >= 1, but frontend uses 0-51
      // So we subtract 1 when reading from DB to convert DB range (1-52) to frontend range (0-51)
      const transformedEvents = allEvents.map(event => ({
        id: `e${event.id}`,
        resourceId: `u${event.user_id}`,  // ✅ ИСПРАВЛЕНО: префикс "u"
        projectId: `p${event.project_id}`,
        startWeek: (event.start_week || 1) - 1, // DB: 1-52 → Frontend: 0-51
        weeksSpan: event.weeks_span || 1,
        unitStart: event.unit_start || 0,
        unitsTall: event.units_tall || 1,
        patternId: event.pattern_id ? `ep${event.pattern_id}` : undefined
      }));
      
      console.log(`✅ GET /events - возвращаем ${transformedEvents.length} событий (workspace: ${workspaceId || 'all'})`);
      
      // 📊 Статистика для отладки
      if (transformedEvents.length > 0) {
        const uniqueResources = new Set(transformedEvents.map(e => e.resourceId)).size;
        const uniqueProjects = new Set(transformedEvents.map(e => e.projectId)).size;
        console.log(`   📊 Уникальных сотрудников: ${uniqueResources}, проектов: ${uniqueProjects}`);
      }
      
      return c.json(transformedEvents);
    } catch (error: any) {
      return handleError(c, 'Fetch Events', error);
    }
  });

  // ✨ Get events changes (delta sync) - ТОЛЬКО изменённые события
  app.get("/make-server-73d66528/events/changes", async (c) => {
    try {
      const workspaceId = c.req.query('workspace_id');
      const since = c.req.query('since'); // ISO timestamp
      
      console.log('🔄 GET /events/changes - запрос изменённых событий');
      console.log(`   Workspace ID: ${workspaceId || 'не указан'}`);
      console.log(`   Since: ${since || 'не указан (все события)'}`);
      
      if (!workspaceId) {
        return c.json({ error: 'workspace_id is required' }, 400);
      }
      
      // ✅ ИСПРАВЛЕНО: Retry Logic + Reduced Limit + Connection Handling
      // Connection Reset часто возникает из-за таймаутов или слишком больших пакетов данных
      const events = await retryOperation(async () => {
        let query = supabase
          .from('events')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('updated_at', { ascending: false })
          .limit(500); // 📉 Reduced from 1000 to prevent timeouts
        
        if (since) {
          query = query.gt('updated_at', since);
        }
        
        // ⏱️ Timeout 15s (increased from 10s)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout after 15s')), 15000);
        });
        
        const { data, error } = await Promise.race([query, timeoutPromise]) as any;
        
        if (error) throw error;
        return data;
      }, 3, 2000, 'Fetch event changes'); // 3 retries, 2s delay
      
      const count = events?.length || 0;
      console.log(`✅ Найдено ${count} изменённых событий`);
      
      if (count === 0) {
        return c.json({ events: [], timestamp: new Date().toISOString() });
      }
      
      const transformedEvents = events.map(event => ({
        id: `e${event.id}`,
        resourceId: `u${event.user_id}`,  // ✅ Delta sync: префикс "u"
        projectId: `p${event.project_id}`,
        startWeek: (event.start_week || 1) - 1,
        weeksSpan: event.weeks_span || 1,
        unitStart: event.unit_start || 0,
        unitsTall: event.units_tall || 1,
        patternId: event.pattern_id ? `ep${event.pattern_id}` : undefined,
        updatedAt: event.updated_at
      }));
      
      console.log(`✅ GET /events/changes - возвращаем ${transformedEvents.length} изменений`);
      
      return c.json({ 
        events: transformedEvents, 
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Exception fetching event changes:', error);
      const isTimeout = error.message && error.message.includes('Request timeout');
      return c.json({ 
        events: [], 
        timestamp: new Date().toISOString(),
        error: isTimeout ? 'timeout' : 'unknown'
      }, isTimeout ? 504 : 500);
    }
  });

  // Get all event patterns
  app.get("/make-server-73d66528/event-patterns", async (c) => {
    try {
      console.log('🎨 Запрос паттернов из таблицы event_patterns...');
      
      const patterns = await retryOperation(async () => {
        // Добавляем таймаут для каждого запроса (10с)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout after 10s')), 10000);
        });

        const query = supabase
          .from('event_patterns')
          .select('*')
          .order('id', { ascending: true });

        const { data, error } = await Promise.race([query, timeoutPromise]) as any;
        
        if (error) throw error;
        return data;
      }, 3, 1000, 'Fetch Patterns'); // 3 retries, 1s delay start
      
      console.log(`✓ Получено ${patterns?.length || 0} паттернов`);
      
      const transformedPatterns = patterns?.map(p => ({
        id: `ep${p.id}`,
        name: p.name,
        pattern: p.pattern
      })) || [];
      
      return c.json(transformedPatterns);
    } catch (error: any) {
      return handleError(c, 'Fetch Event Patterns', error);
    }
  });

  // Create new event
  app.post("/make-server-73d66528/events", async (c) => {
    try {
      console.log('➕ Создание нового события...');
      
      const body = await c.req.json();
      const { resourceId, projectId, startWeek, weeksSpan, unitStart, unitsTall, patternId, workspace_id } = body;
      
      if (!resourceId || !projectId || startWeek === undefined) {
        return c.json({ error: 'resourceId, projectId, and startWeek are required' }, 400);
      }
      
      if (!workspace_id) {
        return c.json({ error: 'Workspace ID is required' }, 400);
      }
      
      // Get workspace timeline year for weeks calculation
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('timeline_year')
        .eq('id', workspace_id)
        .single();
      
      const timelineYear = workspace?.timeline_year || new Date().getFullYear();
      const weeksInYear = getWeeksInYear(timelineYear);
      
      const userId = parseInt(resourceId.replace('u', ''));  // ✅ ИСПРАВЛЕНО: префикс "u"
      const projectIdNum = parseInt(projectId.replace('p', ''));
      const patternIdNum = patternId ? parseInt(patternId.replace('ep', '')) : null;
      
      const maxWeeks = weeksInYear - startWeek;
      const validWeeksSpan = Math.max(1, Math.min(weeksSpan || 1, maxWeeks));
      
      const { data, error } = await supabase
        .from('events')
        .insert({
          user_id: userId,
          project_id: projectIdNum,
          start_week: startWeek + 1, // Frontend: 0-51 → DB: 1-52
          weeks_span: validWeeksSpan,
          unit_start: unitStart !== undefined ? unitStart : 0,
          units_tall: unitsTall !== undefined ? unitsTall : 1,
          // ❌ pattern_id УДАЛЁН - паттерны только у проектов!
          workspace_id
        })
        .select('*')  // ✅ ИСПРАВЛЕНО: убран JOIN с event_patterns
        .single();
      
      if (error) {
        console.error('❌ Ошибка создания события:', error);
        return c.json({ error: `Failed to create event: ${error.message}` }, 500);
      }
      
      await updateWorkspaceSummary(workspace_id, 'event created');
      
      const event = {
        id: `e${data.id}`,
        resourceId: `u${data.user_id}`,  // ✅ Create event: префикс "u"
        projectId: `p${data.project_id}`,
        startWeek: (data.start_week || 1) - 1,
        weeksSpan: data.weeks_span || 1,
        unitStart: data.unit_start || 0,
        unitsTall: data.units_tall || 1,
        patternId: data.pattern_id ? `ep${data.pattern_id}` : undefined
      };
      
      console.log(`✅ Событие создано:`, event.id);
      return c.json(event);
    } catch (error: any) {
      return handleError(c, 'Create Event', error);
    }
  });

  // Batch create events
  app.post("/make-server-73d66528/events/batch-create", async (c) => {
    try {
      console.log('📦 Пакетное создание событий...');
      
      const body = await c.req.json();
      const { events: eventsData, workspace_id } = body;
      
      if (!Array.isArray(eventsData)) {
        return c.json({ error: 'events array is required' }, 400);
      }
      
      if (!workspace_id) {
        return c.json({ error: 'workspace_id is required' }, 400);
      }
      
      console.log(`📦 Создание ${eventsData.length} событий...`);
      
      // Get workspace timeline year
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('timeline_year')
        .eq('id', workspace_id)
        .single();
      
      const timelineYear = workspace?.timeline_year || new Date().getFullYear();
      const weeksInYear = getWeeksInYear(timelineYear);
      
      const eventsToInsert = eventsData.map(event => {
        const userId = parseInt(event.resourceId.replace('u', ''));  // ✅ ИСПРАВЛЕНО: префикс "u"
        const projectId = parseInt(event.projectId.replace('p', ''));
        const patternId = event.patternId ? parseInt(event.patternId.replace('ep', '')) : null;
        
        const startWeek = event.startWeek || 0;
        const maxWeeks = weeksInYear - startWeek;
        const weeksSpan = Math.max(1, Math.min(event.weeksSpan || 1, maxWeeks));
        
        return {
          user_id: userId,
          project_id: projectId,
          start_week: startWeek + 1,
          weeks_span: weeksSpan,
          unit_start: event.unitStart !== undefined ? event.unitStart : 0,
          units_tall: event.unitsTall !== undefined ? event.unitsTall : 1,
          // ❌ pattern_id УДАЛЁН - паттерны только у проектов!
          workspace_id
        };
      });
      
      const { data, error } = await supabase
        .from('events')
        .insert(eventsToInsert)
        .select('*');  // ✅ ИСПРАВЛЕНО: убран JOIN с event_patterns
      
      if (error) {
        console.error('❌ Ошибка пакетного создания:', error);
        return c.json({ error: `Failed to batch create events: ${error.message}` }, 500);
      }
      
      const createdCount = data?.length || 0;
      console.log(`✅ Создано ${createdCount} из ${eventsToInsert.length} событий`);
      
      await updateWorkspaceSummary(workspace_id, `batch create ${createdCount} events`);
      
      const transformedEvents = data?.map(ev => ({
        id: `e${ev.id}`,
        resourceId: `u${ev.user_id}`,  // ✅ Batch create: префикс "u"
        projectId: `p${ev.project_id}`,
        startWeek: (ev.start_week || 1) - 1,
        weeksSpan: ev.weeks_span || 1,
        unitStart: ev.unit_start || 0,
        unitsTall: ev.units_tall || 1,
        patternId: ev.pattern_id ? `ep${ev.pattern_id}` : undefined
      })) || [];
      
      return c.json(transformedEvents);
    } catch (error: any) {
      return handleError(c, 'Batch Create Events', error);
    }
  });

  // Update event
  app.put("/make-server-73d66528/events/:id", async (c) => {
    try {
      const eventId = c.req.param('id');
      const numericId = parseInt(eventId.replace('e', ''));
      
      const body = await c.req.json();
      
      console.log(`🔄 Обновление события ${eventId}:`, body);
      
      // Get workspace for weeks calculation
      const { data: existingEvent } = await supabase
        .from('events')
        .select('workspace_id')
        .eq('id', numericId)
        .single();
      
      let weeksInYear = 52;
      if (existingEvent?.workspace_id) {
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('timeline_year')
          .eq('id', existingEvent.workspace_id)
          .single();
        
        const timelineYear = workspace?.timeline_year || new Date().getFullYear();
        weeksInYear = getWeeksInYear(timelineYear);
      }
      
      const updateData: any = {};
      
      if (body.resourceId !== undefined) {
        updateData.user_id = parseInt(body.resourceId.replace('u', ''));  // ✅ ИСПРАВЛЕНО: префикс "u"
      }
      if (body.projectId !== undefined) {
        updateData.project_id = parseInt(body.projectId.replace('p', ''));
      }
      if (body.startWeek !== undefined) {
        updateData.start_week = body.startWeek + 1;
      }
      if (body.weeksSpan !== undefined) {
        const startWeek = body.startWeek !== undefined ? body.startWeek : 0;
        const maxWeeks = weeksInYear - startWeek;
        updateData.weeks_span = Math.max(1, Math.min(body.weeksSpan, maxWeeks));
      }
      if (body.unitStart !== undefined) {
        updateData.unit_start = body.unitStart;
      }
      if (body.unitsTall !== undefined) {
        updateData.units_tall = body.unitsTall;
      }
      if (body.patternId !== undefined) {
        updateData.pattern_id = body.patternId ? parseInt(body.patternId.replace('ep', '')) : null;
      }
      
      const { data, error } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', numericId)
        .select('*')  // ✅ ИСПРАВЛЕНО: убран JOIN с event_patterns
        .single();
      
      if (error) {
        console.error('❌ Ошибка обновления события:', error);
        return c.json({ error: `Failed to update event: ${error.message}` }, 500);
      }
      
      if (existingEvent?.workspace_id) {
        await updateWorkspaceSummary(existingEvent.workspace_id, 'event updated');
      }
      
      const event = {
        id: `e${data.id}`,
        resourceId: `u${data.user_id}`,  // ✅ Update event: префикс "u"
        projectId: `p${data.project_id}`,
        startWeek: (data.start_week || 1) - 1,
        weeksSpan: data.weeks_span || 1,
        unitStart: data.unit_start || 0,
        unitsTall: data.units_tall || 1,
        patternId: data.pattern_id ? `ep${data.pattern_id}` : undefined
      };
      
      console.log(`✅ Событие обновлено:`, event.id);
      return c.json(event);
    } catch (error: any) {
      return handleError(c, 'Update Event', error);
    }
  });

  // Delete event
  app.delete("/make-server-73d66528/events/:id", async (c) => {
    try {
      const eventId = c.req.param('id');
      
      // Check for temporary events (should not be deleted via API)
      if (eventId.startsWith('ev_temp_')) {
        console.warn(`⚠️ Попытка удалить временное событие ${eventId} через API - блокируется`);
        return c.json({ error: 'Cannot delete temporary events via API' }, 400);
      }
      
      const numericId = parseInt(eventId.replace('e', ''));
      
      console.log(`🗑️ Удаление события ${eventId}...`);
      
      // Get workspace_id before deletion
      const { data: event } = await supabase
        .from('events')
        .select('workspace_id')
        .eq('id', numericId)
        .single();
      
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', numericId);
      
      if (error) {
        console.error('❌ Ошибка удаления события:', error);
        return c.json({ error: `Failed to delete event: ${error.message}` }, 500);
      }
      
      if (event?.workspace_id) {
        await updateWorkspaceSummary(event.workspace_id, 'event deleted');
      }
      
      console.log(`✅ Событие ${eventId} удалено`);
      return c.json({ success: true });
    } catch (error: any) {
      return handleError(c, 'Delete Event', error);
    }
  });

  // 🚀 BATCH API - пакетные операции с событиями
  app.post("/make-server-73d66528/events/batch", async (c) => {
    try {
      console.log('📦 BATCH: начало пакетной операции...');
      const body = await c.req.json();
      
      const { operations } = body; // [{ op: 'create'|'update'|'delete', data: {...} }]
      
      if (!operations || !Array.isArray(operations)) {
        console.error('❌ BATCH: невалидный запрос');
        return c.json({ error: 'Invalid batch request: operations array required' }, 400);
      }
      
      console.log(`📦 BATCH: получено операций: ${operations.length}`);
      
      // Get workspace_id and timeline_year for dynamic weeks calculation
      let weeksInYear = 52;
      const firstCreate = operations.find(op => op.op === 'create');
      if (firstCreate?.workspace_id) {
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('timeline_year')
          .eq('id', firstCreate.workspace_id)
          .single();
        
        const timelineYear = workspace?.timeline_year || new Date().getFullYear();
        weeksInYear = getWeeksInYear(timelineYear);
      }
      
      const results = {
        created: [],
        updated: [],
        deleted: [],
        errors: []
      };
      
      // Группируем операции по типу
      const creates = operations.filter(op => op.op === 'create');
      const updates = operations.filter(op => op.op === 'update');
      const deletes = operations.filter(op => op.op === 'delete');
      
      console.log(`📦 BATCH: create=${creates.length}, update=${updates.length}, delete=${deletes.length}`);
      
      // 1️⃣ УДАЛЕНИЕ
      for (const op of deletes) {
        try {
          const eventId = op.id;
          if (eventId.startsWith('ev_temp_')) {
            console.log(`⏭️ BATCH: пропуск временного события ${eventId}`);
            continue;
          }
          
          const numericId = parseInt(eventId.replace(/^e/, ''));
          if (isNaN(numericId)) {
            results.errors.push({ op: 'delete', id: eventId, error: 'Invalid ID' });
            continue;
          }
          
          const { error } = await supabase
            .from('events')
            .delete()
            .eq('id', numericId);
          
          if (error) {
            console.error(`❌ BATCH delete error:`, error);
            results.errors.push({ op: 'delete', id: eventId, error: error.message });
          } else {
            results.deleted.push(eventId);
          }
        } catch (error: any) {
          results.errors.push({ op: 'delete', id: op.id, error: error.message });
        }
      }
      
      // 2️⃣ СОЗДАНИЕ
      if (creates.length > 0) {
        try {
          const eventsToCreate = creates.map(op => {
            const body = op.data;
            const userId = parseInt(body.resourceId.replace('u', ''));  // ✅ ИСПРАВЛЕНО: префикс "u"
            const projectId = parseInt(body.projectId.replace('p', ''));
            const patternId = body.patternId ? parseInt(body.patternId.replace('ep', '')) : null;
            
            const startWeek = body.startWeek || 0;
            const maxWeeks = weeksInYear - startWeek;
            let weeksSpan = body.weeksSpan || 1;
            weeksSpan = Math.max(1, Math.min(weeksSpan, maxWeeks));
            
            const eventData: any = {
              user_id: userId,
              project_id: projectId,
              start_week: startWeek + 1,
              weeks_span: weeksSpan,
              unit_start: body.unitStart !== undefined ? body.unitStart : 0,
              units_tall: body.unitsTall !== undefined ? body.unitsTall : 1,
              // ❌ pattern_id УДАЛЁН - паттерны только у проектов!
              workspace_id: op.workspace_id
            };
            
            // Если передан ID (для Undo/Redo), добавляем его
            if (body.id) {
              const numericId = parseInt(body.id.replace('e', ''));
              if (!isNaN(numericId)) {
                eventData.id = numericId;
                console.log(`📝 BATCH create: используем существующий ID ${body.id}`);
              }
            }
            
            return eventData;
          });
          
          // Разделяем на события с ID (восстановление) и без ID (новые)
          const eventsWithId = eventsToCreate.filter((e: any) => e.id !== undefined);
          const eventsNew = eventsToCreate.filter((e: any) => e.id === undefined);
          
          console.log(`📦 BATCH create split: ${eventsWithId.length} with ID, ${eventsNew.length} new`);
          
          // 2.1 Восстановление событий с ID (UPSERT)
          if (eventsWithId.length > 0) {
            const { data, error } = await supabase
              .from('events')
              .upsert(eventsWithId, { onConflict: 'id' })
              .select('*');  // ✅ ИСПРАВЛЕНО: убран JOIN с event_patterns
              
            if (error) {
              console.error(`❌ BATCH upsert (restore) error:`, error);
              results.errors.push({ op: 'create', error: error.message });
            } else if (data) {
              const transformed = data.map(ev => ({
                id: `e${ev.id}`,
                resourceId: `u${ev.user_id}`,  // ✅ Batch UPSERT: префикс "u"
                projectId: `p${ev.project_id}`,
                startWeek: (ev.start_week || 1) - 1,
                weeksSpan: ev.weeks_span || 1,
                unitStart: ev.unit_start || 0,
                unitsTall: ev.units_tall || 1,
                patternId: ev.pattern_id ? `ep${ev.pattern_id}` : undefined
              }));
              results.created.push(...transformed);
            }
          }
          
          // 2.2 Создание новых событий (INSERT)
          if (eventsNew.length > 0) {
            const { data, error } = await supabase
              .from('events')
              .insert(eventsNew)
              .select('*');  // ✅ ИСПРАВЛЕНО: убран JOIN с event_patterns
              
            if (error) {
              console.error(`❌ BATCH insert (new) error:`, error);
              results.errors.push({ op: 'create', error: error.message });
            } else if (data) {
              const transformed = data.map(ev => ({
                id: `e${ev.id}`,
                resourceId: `u${ev.user_id}`,  // ✅ Batch INSERT: префикс "u"
                projectId: `p${ev.project_id}`,
                startWeek: (ev.start_week || 1) - 1,
                weeksSpan: ev.weeks_span || 1,
                unitStart: ev.unit_start || 0,
                unitsTall: ev.units_tall || 1,
                patternId: ev.pattern_id ? `ep${ev.pattern_id}` : undefined
              }));
              results.created.push(...transformed);
            }
          }
          
          console.log(`✅ BATCH create total: создано/восстановлено ${results.created.length} событий`);
        } catch (error: any) {
          console.error(`❌ BATCH create exception:`, error);
          results.errors.push({ op: 'create', error: error.message });
        }
      }
      
      // 3️⃣ ОБНОВЛЕНИЕ
      if (updates.length > 0) {
        console.log(`🔄 BATCH: начало обновления ${updates.length} событий`);
        
        const processUpdateOp = async (op: any) => {
          try {
            const eventId = op.id;
            const numericId = parseInt(eventId.replace(/^e/, ''));
            
            if (isNaN(numericId)) {
              return { error: { id: eventId, message: 'Invalid ID' } };
            }
            
            const body = op.data;
            const updateData: any = {};
            
            if (body.resourceId !== undefined) {
              updateData.user_id = parseInt(body.resourceId.replace('u', ''));
            }
            if (body.projectId !== undefined) {
              updateData.project_id = parseInt(body.projectId.replace('p', ''));
            }
            if (body.startWeek !== undefined) {
              updateData.start_week = body.startWeek + 1;
            }
            if (body.weeksSpan !== undefined) {
              const startWeek = body.startWeek !== undefined ? body.startWeek : 0;
              const maxWeeks = weeksInYear - startWeek;
              updateData.weeks_span = Math.max(1, Math.min(body.weeksSpan, maxWeeks));
            }
            if (body.unitStart !== undefined) {
              updateData.unit_start = body.unitStart;
            }
            if (body.unitsTall !== undefined) {
              updateData.units_tall = body.unitsTall;
            }
            if (body.patternId !== undefined) {
              updateData.pattern_id = body.patternId ? parseInt(body.patternId.replace('ep', '')) : null;
            }
            
            // ✅ ИСПРАВЛЕНО: Retry Logic для обновления
            const data = await retryOperation(async () => {
              const { data, error } = await supabase
                .from('events')
                .update(updateData)
                .eq('id', numericId)
                .select('*')
                .maybeSingle();
              
              if (error) throw error;
              return data;
            }, 3, 1000, `Update event ${eventId}`);
            
            if (!data) {
              console.warn(`⚠️ BATCH update: событие ${eventId} не найдено в БД. Попытка восстановления (Auto-Upsert)...`);
              
              const canRecover = 
                updateData.user_id !== undefined && 
                updateData.project_id !== undefined && 
                updateData.start_week !== undefined && 
                op.workspace_id !== undefined;
                
              if (canRecover) {
                 const recoverData = {
                   id: numericId,
                   ...updateData,
                   workspace_id: op.workspace_id,
                   weeks_span: updateData.weeks_span || 1,
                   unit_start: updateData.unit_start || 0,
                   units_tall: updateData.units_tall || 1
                 };
                 
                 // Retry Logic для восстановления
                 const recoveredData = await retryOperation(async () => {
                   const { data, error } = await supabase
                      .from('events')
                      .upsert(recoverData)
                      .select('*')
                      .maybeSingle();
                      
                   if (error) throw error;
                   return data;
                 }, 3, 1000, `Recover event ${eventId}`);
                 
                 if (recoveredData) {
                   console.log(`✅ BATCH auto-recover success: ${eventId}`);
                   return {
                     success: {
                       id: `e${recoveredData.id}`,
                       resourceId: `u${recoveredData.user_id}`,
                       projectId: `p${recoveredData.project_id}`,
                       startWeek: (recoveredData.start_week || 1) - 1,
                       weeksSpan: recoveredData.weeks_span || 1,
                       unitStart: recoveredData.unit_start || 0,
                       unitsTall: recoveredData.units_tall || 1,
                       patternId: recoveredData.pattern_id ? `ep${recoveredData.pattern_id}` : undefined
                     }
                   };
                 }
              }

              console.warn(`⚠️ BATCH auto-recover impossible: missing fields`);
              return { error: { id: eventId, message: 'Event not found' } };
            }
            
            return {
              success: {
                id: `e${data.id}`,
                resourceId: `u${data.user_id}`,
                projectId: `p${data.project_id}`,
                startWeek: (data.start_week || 1) - 1,
                weeksSpan: data.weeks_span || 1,
                unitStart: data.unit_start || 0,
                unitsTall: data.units_tall || 1,
                patternId: data.pattern_id ? `ep${data.pattern_id}` : undefined
              }
            };
          } catch (error: any) {
            console.error(`❌ BATCH update error для ${op.id}:`, error.message);
            return { error: { id: op.id, message: error.message } };
          }
        };
        
        // ✅ ИСПРАВЛЕНО: Обработка чанками по 5 операций параллельно
        // Это предотвращает Connection Reset при большом количестве обновлений
        const updateResults = await processInChunks(updates, 5, processUpdateOp);
        
        updateResults.forEach(result => {
          if (result.error) {
            results.errors.push({ op: 'update', ...result.error });
          } else if (result.success) {
            results.updated.push(result.success);
          }
        });
      }
      
      console.log(`✅ BATCH: завершено. Создано: ${results.created.length}, обновлено: ${results.updated.length}, удалено: ${results.deleted.length}, ошибок: ${results.errors.length}`);
      
      // Обновляем workspace summary
      const workspaceId = operations[0]?.workspace_id;
      if (workspaceId) {
        await updateWorkspaceSummary(workspaceId, `batch: ${operations.length} ops`);
      }
      
      return c.json(results);
    } catch (error: any) {
      return handleError(c, 'Batch Operations', error);
    }
  });

  // 🧪 Clear all events in workspace
  app.delete("/make-server-73d66528/events/clear/:workspaceId", async (c) => {
    try {
      const workspaceId = c.req.param('workspaceId');
      console.log('🗑️ Очистка всех событий в воркспейсе:', workspaceId);
      
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      
      const { data: { user }, error: authError } = await retryOperation(
        () => supabaseAuth.auth.getUser(accessToken),
        3, 1000, 'Auth check (Clear Events)'
      );
      
      if (!user || authError) {
        console.error('❌ Unauthorized access to clear events');
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      // Count events
      const { count } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);
      
      console.log(`📊 Найдено событий для удаления: ${count || 0}`);
      
      if (!count || count === 0) {
        return c.json({ deleted: 0, message: 'No events to delete' });
      }
      
      // Delete all events
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('workspace_id', workspaceId);
      
      if (error) {
        console.error('❌ Ошибка очистки событий:', error);
        return c.json({ error: `Failed to clear events: ${error.message}` }, 500);
      }
      
      await updateWorkspaceSummary(workspaceId, 'all events cleared');
      
      console.log(`✅ Удалено событий: ${count}`);
      return c.json({ deleted: count });
    } catch (error: any) {
      return handleError(c, 'Clear Events', error);
    }
  });

  // ==================== BACKUPS (AUTO-SAVE) ====================

  const BACKUP_BUCKET = 'make-73d66528-backups';

  // 1. Create Backup (Snapshot)
  app.post("/make-server-73d66528/events/backup", async (c) => {
    try {
      const { workspaceId } = await c.req.json();
      
      if (!workspaceId) {
        return c.json({ error: 'Workspace ID required' }, 400);
      }

      console.log(`💾 BACKUP: Creating snapshot for workspace ${workspaceId}...`);
      
      // 1. Create bucket if not exists
      const { data: buckets } = await supabase.storage.listBuckets();
      if (!buckets?.some(b => b.name === BACKUP_BUCKET)) {
        await supabase.storage.createBucket(BACKUP_BUCKET, { public: false });
        console.log(`📦 Created bucket ${BACKUP_BUCKET}`);
      }
      
      // 2. Fetch ALL events for workspace (Raw DB format)
      // Use pagination to get all events if > 1000
      const PAGE_SIZE = 1000;
      let allEvents: any[] = [];
      let currentPage = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('workspace_id', workspaceId)
          .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);
          
        if (error) throw error;
        
        if (data && data.length > 0) {
          allEvents = allEvents.concat(data);
        }
        
        hasMore = data?.length === PAGE_SIZE;
        currentPage++;
      }
      
      console.log(`📦 Fetched ${allEvents.length} events for backup`);
      
      // 3. Save to Storage
      const timestamp = Date.now();
      const filename = `${workspaceId}/backup_${timestamp}.json`;
      const fileContent = JSON.stringify({
        timestamp,
        workspaceId,
        count: allEvents.length,
        events: allEvents
      });
      
      const { error: uploadError } = await supabase.storage
        .from(BACKUP_BUCKET)
        .upload(filename, fileContent, {
          contentType: 'application/json',
          upsert: true
        });
        
      if (uploadError) throw uploadError;
      
      console.log(`✅ Backup saved: ${filename}`);
      
      // 4. Rotation (Keep last 5)
      const { data: files } = await supabase.storage
        .from(BACKUP_BUCKET)
        .list(`${workspaceId}`, {
          sortBy: { column: 'created_at', order: 'desc' }
        });
        
      if (files && files.length > 5) {
        const toDelete = files.slice(5).map(f => `${workspaceId}/${f.name}`);
        await supabase.storage.from(BACKUP_BUCKET).remove(toDelete);
        console.log(`🗑️ Rotation: Deleted ${toDelete.length} old backups`);
      }
      
      return c.json({ success: true, timestamp, count: allEvents.length });
    } catch (error: any) {
      return handleError(c, 'Create Backup', error);
    }
  });

  // 2. List Backups
  app.get("/make-server-73d66528/events/backups/:workspaceId", async (c) => {
    try {
      const workspaceId = c.req.param('workspaceId');
      
      const { data: files, error } = await supabase.storage
        .from(BACKUP_BUCKET)
        .list(`${workspaceId}`, {
          sortBy: { column: 'created_at', order: 'desc' }
        });
        
      if (error) {
        // If bucket doesn't exist, return empty list
        if (error.message.includes('Bucket not found')) return c.json([]);
        throw error;
      }
      
      const backups = files.map((f, index) => ({
        id: f.name, // using filename as ID
        timestamp: new Date(f.created_at).getTime(),
        label: 'Автосохранение',
        version: files.length - index,
        size: f.metadata?.size
      }));
      
      return c.json(backups);
    } catch (error: any) {
      return handleError(c, 'List Backups', error);
    }
  });

  // 3. Restore Backup
  app.post("/make-server-73d66528/events/restore", async (c) => {
    try {
      const { workspaceId, backupId } = await c.req.json();
      console.log(`♻️ RESTORE: Restoring backup ${backupId} for workspace ${workspaceId}...`);
      
      // 1. Download Backup
      const { data: blob, error: downloadError } = await supabase.storage
        .from(BACKUP_BUCKET)
        .download(`${workspaceId}/${backupId}`);
        
      if (downloadError) throw downloadError;
      
      const backupData = JSON.parse(await blob.text());
      const eventsToRestore = backupData.events;
      
      if (!Array.isArray(eventsToRestore)) {
        throw new Error('Invalid backup format: events array missing');
      }
      
      console.log(`📦 Backup contains ${eventsToRestore.length} events`);
      
      // 2. Delete ALL current events (Transaction-like)
      // Note: Supabase/PostgREST doesn't support explicit transactions in HTTP API easily.
      // Ideally, this should be a stored procedure (RPC).
      // But we will do Delete -> Insert sequence.
      
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('workspace_id', workspaceId);
        
      if (deleteError) throw deleteError;
      
      console.log('🗑️ Cleared current events');
      
      // 3. Insert Backup Events (Batch)
      // Use chunks of 1000
      const CHUNK_SIZE = 1000;
      for (let i = 0; i < eventsToRestore.length; i += CHUNK_SIZE) {
        const chunk = eventsToRestore.slice(i, i + CHUNK_SIZE);
        const { error: insertError } = await supabase
          .from('events')
          .insert(chunk);
          
        if (insertError) {
          console.error('❌ Insert error during restore:', insertError);
          // Critical failure: Data deleted but insert failed.
          // In a real app, we should have a way to rollback or use RPC.
          throw insertError;
        }
      }
      
      await updateWorkspaceSummary(workspaceId, `restored backup ${backupId}`);
      console.log(`✅ Successfully restored ${eventsToRestore.length} events`);
      
      return c.json({ success: true, count: eventsToRestore.length });
    } catch (error: any) {
      return handleError(c, 'Restore Backup', error);
    }
  });

}