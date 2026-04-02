import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as kv from './kv_store.tsx';

// Constants
const BACKUP_BUCKET = 'make-73d66528-backups';
const MAX_BACKUPS = 10; // Increased to 10

// Helper to get Supabase client
const getSupabase = (accessToken?: string) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const options: any = {};
  
  if (accessToken) {
    options.global = {
      headers: { Authorization: `Bearer ${accessToken}` },
    };
  }
  
  return createClient(url, key, options);
};

// Error handler helper
const handleError = (c: any, context: string, error: any) => {
  console.error(`❌ Error in ${context}:`, error);
  return c.json({ 
    error: error.message || "Internal Server Error",
    context 
  }, 500);
};

export const registerBackupRoutes = (app: Hono) => {
  
  // Initialize storage bucket (idempotent-ish)
  const ensureBucket = async (supabase: any) => {
    try {
      const { data, error } = await supabase.storage.getBucket(BACKUP_BUCKET);
      if (error && error.message.includes('not found')) {
        console.log(`🪣 Creating bucket ${BACKUP_BUCKET}...`);
        await supabase.storage.createBucket(BACKUP_BUCKET, {
          public: false,
          fileSizeLimit: 10485760, // 10MB
        });
      }
    } catch (e) {
      console.error('Error ensuring bucket:', e);
    }
  };

  // 1. Create Backup (Auto-backup)
  app.post("/make-server-73d66528/backups/:workspaceId", async (c) => {
    try {
      const workspaceId = c.req.param('workspaceId');
      
      // 🛡️ Защита от некорректных ID (например "loading")
      if (workspaceId === 'loading' || isNaN(parseInt(workspaceId))) {
        console.warn(`⚠️ Blocked backup request for invalid workspaceId: "${workspaceId}"`);
        return c.json({ error: 'Invalid workspace ID' }, 400);
      }
      
      console.log(`💾 Creating backup for workspace ${workspaceId}...`);
      
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const supabaseAuth = getSupabase(); // Use service role for Auth check
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      
      if (!user || authError) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      // Use service role for DB/Storage operations
      const supabase = getSupabase();
      await ensureBucket(supabase);

      // 1. Fetch all events for workspace
      const { data: events, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('workspace_id', workspaceId);
        
      if (fetchError) throw fetchError;
      
      // 2. Determine Version Number using KV Store
      const versionKey = `backup_ver_${workspaceId}`;
      let version = 1;
      try {
        const currentVer = await kv.get(versionKey);
        if (currentVer) {
          version = (currentVer as number) + 1;
        }
        await kv.set(versionKey, version);
      } catch (err) {
        console.warn('⚠️ KV Store warning (using fallback version 1):', err);
      }

      const backupData = {
        timestamp: Date.now(),
        workspaceId,
        events,
        count: events.length,
        version: version.toString()
      };
      
      // Format: backup_v{version}_{timestamp}.json
      const fileName = `${workspaceId}/backup_v${version}_${Date.now()}.json`;
      const fileContent = JSON.stringify(backupData);
      
      // 3. Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from(BACKUP_BUCKET)
        .upload(fileName, fileContent, {
          contentType: 'application/json',
          upsert: true
        });
        
      if (uploadError) throw uploadError;
      
      console.log(`✅ Backup created: ${fileName} (v${version}, ${events.length} events)`);
      
      // 4. Cleanup old backups (keep last MAX_BACKUPS)
      const { data: files, error: listError } = await supabase.storage
        .from(BACKUP_BUCKET)
        .list(workspaceId, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' } // Newest first
        });
        
      if (!listError && files) {
        // Filter only backup_ files
        const backupFiles = files.filter(f => f.name.startsWith('backup_'));
        
        if (backupFiles.length > MAX_BACKUPS) {
          const filesToDelete = backupFiles.slice(MAX_BACKUPS).map(f => `${workspaceId}/${f.name}`);
          console.log(`🧹 Cleaning up ${filesToDelete.length} old backups...`);
          
          await supabase.storage
            .from(BACKUP_BUCKET)
            .remove(filesToDelete);
        }
      }
      
      return c.json({ success: true, fileName, count: events.length, version });
    } catch (error: any) {
      return handleError(c, 'Create Backup', error);
    }
  });

  // 2. List Backups
  app.get("/make-server-73d66528/backups/:workspaceId", async (c) => {
    try {
      const workspaceId = c.req.param('workspaceId');
      
      // 🛡️ Защита от некорректных ID
      if (workspaceId === 'loading' || isNaN(parseInt(workspaceId))) {
        return c.json({ backups: [] });
      }
      
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const supabase = getSupabase(); // Service role
      const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
      
      if (!user || authError) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      // Ensure bucket exists before listing
      await ensureBucket(supabase);

      const { data: files, error } = await supabase.storage
        .from(BACKUP_BUCKET)
        .list(workspaceId, {
          limit: 20, // Increased limit to ensure we get enough
          sortBy: { column: 'created_at', order: 'desc' }
        });
        
      if (error) throw error;
      
      // Parse file names to get metadata
      const backups = files
        .filter(f => f.name.startsWith('backup_'))
        .map((f, index) => {
          // Try new format: backup_v{ver}_{timestamp}.json
          const newFormatMatch = f.name.match(/^backup_v(\d+)_(\d+)\.json$/);
          
          let version = 0;
          let timestamp = 0;
          
          if (newFormatMatch) {
            version = parseInt(newFormatMatch[1]);
            timestamp = parseInt(newFormatMatch[2]);
          } else {
             // Fallback to old format: backup_{timestamp}.json
             // Calculate version relative to index (legacy behavior)
             const oldFormatMatch = f.name.match(/^backup_(\d+)\.json$/);
             if (oldFormatMatch) {
                timestamp = parseInt(oldFormatMatch[1]);
                version = files.length - index; // Rough estimate for old files
             } else {
                timestamp = new Date(f.created_at).getTime();
                version = 0;
             }
          }
          
          return {
            id: f.name,
            timestamp: !isNaN(timestamp) ? timestamp : new Date(f.created_at).getTime(),
            label: 'Автосохранение',
            version: version,
            size: f.metadata?.size || 0
          };
        });
        
      return c.json({ backups });
    } catch (error: any) {
      return handleError(c, 'List Backups', error);
    }
  });

  // 3. Restore Backup
  app.post("/make-server-73d66528/backups/:workspaceId/restore", async (c) => {
    try {
      const workspaceId = c.req.param('workspaceId');
      const { fileId } = await c.req.json();
      
      if (!fileId) return c.json({ error: 'fileId is required' }, 400);
      
      console.log(`♻️ Restoring backup ${fileId} for workspace ${workspaceId}...`);
      
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const supabaseAuth = getSupabase();
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      
      if (!user || authError) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      const supabase = getSupabase();
      const filePath = `${workspaceId}/${fileId}`;
      
      // 1. Download Backup
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(BACKUP_BUCKET)
        .download(filePath);
        
      if (downloadError) throw downloadError;
      
      const text = await fileData.text();
      const backup = JSON.parse(text);
      const events = backup.events || [];
      
      console.log(`📦 Loaded backup: ${events.length} events from ${new Date(backup.timestamp).toISOString()}`);
      
      // 2. Clear current events
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('workspace_id', workspaceId);
        
      if (deleteError) throw deleteError;
      
      // 3. Insert events (Batching if needed)
      if (events.length > 0) {
        // Clean events data
        const cleanEvents = events.map((e: any) => ({
          id: e.id,
          workspace_id: workspaceId,
          project_id: e.project_id,
          resource_id: e.resource_id || e.user_id,
          start_week: e.start_week,
          weeks_span: e.weeks_span,
          unit_start: e.unit_start,
          units_tall: e.units_tall,
        }));

        // Batch insert in chunks of 1000
        const chunkSize = 1000;
        for (let i = 0; i < cleanEvents.length; i += chunkSize) {
          const chunk = cleanEvents.slice(i, i + chunkSize);
          const { error: insertError } = await supabase
            .from('events')
            .insert(chunk);
            
          if (insertError) {
            console.error('Insert chunk error:', insertError);
            throw insertError;
          }
        }
      }
      
      console.log(`✅ Restore complete: ${events.length} events restored`);
      
      return c.json({ success: true, restoredCount: events.length });
    } catch (error: any) {
      return handleError(c, 'Restore Backup', error);
    }
  });
};