import { useState, useEffect, useRef } from "react";
import { SchedulerProvider } from "./contexts/SchedulerContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { FilterProvider } from "./contexts/FilterContext";
import { ToastProvider } from "./components/ui/ToastContext";
import { AuthScreen } from "./components/auth/AuthScreen";
import { SchedulerMain } from "./components/scheduler/SchedulerMain";
import { WorkspaceListScreen } from "./components/workspace/WorkspaceListScreen";
import { LoadingScreen } from "./components/ui/spinner";
import { PresenceProvider } from "./contexts/PresenceContext";
import { UIProvider } from "./contexts/UIContext";
import { Workspace } from "./types/scheduler";
import {
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  getStorageJSON,
  setStorageJSON,
} from "./utils/storage";
import {
  projectId,
  publicAnonKey,
} from "./utils/supabase/info";
import { checkServerHealth } from "./utils/healthCheck";
import { decodeSupabaseJWT } from "./utils/jwt";
import { Sitemap } from "./components/Sitemap";
import "./utils/debugCommands"; // Enable debug commands in console

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(
    null,
  );
  const [selectedWorkspace, setSelectedWorkspace] =
    useState<Workspace | null>(null);
  const [serverHealthy, setServerHealthy] = useState(true);

  // Check server health on mount
  useEffect(() => {
    // Устанавливаем начальный title
    if (!selectedWorkspace) {
      document.title =
        "Planaro - Управление рабочими пространствами";
    }

    checkServerHealth().then((healthy) => {
      setServerHealthy(healthy);
      if (!healthy) {
        console.warn(
          "⚠️ Проверка здоровья сервера не прошла (возможно холодный старт или сетевая ошибка). Приложение продолжит работу.",
        );
      }
    });
  }, []);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = async () => {
      const path = window.location.pathname;

      // Если вернулись на главную - сбрасываем выбранный воркспейс
      if (path === "/" || path === "") {
        setSelectedWorkspace(null);
        document.title =
          "Planaro - Управление рабочими пространствами";
        return;
      }

      // Если перешли к воркспейсу - загружаем его
      const match = path.match(/^\/workspace\/(.+)$/);
      if (match && match[1] && accessToken) {
        const workspaceId = match[1];

        // Загружаем воркспейс из API
        try {
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/workspaces/${workspaceId}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            },
          );

          if (response.ok) {
            const workspace = await response.json();
            setSelectedWorkspace(workspace);
            document.title = `${workspace.name} - Planaro`;
          } else {
            console.warn(
              "❌ Воркспейс не найден:",
              workspaceId,
            );
            // Redirect to home
            window.history.pushState(null, "", "/");
            setSelectedWorkspace(null);
            document.title =
              "Planaro - Управление рабочими пространствами";
          }
        } catch (error) {
          console.error(
            "❌ Ошибка загрузки воркспейса:",
            error,
          );
          window.history.pushState(null, "", "/");
          setSelectedWorkspace(null);
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () =>
      window.removeEventListener("popstate", handlePopState);
  }, [accessToken]);

  // Restore workspace from URL on mount (после авторизации)
  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const path = window.location.pathname;
    const match = path.match(/^\/workspace\/(.+)$/);

    // Если воркспейс уже загружен (например, через navigation) - не загружаем снова
    if (match && match[1] && !selectedWorkspace) {
      const workspaceId = match[1];

      // Загружаем воркспейс из API
      (async () => {
        try {
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/workspaces/${workspaceId}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            },
          );

          if (response.ok) {
            const workspace = await response.json();
            setSelectedWorkspace(workspace);
            document.title = `${workspace.name} - Planaro`;
          } else {
            console.warn(
              "❌ Воркспейс не найден:",
              workspaceId,
            );
            // Redirect to home
            window.history.pushState(null, "", "/");
            setSelectedWorkspace(null);
          }
        } catch (error) {
          console.error(
            "❌ Ошибка загрузки воркспейса:",
            error,
          );
          window.history.pushState(null, "", "/");
          setSelectedWorkspace(null);
        }
      })();
    }
  }, [isAuthenticated, accessToken, selectedWorkspace]);

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await getStorageItem("auth_access_token");
        const rawSessionId = await getStorageItem(
          "auth_session_id",
        );

        // Clean up session ID (remove extra quotes if present due to legacy double-serialization)
        const sessionId = rawSessionId
          ? rawSessionId.replace(/^"|"$/g, "")
          : null;

        if (rawSessionId !== sessionId) {
          console.log("🧹 Cleaned session ID:", {
            raw: rawSessionId,
            cleaned: sessionId,
          });
          // Update storage with cleaned ID
          if (sessionId)
            await setStorageItem("auth_session_id", sessionId);
        }

        if (token && sessionId) {
          // 🛡️ Проверяем срок действия токена локально перед использо��анием
          const payload = decodeSupabaseJWT(token);
          const isExpired = payload?.exp ? (payload.exp * 1000) < Date.now() : true;

          if (isExpired) {
            console.log("⚠️ Token expired locally, clearing auth");
            await removeStorageItem("auth_access_token");
            await removeStorageItem("auth_session_id");
            setIsAuthenticated(false);
            setAccessToken(null);
            setIsCheckingAuth(false);
            return;
          }

          // ✅ Сразу устанавливаем токен - не блокируем UI
          setAccessToken(token);
          setIsAuthenticated(true);
          setIsCheckingAuth(false);

          // Validate token with server в фоне
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/auth/session`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${publicAnonKey}`,
              },
              body: JSON.stringify({ session_id: sessionId }),
            },
          );

          if (response.ok) {
            const data = await response.json();

            // ✅ ИСПРАВЛЕНО: Сервер возвращает { session: { access_token, ... } }
            if (data.session && data.session.access_token) {
              setAccessToken(data.session.access_token);
              await setStorageItem(
                "auth_access_token",
                data.session.access_token,
              );
              console.log("✅ Токен валидный и обновлен");
            } else {
              console.log("⚠️ No valid session, clearing auth");
              await removeStorageItem("auth_access_token");
              await removeStorageItem("auth_session_id");
              setIsAuthenticated(false);
              setAccessToken(null);
            }
          } else {
            console.log(
              "❌ Session check failed, clearing auth",
            );
            await removeStorageItem("auth_access_token");
            await removeStorageItem("auth_session_id");
            setIsAuthenticated(false);
            setAccessToken(null);
          }
        } else {
          console.log("⚠️ No stored credentials found");
          setIsCheckingAuth(false);
        }
      } catch (error) {
        console.error("❌ Auth check failed:", error);
        await removeStorageItem("auth_access_token");
        await removeStorageItem("auth_session_id");
        setIsAuthenticated(false);
        setAccessToken(null);
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  // Periodic token refresh (check every 2 minutes)
  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const refreshInterval = setInterval(
      async () => {
        try {
          const rawSessionId = await getStorageItem(
            "auth_session_id",
          );
          const sessionId = rawSessionId
            ? rawSessionId.replace(/^"|"$/g, "")
            : null;

          if (!sessionId) {
            console.log("⚠️ No session_id for refresh");
            return;
          }

          // Check if token needs refresh (locally first to avoid unnecessary calls)
          const payload = decodeSupabaseJWT(accessToken);
          // If token expires in > 5 minutes, we might skip call, 
          // BUT checking with server ensures we are in sync and session is valid.
          // Server handles the logic of "refresh only if < 5 mins remaining".
          // So we just ping the server.
          
          // However, to reduce noise, maybe check if < 10 mins?
          // Server threshold is 5 mins.
          // Let's just call server. It's safe.
          
          // console.log("Checking token status..."); 

          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/auth/session`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${publicAnonKey}`,
              },
              body: JSON.stringify({ session_id: sessionId }),
            },
          );

          if (response.ok) {
            const data = await response.json();

            if (data.session && data.session.access_token) {
              // Only update state if token actually changed
              if (data.session.access_token !== accessToken) {
                console.log("🔄 Token refreshed by server");
                setAccessToken(data.session.access_token);
                await setStorageItem(
                  "auth_access_token",
                  data.session.access_token,
                );
              }
            } else {
               // If session is null, it means it expired or was deleted
               console.warn("⚠️ Session invalid or expired during check");
               // Don't logout immediately to avoid interrupting user?
               // But if session is gone, requests will fail anyway.
            }
          }
        } catch (error) {
          console.error("❌ Token refresh check failed:", error);
        }
      },
      2 * 60 * 1000, // Check every 2 minutes
    );

    return () => {
      clearInterval(refreshInterval);
    };
  }, [isAuthenticated, accessToken]);

  const handleAuthSuccess = async (
    token: string,
    authType: string,
    displayName?: string,
    sessionId?: string,
  ) => {
    console.log("✅ Auth Success Handler:", {
      tokenPrefix: token?.substring(0, 8),
      authType,
      hasDisplayName: !!displayName,
      sessionId,
    });

    setAccessToken(token);
    setIsAuthenticated(true);

    await setStorageItem("auth_access_token", token);

    if (sessionId) {
      await setStorageItem("auth_session_id", sessionId);
    } else {
      console.warn(
        "⚠️ No session ID provided to handleAuthSuccess, persistence may fail",
      );
    }
  };

  const handleSignOut = async () => {
    // Clear cache
    await setStorageJSON("cache_online_users_batch", null);
    await removeStorageItem("cache_workspaces_list");

    // Clear auth
    await removeStorageItem("auth_access_token");
    await removeStorageItem("auth_session_id");

    setIsAuthenticated(false);
    setAccessToken(null);
    setSelectedWorkspace(null);

    // Reset URL
    window.history.pushState(null, "", "/");
    document.title =
      "Planaro - Управление рабочими пространствами";
  };

  const handleSelectWorkspace = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);

    // Update URL
    window.history.pushState(
      null,
      "",
      `/workspace/${workspace.id}`,
    );

    // Update title
    document.title = `${workspace.name} - Planaro`;
  };

  const handleBackToWorkspaces = async () => {
    setSelectedWorkspace(null);

    // Update URL
    window.history.pushState(null, "", "/");

    // Update title
    document.title =
      "Planaro - Управление рабочими пространствами";

    // 🔒 Очистка кэша онлайн пользователей
    await setStorageJSON("cache_online_users_batch", null);

    // 🔒 Установка временной блокировки присутствия текущего пользователя (5 секунд)
    const token = await getStorageItem("auth_access_token");
    if (token) {
      try {
        const { getEmailFromToken } = await import(
          "./utils/jwt"
        );
        const email = getEmailFromToken(token);

        if (email) {
          await setStorageJSON(
            "suppress_current_user_presence",
            {
              email,
              timestamp: Date.now(),
              ttl: 5000, // 5 секунд
            },
          );
        }
      } catch (err) {
        console.warn(
          "⚠️ Ошибка установки блокировки presence:",
          err,
        );
      }
    }
  };

  const handleTokenRefresh = async (newToken: string) => {
    console.log("🔄 Обновление токена в App.tsx...");
    setAccessToken(newToken);
    await setStorageItem("auth_access_token", newToken);
  };

  // ⚠️ УБРАНО: Больше не блокируем приложение если сервер недоступен
  // Graceful degradation - приложение продолжит работать, будут только ошибки в запросах
  // (закомментирован для production - раскомментируйте для диагностики)
  /*
  if (!serverHealthy) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-yellow-50">
        <div className="text-center max-w-md p-8">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl mb-4 text-yellow-900">Сервер недоступен</h1>
          <p className="text-yellow-700 mb-6">
            Не удалось подключиться к серверу. Проверьте консоль разработчика для деталей.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
          >
            Перезагрузить страницу
          </button>
        </div>
      </div>
    );
  }
  */

  // ✅ Убран блокирующий спиннер - проверка авторизации происходит в фоне
  // Скелетон воркспейсов покажет loading состояние

  // 🔄 Показываем загрузку пока проверяем локальный токен
  // Это предотвращает мигание формы входа при обновлении страницы

  if (
    window.location.pathname === "/sitemap" ||
    window.location.pathname === "/sitemap.html"
  ) {
    return <Sitemap />;
  }

  if (isCheckingAuth) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <LoadingScreen />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  // Check if we're on a workspace URL but workspace isn't loaded yet
  const currentPath = window.location.pathname;
  const isWorkspaceUrl = currentPath.match(
    /^\/workspace\/(.+)$/,
  );

  if (isWorkspaceUrl && !selectedWorkspace) {
    // ✅ Показываем скелетон календаря вместо circular loader
    // Создаем временный воркспейс для отображения скелетона
    const tempWorkspace: Workspace = {
      id: "loading",
      name: "Загрузка...",
      timeline_year: new Date().getFullYear(),
      created_at: new Date().toISOString(),
    };

    return (
      <UIProvider>
        <SchedulerProvider
          accessToken={accessToken || undefined}
          workspaceId={tempWorkspace.id}
          timelineYear={tempWorkspace.timeline_year}
        >
          <SettingsProvider>
            <FilterProvider>
              <PresenceProvider
                workspaceId={tempWorkspace.id}
                accessToken={accessToken || undefined}
              >
                <SchedulerMain
                  workspaceId={tempWorkspace.id}
                  workspace={tempWorkspace}
                  accessToken={accessToken}
                  onBackToWorkspaces={handleBackToWorkspaces}
                  onSignOut={handleSignOut}
                  onTokenRefresh={handleTokenRefresh}
                />
              </PresenceProvider>
            </FilterProvider>
          </SettingsProvider>
        </SchedulerProvider>
      </UIProvider>
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
    <UIProvider>
      <SchedulerProvider
        accessToken={accessToken || undefined}
        workspaceId={selectedWorkspace.id}
        timelineYear={selectedWorkspace.timeline_year}
      >
        <SettingsProvider>
          <FilterProvider>
            <PresenceProvider
              workspaceId={selectedWorkspace.id}
              accessToken={accessToken || undefined}
            >
              <SchedulerMain
                workspace={selectedWorkspace}
                onBackToWorkspaces={handleBackToWorkspaces}
                accessToken={accessToken}
                onTokenRefresh={handleTokenRefresh}
                onSignOut={handleSignOut}
                onWorkspaceUpdate={setSelectedWorkspace}
              />
            </PresenceProvider>
          </FilterProvider>
        </SettingsProvider>
      </SchedulerProvider>
    </UIProvider>
  );
}

export default function App() {
  // Enforce mobile viewport settings to prevent zooming and fix orientation scaling
  useEffect(() => {
    // Standard viewport meta tag for mobile apps
    const viewportContent = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";
    
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute("name", "viewport");
      document.head.appendChild(meta);
    }
    
    // Force the settings
    meta.setAttribute("content", viewportContent);

    // Prevent pinch-zoom on iOS (Gesture events)
    const handleGestureStart = (e: Event) => {
      e.preventDefault();
    };
    
    // Prevent zoom via keyboard/trackpad (Ctrl + Wheel) on Desktop/Mac
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    // Add listeners with passive: false to ensure we can preventDefault
    document.addEventListener('gesturestart', handleGestureStart);
    document.addEventListener('wheel', handleWheel, { passive: false });

    // Prevent double-tap to zoom
    let lastTouchEnd = 0;
    const handleTouchEnd = (e: TouchEvent) => {
      const now = (new Date()).getTime();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };
    
    document.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', handleGestureStart);
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}