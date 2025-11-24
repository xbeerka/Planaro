/**
 * Утилита для отслеживания очередности использования проектов в воркспейсах
 * Хранит локально в localStorage последовательность использования проектов
 */

const STORAGE_KEY = 'planaro_project_usage';

interface ProjectUsageData {
  [workspaceId: string]: {
    projectIds: string[]; // Массив ID проектов, отсортированный по последнему использованию (последний = первый)
    lastUpdated: string;
  };
}

/**
 * Загружает данные об использовании проектов из localStorage
 */
function loadProjectUsage(): ProjectUsageData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch (error) {
    console.error('❌ Ошибка загрузки данных об использовании проектов:', error);
    return {};
  }
}

/**
 * Сохраняет данные об использовании проектов в localStorage
 */
function saveProjectUsage(data: ProjectUsageData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('❌ Ошибка сохранения данных об использовании проектов:', error);
  }
}

/**
 * Отмечает проект как использованный в воркспейсе
 * @param workspaceId - ID воркспейса
 * @param projectId - ID проекта
 */
export function trackProjectUsage(workspaceId: string, projectId: string): void {
  const data = loadProjectUsage();
  
  // Инициализируем воркспейс если его нет
  if (!data[workspaceId]) {
    data[workspaceId] = {
      projectIds: [],
      lastUpdated: new Date().toISOString()
    };
  }
  
  // Убираем projectId из текущей позиции (если есть)
  const existingIndex = data[workspaceId].projectIds.indexOf(projectId);
  if (existingIndex !== -1) {
    data[workspaceId].projectIds.splice(existingIndex, 1);
  }
  
  // Добавляем projectId в начало (последний использованный = первый в списке)
  data[workspaceId].projectIds.unshift(projectId);
  
  // Ограничиваем размер до 100 проектов
  if (data[workspaceId].projectIds.length > 100) {
    data[workspaceId].projectIds = data[workspaceId].projectIds.slice(0, 100);
  }
  
  // Обновляем timestamp
  data[workspaceId].lastUpdated = new Date().toISOString();
  
  saveProjectUsage(data);
  
  console.log(`📊 Проект ${projectId} отмечен как использованный в воркспейсе ${workspaceId}`);
}

/**
 * Возвращает список проектов, отсортированный по последнему использованию
 * @param workspaceId - ID воркспейса
 * @param projects - Массив всех проектов
 * @returns Массив проектов, отсортированный по последнему использованию (последний = первый)
 */
export function getSortedProjectsByUsage<T extends { id: string }>(
  workspaceId: string,
  projects: T[]
): T[] {
  const data = loadProjectUsage();
  const usageOrder = data[workspaceId]?.projectIds || [];
  
  if (usageOrder.length === 0) {
    // Если нет данных об использовании, возвращаем как есть
    return projects;
  }
  
  // Создаём map для быстрого поиска
  const projectMap = new Map<string, T>();
  projects.forEach(p => projectMap.set(p.id, p));
  
  // Сортируем: сначала проекты по очереди использования, затем остальные
  const sortedProjects: T[] = [];
  const addedIds = new Set<string>();
  
  // Добавляем проекты в порядке использования
  for (const projectId of usageOrder) {
    const project = projectMap.get(projectId);
    if (project) {
      sortedProjects.push(project);
      addedIds.add(projectId);
    }
  }
  
  // Добавляем остальные проекты (которые ещё не использовались)
  for (const project of projects) {
    if (!addedIds.has(project.id)) {
      sortedProjects.push(project);
    }
  }
  
  console.log(`📊 Проекты отсортированы по использованию (воркспейс ${workspaceId}):`, sortedProjects.map(p => p.id));
  
  return sortedProjects;
}

/**
 * Очищает данные об использовании проектов для воркспейса
 * @param workspaceId - ID воркспейса
 */
export function clearProjectUsage(workspaceId: string): void {
  const data = loadProjectUsage();
  delete data[workspaceId];
  saveProjectUsage(data);
  console.log(`🗑️ Данные об использовании проектов очищены для воркспейса ${workspaceId}`);
}
