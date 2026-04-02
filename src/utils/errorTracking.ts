/**
 * Anonymous Error Tracking System
 * 
 * Собирает ошибки от всех пользователей анонимно и отправляет в Supabase.
 * Юзеры не знают что баги собираются.
 */

import { publicAnonKey } from './supabase/info';

const EDGE_FUNCTION_URL = 'https://zhukuvbdjyneoloarlqy.supabase.co/functions/v1';
const APP_VERSION = '1.0.0';
const MAX_AUTO_ACTIONS = 50;

// ==================== TYPES ====================

export interface UserAction {
  time: string;
  type: 'click' | 'navigate' | 'modal_open' | 'modal_close' | 'api_call' | 'input_change' | 'keyboard' | 'scroll' | 'context_menu' | 'focus';
  target?: string;
  details?: any;
}

interface ErrorLogPayload {
  session_id: string;
  user_agent: string;
  screen_resolution: string;
  error_message: string;
  error_stack?: string;
  component_stack?: string;
  route: string;
  workspace_id?: string;
  actions: UserAction[];
  app_version: string;
  environment: string;
}

// ==================== DEDUPLICATION ====================

// Хранилище отправленных ошибок (message + stack hash) для дедупликации
const sentErrorsCache = new Map<string, number>();
const DEDUPE_WINDOW_MS = 5000; // 5 секунд

/**
 * Создать уникальный хэш для ошибки (только message — стек может отличаться между источниками)
 */
function getErrorHash(message: string): string {
  return message;
}

/**
 * Проверить, была ли эта ошибка недавно отправлена
 */
function shouldSkipDuplicate(message: string): boolean {
  const hash = getErrorHash(message);
  const lastSentTime = sentErrorsCache.get(hash);
  
  if (lastSentTime && (Date.now() - lastSentTime < DEDUPE_WINDOW_MS)) {
    console.log(`🔇 Дедупликация: пропуск "${message.substring(0, 50)}..." (${Date.now() - lastSentTime}ms с последней отправки)`);
    return true; // Skip duplicate
  }
  
  // Записываем время отправки
  sentErrorsCache.set(hash, Date.now());
  
  // Очищаем старые записи (для экономии памяти)
  if (sentErrorsCache.size > 50) {
    const now = Date.now();
    for (const [key, time] of sentErrorsCache.entries()) {
      if (now - time > DEDUPE_WINDOW_MS) {
        sentErrorsCache.delete(key);
      }
    }
  }
  
  return false; // Send this error
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Получить или создать анонимный session_id
 * Хранится в localStorage, уникален для каждого браузера
 */
function getAnonymousSessionId(): string {
  const STORAGE_KEY = 'planaro_anon_session_id';
  let sessionId = localStorage.getItem(STORAGE_KEY);
  
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(STORAGE_KEY, sessionId);
  }
  
  return sessionId;
}

/**
 * Получить разрешение экрана (анонимная метрика)
 */
function getScreenResolution(): string {
  return `${window.screen.width}x${window.screen.height}`;
}

/**
 * Извлечь workspace_id из URL (если есть)
 * Обезличиваем: не передаем название, только ID
 */
function extractWorkspaceId(): string | undefined {
  const match = window.location.pathname.match(/\/workspace\/(\d+)/);
  return match ? match[1] : undefined;
}

// ==================== AUTO ACTION TRACKING ====================

// Глобальный буфер действий (in-memory, никуда не отправляется до ошибки)
const autoActionsBuffer: UserAction[] = [];

function pushAction(action: Omit<UserAction, 'time'>) {
  autoActionsBuffer.push({
    ...action,
    time: new Date().toISOString(),
  });
  if (autoActionsBuffer.length > MAX_AUTO_ACTIONS) {
    autoActionsBuffer.shift();
  }
}

/** Получить последние N действий из авто-буфера */
export function getAutoActions(count: number = 30): UserAction[] {
  return autoActionsBuffer.slice(-count);
}

/**
 * Получить осмысленное описание элемента для лога
 */
