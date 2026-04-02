import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";

// Import modular route handlers
import { registerAuthRoutes } from './server_auth.tsx';
import { registerDataRoutes } from './server_data.tsx';
import { registerEventsRoutes } from './server_events.tsx';
import { registerPresenceRoutes } from './server_presence.tsx';
import { registerProfileRoutes } from './server_profile.tsx';
import { registerCommentsRoutes } from './server_comments.tsx';
import { registerBackupRoutes } from './server_backups.tsx';
import { registerSnapshotRoutes } from './server_snapshot.tsx';

const app = new Hono();

console.log('🚀 Запуск сервера Make Server 73d66528...');
console.log('📦 Модульная архитектура: auth + data + events + presence + profile + snapshot');

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Global error handler
app.onError((err, c) => {
  console.error('🔥 ГЛОБАЛЬНАЯ ОШИБКА:', {
    message: err.message,
    stack: err.stack,
    name: err.name
  });
  return c.json({ error: 'Internal Server Error', details: err.message }, 500);
});

// ==================== HEALTH CHECK ====================

// Health check endpoint
app.get("/make-server-73d66528/health", (c) => {
  console.log('💚 Health check called');
  return c.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    modules: ['auth', 'data', 'events', 'presence', 'profile']
  });
});

// ==================== ERROR LOGGING ====================

// Anonymous error logging endpoint (no auth required)
// ВАЖНО: Регистрируется ДО модульных роутов, чтобы они не перехватили запрос
app.post("/make-server-73d66528/log-error", async (c) => {
  try {
    const body = await c.req.json();
    
    // Validate required fields
    if (!body.error_message || !body.session_id) {
      return c.json({ error: 'Missing required fields: error_message, session_id' }, 400);
    }
    
    // Import Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Upload screenshot if provided (base64 → Supabase Storage)
    let screenshotUrl: string | null = null;
    if (body.screenshot_base64) {
      try {
        const base64Data = body.screenshot_base64.replace(/^data:image\/\w+;base64,/, '');
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const ext = body.screenshot_base64.match(/^data:image\/(\w+);/)?.[1] || 'png';
        const fileName = `${body.session_id}/${Date.now()}.${ext}`;
        
        const { error: uploadError } = await supabaseAdmin.storage
          .from('error-screenshots')
          .upload(fileName, binaryData, { 
            contentType: `image/${ext}`,
            upsert: false,
          });
        
        if (!uploadError) {
          const { data: urlData } = supabaseAdmin.storage
            .from('error-screenshots')
            .getPublicUrl(fileName);
          screenshotUrl = urlData?.publicUrl || null;
          console.log('📸 Screenshot uploaded:', screenshotUrl);
        } else {
          console.warn('⚠️ Screenshot upload failed:', uploadError.message);
        }
      } catch (uploadErr: any) {
        console.warn('⚠️ Screenshot processing failed:', uploadErr.message);
      }
    }

    // Upload video if provided (base64 → Supabase Storage)
    let videoUrl: string | null = null;
    if (body.video_base64) {
      try {
        const base64Data = body.video_base64.replace(/^data:video\/\w+;base64,/, '');
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const ext = body.video_base64.match(/^data:video\/(\w+);/)?.[1] || 'webm';
        const fileName = `${body.session_id}/${Date.now()}.${ext}`;
        
        const { error: uploadError } = await supabaseAdmin.storage
          .from('error-screenshots')
          .upload(fileName, binaryData, { 
            contentType: `video/${ext}`,
            upsert: false,
          });
        
        if (!uploadError) {
          const { data: urlData } = supabaseAdmin.storage
            .from('error-screenshots')
            .getPublicUrl(fileName);
          videoUrl = urlData?.publicUrl || null;
          console.log('🎬 Video uploaded:', videoUrl, `(${Math.round(binaryData.length / 1024)}KB)`);
        } else {
          console.warn('⚠️ Video upload failed:', uploadError.message);
        }
      } catch (uploadErr: any) {
        console.warn('⚠️ Video processing failed:', uploadErr.message);
      }
    }
    
    // Insert into error_logs table
    const { error } = await supabaseAdmin
      .from('error_logs')
      .insert({
        session_id: body.session_id,
        user_agent: body.user_agent || null,
        screen_resolution: body.screen_resolution || null,
        error_message: body.error_message,
        error_stack: body.error_stack || null,
        component_stack: body.component_stack || null,
        route: body.route || null,
        workspace_id: body.workspace_id || null,
        actions: body.actions || [],
        app_version: body.app_version || '1.0.0',
        environment: body.environment || 'production',
        report_type: body.report_type || 'auto',
        description: body.description || null,
        screenshot_url: screenshotUrl,
        video_url: videoUrl,
      });
    
    if (error) {
      console.error('❌ Failed to insert error log:', error);
      return c.json({ error: 'Failed to save error log', details: error.message }, 500);
    }
    
    return c.json({ success: true });
  } catch (err: any) {
    console.error('❌ Error logging endpoint failed:', err);
    return c.json({ error: 'Internal server error', details: err.message }, 500);
  }
});

// ==================== REGISTER MODULAR ROUTES ====================

console.log('📋 Регистрация маршрутов...');

// 1. Authentication routes (10 endpoints)
console.log('  🔐 Auth routes...');
registerAuthRoutes(app);

// 2. Data routes (36 endpoints: workspaces, departments, resources, projects, grades, companies)
console.log('  🗄️ Data routes...');
registerDataRoutes(app);

// 3. Events routes (9 endpoints: events, event-patterns, batch operations)
console.log('  📅 Events routes...');
registerEventsRoutes(app);

// 4. Presence routes (4 endpoints: heartbeat, online users, leave)
console.log('  👥 Presence routes...');
registerPresenceRoutes(app);

// 5. Profile routes (3 endpoints: upload avatar, update profile, user avatars)
console.log('  👤 Profile routes...');
registerProfileRoutes(app);

// 6. Comments routes (4 endpoints)
console.log('  💬 Comments routes...');
registerCommentsRoutes(app);

// 7. Backup routes (3 endpoints)
console.log('  💾 Backup routes...');
registerBackupRoutes(app);

// 8. Snapshot routes (1 endpoint)
console.log('  📸 Snapshot routes...');
registerSnapshotRoutes(app);

console.log('✅ Все маршруты зарегистрированы (70 endpoints)');
console.log('🌐 Сервер готов к приёму запросов');

// ==================== START SERVER ====================

Deno.serve(app.fetch);