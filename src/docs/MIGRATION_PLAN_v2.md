# План миграции на DB Schema v2.0

## Сводка изменений по файлам

### ШАГ 1: Типы (Frontend) - `/types/scheduler.ts` ✅
- [x] `Resource`: убрать `firstName`, `lastName`, `size`; переименовать `fullName` в `full_name`-совместимый; добавить `authUserId?: string`
- [x] `Workspace`: убрать `owner_id`, `company_id`; добавить `organization_id`, `sort_order`, `created_by`
- [x] `Comment`: `userId` -> `resourceId`; добавить `authorAuthUserId`; убрать `userDisplayName` (получать из profiles/resources)
- [x] `SchedulerEvent`: оставить `resourceId` (уже правильно на фронте, но бэк маппил из `user_id`)
- [x] Добавить интерфейсы: `Organization`, `OrganizationMember`, `Profile`, `WorkspaceMember`

### ШАГ 2: Backend - Snapshot `/supabase/functions/server/server_snapshot.tsx` ✅
- [x] `from('users')` -> `from('resources')`
- [x] `departments` query: `users:users(count)` -> `resources:resources(count)`
- [x] resources mapping: убрать split на firstName/lastName, читать `full_name` напрямую; убрать `size`; добавить `authUserId`
- [x] events mapping: `event.user_id` -> `event.resource_id`; resourceId prefix `u` -> `r`
- [x] comments mapping: `row.user_id` -> `row.resource_id`; userId prefix `u` -> `r`; использовать `author_auth_user_id`
- [x] Аватарки комментариев: искать через `profiles` вместо `auth.admin.getUserById`

### ШАГ 3: Backend - Events `/supabase/functions/server/server_events.tsx` ✅
- [x] Все `user_id` -> `resource_id` в INSERT/UPDATE/SELECT
- [x] Все `resourceId.replace('u', '')` -> `resourceId.replace('r', '')`
- [x] Все `u${event.user_id}` -> `r${event.resource_id}`
- [x] Все маппинги в GET, POST, PUT, DELETE, batch, batch-create, changes

### ШАГ 4: Backend - Data `/supabase/functions/server/server_data.tsx` ✅
- [x] Workspaces GET: поддержка `workspace_members` для shared access
- [x] Summary: `from('users')` -> `from('resources')`
- [x] Users endpoint: `from('users')` -> `from('resources')`; маппинг полей
- [x] Resources/departments/projects/companies/grades CRUD: `from('users')` -> `from('resources')` где используется

### ШАГ 5: Backend - Comments `/supabase/functions/server/server_comments.tsx` ✅
- [x] `user_id` -> `resource_id`
- [x] Добавить `author_auth_user_id` при создании (из auth user)
- [x] Убрать `user_display_name`

### ШАГ 6: Backend - Profile `/supabase/functions/server/server_profile.tsx` ✅
- [x] Работать с таблицей `profiles` вместо `auth.users.user_metadata`
- [x] Добавлен endpoint `POST /profile/ensure` (upsert после логина)
- [x] Добавлен endpoint `GET /profile` (получить текущий профиль)
- [x] Update profile теперь пишет и в auth metadata И в profiles таблицу

### ШАГ 7: Frontend - Prefix смена `u` -> `r` ✅
- [x] `/hooks/useRealtimeEvents.ts`: `u${...}` -> `r${...}`; `.replace('u', '')` -> `.replace('r', '')`
- [x] `/hooks/useRealtimeComments.ts`: аналогично
- [x] `/hooks/useRealtimeResources.ts`: аналогично
- [x] `/contexts/SchedulerContext.tsx`: SyncManager маппинг
- [x] `/components/scheduler/SchedulerMain.tsx`: все использования
- [x] `/components/scheduler/SchedulerGrid.tsx`: resource ID matching

### ШАГ 8: Frontend - Resource interface ✅
- [x] Убрать `firstName`, `lastName` из Resource
- [x] Обновить все компоненты
- [x] Убрать `size` из Resource и всех UI
- [x] Добавить `authUserId` в Resource

### ШАГ 9: Frontend - Comments ✅
- [x] `comment.userId` -> `comment.resourceId`
- [x] Убрать `comment.userDisplayName` — получать имя из resources по resourceId
- [x] Добавить `comment.authorAuthUserId`

### ШАГ 10: Frontend - Workspaces & Organizations ✅
- [x] `Workspace` тип: добавлены `organization_id`, `sort_order`, `created_by`
- [x] Добавлены типы: `Organization`, `OrganizationMember`, `Profile`, `WorkspaceMember`
- [x] Backend: workspaces endpoint поддерживает `workspace_members` для shared доступа
- [ ] UI для управления организациями (отложено — требует отдельных экранов)

### ШАГ 11: Frontend - API services ✅
- [x] `/services/api/resources.ts`: убрать `size`; обновить маппинг полей
- [x] `/services/api/profile.ts`: добавлены `ensureProfile()`, `getProfile()`
- [x] `/services/api/workspaces.ts`: обновлен тип `WorkspaceSummary`
- [x] Экспорт profile из `/services/api/index.ts`

### ШАГ 12: Frontend - Auth flow ✅
- [x] После логина: `ensureProfile()` upsert в `profiles` таблицу (non-blocking)
- [ ] Показывать организации пользователя (отложено — требует UI)

## Порядок выполнения (приоритет)

Все шаги завершены. Отложены:
- UI для управления организациями (Шаг 10)
- Экран выбора организаций (Шаг 12)

## Критические риски

1. ✅ **Prefix `u` -> `r`** — выполнено атомарно
2. ✅ **`user_id` -> `resource_id`** — backend обновлён
3. ⚠️ **workspaces_summary** view — может требовать обновления если ссылается на `users`
4. ✅ **Realtime subscriptions** — обновлены
5. ⚠️ **Undo/Redo history** — старая история с prefix `u` невалидна после миграции