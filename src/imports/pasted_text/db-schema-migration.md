База данных проекта: новая структура и миграция без потери данных
1. Общая идея архитектуры

Старая схема была плоской: воркспейты существовали сами по себе, а public.users смешивал бизнес-сущности людей с auth.users.

Новая схема вводит правильную иерархию доступа:

auth.users → profiles → organizations → organization_members → workspaces → workspace_members → рабочие сущности (resources, events, comments, projects, departments, companies, grades, workspace_off_weeks).

Что это даёт
доступ можно ограничивать на уровне пространства (organization)
внутри пространства можно иметь несколько воркспейтов
у пользователей есть роли: owner, editor, viewer
auth.users остаётся только для авторизации
public.users больше не используется как доменная таблица людей
2. Что было изменено концептуально
Главные изменения
public.users → public.resources
это таблица людей/ресурсов внутри воркспейта
она больше не конфликтует с auth.users
Добавлен верхний уровень доступа:
organizations
organization_members
organization_invites
workspaces теперь принадлежат organizations
добавлен organization_id
Добавлен уровень доступа к воркспейту:
workspace_members
workspace_invites
Все рабочие сущности привязаны к workspace_id
resources
companies
departments
grades
projects
events
comments
workspace_off_weeks
event_patterns остаётся глобальной справочной таблицей
Для комментариев добавлено поле:
author_auth_user_id
это автор комментария из auth.users
3. Итоговая структура таблиц
auth.users

Системная таблица Supabase, хранит только авторизацию.

Микрокомментарий: не трогаем как бизнес-таблицу, используем только как источник логина и идентичности.

profiles

Профиль авторизованного пользователя.

Поля:

id uuid — PK, ссылка на auth.users(id)
full_name text
avatar_url text
created_at timestamptz
updated_at timestamptz

Микрокомментарий: отдельный слой профиля для UI и персональных данных, не смешивается с бизнес-данными пространства.

organizations

Верхний контейнер доступа.

Поля:

id bigint
name text
created_by uuid → auth.users(id)
created_at timestamptz
updated_at timestamptz

Микрокомментарий: это “пространство” верхнего уровня, внутри которого живут воркспейсы.

organization_members

Участники организации и их роль.

Поля:

organization_id bigint → organizations(id)
user_id uuid → auth.users(id)
role access_role (owner | editor | viewer)
created_at timestamptz
updated_at timestamptz

Микрокомментарий: управляет доступом к целому пространству.

organization_invites

Приглашения в организацию.

Поля:

id bigint
organization_id bigint → organizations(id)
email text
role access_role
invited_by uuid → auth.users(id)
token uuid
accepted_at timestamptz
created_at timestamptz

Микрокомментарий: приглашение пользователя в пространство по email.

workspaces

Рабочие области внутри организации.

Поля:

id bigint
organization_id bigint → organizations(id)
name text
timeline_year integer
sort_order integer
created_by uuid → auth.users(id)
created_at timestamptz
updated_at timestamptz

Микрокомментарий: воркспейс теперь не существует сам по себе, а принадлежит организации.

workspace_members

Участники конкретного воркспейса и их роль.

Поля:

workspace_id bigint → workspaces(id)
user_id uuid → auth.users(id)
role access_role
created_at timestamptz
updated_at timestamptz

Микрокомментарий: позволяет дать доступ только к одному воркспейсу без доступа ко всему пространству.

workspace_invites

Приглашения в конкретный воркспейс.

Поля:

id bigint
workspace_id bigint → workspaces(id)
email text
role access_role
invited_by uuid → auth.users(id)
token uuid
accepted_at timestamptz
created_at timestamptz

Микрокомментарий: локальное приглашение только в один воркспейс.

resources

Люди/ресурсы внутри воркспейса. Это бывшая таблица public.users.

Поля:

id bigint
workspace_id bigint → workspaces(id)
full_name text
position text
department_id bigint nullable
grade_id bigint nullable
company_id bigint nullable
auth_user_id uuid nullable, unique → auth.users(id)
avatar_url text
is_visible boolean
sort_order integer
created_at timestamptz
updated_at timestamptz