function describeElement(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  
  // aria-label — наиболее осмысленное описание
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return `${tag} [${ariaLabel}]`;
  
  // data-track — явная метка для трекинга
  const trackLabel = el.dataset.track;
  if (trackLabel) return `${tag} [${trackLabel}]`;
  
  // placeholder для инпутов
  if (tag === 'input' || tag === 'textarea') {
    const placeholder = el.getAttribute('placeholder');
    const name = el.getAttribute('name');
    if (placeholder) return `${tag} "${placeholder}"`;
    if (name) return `${tag} [name=${name}]`;
    return tag;
  }
  
  // Для кнопок и ссылок — берем прямой текст (не всех потомков)
  // Это избегает захвата текста вложенных элементов типа тултипов
  let text = '';
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent?.trim() || '';
    } else if (child instanceof HTMLElement) {
      // Берём текст из span/div но не из вложенных кнопок
      const childTag = child.tagName.toLowerCase();
      if (childTag !== 'button' && childTag !== 'a' && !child.getAttribute('role')) {
        text += child.textContent?.trim() || '';
      }
    }
    if (text.length > 60) break;
  }
  text = text.substring(0, 60);
  
  if (text) return `${tag} "${text}"`;
  
  // Для иконок без текста — пробуем title, потом родителя
  const title = el.getAttribute('title');
  if (title) return `${tag} [${title}]`;
  
  if (el.parentElement) {
    const parentText = el.parentElement.textContent?.trim().substring(0, 40);
    if (parentText) return `${tag} in "${parentText}"`;
  }
  
  // Классы как последний фолбэк (первые 2 значимых класса)
  const classes = Array.from(el.classList)
    .filter(c => !c.startsWith('!') && c.length < 30)
    .slice(0, 2)
    .join('.');
  if (classes) return `${tag}.${classes}`;
  
  return tag;
}

/**
 * Проверить, является ли клик по интерактивному элементу
 */
