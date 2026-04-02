import { Workspace } from '../types/scheduler';

export type EffectiveRole = 'owner' | 'editor' | 'viewer';

/**
 * Вычисляет эффективную роль пользователя в воркспейсе
 * на основе метаданных, возвращённых бэкендом.
 * 
 * Приоритет для org-воркспейсов:
 *   1. _ws_role (per-workspace override в workspace_members) — если задан
 *   2. _org_role (роль в организации) — потолок для всех воркспейсов в орге
 *   _is_creator НЕ перекрывает org role — если в орге viewer, то и в воркспейсе viewer
 * 
 * Для non-org воркспейсов:
 *   - _is_creator / 'owned' → owner
 *   - 'shared' → _ws_role
 */
export function getEffectiveRole(workspace: Workspace): EffectiveRole | null {
  const source = workspace._source;

  // Нет метаданных — не можем определить роль
  if (!source) {
    return null;
  }

  // Через организацию — org role является потолком
  // _is_creator НЕ даёт привилегий, если org role ограничивает
  if (source === 'organization') {
    // Per-workspace role override takes priority over org role
    if (workspace._ws_role) {
      if (workspace._ws_role === 'owner') return 'owner';
      return workspace._ws_role === 'editor' ? 'editor' : 'viewer';
    }
    // Fall back to org-level role (this is the ceiling)
    const orgRole = workspace._org_role;
    if (orgRole === 'owner' || orgRole === 'admin') return 'owner';
    if (orgRole === 'editor') return 'editor';
    return 'viewer'; // org 'viewer' or 'member' → workspace 'viewer'
  }

  // Владелец (создатель) вне организации — полный доступ
  if (source === 'owned' || workspace._is_creator) {
    return 'owner';
  }

  // Прямой шеринг — роль из workspace_members
  if (source === 'shared') {
    return workspace._ws_role === 'viewer' ? 'viewer' : 'editor';
  }

  return null;
}

/**
 * Проверка: может ли пользователь редактировать контент воркспейса
 * null означает "ещё не определено" — блокируем до выяснения
 */
export function canEdit(role: EffectiveRole | null): boolean {
  if (role === null) return false; // Блокируем пока роль не определена
  return role !== 'viewer';
}
