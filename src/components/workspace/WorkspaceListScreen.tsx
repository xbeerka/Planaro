import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";
import {
  Workspace,
  WorkspaceSummary,
} from "../../types/scheduler";
import {
  getWorkspaces,
  getWorkspaceSummary,
  deleteWorkspace,
} from "../../services/api/workspaces";
import {
  Plus,
  Calendar,
  Users,
  LogOut,
  ChevronDown,
  MoreVertical,
  Pencil,
  Trash2,
  Folder,
  Layers,
  User,
} from "lucide-react";
import { CreateWorkspaceModal } from "./CreateWorkspaceModal";
import { EditWorkspaceModal } from "./EditWorkspaceModal";
import { WorkspaceManagementWrapper } from "./WorkspaceManagementWrapper";
import { UnifiedManagementWrapper } from "./UnifiedManagementWrapper";
import {
  getStorageJSON,
  setStorageJSON,
} from "../../utils/storage";
import {
  decodeSupabaseJWT,
  getDisplayNameFromToken,
  getEmailFromToken,
} from "../../utils/jwt";
import { toast } from "sonner@2.0.3";
import { WorkspaceUsers } from "./WorkspaceUsers";
import { presenceApi } from "../../services/api/presence";
import { ProfileModal } from "../auth/ProfileModal";
import { throttledRequest } from "../../utils/requestThrottle";
import { LoadingScreen } from "../ui/spinner";
import { WorkspaceCardSkeleton } from "./WorkspaceCardSkeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { projectId } from "../../utils/supabase/info";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "../ui/card";
import { Badge } from "../ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../ui/avatar";

// Онлайн пользователь (из presence системы)
interface OnlineUser {
  userId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  lastSeen: string;
}

interface WorkspaceWithSummary extends Workspace {
  summary?: WorkspaceSummary | null;
  onlineUsers?: OnlineUser[];
}

interface WorkspaceListScreenProps {
  onSelectWorkspace: (workspace: Workspace) => void;
  onSignOut: () => void;
  onTokenRefresh: (newToken: string) => Promise<void>;
  accessToken?: string | null;
}

import Planaro from "../../imports/Planaro-824-597";