function findInteractiveAncestor(el: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = el;
  // Поднимаемся максимум на 5 уровней
  for (let i = 0; i < 5 && current; i++) {
    const tag = current.tagName.toLowerCase();
    if (
      tag === 'button' || 
      tag === 'a' || 
      tag === 'input' || 
      tag === 'select' ||
      tag === 'textarea' ||
      current.getAttribute('role') === 'button' ||
      current.getAttribute('role') === 'menuitem' ||
      current.getAttribute('role') === 'tab' ||
      current.getAttribute('role') === 'option' ||
      current.dataset.trackClick !== undefined ||
      current.classList.contains('cursor-pointer')
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * Инициализация автоматического трекинга действий
 * Вызывается один раз. Ноль влияния на перформанс:
 * - passive listeners (не блокируют UI)
 * - никаких DOM запросов в цикле
 * - никаких сетевых запросов (данные в памяти)
 */
function initAutoTracking(): void {
  // 1. КЛИКИ — делегирование на document
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target) return;
    
    const interactive = findInteractiveAncestor(target);
    if (interactive) {
      pushAction({
        type: 'click',
        target: describeElement(interactive),
      });
    }
  }, { passive: true, capture: true });

  // 2. НАВИГАЦИЯ — отслеживаем pushState и popstate
  const originalPushState = history.pushState.bind(history);
  history.pushState = function(...args: any[]) {
    originalPushState(...args);
    pushAction({
      type: 'navigate',
      target: window.location.pathname,
      details: { method: 'pushState' },
    });
  };

  window.addEventListener('popstate', () => {
    pushAction({
      type: 'navigate',
      target: window.location.pathname,
      details: { method: 'popstate' },
    });
  }, { passive: true });

  // 3. МОДАЛКИ — MutationObserver для dialog элементов
  let knownModals = new Set<Element>();
  
  const modalObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        
        const modals = findModals(node);
        for (const modal of modals) {
          if (!knownModals.has(modal)) {
            knownModals.add(modal);
            const title = getModalTitle(modal);
            // Пропускаем dropdown/popover (маленькие, без заголовка, role=menu)
            if (isDropdownOrPopover(modal)) continue;
            pushAction({
              type: 'modal_open',
              target: title || 'dialog',
            });
          }
        }
      }
      
      for (const node of mutation.removedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        
        const modals = findModals(node);
        for (const modal of modals) {
          if (knownModals.has(modal)) {
            knownModals.delete(modal);
            if (isDropdownOrPopover(modal)) continue;
            const title = getModalTitle(modal);
            pushAction({
              type: 'modal_close',
              target: title || 'dialog',
            });
          }
        }
      }
    }
    
    // Очистка мёртвых ссылок
    if (knownModals.size > 10) {
      knownModals = new Set([...knownModals].filter(m => document.contains(m)));
    }
  });
  
  modalObserver.observe(document.body, { childList: true, subtree: false });

  // 4. КЛАВИАТУРА — значимые хоткеи
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    
    if (e.key === 'Escape') {
      pushAction({ type: 'keyboard', target: 'Escape' });
    } else if (mod && e.key === 'z') {
      pushAction({ type: 'keyboard', target: e.shiftKey ? 'Cmd+Shift+Z (Redo)' : 'Cmd+Z (Undo)' });
    } else if (mod && e.key === 'y') {
      pushAction({ type: 'keyboard', target: 'Cmd+Y (Redo)' });
    } else if (mod && e.key === 'c') {
      pushAction({ type: 'keyboard', target: 'Cmd+C (Copy)' });
    } else if (mod && e.key === 'v') {
      pushAction({ type: 'keyboard', target: 'Cmd+V (Paste)' });
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      // Только если не в текстовом поле
      const active = document.activeElement?.tagName.toLowerCase();
      if (active !== 'input' && active !== 'textarea' && !(document.activeElement as HTMLElement)?.isContentEditable) {
        pushAction({ type: 'keyboard', target: e.key });
      }
    }
  }, { passive: true });

  // 5. ФОКУС на input/textarea — трекаем какое поле юзер начал заполнять
  document.addEventListener('focusin', (e) => {
    const target = e.target as HTMLElement;
    if (!target) return;
    const tag = target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      pushAction({
        type: 'focus',
        target: describeElement(target),
      });
    }
  }, { passive: true });

  // 6. КОНТЕКСТНОЕ МЕНЮ (правый клик)
  document.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement;
    if (!target) return;
    pushAction({
      type: 'context_menu',
      target: describeElement(target),
    });
  }, { passive: true });
}

function findModals(root: HTMLElement): HTMLElement[] {
  const results: HTMLElement[] = [];
  
  // Сам элемент — модалка?
  if (isModalElement(root)) {
    results.push(root);
  }
  
  // Прямые дочерние (не рекурсивно — модалки обычно в body > div)
  if (root.children) {
    for (const child of root.children) {
      if (child instanceof HTMLElement && isModalElement(child)) {
        results.push(child);
      }
    }
  }
  
  return results;
}

function isModalElement(el: HTMLElement): boolean {
  if (el.getAttribute('role') === 'dialog' || el.getAttribute('role') === 'alertdialog') return true;
  const style = el.style;
  const computed = style.position || '';
  if (computed === 'fixed' && style.zIndex && parseInt(style.zIndex) > 100) return true;
  // Check class-based modals (fixed inset-0 z-[9999])
  if (el.classList.contains('fixed') && (el.classList.contains('inset-0') || el.className.includes('z-['))) return true;
  return false;
}

function getModalTitle(modal: Element): string {
  // Ищем h2, h3 или [role=heading] внутри модалки
  const heading = modal.querySelector('h2, h3, [role="heading"]');
  if (heading?.textContent) {
    return heading.textContent.trim().substring(0, 80);
  }
  // Ищем элемент с data-modal-title
  const titled = modal.querySelector('[data-modal-title]');
  if (titled?.textContent) {
    return titled.textContent.trim().substring(0, 80);
  }
  return '';
}

