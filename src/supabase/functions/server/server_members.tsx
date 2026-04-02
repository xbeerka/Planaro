import { Hono } from "npm:hono";
import { createAdminClient, createAuthClient, handleError } from './server_utils.tsx';

const supabase = createAdminClient();
const supabaseAuth = createAuthClient();

export function registerMembersRoutes(app: Hono) {

  // Helper: check if user can manage workspace members
  async function canManageWorkspaceMembers(workspaceId: string, userId: string): Promise<boolean> {
    const { data: workspace } = await supabase
      .from('workspaces').select('created_by, organization_id').eq('id', workspaceId).single();
    if (!workspace) return false;
    if (workspace.created_by === userId) return true;
    if (workspace.organization_id) {
      const { data: orgMember } = await supabase
        .from('organization_members').select('role')
        .eq('organization_id', workspace.organization_id).eq('user_id', userId).single();
      if (orgMember) return true;
    }
    const { data: wsMember } = await supabase
      .from('workspace_members').select('role')
      .eq('workspace_id', workspaceId).eq('user_id', userId).single();
    if (wsMember && (wsMember.role === 'editor' || wsMember.role === 'owner')) return true;
    return false;
  }

  // ==================== WORKSPACE MEMBERS & INVITES ====================

  // GET: список owner + members + pending invites
  app.get("/make-server-73d66528/workspaces/:id/members", async (c) => {
    try {
      const workspaceId = c.req.param('id');
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

      console.log(`👥 Запрос участников workspace ${workspaceId}`);

      // Параллельно загружаем workspace, members, invites
      const [workspaceResult, membersResult, invitesResult] = await Promise.all([
        supabase.from('workspaces').select('created_by').eq('id', workspaceId).single(),
        supabase.from('workspace_members').select('workspace_id, user_id, role, created_at')
          .eq('workspace_id', workspaceId).order('created_at', { ascending: true })
          .then(r => { if (r.error) console.error('❌ workspace_members query error:', r.error.message); return r.data || []; })
          .catch(e => { console.error('❌ workspace_members exception:', e); return [] as any[]; }),
        supabase.from('workspace_invites').select('id, workspace_id, email, role, invited_by, token, accepted_at, created_at')
          .eq('workspace_id', workspaceId).is('accepted_at', null).order('created_at', { ascending: true })
          .then(r => { if (r.error) console.error('❌ workspace_invites query error:', r.error.message); return r.data || []; })
          .catch(e => { console.error('❌ workspace_invites exception:', e); return [] as any[]; }),
      ]);

      const workspace = workspaceResult.data;
      const members: any[] = membersResult;
      const invites: any[] = invitesResult;

      const allUserIds = new Set<string>();
      if (workspace?.created_by) allUserIds.add(workspace.created_by);
      members.forEach((m: any) => allUserIds.add(m.user_id));

      const profileMap = new Map<string, any>();
      if (allUserIds.size > 0) {
        // Параллельно: profiles из БД + один batch listUsers вместо N getUserById
        const [profilesResult, authListResult] = await Promise.all([
          supabase.from('profiles').select('id, full_name, avatar_url').in('id', Array.from(allUserIds)),
          supabase.auth.admin.listUsers({ perPage: 1000 }).catch(e => { console.warn('⚠️ listUsers failed:', e); return { data: { users: [] } }; }),
        ]);

        (profilesResult.data || []).forEach((p: any) => profileMap.set(p.id, p));

        // Строим map email по user_id из batch-ответа
        const authUsers = (authListResult as any)?.data?.users || [];
        const authEmailMap = new Map<string, string>();
        authUsers.forEach((au: any) => { if (au.id && au.email) authEmailMap.set(au.id, au.email); });

        allUserIds.forEach(uid => {
          const email = authEmailMap.get(uid);
          if (email) {
            const existing = profileMap.get(uid) || {};
            profileMap.set(uid, { ...existing, id: uid, _email: email });
          }
        });
      }

      const result: any[] = [];
      if (workspace?.created_by) {
        const op = profileMap.get(workspace.created_by);
        result.push({ type: 'member', user_id: workspace.created_by, role: 'owner', email: op?._email || '', display_name: op?.full_name || '', avatar_url: op?.avatar_url || null });
      }
      members.forEach((m: any) => {
        if (m.user_id === workspace?.created_by) return;
        const p = profileMap.get(m.user_id);
        result.push({ type: 'member', user_id: m.user_id, role: m.role || 'viewer', email: p?._email || '', display_name: p?.full_name || '', avatar_url: p?.avatar_url || null, created_at: m.created_at });
      });
      const memberEmails = new Set(result.filter(r => r.role !== 'owner').map(r => r.email.toLowerCase()));
      invites.forEach((inv: any) => {
        if (memberEmails.has(inv.email.toLowerCase())) return;
        result.push({ type: 'invite', invite_id: inv.id, role: inv.role || 'viewer', email: inv.email, display_name: '', avatar_url: null, created_at: inv.created_at });
      });

      console.log(`✅ workspace ${workspaceId}: ${members.length} members, ${invites.length} pending invites`);
      return c.json(result);
    } catch (error: any) { return handleError(c, 'Get Workspace Members', error); }
  });

  // POST: Пригласить пользователей
  app.post("/make-server-73d66528/workspaces/:id/members", async (c) => {
    try {
      const workspaceId = c.req.param('id');
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

      const body = await c.req.json();
      const { emails, role } = body;
      if (!emails || !Array.isArray(emails) || emails.length === 0) return c.json({ error: 'emails обязательны' }, 400);
      const validRole = role === 'editor' ? 'editor' : 'viewer';

      if (!(await canManageWorkspaceMembers(workspaceId, user.id))) return c.json({ error: 'Нет прав для приглашения участников' }, 403);

      console.log(`📨 Приглашение ${emails.length} пользователей → workspace ${workspaceId}, роль: ${validRole}`);

      const normalizedEmails = emails.map((e: string) => e.toLowerCase().trim());
      const profileByEmail = new Map<string, any>();
      try {
        const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (listData?.users) {
          for (const authUser of listData.users) {
            const authEmail = (authUser.email || '').toLowerCase();
            if (normalizedEmails.includes(authEmail)) profileByEmail.set(authEmail, { id: authUser.id, email: authUser.email });
          }
        }
      } catch (e) { console.warn('⚠️ Failed to list auth users for invite lookup'); }

      const invitesToCreate: any[] = [];
      for (const email of normalizedEmails) {
        invitesToCreate.push({
          workspace_id: parseInt(workspaceId), email, role: validRole,
          invited_by: user.id, token: crypto.randomUUID(), created_at: new Date().toISOString(),
        });
      }

      if (invitesToCreate.length > 0) {
        const inviteEmails = invitesToCreate.map(i => i.email);
        await supabase.from('workspace_invites').delete().eq('workspace_id', workspaceId).in('email', inviteEmails).is('accepted_at', null);

        const { data: insertedInvites, error: err } = await supabase.from('workspace_invites').insert(invitesToCreate).select('id, email');
        if (err) return c.json({ error: err.message }, 500);

        const { data: ws } = await supabase.from('workspaces').select('name').eq('id', workspaceId).single();
        const wsName = ws?.name || 'Воркспейс';
        const actorName = user.user_metadata?.name || user.email || 'Пользователь';
        const actorAvatar = user.user_metadata?.avatar_url || null;

        for (const inv of (insertedInvites || [])) {
          const profile = profileByEmail.get(inv.email);
          if (profile) {
            const { data: notif } = await supabase.from('notifications').insert({
              workspace_id: parseInt(workspaceId), actor_auth_user_id: user.id, type: 'workspace_invite',
              title: `Приглашение в «${wsName}»`,
              body: `${actorName} приглашает вас в пространство «${wsName}» с ролью «${validRole === 'editor' ? 'Редактор' : 'Просмотр'}»`,
              data: { invite_id: inv.id, workspace_id: parseInt(workspaceId), role: validRole, actor_name: actorName, actor_avatar: actorAvatar },
            }).select('id').single();
            console.log(`📝 Notification created: id=${notif?.id || 'null'}`);
            
            if (notif) {
              const { data: recipientData, error: recipientErr } = await supabase
                .from('notification_recipients')
                .insert({ notification_id: notif.id, user_id: profile.id })
                .select('*');
              
              if (recipientErr) {
                console.error(`❌ Failed to insert notification_recipients:`, recipientErr.message);
              } else {
                console.log(`✅ notification_recipients created:`, JSON.stringify(recipientData));
                
                // 🔥 Отправляем Broadcast для Realtime уведомления получателю
                const broadcastChannel = `notifications:user:${profile.id}`;
                console.log(`📡 Sending broadcast to ${broadcastChannel}`);
                const broadcastResult = await supabase.channel(broadcastChannel).send({
                  type: 'broadcast',
                  event: 'new_notification',
                  payload: { notification_id: notif.id, type: 'workspace_invite' },
                });
                console.log(`📡 Broadcast result:`, broadcastResult);
              }
              
              console.log(`🔔 Notification created for ${inv.email} (invite ${inv.id})`);
            }
          }
        }
      }

      const registeredCount = normalizedEmails.filter(e => profileByEmail.has(e)).length;
      console.log(`✅ ${invitesToCreate.length} invites created (${registeredCount} registered, ${normalizedEmails.length - registeredCount} unregistered)`);
      return c.json({ added_members: 0, created_invites: invitesToCreate.length, pending_emails: invitesToCreate.map(i => i.email), direct_emails: [] });
    } catch (error: any) { return handleError(c, 'Invite Workspace Members', error); }
  });

  // PUT: Update member role
  app.put("/make-server-73d66528/workspaces/:id/members/:userId", async (c) => {
    try {
      const workspaceId = c.req.param('id');
      const targetUserId = c.req.param('userId');
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);
      if (!(await canManageWorkspaceMembers(workspaceId, user.id))) return c.json({ error: 'Нет прав для изменения ролей' }, 403);

      const { role } = await c.req.json();
      const validRole = role === 'editor' ? 'editor' : 'viewer';
      const { error: err } = await supabase.from('workspace_members').update({ role: validRole, updated_at: new Date().toISOString() }).eq('workspace_id', workspaceId).eq('user_id', targetUserId);
      if (err) return c.json({ error: err.message }, 500);

      // 📡 Broadcast: уведомляем пользователя о смене роли
      console.log(`📡 Broadcasting access_changed to user ${targetUserId}`);
      await supabase.channel(`notifications:user:${targetUserId}`).send({
        type: 'broadcast',
        event: 'access_changed',
        payload: { action: 'role_changed', scope: 'workspace', workspace_id: workspaceId, new_role: validRole },
      }).catch((e: any) => console.warn('⚠️ Broadcast failed:', e));

      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Update Member Role', error); }
  });

  // PUT: Update invite role
  app.put("/make-server-73d66528/workspaces/:id/invites/:inviteId", async (c) => {
    try {
      const workspaceId = c.req.param('id');
      const inviteId = c.req.param('inviteId');
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);
      if (!(await canManageWorkspaceMembers(workspaceId, user.id))) return c.json({ error: 'Нет прав для изменения ролей' }, 403);

      const { role } = await c.req.json();
      const validRole = role === 'editor' ? 'editor' : 'viewer';
      const { error: err } = await supabase.from('workspace_invites').update({ role: validRole }).eq('id', inviteId).eq('workspace_id', workspaceId).is('accepted_at', null);
      if (err) return c.json({ error: err.message }, 500);
      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Update Invite Role', error); }
  });

  // DELETE: Remove member
  app.delete("/make-server-73d66528/workspaces/:id/members/:userId", async (c) => {
    try {
      const workspaceId = c.req.param('id');
      const targetUserId = c.req.param('userId');
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);
      if (!(await canManageWorkspaceMembers(workspaceId, user.id))) return c.json({ error: 'Нет прав для удаления участников' }, 403);

      const { error: err } = await supabase.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', targetUserId);
      if (err) return c.json({ error: err.message }, 500);
      console.log(`✅ Member ${targetUserId} удалён из workspace ${workspaceId}`);

      // 📡 Broadcast: уведомляем пользователя об удалении доступа
      console.log(`📡 Broadcasting access_changed (removed) to user ${targetUserId}`);
      await supabase.channel(`notifications:user:${targetUserId}`).send({
        type: 'broadcast',
        event: 'access_changed',
        payload: { action: 'removed', scope: 'workspace', workspace_id: workspaceId },
      }).catch((e: any) => console.warn('⚠️ Broadcast failed:', e));

      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Remove Workspace Member', error); }
  });

  // DELETE: Revoke invite
  app.delete("/make-server-73d66528/workspaces/:id/invites/:inviteId", async (c) => {
    try {
      const workspaceId = c.req.param('id');
      const inviteId = c.req.param('inviteId');
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);
      if (!(await canManageWorkspaceMembers(workspaceId, user.id))) return c.json({ error: 'Нет прав для отзыва приглашений' }, 403);

      const { data: invite } = await supabase.from('workspace_invites').select('email').eq('id', inviteId).eq('workspace_id', workspaceId).single();
      const { error: err } = await supabase.from('workspace_invites').delete().eq('id', inviteId).eq('workspace_id', workspaceId);
      if (err) return c.json({ error: err.message }, 500);

      // Clean up notifications + broadcast
      if (invite?.email) {
        try {
          const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
          const targetUser = listData?.users?.find((u: any) => (u.email || '').toLowerCase() === invite.email.toLowerCase());
          if (targetUser) {
            const { data: notifs } = await supabase.from('notifications').select('id').eq('workspace_id', parseInt(workspaceId)).eq('type', 'workspace_invite');
            if (notifs && notifs.length > 0) {
              const notifIds = notifs.map((n: any) => n.id);
              await supabase.from('notification_recipients').delete().in('notification_id', notifIds).eq('user_id', targetUser.id);
              console.log(`🗑️ Удалены уведомления workspace_invite для ${invite.email}`);

              // 🔥 Broadcast: уведомляем получателя об удалении
              const broadcastChannel = `notifications:user:${targetUser.id}`;
              console.log(`📡 Sending notification_updated broadcast to ${broadcastChannel}`);
              await supabase.channel(broadcastChannel).send({
                type: 'broadcast',
                event: 'notification_updated',
                payload: { action: 'revoked', type: 'workspace_invite' },
              });
            }
          }
        } catch (e) { console.warn('⚠️ Failed to clean up workspace invite notifications:', e); }
      }

      console.log(`✅ Invite ${inviteId} отозван из workspace ${workspaceId}`);
      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Revoke Workspace Invite', error); }
  });

  // ==================== NOTIFICATIONS ====================

  app.get("/make-server-73d66528/notifications", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

      const { data: recipients } = await supabase.from('notification_recipients').select('notification_id, is_read, read_at, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
      if (!recipients || recipients.length === 0) return c.json([]);

      const notifIds = recipients.map(r => r.notification_id);
      const { data: notifications } = await supabase.from('notifications').select('id, organization_id, workspace_id, actor_auth_user_id, type, title, body, data, created_at').in('id', notifIds);

      const actorIds = [...new Set((notifications || []).map(n => n.actor_auth_user_id).filter(Boolean))];
      const actorProfiles = new Map<string, any>();
      if (actorIds.length > 0) {
        // Параллельно: profiles + batch listUsers (вместо N getUserById)
        const [profilesRes, authListRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name, avatar_url').in('id', actorIds),
          supabase.auth.admin.listUsers({ perPage: 1000 }).catch(e => { console.warn('⚠️ listUsers failed:', e); return { data: { users: [] } }; }),
        ]);

        for (const p of (profilesRes.data || [])) actorProfiles.set(p.id, p);
        console.log(`👤 Profiles from DB: ${(profilesRes.data || []).length} found for ${actorIds.length} actors`);

        // Обогащаем из batch auth данных
        const authUsers = (authListRes as any)?.data?.users || [];
        const authMap = new Map<string, any>();
        authUsers.forEach((au: any) => { if (au.id) authMap.set(au.id, au); });

        for (const uid of actorIds) {
          const authUser = authMap.get(uid);
          if (authUser) {
            const existing = actorProfiles.get(uid) || {};
            const enrichedName = existing.full_name || authUser.user_metadata?.name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || null;
            const enrichedAvatar = existing.avatar_url || authUser.user_metadata?.avatar_url || null;
            actorProfiles.set(uid, {
              id: uid,
              full_name: enrichedName,
              avatar_url: enrichedAvatar,
            });
            console.log(`👤 Actor ${uid}: name="${enrichedName}", avatar=${enrichedAvatar ? 'yes' : 'no'}, source=${existing.full_name ? 'profiles' : 'auth'}`);
          }
        }
      }

      const result = (notifications || []).map(n => {
        const recipient = recipients.find(r => r.notification_id === n.id);
        const actor = n.actor_auth_user_id ? actorProfiles.get(n.actor_auth_user_id) : null;
        return { ...n, is_read: recipient?.is_read || false, read_at: recipient?.read_at || null, actor_name: actor?.full_name || null, actor_avatar: actor?.avatar_url || null };
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return c.json(result);
    } catch (error: any) { return handleError(c, 'Get Notifications', error); }
  });

  app.put("/make-server-73d66528/notifications/:id/read", async (c) => {
    try {
      const notifId = c.req.param('id');
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);
      await supabase.from('notification_recipients').update({ is_read: true, read_at: new Date().toISOString() }).eq('notification_id', parseInt(notifId)).eq('user_id', user.id);
      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Mark Notification Read', error); }
  });

  app.put("/make-server-73d66528/notifications/read-all", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);
      await supabase.from('notification_recipients').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', user.id).eq('is_read', false);
      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Mark All Notifications Read', error); }
  });

  // POST: Accept invite (workspace or org)
  app.post("/make-server-73d66528/notifications/:id/accept", async (c) => {
    try {
      const notifId = c.req.param('id');
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

      const { data: notif } = await supabase.from('notifications').select('*').eq('id', parseInt(notifId)).single();
      if (!notif) return c.json({ error: 'Notification not found' }, 404);

      // ===== ORG INVITE =====
      if (notif.type === 'org_invite') {
        const orgId = notif.data?.organization_id || notif.organization_id;
        const role = notif.data?.role || 'viewer';
        if (!orgId) return c.json({ error: 'Invalid org invite data' }, 400);

        const userEmail = user.email?.toLowerCase();
        const { data: orgInvite } = await supabase.from('organization_invites').select('id, role').eq('organization_id', orgId).eq('email', userEmail).is('accepted_at', null).maybeSingle();
        if (!orgInvite) return c.json({ error: 'Org invite not found or already accepted' }, 404);

        const { data: existing } = await supabase.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle();
        if (!existing) {
          const { error: memberErr } = await supabase.from('organization_members').insert({ organization_id: orgId, user_id: user.id, role: orgInvite.role || role, created_at: new Date().toISOString() });
          if (memberErr) return c.json({ error: memberErr.message }, 500);
        }

        await supabase.from('organization_invites').update({ accepted_at: new Date().toISOString() }).eq('id', orgInvite.id);

        // Delete old invite notification
        await supabase.from('notification_recipients').delete().eq('notification_id', parseInt(notifId));
        await supabase.from('notifications').delete().eq('id', parseInt(notifId));

        // Create system notification "Вы добавлены"
        const { data: orgData } = await supabase.from('organizations').select('name').eq('id', orgId).single();
        const orgName = orgData?.name || 'организацию';
        const { data: sysNotif } = await supabase.from('notifications').insert({
          organization_id: parseInt(orgId as string), actor_auth_user_id: null, type: 'system' as any,
          title: 'Приглашение принято',
          body: `Вы успешно добавлены в организацию «${orgName}»`,
          data: { organization_id: parseInt(orgId as string), subtype: 'invite_accepted' },
        }).select('id').single();
        if (sysNotif) {
          await supabase.from('notification_recipients').insert({ notification_id: sysNotif.id, user_id: user.id, is_read: true, read_at: new Date().toISOString() });
        }

        console.log(`✅ User ${user.id} accepted org invite → organization ${orgId}`);
        return c.json({ success: true, organization_id: orgId });
      }

      // ===== WORKSPACE INVITE =====
      if (notif.type !== 'workspace_invite') return c.json({ error: 'Not an invite notification' }, 400);

      const inviteId = notif.data?.invite_id;
      const wsId = notif.data?.workspace_id || notif.workspace_id;
      if (!inviteId || !wsId) return c.json({ error: 'Invalid invite data' }, 400);

      const { data: invite } = await supabase.from('workspace_invites').select('*').eq('id', inviteId).is('accepted_at', null).single();
      if (!invite) return c.json({ error: 'Invite not found or already accepted' }, 404);

      // Ownership transfer logic
      const { data: workspace } = await supabase.from('workspaces').select('created_by, name').eq('id', wsId).single();
      if (workspace?.created_by === user.id && invite.invited_by) {
        console.log(`🔄 Transferring ownership: ${user.id} → ${invite.invited_by} for workspace ${wsId}`);
        const { error: ownershipErr } = await supabase.from('workspaces').update({ created_by: invite.invited_by }).eq('id', wsId);
        if (ownershipErr) console.warn('⚠️ Ownership transfer failed:', ownershipErr.message);
        else console.log(`✅ Ownership transferred to inviter ${invite.invited_by}`);
      }

      const { data: existingMember } = await supabase.from('workspace_members').select('id').eq('workspace_id', wsId).eq('user_id', user.id).maybeSingle();
      if (existingMember) {
        await supabase.from('workspace_members').update({ role: invite.role || 'viewer' }).eq('workspace_id', wsId).eq('user_id', user.id);
      } else {
        const { error: memberErr } = await supabase.from('workspace_members').insert({ workspace_id: wsId, user_id: user.id, role: invite.role || 'viewer', created_at: new Date().toISOString() });
        if (memberErr) return c.json({ error: memberErr.message }, 500);
      }

      await supabase.from('workspace_invites').update({ accepted_at: new Date().toISOString() }).eq('id', inviteId);

      // Delete old invite notification
      await supabase.from('notification_recipients').delete().eq('notification_id', parseInt(notifId));
      await supabase.from('notifications').delete().eq('id', parseInt(notifId));

      // Create system notification "Вы добавлены"
      const wsName = workspace?.name || 'пространство';
      const { data: sysNotif } = await supabase.from('notifications').insert({
        workspace_id: parseInt(wsId as string), actor_auth_user_id: null, type: 'system' as any,
        title: 'Приглашение принято',
        body: `Вы успешно добавлены в пространство «${wsName}»`,
        data: { workspace_id: parseInt(wsId as string), subtype: 'invite_accepted' },
      }).select('id').single();
      if (sysNotif) {
        await supabase.from('notification_recipients').insert({ notification_id: sysNotif.id, user_id: user.id, is_read: true, read_at: new Date().toISOString() });
      }

      console.log(`✅ User ${user.id} accepted invite ${inviteId} → workspace ${wsId}`);
      return c.json({ success: true, workspace_id: wsId });
    } catch (error: any) { return handleError(c, 'Accept Invite', error); }
  });

  // POST: Decline invite
  app.post("/make-server-73d66528/notifications/:id/decline", async (c) => {
    try {
      const notifId = c.req.param('id');
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

      const { data: notif } = await supabase.from('notifications').select('*').eq('id', parseInt(notifId)).single();
      if (!notif) return c.json({ error: 'Notification not found' }, 404);

      if (notif.type === 'org_invite') {
        const orgId = notif.data?.organization_id || notif.organization_id;
        if (!orgId) return c.json({ error: 'Invalid org invite data' }, 400);
        const userEmail = user.email?.toLowerCase();
        await supabase.from('organization_invites').delete().eq('organization_id', orgId).eq('email', userEmail).is('accepted_at', null);
      } else if (notif.type === 'workspace_invite') {
        const inviteId = notif.data?.invite_id;
        if (inviteId) {
          await supabase.from('workspace_invites').delete().eq('id', inviteId);
        }
      } else {
        return c.json({ error: 'Not an invite notification' }, 400);
      }

      // Delete notification and recipient completely
      await supabase.from('notification_recipients').delete().eq('notification_id', parseInt(notifId));
      await supabase.from('notifications').delete().eq('id', parseInt(notifId));

      console.log(`❌ User ${user.id} declined notification ${notifId} (type: ${notif.type})`);
      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Decline Invite', error); }
  });
}