# Planaro - Database Schema v2.0

## Иерархия доступа

```
auth.users -> profiles -> organizations -> organization_members -> workspaces -> workspace_members -> рабочие сущности
```

## Таблицы

### auth.users (системная, не трогаем)
Системная таблица Supabase для авторизации.

### profiles
| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | FK -> auth.users(id) |
| full_name | text | |
| avatar_url | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### organizations
| Поле | Тип | Описание |
|------|-----|----------|
| id | bigint PK | |
| name | text | |
| created_by | uuid | FK -> auth.users(id) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### organization_members
| Поле | Тип | Описание |
|------|-----|----------|
| organization_id | bigint | FK -> organizations(id) |
| user_id | uuid | FK -> auth.users(id) |
| role | access_role | owner / editor / viewer |
| created_at | timestamptz | |
| updated_at | timestamptz | |

PK: (organization_id, user_id)

### organization_invites
| Поле | Тип | Описание |
|------|-----|----------|
| id | bigint PK | |
| organization_id | bigint | FK -> organizations(id) |
| email | text | |
| role | access_role | |
| invited_by | uuid | FK -> auth.users(id) |
| token | uuid | |
| accepted_at | timestamptz | |
| created_at | timestamptz | |

### workspaces
| Поле | Тип | Описание |
|------|-----|----------|
| id | bigint PK | |
| organization_id | bigint | FK -> organizations(id) **НОВОЕ** |
| name | text | |
| timeline_year | integer | |
| sort_order | integer | **НОВОЕ** |
| created_by | uuid | FK -> auth.users(id) (было owner_id) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Убрано: `owner_id`, `company_id`

### workspace_members
| Поле | Тип | Описание |
|------|-----|----------|
| workspace_id | bigint | FK -> workspaces(id) |
| user_id | uuid | FK -> auth.users(id) |
| role | access_role | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

PK: (workspace_id, user_id)

### workspace_invites
| Поле | Тип | Описание |
|------|-----|----------|
| id | bigint PK | |
| workspace_id | bigint | FK -> workspaces(id) |
| email | text | |
| role | access_role | |
| invited_by | uuid | FK -> auth.users(id) |
| token | uuid | |
| accepted_at | timestamptz | |
| created_at | timestamptz | |

### resources (бывшая public.users)
| Поле | Тип | Описание |
|------|-----|----------|
| id | bigint PK | |
| workspace_id | bigint | FK -> workspaces(id) |
| full_name | text | (было fullName / name) |
| position | text | |
| department_id | bigint nullable | |
| grade_id | bigint nullable | |
| company_id | bigint nullable | |
| auth_user_id | uuid nullable, unique | FK -> auth.users(id) **НОВОЕ** |
| avatar_url | text | |
| is_visible | boolean | |
| sort_order | integer | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Убрано: `size`

### departments
| Поле | Тип | Описание |
|------|-----|----------|
| id | bigint PK | |
| workspace_id | bigint | FK -> workspaces(id) |
| name | text | |
| queue | integer | |
| visible | boolean | |
| color | text nullable | |
| last_activity_at | timestamptz nullable | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### companies
| Поле | Тип | Описание |
|------|-----|----------|
| id | bigint PK | |
| workspace_id | bigint | FK -> workspaces(id) |
| name | text | |
| sort_order | integer | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### grades
| Поле | Тип | Описание |
|------|-----|----------|
| id | bigint PK | |
| workspace_id | bigint | FK -> workspaces(id) |
| name | text | |
| sort_order | integer | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### event_patterns (глобальная)
| Поле | Тип | Описание |
|------|-----|----------|
| id | bigint PK | |
| pattern | text unique | |
| name | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### projects
| Поле | Тип | Описание |
|------|-----|----------|
| id | bigint PK | |
| workspace_id | bigint | FK -> workspaces(id) |
| name | text | |
| backgroundColor | text nullable | |
| textColor | text nullable | |
| pattern_id | bigint nullable | FK -> event_patterns(id) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### events
| Поле | Тип | Описание |
|------|-----|----------|
| id | bigint PK | |
| workspace_id | bigint | FK -> workspaces(id) |
| resource_id | bigint nullable | FK -> resources(id) **(было user_id)** |
| project_id | bigint nullable | FK -> projects(id) |
| start_week | integer | |
| weeks_span | integer | |
| unit_start | integer | |
| units_tall | integer | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### comments
| Поле | Тип | Описание |
|------|-----|----------|
| id | bigint PK | |
| workspace_id | bigint | FK -> workspaces(id) |
| resource_id | bigint | FK -> resources(id) **(было user_id)** |
| auth_user_id | uuid nullable | legacy, будет убрано |
| author_auth_user_id | uuid nullable | FK -> auth.users(id) **НОВОЕ** |
| comment | text | |
| week_number | integer | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Убрано: `user_display_name`

### workspace_off_weeks
| Поле | Тип | Описание |
|------|-----|----------|
| id | bigint PK | |
| workspace_id | bigint | FK -> workspaces(id) |
| week_number | integer | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

## Роли доступа (access_role enum)
- `owner` - полный доступ
- `editor` - редактирование
- `viewer` - только просмотр

## Ключевые изменения v1 -> v2

### Переименования в БД
| Было | Стало |
|------|-------|
| таблица `public.users` | таблица `resources` |
| `events.user_id` | `events.resource_id` |
| `comments.user_id` | `comments.resource_id` |
| `workspaces.owner_id` | `workspaces.created_by` |

### Новые таблицы
- `profiles`
- `organizations`
- `organization_members`
- `organization_invites`
- `workspace_members`
- `workspace_invites`

### Новые поля
- `workspaces.organization_id`
- `workspaces.sort_order`
- `resources.auth_user_id`
- `comments.author_auth_user_id`

### Убранные поля
- `workspaces.owner_id`, `workspaces.company_id`
- `resources.size`
- `comments.user_display_name`
