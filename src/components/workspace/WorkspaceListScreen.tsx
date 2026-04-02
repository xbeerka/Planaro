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
  createWorkspace,
} from "../../services/api/workspaces";
import { Plus, ChevronDown, Globe, Users, Settings, LogOut, Trash2, Search, X, Check, Crown, Shield, UserMinus, Bell, MoreVertical, User, Loader2 } from "lucide-react";
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
import { ProfileModal } from "../auth/ProfileModal";
import { NotificationCenter } from "../notifications/NotificationCenter";
import { useWorkspacesPresence } from "../../hooks/useWorkspacesPresence";
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

import { useRealtimeWorkspaces } from "../../hooks/useRealtimeWorkspaces";
import { ShareWorkspaceModal } from "./ShareWorkspaceModal";
import { OrganizationMembersModal } from "./OrganizationMembersModal";
import { organizationMembersApi } from "../../services/api/organizationMembers";
import { getEffectiveRole } from "../../utils/workspaceRole";

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
  // Source metadata from backend
  _source?: 'organization' | 'owned' | 'shared';
  _org_id?: number;
  _org_name?: string;
  _org_role?: string; // 'owner' | 'admin' | 'member'
  _ws_role?: string;  // 'owner' | 'editor' | 'viewer'
  _is_creator?: boolean;
  _shared_count?: number;
}