export function WorkspaceListScreen({
  onSelectWorkspace,
  onSignOut,
  onTokenRefresh,
  accessToken,
}: WorkspaceListScreenProps) {
  const [workspaces, setWorkspaces] = useState<
    WorkspaceWithSummary[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWorkspace, setEditingWorkspace] =
    useState<Workspace | null>(null);
  const [managingWorkspace, setManagingWorkspace] =
    useState<Workspace | null>(null);

  const [onlineUsersMap, setOnlineUsersMap] = useState<
    Map<string, OnlineUser[]>
  >(new Map());
  const [showProfileModal, setShowProfileModal] =
    useState(false);

  // Извлекаем данные текущего пользователя из accessToken (мемоизировано)
  const currentUserEmail = useMemo(() => {
    if (!accessToken) {
      return undefined;
    }
    const email = getEmailFromToken(accessToken);
    return email;
  }, [accessToken]);

  const currentUserDisplayName = useMemo(() => {
    if (!accessToken) return undefined;
    return getDisplayNameFromToken(accessToken);
  }, [accessToken]);

  const currentUserAvatarUrl = useMemo(() => {
    if (!accessToken) return undefined;
    const payload = decodeSupabaseJWT(accessToken);
    const avatarUrl = payload?.user_metadata?.avatar_url as
      | string
      | undefined;
    return avatarUrl;
  }, [accessToken]);

  // Получаем инициалы из displayName или email
  const getUserInitials = (
    displayName?: string,
    email?: string,
  ) => {
    if (displayName) {
      const parts = displayName.trim().split(" ");
      if (parts.length >= 2) {
        return (
          parts[0][0] + parts[parts.length - 1][0]
        ).toUpperCase();
      }
      return displayName.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  useEffect(() => {
    if (accessToken) {
      loadWorkspaces();
    }
  }, [accessToken]);

  // Fetch online users for all workspaces - используем батч-запрос для оптимизации + кэширование
  useEffect(() => {
    if (!accessToken || workspaces.length === 0) {
      return;
    }

    const CACHE_KEY = "cache_online_users_batch";
    const CACHE_TTL_MS = 45000; // 45 секунд TTL

    // Загрузить из кэша
    const loadCachedOnlineUsers = async () => {
      try {
        const cached = await getStorageJSON<{
          data: Record<string, OnlineUser[]>;
          timestamp: number;
        }>(CACHE_KEY);

        if (cached && cached.data && cached.timestamp) {
          const age = Date.now() - cached.timestamp;
          if (age < CACHE_TTL_MS) {
            let cachedData = cached.data;

            // 🔒 Проверяем блокировку текущего пользователя при загрузке из кэша
            try {
              const suppressData = await getStorageJSON<{
                email: string;
                timestamp: number;
                ttl: number;
              }>("suppress_current_user_presence");

              if (
                suppressData &&
                suppressData.email &&
                suppressData.timestamp
              ) {
                const suppressAge =
                  Date.now() - suppressData.timestamp;

                if (suppressAge < suppressData.ttl) {
                  // Фильтруем текущего пользователя из кэша
                  const filteredData: Record<
                    string,
                    OnlineUser[]
                  > = {};
                  Object.entries(cachedData).forEach(
                    ([workspaceId, users]) => {
                      filteredData[workspaceId] = users.filter(
                        (u) => u.email !== suppressData.email,
                      );
                    },
                  );

                  cachedData = filteredData;
                }
              }
            } catch (err) {
              console.warn(
                "⚠️ Кэш: ошибка проверки блокировки:",
                err,
              );
            }

            const newMap = new Map<string, OnlineUser[]>();
            Object.entries(cachedData).forEach(
              ([workspaceId, users]) => {
                newMap.set(workspaceId, users);
              },
            );
            setOnlineUsersMap(newMap);
            return true; // Кэш валиден
          }
        }
      } catch (err) {
        console.warn(
          "⚠️ Ошибка чтения кэша онлайн пользователей:",
          err,
        );
      }
      return false; // Кэш невалиден
    };

    const fetchOnlineUsersForWorkspaces = async () => {
      try {
        const workspaceIds = workspaces.map((w) => w.id);

        // 🛡️ Throttled request - защита от перегрузки
        let workspacesData = await throttledRequest(
          "presence-batch-all-workspaces",
          async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(
              () => controller.abort(),
              10000,
            ); // 10 second timeout

            // Один батч-запрос вместо N запросов - оптимизация для снижения DDOS базы
            const result =
              await presenceApi.getOnlineUsersBatch(
                workspaceIds,
              );
            clearTimeout(timeoutId);
            return result;
          },
        );

        if (!workspacesData) {
          console.warn("⚠️ Batch запрос: пропущен (throttle)");
          return;
        }

        // 🔒 Проверяем блокировку текущего пользователя (предотвращение "мигания")
        try {
          const suppressData = await getStorageJSON<{
            email: string;
            timestamp: number;
            ttl: number;
          }>("suppress_current_user_presence");

          if (
            suppressData &&
            suppressData.email &&
            suppressData.timestamp
          ) {
            const age = Date.now() - suppressData.timestamp;

            if (age < suppressData.ttl) {
              // Фильтруем текущего пользователя из ВСЕХ воркспейсов
              const filteredData: Record<string, OnlineUser[]> =
                {};
              Object.entries(workspacesData || {}).forEach(
                ([workspaceId, users]) => {
                  const userArray = users as OnlineUser[];
                  filteredData[workspaceId] = userArray.filter(
                    (u) => u.email !== suppressData.email,
                  );
                },
              );

              workspacesData = filteredData;
            }
          }
        } catch (err) {
          console.warn(
            "⚠️ Ошибка проверки блокировки presence:",
            err,
          );
        }

        // Преобразуем объект { workspace_id: users[] } в Map
        const newMap = new Map<string, OnlineUser[]>();
        Object.entries(workspacesData || {}).forEach(
          ([workspaceId, users]) => {
            const userArray = users as OnlineUser[];
            newMap.set(workspaceId, userArray);
          },
        );

        setOnlineUsersMap(newMap);

        // Сохранить в кэш (уже отфильтрованные данные)
        await setStorageJSON(CACHE_KEY, {
          data: workspacesData || {},
          timestamp: Date.now(),
        });
      } catch (error: any) {
        // Gracefully handle errors
        if (error.name === "AbortError") {
          console.warn("⚠️ Batch запрос: таймаут (10 секунд)");
        } else if (error.message?.includes("Failed to fetch")) {
          console.warn("⚠️ Batch запрос: сетевая ошибка");
        } else {
          console.warn(
            "⚠️ Batch запрос: ошибка загрузки",
            error.message || error,
          );
        }
      }
    };

    // Сначала попробовать загрузить из кэша
    loadCachedOnlineUsers().then((cacheValid) => {
      // Всегда делаем запрос в фоне для обновления
      fetchOnlineUsersForWorkspaces();
    });

    // Периодическое обновление каждые 15 секунд (вместо 10)
    const intervalId = setInterval(
      fetchOnlineUsersForWorkspaces,
      15000,
    );

    return () => {
      clearInterval(intervalId);
    };
  }, [accessToken, workspaces]);

  const loadWorkspaces = async () => {
    try {
      // Load from cache first
      const cacheKey = "cache_workspaces_list";
      const cachedData =
        await getStorageJSON<WorkspaceWithSummary[]>(cacheKey);

      if (cachedData) {
        setWorkspaces(cachedData);
        setIsLoading(false);
      }

      // Load fresh data in background
      const data = await getWorkspaces();

      // Load summaries for each workspace
      const workspacesWithSummaries = await Promise.all(
        data.map(async (workspace) => {
          try {
            const summary = await getWorkspaceSummary(
              workspace.id,
            );
            return { ...workspace, summary };
          } catch (err) {
            console.warn(
              `Failed to load summary for workspace ${workspace.id}:`,
              err,
            );
            return { ...workspace, summary: null };
          }
        }),
      );

      setWorkspaces(workspacesWithSummaries);

      // Update cache
      await setStorageJSON(cacheKey, workspacesWithSummaries);
    } catch (error) {
      console.error("Failed to load workspaces:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWorkspace = async (workspaceId: string) => {
    if (
      !confirm(
        "Вы уверены, что хотите удалить это рабочее пространство?",
      )
    ) {
      return;
    }

    // Оптимистичное удаление
    const workspaceToDelete = workspaces.find(
      (w) => w.id === workspaceId,
    );
    if (!workspaceToDelete) return;

    setWorkspaces((prev) =>
      prev.filter((w) => w.id !== workspaceId),
    );

    try {
      await deleteWorkspace(workspaceId);
      toast.success("Удалено", {
        description: `Рабочее пространство "${workspaceToDelete.name}" удалено`,
      });
    } catch (error) {
      console.error("Failed to delete workspace:", error);
      toast.error("Ошибка", {
        description: "Не удалось удалить рабочее пространство",
      });

      // Откат оптимистичного удаления
      setWorkspaces((prev) => [...prev, workspaceToDelete]);
    }
  };

  const handleOpenSettings = (workspace: Workspace) => {
    setManagingWorkspace(workspace); // Грейды/Компании
  };

  const handleOpenManagement = (workspace: Workspace) => {
    setEditingWorkspace(workspace); // Сотрудники/Департаменты/Проекты
  };

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffHours < 24) {
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "только что";
      if (diffMins < 60) return `${diffMins} мин. назад`;
      if (diffHours === 1) return "1 час назад";
      return `${diffHours} часа назад`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()
    ) {
      return "вчера";
    }

    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const wasUpdated = (workspace: WorkspaceWithSummary) => {
    if (workspace.summary?.last_updated) {
      const created = new Date(workspace.created_at).getTime();
      const lastUpdated = new Date(
        workspace.summary.last_updated,
      ).getTime();
      if (Math.abs(lastUpdated - created) > 1000) {
        return true;
      }
    }
    return false;
  };

  // Show skeleton layout while loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        {/* Header Skeleton */}
        <div className="p-2">
          <div className="max-w-[1800px] mx-auto">
            <div className="h-14 relative rounded-[16px] w-full flex items-center px-4 animate-pulse">
              <div className="absolute border border-[#f0f0f0] border-solid inset-0 pointer-events-none rounded-[16px]" />
              <div className="flex items-center justify-between w-full relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-[10px] bg-gray-200" />
                  <div className="h-5 w-20 bg-gray-200 rounded" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-40 bg-gray-200 rounded-[12px]" />
                  <div className="w-8 h-8 rounded-full bg-gray-200" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Skeleton */}
        <main className="max-w-[1800px] mx-auto px-6 py-12">
          <div className="mb-12 animate-pulse">
            <div className="h-9 w-80 bg-gray-200 rounded mb-3" />
            <div className="h-5 w-96 bg-gray-200 rounded" />
          </div>

          {/* Skeleton Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <WorkspaceCardSkeleton key={i} />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header - точная копия стиля календаря */}
      <div className="p-2">
        <div className="max-w-[1800px] mx-auto">
          <div className="h-14 relative rounded-[16px] w-full flex items-center px-[24px] pt-[0px] pr-[16px] pb-[0px] pl-[24px] py-[0px]">
            <div className="absolute border border-[#f0f0f0] border-solid inset-0 pointer-events-none rounded-[16px]" />

            <div className="flex items-center justify-between w-full relative z-10">
              <div className="flex items-center gap-3">
                {/* Logo */}
                <div className="h-4 w-auto aspect-[987/143]">
                  <Planaro />
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* User Avatar with Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="relative focus:outline-none flex items-center justify-center">
                      <Avatar className="!w-7 !h-7 cursor-pointer hover:opacity-80 transition-opacity rounded-[10px]">
                        {currentUserAvatarUrl && (
                          <AvatarImage
                            src={currentUserAvatarUrl}
                            alt={currentUserDisplayName || "User"}
                          />
                        )}
                        <AvatarFallback 
                          className="bg-[#f6f6f6] text-[#868789] text-[10px] font-medium rounded-[10px]"
                        >
                          {getUserInitials(
                            currentUserDisplayName,
                            currentUserEmail,
                          )}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="end"
                    className="w-64 rounded-[12px] p-2 border-[#f0f0f0]"
                  >
                    <div className="flex items-center gap-3 p-3 bg-[#f6f6f6] rounded-[10px] mb-2">
                      <Avatar className="w-10 h-10 rounded-[10px]">
                        {currentUserAvatarUrl && (
                          <AvatarImage
                            src={currentUserAvatarUrl}
                            alt={currentUserDisplayName || "User"}
                          />
                        )}
                        <AvatarFallback className="bg-[#f6f6f6] text-[#868789] text-sm font-medium rounded-[10px]">
                          {getUserInitials(
                            currentUserDisplayName,
                            currentUserEmail,
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col flex-1 min-w-0">
                        {currentUserDisplayName && (
                          <p className="font-medium truncate text-sm">
                            {currentUserDisplayName}
                          </p>
                        )}
                        {currentUserEmail && (
                          <p className="truncate text-xs text-muted-foreground">
                            {currentUserEmail}
                          </p>
                        )}
                      </div>
                    </div>

                    <DropdownMenuItem
                      onClick={() => setShowProfileModal(true)}
                      className="cursor-pointer rounded-[8px] py-2"
                    >
                      <User className="w-4 h-4 mr-2 opacity-70" />
                      Профиль
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="my-1" />

                    <DropdownMenuItem
                      onClick={onSignOut}
                      className="text-red-600 cursor-pointer focus:text-red-600 focus:bg-red-50 rounded-[8px] py-2"
                    >
                      <LogOut className="w-4 h-4 mr-2 opacity-70" />
                      Выйти
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-6 py-8">
        {/* Page Title */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight mb-2 text-black">
              {workspaces.length === 0
                ? "Начните с создания пространства"
                : "Мои пространства"}
            </h2>
            <p className="text-sm text-[#868789]">
              {workspaces.length === 0
                ? "Создайте рабочее пространство для управления проектами и командой"
                : `${workspaces.length} ${((n) => {
                    const forms = ["активное пространство", "активных пространства", "активных пространств"];
                    return forms[(n % 100 > 4 && n % 100 < 20) ? 2 : [2, 0, 1, 1, 1, 2][(n % 10 < 5) ? n % 10 : 5]];
                  })(workspaces.length)}`}
            </p>
          </div>

          {/* Create Button */}
          <div
            onClick={() => setShowCreateModal(true)}
            className="box-border content-stretch flex gap-[6px] items-center justify-center px-[12px] py-[8px] relative rounded-[12px] shrink-0 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]" />
            <Plus className="w-[16px] h-[16px] relative z-10" />
            <p className="font-medium leading-[20px] relative z-10 shrink-0 text-[12px] text-black text-nowrap whitespace-pre">
              Создать
            </p>
          </div>
        </div>

        {/* Workspaces Grid */}
        {workspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <h3 className="text-2xl font-medium mb-3 text-black">
              Пусто
            </h3>
            <p className="text-muted-foreground max-w-md text-base">
              Создайте рабочее пространство для управления проектами и командой
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {workspaces.map((workspace) => {
              const workspaceIdStr = String(workspace.id);
              const users =
                onlineUsersMap.get(workspaceIdStr) || [];

              return (
                <div
                  key={workspace.id}
                  className="group relative cursor-pointer"
                  onClick={() => onSelectWorkspace(workspace)}
                >
                  {/* Карточка в стиле календаря */}
                  <div className="relative rounded-[16px] overflow-hidden bg-white">
                    <div className="absolute border border-[#f0f0f0] border-solid inset-0 pointer-events-none rounded-[16px] group-hover:border-[#0062FF] transition-colors" />

                    <div className="p-4 relative z-10">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-medium text-black truncate mb-2">
                            {workspace.name}
                          </h3>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f6f6f6] text-[#868789]">
                            {workspace.timeline_year}
                          </span>
                        </div>

                        {/* Menu Button */}
                        <div
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="box-border flex items-center justify-center p-[6px] relative rounded-[8px] shrink-0 cursor-pointer hover:bg-gray-50 transition-colors focus:outline-none">
                                <div className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[8px]" />
                                <MoreVertical className="w-3.5 h-3.5 text-[#868789] relative z-10" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48 rounded-xl"
                            >
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenSettings(
                                    workspace,
                                  );
                                }}
                                className="py-2.5 cursor-pointer"
                              >
                                Настройки
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenManagement(
                                    workspace,
                                  );
                                }}
                                className="py-2.5 cursor-pointer"
                              >
                                Управление
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteWorkspace(
                                    workspace.id,
                                  );
                                }}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50 py-2.5 cursor-pointer"
                              >
                                Удалить
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      {(() => {
                        const plural = (n: number, forms: string[]) => 
                          forms[(n % 100 > 4 && n % 100 < 20) ? 2 : [2, 0, 1, 1, 1, 2][(n % 10 < 5) ? n % 10 : 5]];
                        
                        const projectCount = workspace.summary?.project_count ?? (workspace.summary as any)?.projects_count ?? 0;
                        const peopleCount = workspace.summary?.visible_count ?? workspace.summary?.member_count ?? 0;
                        const hiddenCount = workspace.summary?.hidden_count ?? 0;
                        const deptCount = workspace.summary?.department_count ?? 0;

                        return (
                          <div className="grid grid-cols-3 gap-2 mb-4">
                            <div className="text-center p-3 bg-[#f6f6f6] rounded-[10px]">
                              <div className="text-xl font-semibold text-black mb-0.5">
                                {projectCount}
                              </div>
                              <div className="text-[9px] uppercase tracking-wider text-[#868789] font-medium">
                                {plural(projectCount, ['проект', 'проекта', 'проектов'])}
                              </div>
                            </div>
                            <div className="text-center p-3 bg-[#f6f6f6] rounded-[10px]">
                              <div className="text-xl font-semibold text-black mb-0.5">
                                {peopleCount}
                              </div>
                              <div className="text-[9px] uppercase tracking-wider text-[#868789] font-medium">
                                {plural(peopleCount, ['человек', 'человека', 'человек'])}
                                {hiddenCount > 0 && (
                                  <> ({hiddenCount} {plural(hiddenCount, ['скрыт', 'скрыто', 'скрыто'])})</>
                                )}
                              </div>
                            </div>
                            <div className="text-center p-3 bg-[#f6f6f6] rounded-[10px]">
                              <div className="text-xl font-semibold text-black mb-0.5">
                                {deptCount}
                              </div>
                              <div className="text-[9px] uppercase tracking-wider text-[#868789] font-medium">
                                {plural(deptCount, ['отдел', 'отдела', 'отделов'])}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-[#f0f0f0] h-[40px]">
                        <span className="text-[10px] text-[#868789] font-medium">
                          {wasUpdated(workspace)
                            ? `Изменено ${formatRelativeDate(workspace.summary!.last_updated!)}`
                            : `Создано ${formatRelativeDate(workspace.created_at)}`}
                        </span>
                        <WorkspaceUsers
                          users={users}
                          currentUserEmail={currentUserEmail}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreateModal && (
        <CreateWorkspaceModal
          existingWorkspaces={workspaces}
          onClose={() => setShowCreateModal(false)}
          onCreate={loadWorkspaces}
        />
      )}

      {managingWorkspace && (
        <WorkspaceManagementWrapper
          workspace={managingWorkspace}
          onClose={() => setManagingWorkspace(null)}
        />
      )}

      {editingWorkspace && (
        <UnifiedManagementWrapper
          workspace={editingWorkspace}
          onClose={() => setEditingWorkspace(null)}
          accessToken={accessToken}
        />
      )}

      {showProfileModal && (
        <ProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          accessToken={accessToken}
          currentEmail={currentUserEmail}
          currentDisplayName={currentUserDisplayName}
          currentAvatarUrl={currentUserAvatarUrl}
          onTokenRefresh={onTokenRefresh}
          onProfileUpdated={() => {
            // Optional: reload logic is handled in ProfileModal
          }}
        />
      )}
    </div>
  );
}