Микрокомментарий: это основной доменный “человек” в системе; может быть связан с авторизованным пользователем, а может существовать без логина.

companies

Компании внутри воркспейса.

Поля:

id bigint
workspace_id bigint → workspaces(id)
name text
sort_order integer
created_at timestamptz
updated_at timestamptz

Микрокомментарий: справочник компаний, изолированный по воркспейсу.

departments

Департаменты внутри воркспейса.

Поля:

id bigint
workspace_id bigint → workspaces(id)
name text
queue integer
visible boolean
color text nullable
last_activity_at timestamptz nullable
created_at timestamptz
updated_at timestamptz

Микрокомментарий: структура подразделений внутри конкретного воркспейса.

grades

Грейды внутри воркспейса.

Поля:

id bigint
workspace_id bigint → workspaces(id)
name text
sort_order integer
created_at timestamptz
updated_at timestamptz

Микрокомментарий: локальный справочник уровней/грейдов сотрудников.

event_patterns

Глобальные паттерны событий.

Поля:

id bigint
pattern text unique
name text
created_at timestamptz
updated_at timestamptz

Микрокомментарий: глобальный справочник, не привязан к воркспейту.

projects

Проекты внутри воркспейта.

Поля:

id bigint
workspace_id bigint → workspaces(id)
name text
backgroundColor text nullable
pattern_id bigint nullable → event_patterns(id)
textColor text nullable
created_at timestamptz
updated_at timestamptz

Микрокомментарий: проект живёт внутри воркспейта и может ссылаться на глобальный паттерн.

events

События/назначения внутри воркспейта.

Поля:

id bigint
workspace_id bigint → workspaces(id)
resource_id bigint nullable → resources(id)
project_id bigint nullable → projects(id)
start_week integer
weeks_span integer
unit_start integer
units_tall integer
created_at timestamptz
updated_at timestamptz

Микрокомментарий: календарная сущность, всегда привязана к воркспейту, а ресурс и проект — дополнительные связи.

comments

Комментарии к ресурсу внутри воркспейта.

Текущая структура после миграции:

id bigint
workspace_id bigint → workspaces(id)
resource_id bigint → resources(id)
auth_user_id uuid nullable → auth.users(id)
author_auth_user_id uuid nullable → auth.users(id)
comment text
week_number integer
created_at timestamptz
updated_at timestamptz

Микрокомментарий: комментарий принадлежит ресурсу и воркспейту; автор комментария — это отдельный auth.users.
author_auth_user_id — новое нормальное поле для автора.
auth_user_id — старое legacy-поле, его лучше потом убрать, когда код полностью перейдёт на новую схему.

workspace_off_weeks

Выходные недели внутри воркспейта.

Поля:

id bigint
workspace_id bigint → workspaces(id)
week_number integer
created_at timestamptz
updated_at timestamptz

Микрокомментарий: хранит недели, которые являются выходными для конкретного воркспейта.

4. Логика доступа
Роли

Используются три роли:

owner
editor
viewer
Принцип
organization_members управляет доступом к пространству целиком
workspace_members управляет доступом к конкретному воркспейту
рабочие таблицы проверяют доступ через workspace_id
owner имеет полный доступ
editor может редактировать
viewer только просматривает
5. Что важно для миграции фронта и логики
Нужно заменить в коде
public.users → resources
user_id в комментариях/эвентах → resource_id
для комментариев использовать author_auth_user_id как автора
доступ к списку воркспейсов и данным строить не напрямую, а через memberships
Нужно убрать из старой логики
прямой показ всех воркспейсов всем авторизованным
использование public.users как имени сущности человека
workspace_id default 0
предположение, что каждый авторизованный пользователь автоматически видит всё
6. Приоритетная бизнес-логика после переделки
Пользователь входит через auth.users
У него есть profiles
Он видит только те organizations, где состоит в organization_members
Внутри организации он видит только свои workspaces
Внутри workspace он видит resources, events, comments, projects и справочники, если есть доступ
Комментарий всегда привязан к:
workspace_id
resource_id
author_auth_user_id