function isDropdownOrPopover(el: HTMLElement): boolean {
  // role=menu, role=listbox, role=combobox — это выпадающие списки, не модалки
  const role = el.getAttribute('role');
  if (role === 'menu' || role === 'listbox' || role === 'combobox' || role === 'tooltip') return true;
  
  // data-radix-popper — Radix UI popover/dropdown
  if (el.hasAttribute('data-radix-popper-content-wrapper')) return true;
  if (el.querySelector('[data-radix-popper-content-wrapper]')) return true;
  
  // Маленькие элементы скорее всего dropdown/tooltip
  // Модалки обычно > 200px по обоим направлениям
  const rect = el.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0 && (rect.width < 200 || rect.height < 100)) return true;
  
  return false;
}

// ==================== MAIN API ====================

/**
 * Основная функция логирования ошибки
 */
export async function logError(
  error: Error,
  context: {
    componentStack?: string;
    recentActions?: UserAction[];
    type?: string;
  } = {}
): Promise<void> {
  try {
    // Проверка на дубликаты (по message — стек может отличаться между источниками ошибки)
    if (shouldSkipDuplicate(error.message || 'Unknown error')) {
      return; // Skip logging this error
    }

    const route = window.location.pathname;
    const workspace_id = extractWorkspaceId();

    // Собираем действия: переданные вручную + авто-буфер (авто-буфер приоритетнее)
    const manualActions = context.recentActions || [];
    const autoActions = getAutoActions(30);
    // Merge: используем авто если есть, иначе manual
    const actions = autoActions.length > 0 ? autoActions : manualActions;

    const payload: ErrorLogPayload = {
      session_id: getAnonymousSessionId(),
      user_agent: navigator.userAgent,
      screen_resolution: getScreenResolution(),
      error_message: error.message || 'Unknown error',
      error_stack: error.stack,
      component_stack: context.componentStack,
      route: route,
      workspace_id: workspace_id,
      actions: actions,
      app_version: APP_VERSION,
      environment: process.env.NODE_ENV || 'production',
    };

    // Для dev: показываем что отправляется
    if (process.env.NODE_ENV === 'development') {
      console.group('🐛 Error logged to Supabase');
      console.log('Message:', error.message);
      console.log('Route:', route);
      console.log('Workspace ID:', workspace_id);
      console.log('Stack:', error.stack?.split('\n').slice(0, 3).join('\n'));
      console.log('Recent actions:', context.recentActions?.slice(-5));
      console.groupEnd();
    }

    // Отправляем в Edge Function (fire-and-forget, не блокируем UI)
    fetch(`${EDGE_FUNCTION_URL}/make-server-73d66528/log-error`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`, // ✅ Публичный ключ для Supabase Gateway
      },
      body: JSON.stringify(payload),
      // Не ждем ответа, чтобы не тормозить приложение
      keepalive: true,
    })
      .then((response) => {
        if (!response.ok) {
          console.warn('⚠️ Error log failed:', response.status);
        }
      })
      .catch((err) => {
        // Тихо проглатываем, чтобы не создавать новую ошибку
        console.warn('⚠️ Failed to log error to backend:', err);
      });
  } catch (err) {
    // Даже если логирование упало — не показываем юзеру
    console.warn('⚠️ Error tracking failed:', err);
  }
}

/**
 * Глобальная инициализация обработчиков ошибок
 * Вызывается один раз при старте приложения
 */
export function initGlobalErrorHandlers(getRecentActions: () => UserAction[]): void {
  // Автоматический трекинг действий (клики, навигация, модалки, хоткеи)
  initAutoTracking();

  // Обработчик необработанных JS ошибок
  window.addEventListener('error', (event) => {
    logError(event.error || new Error(event.message), {
      type: 'uncaught',
      recentActions: getRecentActions(),
    });
  });

  // Обработчик необработанных промисов
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason));
    
    logError(error, {
      type: 'unhandled_promise',
      recentActions: getRecentActions(),
    });
  });

  console.log('✅ Global error handlers initialized');
}