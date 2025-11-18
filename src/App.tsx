import { useState, useEffect, useRef } from 'react';
import { SchedulerProvider } from './contexts/SchedulerContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { FilterProvider } from './contexts/FilterContext';
import { ToastProvider } from './components/ui/ToastContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { SchedulerMain } from './components/scheduler/SchedulerMain';
import { WorkspaceListScreen } from './components/workspace/WorkspaceListScreen';
import { Workspace } from './types/scheduler';
import { getStorageItem, setStorageItem, removeStorageItem, getStorageJSON, setStorageJSON } from './utils/storage';
import { projectId, publicAnonKey } from './utils/supabase/info';
import { checkServerHealth } from './utils/healthCheck';

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [serverHealthy, setServerHealthy] = useState(true);

  // Check server health on mount
  useEffect(() => {
    // Устанавливаем начальный title
    if (!selectedWorkspace) {
      document.title = 'Planaro - Управление рабочими пространствами';
    }
    
    checkServerHealth().then(healthy => {
      setServerHealthy(healthy);
      if (!healthy) {
        console.error('⚠️ Сервер недоступен - приложение не будет работать корректно');
      }
    });
  }, []);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = async () => {
      const path = window.location.pathname;
      
      // Если вернулись на главную - сбрасываем выбранный воркспейс
      if (path === '/' || path === '') {
        setSelectedWorkspace(null);
        document.title = 'Planaro - Управление рабочими пространствами';
        return;
      }
      
      // Если перешли к воркспейсу - загружаем его
      const match = path.match(/^\/workspace\/(.+)$/);
      if (match && match[1] && accessToken) {
        const workspaceId = match[1];
        
        // Загружаем информацию о воркспейсе
        import('./services/api/workspaces').then(({ getWorkspaces }) => {
          getWorkspaces(accessToken).then(workspaces => {
            const workspace = workspaces.find(w => String(w.id) === workspaceId);
            if (workspace) {
              setSelectedWorkspace(workspace);
              document.title = `${workspace.name} - Planaro`;
            } else {
              console.warn('⚠️ Воркспейс не найден, редирект на главную');
              window.history.replaceState(null, '', '/');
              setSelectedWorkspace(null);
              document.title = 'Planaro - Управление рабочими пространствами';
            }
          }).catch(error => {
            console.error('❌ Ошибка загрузки воркспейса:', error);
            window.history.replaceState(null, '', '/');
            setSelectedWorkspace(null);
            document.title = 'Planaro - Управление рабочими пространствами';
          });
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [accessToken]);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const storedAccessToken = await getStorageItem('auth_access_token');
        const storedSessionId = await getStorageItem('auth_session_id');
        
        if (!storedAccessToken && !storedSessionId) {
          setIsAuthenticated(false);
          setAccessToken(null);
          setIsCheckingAuth(false);
          return;
        }
        
        // Check session with server (uses KV store for session persistence)
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/auth/session`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`
            },
            body: JSON.stringify({
              session_id: storedSessionId
            })
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          
          // Сервер возвращает { session: { access_token, refresh_token, user } } или { session: null }
          if (data.session?.access_token) {
            // Save access_token if changed
            if (data.session.access_token !== storedAccessToken) {
              await setStorageItem('auth_access_token', data.session.access_token);
            }
            
            setAccessToken(data.session.access_token);
            setIsAuthenticated(true);
          } else {
            await removeStorageItem('auth_access_token');
            await removeStorageItem('auth_session_id');
            setIsAuthenticated(false);
            setAccessToken(null);
          }
        } else {
          console.warn('⚠️ Север вернул ошибку при проверке сессии:', response.status);
          await removeStorageItem('auth_access_token');
          await removeStorageItem('auth_session_id');
          setIsAuthenticated(false);
          setAccessToken(null);
        }
      } catch (error) {
        console.error('❌ Ошибка при проверке сессии:', error);
        await removeStorageItem('auth_access_token').catch(() => {});
        await removeStorageItem('auth_session_id').catch(() => {});
        setIsAuthenticated(false);
        setAccessToken(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkSession();
  }, []);

  // Восстановление воркспейса из URL при загрузке страницы или после авторизации
  useEffect(() => {
    if (!isAuthenticated || isCheckingAuth || !accessToken) return;
    
    const path = window.location.pathname;
    const match = path.match(/^\/workspace\/(.+)$/);
    
    if (match && match[1]) {
      const workspaceId = match[1];
      
      // Если воркспейс уже загружен с правильным ID - ничего не делаем
      if (selectedWorkspace && String(selectedWorkspace.id) === workspaceId) {
        return;
      }
      
      // Загружаем информацию о воркспейсе
      import('./services/api/workspaces').then(({ getWorkspaces }) => {
        getWorkspaces(accessToken).then(workspaces => {
          const workspace = workspaces.find(w => String(w.id) === workspaceId);
          if (workspace) {
            setSelectedWorkspace(workspace);
            document.title = `${workspace.name} - Planaro`;
          } else {
            console.warn('⚠️ Воркспейс не найден, редирект на главную');
            window.history.replaceState(null, '', '/');
            setSelectedWorkspace(null);
            document.title = 'Planaro - Управление рабочими пространствами';
          }
        }).catch(error => {
          console.error('❌ Ошибка загрузки воркспейса:', error);
          window.history.replaceState(null, '', '/');
          setSelectedWorkspace(null);
          document.title = 'Planaro - Управление рабочими пространствами';
        });
      });
    } else if (path === '/' || path === '') {
      // URL на главной - убеждаемся что воркспейс не выбран
      if (selectedWorkspace) {
        setSelectedWorkspace(null);
        document.title = 'Planaro - Управление рабочими пространствами';
      }
    }
  }, [isAuthenticated, isCheckingAuth, accessToken, selectedWorkspace]);
  
  // Периодическая проверка сессии (каждые 10 минут)
  // Сервер автоматически обновит access_token через refresh_token, если он истек
  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const refreshInterval = setInterval(async () => {
      try {
        const storedSessionId = await getStorageItem('auth_session_id');
        
        if (!storedSessionId) {
          return;
        }
        
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/auth/session`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`
            },
            body: JSON.stringify({
              session_id: storedSessionId
            })
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.session?.access_token) {
            // Save updated access_token if changed (сервер мог обновить его через refresh_token)
            const currentToken = await getStorageItem('auth_access_token');
            if (data.session.access_token !== currentToken) {
              await setStorageItem('auth_access_token', data.session.access_token);
              setAccessToken(data.session.access_token);
            }
          } else {
            await handleSignOut();
          }
        } else {
          console.warn('⚠️ Сервер вернул ошибку при периодической проверке сессии');
        }
      } catch (error) {
        console.error('❌ Ошибка проверки сессии:', error);
      }
    }, 10 * 60 * 1000); // 10 минут

    return () => {
      clearInterval(refreshInterval);
    };
  }, [isAuthenticated, accessToken]);

  const handleAuthSuccess = async (
    token: string, 
    authType: 'signin' | 'signup', 
    displayName?: string,
    sessionId?: string
  ) => {
    await setStorageItem('auth_access_token', token);
    if (sessionId) {
      await setStorageItem('auth_session_id', sessionId);
    }
    
    setAccessToken(token);
    setIsAuthenticated(true);
    
    // При входе всегда показываем список воркспейсов
    window.history.replaceState(null, '', '/');
    document.title = 'Planaro - Управление рабочими пространствами';
  };

  const handleTokenRefresh = async (newToken: string) => {
    // Сохраняем новый токен в IndexedDB
    await setStorageItem('auth_access_token', newToken);
    
    // Обновляем state - это автоматически обновит все компоненты (включая OnlineUsers)
    setAccessToken(newToken);
  };

  const handleSignOut = async () => {
    const sessionId = await getStorageItem('auth_session_id');
    if (sessionId) {
      try {
        // Remove session from server
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/auth/signout`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`
            },
            body: JSON.stringify({ session_id: sessionId })
          }
        );
      } catch (error) {
        console.error('❌ Ошибка удаления сессии на сервере:', error);
      }
    }
    
    // Очищаем данные авторизации и кэш
    await removeStorageItem('auth_access_token');
    await removeStorageItem('auth_session_id');
    await removeStorageItem('cache_workspaces_list');
    await removeStorageItem('cache_online_users_batch');
    setAccessToken(null);
    setIsAuthenticated(false);
    setSelectedWorkspace(null);
    
    // Сбрасываем URL на главную
    window.history.replaceState(null, '', '/');
    document.title = 'Planaro - Управление рабочими пространствами';
  };

  const handleBackToWorkspaces = async () => {
    // Мгновенно очищаем текущего пользователя из presence кэша
    // Это предотвращает "мигание" аватарки при возврате из календаря
    try {
      const { getEmailFromToken } = await import('./utils/jwt');
      const currentUserEmail = accessToken ? getEmailFromToken(accessToken) : null;
      
      if (currentUserEmail) {
        const cachedData = await getStorageJSON('cache_online_users_batch');
        
        if (cachedData?.data) {
          // Удаляем текущего пользователя из всех воркспейсов в кэше
          const updatedData: Record<string, any[]> = {};
          
          for (const [workspaceId, users] of Object.entries(cachedData.data)) {
            updatedData[workspaceId] = (users as any[]).filter(
              (user: any) => user.email !== currentUserEmail
            );
          }
          
          // Сохраняем обновлённый кэш с тем же timestamp
          await setStorageJSON('cache_online_users_batch', {
            data: updatedData,
            timestamp: cachedData.timestamp
          });
        }
        
        // 🔒 Устанавливаем временную блокировку для предотвращения "мигания"
        // Если batch запрос выполнится ДО того как leave дошёл до сервера,
        // WorkspaceListScreen будет фильтровать текущего пользователя в течение 5 секунд
        await setStorageJSON('suppress_current_user_presence', {
          email: currentUserEmail,
          timestamp: Date.now(),
          ttl: 5000 // 5 секунд
        });
      }
    } catch (error) {
      console.warn('⚠️ Ошибка очистки presence кэша:', error);
      // Не критично - кэш обновится через batch запрос
    }
    
    setSelectedWorkspace(null);
    window.history.pushState(null, '', '/');
    document.title = 'Planaro - Управление рабочими пространствами';
  };

  const handleSelectWorkspace = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    window.history.pushState({ workspaceId: workspace.id }, '', `/workspace/${workspace.id}`);
    document.title = `${workspace.name} - Planaro`;
  };

  if (!serverHealthy) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-red-50">
        <div className="max-w-2xl p-8 bg-white rounded-lg shadow-lg border border-red-200">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg className="w-12 h-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-xl text-red-900 mb-3">Сервер недоступен</h1>
              <p className="text-red-700 mb-4">
                Не удается подключиться к Supabase Edge Function. Приложение не может работать без сервера.
              </p>
              <div className="bg-red-100 border border-red-200 rounded p-4 mb-4">
                <p className="font-medium text-red-900 mb-2">Что нужно сделать:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-red-800">
                  <li>Разверните Edge Function на Supabase:<br/>
                    <code className="bg-red-200 px-2 py-1 rounded text-xs mt-1 inline-block">
                      supabase functions deploy make-server-73d66528
                    </code>
                  </li>
                  <li>Проверьте настройки в Supabase Dashboard (Settings → API)</li>
                  <li>Проверьте логи Edge Function в Dashboard</li>
                </ol>
              </div>
              <p className="text-sm text-red-600">
                <strong>Project ID:</strong> {projectId}<br/>
                <strong>URL:</strong> https://{projectId}.supabase.co/functions/v1/make-server-73d66528/health
              </p>
              <div className="mt-4 pt-4 border-t border-red-200">
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Проверить снова
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isCheckingAuth) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Проверка авторизации...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />; 
  }

  // Check if we're on a workspace URL but workspace isn't loaded yet
  const currentPath = window.location.pathname;
  const isWorkspaceUrl = currentPath.match(/^\/workspace\/(.+)$/);
  
  if (isWorkspaceUrl && !selectedWorkspace) {
    // Show loading spinner while workspace is being restored from URL
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка рабочего пространства...</p>
        </div>
      </div>
    );
  }

  // Show workspace list if no workspace is selected
  if (!selectedWorkspace) {
    return (
      <WorkspaceListScreen 
        onSelectWorkspace={handleSelectWorkspace}
        onSignOut={handleSignOut}
        onTokenRefresh={handleTokenRefresh}
        accessToken={accessToken}
      />
    );
  }

  // Show scheduler for selected workspace
  return (
    <SchedulerProvider accessToken={accessToken || undefined} workspaceId={selectedWorkspace.id}>
      <FilterProvider workspaceId={selectedWorkspace.id}>
        <SchedulerMain 
          accessToken={accessToken} 
          workspace={selectedWorkspace}
          onSignOut={handleSignOut}
          onBackToWorkspaces={handleBackToWorkspaces}
        />
      </FilterProvider>
    </SchedulerProvider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <SettingsProvider>
        <AppContent />
      </SettingsProvider>
    </ToastProvider>
  );
}