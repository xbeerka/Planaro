import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";

// Import modular route handlers
import { registerAuthRoutes } from './server_auth.tsx';
import { registerDataRoutes } from './server_data.tsx';
import { registerEventsRoutes } from './server_events.tsx';
import { registerPresenceRoutes } from './server_presence.tsx';
import { registerProfileRoutes } from './server_profile.tsx';
import { registerCommentsRoutes } from './server_comments.tsx';

const app = new Hono();

console.log('🚀 Запуск сервера Make Server 73d66528...');
console.log('📦 Модульная архитектура: auth + data + events + presence + profile');

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

console.log('✅ Все маршруты зарегистрированы (66 endpoints)');
console.log('🌐 Сервер готов к приёму запросов');

// ==================== START SERVER ====================

Deno.serve(app.fetch);