interface WorkspaceSection {
  id: string;
  title: string;
  subtitle: string;
  type: 'my_org' | 'other_org' | 'shared' | 'owned';
  orgId?: number;
  orgName?: string;
  orgRole?: string;
  canCreate: boolean;
  canManageMembers: boolean;
  workspaces: WorkspaceWithSummary[];
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
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForOrgId, setCreateForOrgId] = useState<number | null>(null);
  const [editingWorkspace, setEditingWorkspace] =
    useState<Workspace | null>(null);
  const [managingWorkspace, setManagingWorkspace] =
    useState<Workspace | null>(null);
  const [sharingWorkspace, setSharingWorkspace] =
    useState<Workspace | null>(null);

  // Realtime Presence для всех воркспейсов (вместо KV Store polling)
  const workspaceIdsForPresence = useMemo(
    () => workspaces.map((w) => String(w.id)),
    [workspaces],
  );
  const onlineUsersMap = useWorkspacesPresence(workspaceIdsForPresence, accessToken);
  const [showProfileModal, setShowProfileModal] =
    useState(false);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgMemberCount, setOrgMemberCount] = useState<number | null>(null);
  const [myOrgInfo, setMyOrgInfo] = useState<{ id: number | string; name: string } | null>(null);
  // For org members modal opened from a specific section (not necessarily my org)
  const [orgModalTarget, setOrgModalTarget] = useState<{ orgId: number | string; orgName?: string } | null>(null);

  // Rename org modal
  const [renameOrgTarget, setRenameOrgTarget] = useState<{ orgId: number | string; currentName: string } | null>(null);
  
  // Флаг: идёт создание воркспейса (кнопка «Создать» заблокирована)
  const [isCreating, setIsCreating] = useState(false);

  // 📡 Realtime для воркспейсов
  const lastWorkspacesChangeRef = useRef<number>(0);
  
  // Compute known org IDs — ONLY orgs where user is an actual member (_source === 'organization')
  // NOT from shared workspaces — otherwise User B sees ALL workspaces from User A's org
  const knownOrgIds = useMemo(() => {
    const ids = new Set<string>();
    for (const w of workspaces) {
      const ws = w as any;
      // Only include orgs where user has org-level membership
      if (ws._source === 'organization' && ws._org_id) {
        ids.add(String(ws._org_id));
      }
    }
    if (myOrgInfo?.id) ids.add(String(myOrgInfo.id));
    return ids;
  }, [workspaces, myOrgInfo]);
  
  const orgMetadata = useMemo(() => {
    const meta = new Map<string, { orgName?: string; orgRole?: string }>();
    for (const w of workspaces) {
      const ws = w as any;
      const orgId = ws._org_id ? String(ws._org_id) : ws.organization_id ? String(ws.organization_id) : null;
      if (orgId && !meta.has(orgId)) {
        meta.set(orgId, { orgName: ws._org_name, orgRole: ws._org_role });
      }
    }
    if (myOrgInfo?.id) {
      const key = String(myOrgInfo.id);
      if (!meta.has(key)) {
        meta.set(key, { orgName: myOrgInfo.name, orgRole: 'owner' });
      }
    }
    return meta;
  }, [workspaces, myOrgInfo]);
  
  useRealtimeWorkspaces({
    enabled: !!accessToken,
    accessToken,
    setWorkspaces: setWorkspaces as any, // WorkspaceWithSummary extends Workspace
    lastLocalChangeRef: lastWorkspacesChangeRef,
    knownOrgIds,
    orgMetadata,
  });

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

  // 📊 Группировка воркспейсов по секциям
  const sections: WorkspaceSection[] = useMemo(() => {
    const plural = (n: number, forms: string[]) =>
      forms[(n % 100 > 4 && n % 100 < 20) ? 2 : [2, 0, 1, 1, 1, 2][(n % 10 < 5) ? n % 10 : 5]];

    const myOrgId = myOrgInfo ? String(myOrgInfo.id) : null;
    const result: WorkspaceSection[] = [];

    // Group org workspaces by org_id
    const orgGroups = new Map<string, WorkspaceWithSummary[]>();
    const ownedNoOrg: WorkspaceWithSummary[] = [];
    const sharedDirect: WorkspaceWithSummary[] = [];

    for (const w of workspaces) {
      if (w._source === 'organization' && w._org_id) {
        const key = String(w._org_id);
        if (!orgGroups.has(key)) orgGroups.set(key, []);
        orgGroups.get(key)!.push(w);
      } else if (w._source === 'shared') {
        sharedDirect.push(w);
      } else {
        // 'owned' or no _source (legacy/cached data)
        ownedNoOrg.push(w);
      }
    }

    // 1. ALWAYS create "Мо пространства" first (even if empty)
    // Find my org (where I'm owner)
    let myOrgId_found: string | null = null;
    let myOrgWorkspaces: WorkspaceWithSummary[] = [];
    
    for (const [orgId, ws] of orgGroups) {
      const first = ws[0];
      const orgRole = first?._org_role || 'member';
      if (orgRole === 'owner') {
        myOrgId_found = orgId;
        myOrgWorkspaces = ws;
        break;
      }
    }

    // Merge legacy owned (no org) into my workspaces
    const allMyWorkspaces = [...myOrgWorkspaces, ...ownedNoOrg];
    
    result.push({
      id: myOrgId_found ? `org_${myOrgId_found}` : 'owned',
      title: 'Мои пространства',
      subtitle: allMyWorkspaces.length === 0
        ? 'Нет пространств'
        : `${allMyWorkspaces.length} ${plural(allMyWorkspaces.length, ['пространство', 'пространства', 'пространств'])}`,
      type: myOrgId_found ? 'my_org' : 'owned',
      orgId: myOrgId_found ? Number(myOrgId_found) : (myOrgInfo ? Number(myOrgInfo.id) : undefined),
      orgName: myOrgWorkspaces[0]?._org_name || myOrgInfo?.name,
      orgRole: 'owner',
      canCreate: true,
      canManageMembers: !!(myOrgId_found || myOrgInfo),
      workspaces: allMyWorkspaces,
    });

    // Remove my org from the map so we don't process it again
    if (myOrgId_found) orgGroups.delete(myOrgId_found);

    // 2. Other orgs (shared with me)
    for (const [orgId, ws] of orgGroups) {
      const first = ws[0];
      const orgRole = first?._org_role || 'member';
      const canEdit = orgRole === 'owner' || orgRole === 'admin' || orgRole === 'editor';
      result.push({
        id: `org_${orgId}`,
        title: first?._org_name || 'Организаия',
        subtitle: `${ws.length} ${plural(ws.length, ['пространство', 'пространства', 'пространств'])}`,
        type: 'other_org',
        orgId: Number(orgId),
        orgName: first?._org_name || 'Организация',
        orgRole,
        canCreate: canEdit,
        canManageMembers: true,
        workspaces: ws,
      });
    }

    // 3. Directly shared workspaces
    if (sharedDirect.length > 0) {
      result.push({
        id: 'shared',
        title: 'Доступные пространства',
        subtitle: `${sharedDirect.length} ${plural(sharedDirect.length, ['пространство', 'пространства', 'пространств'])}`,
        type: 'shared',
        canCreate: false,
        canManageMembers: false,
        workspaces: sharedDirect,
      });
    }

    // Legacy fallback: if no sections created and there are workspaces with no _source
    if (result.length === 1 && result[0].workspaces.length === 0 && workspaces.length > 0) {
      result[0].workspaces = workspaces;
      result[0].subtitle = `${workspaces.length} ${plural(workspaces.length, ['пространство', 'пространства', 'пространств'])}`;
    }

    return result;
  }, [workspaces, myOrgInfo]);

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

  // 🏢 Загрузка информации об организации и количества участников
  const orgLoadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!accessToken) return;
    
    // Strategy: first check if workspace data gives us the org (fastest path)
    // Then fall back to getMyOrganization API call
    
    // Find my org from workspace _org_role === 'owner'
    let myOrgIdFromWorkspaces: string | null = null;
    for (const w of workspaces) {
      if (w._source === 'organization' && w._org_id && w._org_role === 'owner') {
        myOrgIdFromWorkspaces = String(w._org_id);
        break;
      }
    }
    
    const targetOrgId = myOrgIdFromWorkspaces || '__api__';
    
    // Skip if already loaded
    if (orgLoadedRef.current === targetOrgId) return;
    orgLoadedRef.current = targetOrgId;
    
    if (myOrgIdFromWorkspaces) {
      // Fast path: we know the org from workspace data
      Promise.all([
        organizationMembersApi.getOrgById(myOrgIdFromWorkspaces, accessToken).catch(() => null),
        organizationMembersApi.getMembers(myOrgIdFromWorkspaces, accessToken).catch(() => null),
      ]).then(([org, members]) => {
        if (org) setMyOrgInfo({ id: org.id, name: org.name });
        if (members) setOrgMemberCount(members.length);
      });
    } else if (initialLoadDone) {
      // Slow path: workspaces loaded but no org found — ask backend
      organizationMembersApi.getMyOrganization(accessToken)
        .then(org => {
          setMyOrgInfo({ id: org.id, name: org.name });
          return organizationMembersApi.getMembers(org.id, accessToken)
            .then(members => setOrgMemberCount(members.length));
        })
        .catch(() => {
          console.log('ℹ️ У пользователя нет организации');
        });
    }
  }, [accessToken, workspaces, initialLoadDone]);

  // Presence теперь через Realtime (useWorkspacesPresence hook) — без polling Edge Function

  const loadWorkspaces = async () => {
    try {
      const cacheKey = "cache_workspaces_list";

      // Сначала проверяем кэш — если есть, показываем мгновенно без скелетона
      const cachedData = await getStorageJSON<WorkspaceWithSummary[]>(cacheKey);
      if (cachedData && cachedData.length > 0) {
        setWorkspaces(cachedData);
        // НЕ ставим isLoading=true — данные уже видны из кэша
      } else {
        // Кэша нет — показываем скелетон
        setIsLoading(true);
      }

      // Загружаем свежие данные в фоне
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

      // Обновляем кэш
      await setStorageJSON(cacheKey, workspacesWithSummaries);
    } catch (error) {
      console.error("Failed to load workspaces:", error);
      
      // При ошибке сети — показываем кэш как фолбэк
      const cacheKey = "cache_workspaces_list";
      const cachedData = await getStorageJSON<WorkspaceWithSummary[]>(cacheKey);
      if (cachedData && workspaces.length === 0) {
        setWorkspaces(cachedData);
      }
    } finally {
      setIsLoading(false);
      setInitialLoadDone(true);
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

    lastWorkspacesChangeRef.current = Date.now();
    setWorkspaces((prev) =>
      prev.filter((w) => w.id !== workspaceId),
    );

    // Инвалидируем кэш сразу при оптимистчном удалении
    setStorageJSON("cache_workspaces_list", null).catch(() => {});

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

  const handleOpenShare = (workspace: Workspace) => {
    setSharingWorkspace(workspace); // Поделиться
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
      const plural = (n: number, forms: string[]) => 
        forms[(n % 100 > 4 && n % 100 < 20) ? 2 : [2, 0, 1, 1, 1, 2][(n % 10 < 5) ? n % 10 : 5]];
      return `${diffHours} ${plural(diffHours, ['час', 'часа', 'часов'])} назад`;
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
      <div className="p-2 relative z-50">
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
                {/* Notification Bell */}
                <NotificationCenter
                  accessToken={accessToken || null}
                  onInviteAccepted={({ workspace_id, organization_id }) => {
                    console.log('✅ Invite accepted, reloading workspaces...', { workspace_id, organization_id });
                    loadWorkspaces();
                  }}
                  onAccessChanged={(payload) => {
                    console.log('🔐 Access changed event:', payload);
                    // Reload workspaces to reflect new permissions
                    loadWorkspaces();
                    // Show toast notification
                    if (payload.action === 'removed') {
                      toast.info('Доступ изменён', {
                        description: payload.scope === 'organization'
                          ? 'Вас удалили из организации'
                          : 'Вас удалили из пространства',
                      });
                    } else if (payload.action === 'role_changed') {
                      const roleLabel = payload.new_role === 'editor' ? 'Редактор' : payload.new_role === 'viewer' ? 'Просмотр' : payload.new_role;
                      toast.info('Роль изменена', {
                        description: `Ваша роль изменена на «${roleLabel}»`,
                      });
                    }
                  }}
                />

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
        {/* Sections — always render, "Мои пространства" always visible */}
          <div className="space-y-10">
            {sections.map((section) => (
              <div key={section.id}>
                {/* Section Header */}
                <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2 text-black flex items-center gap-2 flex-wrap">
                      <span className="break-words">{section.orgName || section.title}</span>
                      {(section.type === 'other_org' || section.type === 'shared') && (
                        <Globe className="w-5 h-5 text-[#868789] shrink-0" />
                      )}
                    </h2>
                    <p className="text-sm text-[#868789]">
                      {section.subtitle}
                    </p>
                  </div>

                  {/* Section Action Buttons */}
                  <div className="flex items-center gap-2 self-start">
                    {section.canManageMembers && (() => {
                      const isPrimary = (section.type === 'my_org' || section.type === 'owned') && (orgMemberCount ?? 0) > 1;
                      return (
                        <div
                          onClick={() => {
                            setOrgModalTarget(section.orgId ? { orgId: section.orgId, orgName: section.title } : null);
                            setShowOrgModal(true);
                          }}
                          className={`flex gap-[6px] items-center justify-center px-[12px] py-[8px] rounded-[12px] shrink-0 cursor-pointer transition-colors ${
                            isPrimary
                              ? 'bg-[#0062FF] hover:bg-[#0052D9]'
                              : 'relative hover:bg-gray-50'
                          }`}
                        >
                          {!isPrimary && (
                            <div className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]" />
                          )}
                          <Users className={`w-[16px] h-[16px] ${isPrimary ? 'text-white' : 'text-black'}`} />
                          <p className={`font-medium leading-[20px] shrink-0 text-[12px] text-nowrap whitespace-pre ${isPrimary ? 'text-white' : 'text-black'}`}>
                            Поделиться
                          </p>
                          {isPrimary && orgMemberCount !== null && (
                            <span className="ml-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-white/20 text-[10px] font-medium text-white px-1">
                              {orgMemberCount}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {section.canCreate && (
                      <div
                        onClick={() => {
                          setShowCreateModal(true);
                          setCreateForOrgId(section.orgId || null);
                        }}
                        className="box-border content-stretch flex gap-[6px] items-center justify-center px-[12px] py-[8px] relative rounded-[12px] shrink-0 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <div className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]" />
                        <Plus className="w-[16px] h-[16px] relative" />
                        <p className="font-medium leading-[20px] relative shrink-0 text-[12px] text-black text-nowrap whitespace-pre">
                          Создать
                        </p>
                      </div>
                    )}

                    {section.orgId && section.orgRole === 'owner' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <div className="box-border content-stretch flex gap-[6px] items-center justify-center px-[12px] py-[8px] relative rounded-[12px] shrink-0 cursor-pointer hover:bg-gray-50 transition-colors">
                            <div className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]" />
                            <MoreVertical className="w-[16px] h-[16px] relative" />
                            <p className="font-medium leading-[20px] relative shrink-0 text-[12px] text-black text-nowrap whitespace-pre">
                              Ещё
                            </p>
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl">
                          <DropdownMenuItem
                            onClick={() => setRenameOrgTarget({ orgId: section.orgId!, currentName: section.orgName || section.title })}
                            className="py-2.5 cursor-pointer"
                          >
                            Изменить название
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                {/* Section Workspaces Grid */}
                {section.workspaces.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-sm text-[#868789]">
                      {section.canCreate
                        ? 'Создайте первое рабочее пространство'
                        : 'Нет доступных пространств'}
                    </p>
                  </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {section.workspaces.map((workspace) => {
                    const workspaceIdStr = String(workspace.id);
                    const users = onlineUsersMap.get(workspaceIdStr) || [];
                    // Determine access: per-workspace metadata OR section-level role
                    // For org workspaces, org role is the ceiling — _is_creator does NOT override
                    const isOrgWorkspace = workspace._source === 'organization' || section.type === 'my_org' || section.type === 'other_org';
                    const orgRole = workspace._org_role || section.orgRole;
                    const isOrgOwnerOrAdmin = orgRole === 'owner' || orgRole === 'admin';
                    
                    let isOwnerOrCreator: boolean;
                    if (isOrgWorkspace) {
                      // In org context: only org owner/admin or per-workspace override can manage
                      isOwnerOrCreator = isOrgOwnerOrAdmin || workspace._ws_role === 'owner';
                    } else {
                      // Outside org: creator = owner
                      isOwnerOrCreator = section.type === 'owned' || workspace._is_creator === true;
                    }

                    return (
                      <div
                        key={workspace.id}
                        className="group relative cursor-pointer"
                        onClick={() => onSelectWorkspace(workspace)}
                      >
                        <div className="relative rounded-[16px] overflow-hidden bg-white">
                          <div className="absolute border border-[#f0f0f0] border-solid inset-0 pointer-events-none rounded-[16px] group-hover:border-[#0062FF] transition-colors" />

                          <div className="p-4 relative z-10">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-base font-medium text-black flex items-center gap-1.5 mb-2">
                                  <span className="truncate">{workspace.name}</span>
                                  {section.type === 'shared' && (
                                    <Globe className="w-3.5 h-3.5 text-[#868789] shrink-0" />
                                  )}
                                </h3>
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f6f6f6] text-[#868789]">
                                    {workspace.timeline_year}
                                  </span>
                                  {section.type === 'shared' && workspace._ws_role && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">
                                      {workspace._ws_role === 'editor' ? 'Редактор' : workspace._ws_role === 'owner' ? 'Владелец' : 'Просмотр'}
                                    </span>
                                  )}
                                  {section.type === 'other_org' && !isOrgOwnerOrAdmin && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">
                                      {workspace._ws_role === 'editor' ? 'Редактор' : workspace._ws_role === 'owner' ? 'Владелец' : orgRole === 'editor' ? 'Редактор' : 'Просмотр'}
                                    </span>
                                  )}
                                  {(workspace._shared_count ?? 0) > 0 && section.type !== 'shared' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-600">
                                      <Users className="w-3 h-3" />
                                      Общий доступ
                                    </span>
                                  )}
                                </div>
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
                                  <DropdownMenuContent align="end" className="w-48 rounded-xl">
                                    {isOwnerOrCreator && (
                                      <>
                                        <DropdownMenuItem
                                          onClick={(e) => { e.stopPropagation(); handleOpenSettings(workspace); }}
                                          className="py-2.5 cursor-pointer"
                                        >
                                          Настройки
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={(e) => { e.stopPropagation(); handleOpenManagement(workspace); }}
                                          className="py-2.5 cursor-pointer"
                                        >
                                          Управление
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={(e) => { e.stopPropagation(); handleOpenShare(workspace); }}
                                          className="py-2.5 cursor-pointer"
                                        >
                                          Поделиться
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={(e) => { e.stopPropagation(); handleDeleteWorkspace(workspace.id); }}
                                          className="text-red-600 focus:text-red-600 focus:bg-red-50 py-2.5 cursor-pointer"
                                        >
                                          Удалить
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    {!isOwnerOrCreator && (
                                      <DropdownMenuItem
                                        onClick={(e) => { e.stopPropagation(); handleOpenShare(workspace); }}
                                        className="py-2.5 cursor-pointer"
                                      >
                                        Поделиться
                                      </DropdownMenuItem>
                                    )}
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
                                    <div className="text-xl font-semibold text-black mb-0.5">{projectCount}</div>
                                    <div className="text-[9px] uppercase tracking-wider text-[#868789] font-medium">
                                      {plural(projectCount, ['проект', 'проекта', 'проектов'])}
                                    </div>
                                  </div>
                                  <div className="text-center p-3 bg-[#f6f6f6] rounded-[10px]">
                                    <div className="text-xl font-semibold text-black mb-0.5">{peopleCount}</div>
                                    <div className="text-[9px] uppercase tracking-wider text-[#868789] font-medium">
                                      {plural(peopleCount, ['человек', 'человека', 'человек'])}
                                      {hiddenCount > 0 && (
                                        <> ({hiddenCount} {plural(hiddenCount, ['скрыт', 'скрыто', 'скрыто'])})</>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-center p-3 bg-[#f6f6f6] rounded-[10px]">
                                    <div className="text-xl font-semibold text-black mb-0.5">{deptCount}</div>
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
                              <WorkspaceUsers users={users} currentUserEmail={currentUserEmail} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            ))}
          </div>
      </main>

      {/* Modals */}
      {showCreateModal && (
        <CreateWorkspaceModal
          existingWorkspaces={workspaces}
          onClose={() => setShowCreateModal(false)}
          onCreate={async (params) => {
            console.log('🔄 Создание воркспейса:', params.name, 'orgId:', createForOrgId);
            setIsCreating(true);
            
            // Set cooldown BEFORE API call to prevent realtime INSERT from racing
            lastWorkspacesChangeRef.current = Date.now();
            
            try {
              // Resolve organization_id: use createForOrgId, or fallback to myOrgInfo, or let backend decide
              let resolvedOrgId: number | string | undefined = createForOrgId || undefined;
              
              if (!resolvedOrgId && myOrgInfo?.id) {
                resolvedOrgId = myOrgInfo.id;
                console.log('📌 Используем myOrgInfo.id:', resolvedOrgId);
              }
              
              if (!resolvedOrgId) {
                // Last resort: ask backend for user's org
                console.log('📌 orgId не определён, бэкенд определит сам');
              }

              const created = await createWorkspace({
                name: params.name,
                timeline_year: params.timeline_year,
                base_workspace_id: params.base_workspace_id,
                organization_id: resolvedOrgId,
              });
              console.log('✅ Воркспейс создан:', created.id, '_source:', (created as any)._source, '_org_id:', (created as any)._org_id);
              
              // If backend auto-created a personal org, update myOrgInfo
              const createdAny = created as any;
              if (createdAny._org_id && createdAny._org_role === 'owner' && !myOrgInfo) {
                console.log('🏢 Обновляем myOrgInfo из ответа:', createdAny._org_id, createdAny._org_name);
                setMyOrgInfo({ id: createdAny._org_id, name: createdAny._org_name || 'Моя организация' });
              }
              
              // Refresh cooldown after API response too
              lastWorkspacesChangeRef.current = Date.now();
              
              // Вставляем в начало списка с метаданными от бэкенда
              setWorkspaces((prev) => {
                const filtered = prev.filter((w) => String(w.id) !== String(created.id));
                return [{ ...created, summary: null } as WorkspaceWithSummary, ...filtered];
              });
              
              // Подгружаем summary в фоне
              getWorkspaceSummary(created.id).then((summary) => {
                setWorkspaces((prev) =>
                  prev.map((w) =>
                    String(w.id) === String(created.id) ? { ...w, summary } : w
                  )
                );
              }).catch(() => {});
              
              // Инвалидируем кэш
              setStorageJSON("cache_workspaces_list", null).catch(() => {});
              
              // Сбрасываем orgLoadedRef чтобы обновить счётчик участников
              orgLoadedRef.current = null;
              
              toast.success('Создано', { description: `Пространство "${params.name}" создано` });
            } catch (err: any) {
              console.error('❌ Ошибка создания воркспейса:', err);
              toast.error('Ошибка создания', { description: err.message || 'Не удалось создать пространство' });
            } finally {
              setIsCreating(false);
            }
          }}
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

      {sharingWorkspace && (
        <ShareWorkspaceModal
          workspace={sharingWorkspace}
          onClose={() => setSharingWorkspace(null)}
          accessToken={accessToken}
          isViewer={(() => {
            const role = getEffectiveRole(sharingWorkspace);
            return role === 'viewer';
          })()}
          onSharedCountChange={(wsId, newCount) => {
            setWorkspaces(prev => prev.map(w =>
              String(w.id) === String(wsId) ? { ...w, _shared_count: newCount } : w
            ));
          }}
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

      {showOrgModal && (
        <OrganizationMembersModal
          onClose={() => {
            setShowOrgModal(false);
            const closedOrgId = orgModalTarget?.orgId;
            setOrgModalTarget(null);
            // Обновить счётчик после возможных изменений (только для своей орги)
            if (accessToken && closedOrgId) {
              const mySection = sections.find(s => s.type === 'my_org' || s.type === 'owned');
              if (mySection?.orgId && String(mySection.orgId) === String(closedOrgId)) {
                orgLoadedRef.current = null; // Force reload
                organizationMembersApi.getMembers(closedOrgId, accessToken)
                  .then(members => setOrgMemberCount(members.length))
                  .catch(() => {});
              }
            }
          }}
          accessToken={accessToken}
          orgId={orgModalTarget?.orgId}
          orgName={orgModalTarget?.orgName}
        />
      )}

      {renameOrgTarget && (
        <RenameOrgModal
          orgId={renameOrgTarget.orgId}
          currentName={renameOrgTarget.currentName}
          accessToken={accessToken}
          onClose={() => setRenameOrgTarget(null)}
          onRenamed={(newName) => {
            // Update myOrgInfo
            if (myOrgInfo && String(myOrgInfo.id) === String(renameOrgTarget.orgId)) {
              setMyOrgInfo({ ...myOrgInfo, name: newName });
            }
            // Update _org_name in workspaces so sections recalculate
            setWorkspaces(prev => prev.map(w =>
              w._org_id && String(w._org_id) === String(renameOrgTarget.orgId)
                ? { ...w, _org_name: newName }
                : w
            ));
            // Invalidate cache
            setStorageJSON("cache_workspaces_list", null).catch(() => {});
            setRenameOrgTarget(null);
          }}
        />
      )}
    </div>
  );
}

// ---- RenameOrgModal ----

function RenameOrgModal({
  orgId,
  currentName,
  accessToken,
  onClose,
  onRenamed,
}: {
  orgId: number | string;
  currentName: string;
  accessToken?: string | null;
  onClose: () => void;
  onRenamed: (newName: string) => void;
}) {
  const [name, setName] = useState(currentName);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Введите название');
      return;
    }
    if (trimmed === currentName) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      await organizationMembersApi.updateName(orgId, trimmed, accessToken || undefined);
      console.log(`✅ Организация переименована: "${currentName}" → "${trimmed}"`);
      toast.success('Название обновлено');
      onRenamed(trimmed);
    } catch (err: any) {
      console.error('❌ Ошибка переименования организации:', err);
      toast.error('Ошибка', { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative bg-white rounded-[16px] w-[400px] flex flex-col shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] overflow-hidden"
        style={{ animation: 'fadeInScale 0.15s ease-out' }}
      >
        <div className="p-[20px]">
          <div className="flex items-start justify-between mb-[16px]">
            <h2 className="text-[15px] font-semibold text-[#1a1a1a] leading-normal">Переименовать организацию</h2>
            <button
              onClick={onClose}
              className="w-[28px] h-[28px] flex items-center justify-center rounded-[8px] hover:bg-[#f6f6f6] transition-colors shrink-0"
            >
              <X className="w-4 h-4 text-[#868789]" />
            </button>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } }}
            placeholder="Название организации"
            className="w-full h-[40px] px-[12px] text-[13px] bg-[#f6f6f6] rounded-[10px] border-none outline-none placeholder:text-[#999] text-[#333] focus:ring-2 focus:ring-[#0062FF]/20"
          />
        </div>

        <div className="flex justify-end gap-[8px] px-[20px] pb-[20px]">
          <button
            onClick={onClose}
            className="h-[36px] px-[16px] rounded-[10px] text-[13px] font-medium text-[#333] hover:bg-[#f6f6f6] transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="h-[36px] px-[16px] rounded-[10px] text-[13px] font-medium text-white bg-[#0062FF] hover:bg-[#0052D9] disabled:bg-[#d6d6d6] disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сохранить'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}