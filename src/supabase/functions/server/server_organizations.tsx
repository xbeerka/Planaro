import { Hono } from "npm:hono";
import { createAdminClient, createAuthClient, createUserClient, handleError } from './server_utils.tsx';

const supabase = createAdminClient();
const supabaseAuth = createAuthClient();

export function registerOrganizationsRoutes(app: Hono) {

  // GET: Current user's organization info
  app.get("/make-server-73d66528/organization", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

      const { data: ownOrg } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).eq('role', 'owner').limit(1).single();
      if (!ownOrg) {
        console.log(`ℹ️ У пользователя ${user.email} нет собственной организации (role=owner)`);
        return c.json({ error: 'No own organization found' }, 404);
      }

      const { data: org } = await supabase.from('organizations').select('id, name, created_by, created_at').eq('id', ownOrg.organization_id).single();
      if (!org) return c.json({ error: 'Organization not found' }, 404);
      return c.json(org);
    } catch (error: any) { return handleError(c, 'Get Organization', error); }
  });

  // GET: Organization info by ID
  app.get("/make-server-73d66528/organizations/:orgId", async (c) => {
    try {
      const orgId = c.req.param('orgId');
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

      const { data: membership } = await supabase.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).single();
      if (!membership) return c.json({ error: 'Not a member of this organization' }, 403);

      const { data: org } = await supabase.from('organizations').select('id, name, created_by, created_at').eq('id', orgId).single();
      if (!org) return c.json({ error: 'Organization not found' }, 404);
      console.log(`🏢 Org info: ${org.name} (id: ${org.id}), user role: ${membership.role}`);
      return c.json({ ...org, role: membership.role });
    } catch (error: any) { return handleError(c, 'Get Organization By ID', error); }
  });

  // PUT: Update organization name
  app.put("/make-server-73d66528/organizations/:orgId", async (c) => {
    try {
      const orgId = c.req.param('orgId');
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

      const { data: membership } = await supabase.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).single();
      if (!membership || membership.role !== 'owner') return c.json({ error: 'Only owner can update' }, 403);

      const { name } = await c.req.json();
      if (!name?.trim()) return c.json({ error: 'Name required' }, 400);

      const { error: err } = await supabase.from('organizations').update({ name: name.trim(), updated_at: new Date().toISOString() }).eq('id', orgId);
      if (err) return c.json({ error: err.message }, 500);
      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Update Organization', error); }
  });

  // GET: Organization members + invites
  app.get("/make-server-73d66528/organizations/:orgId/members", async (c) => {
    try {
      const orgId = c.req.param('orgId');
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

      console.log(`👥 Запрос участников organization ${orgId}`);

      let members: any[] = [];
      try {
        const { data: rows } = await supabase.from('organization_members').select('organization_id, user_id, role, created_at, updated_at').eq('organization_id', orgId).order('created_at', { ascending: true });
        members = rows || [];
      } catch (e) { console.log('ℹ️ organization_members query error'); }

      let invites: any[] = [];
      try {
        const { data: rows } = await supabase.from('organization_invites').select('id, organization_id, email, role, invited_by, token, accepted_at, created_at').eq('organization_id', orgId).is('accepted_at', null).order('created_at', { ascending: true });
        invites = rows || [];
      } catch (e) { console.log('ℹ️ organization_invites query error'); }

      const allUserIds = new Set<string>();
      members.forEach((m: any) => allUserIds.add(m.user_id));

      const profileMap = new Map<string, any>();
      if (allUserIds.size > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', Array.from(allUserIds));
        (profiles || []).forEach((p: any) => profileMap.set(p.id, p));
        await Promise.all(Array.from(allUserIds).map(async (uid) => {
          try {
            const { data: { user: authUser } } = await supabase.auth.admin.getUserById(uid);
            if (authUser?.email) {
              const existing = profileMap.get(uid) || {};
              profileMap.set(uid, { ...existing, id: uid, _email: authUser.email });
            }
          } catch (e) { console.warn(`⚠️ Failed to fetch auth user ${uid}`); }
        }));
      }

      const result: any[] = [];
      members.forEach((m: any) => {
        const p = profileMap.get(m.user_id);
        result.push({ type: 'member', user_id: m.user_id, role: m.role || 'viewer', email: p?._email || '', display_name: p?.full_name || '', avatar_url: p?.avatar_url || null, created_at: m.created_at });
      });
      const memberEmails = new Set(result.map(r => r.email.toLowerCase()));
      invites.forEach((inv: any) => {
        if (memberEmails.has(inv.email.toLowerCase())) return;
        result.push({ type: 'invite', invite_id: inv.id, role: inv.role || 'viewer', email: inv.email, display_name: '', avatar_url: null, created_at: inv.created_at });
      });

      console.log(`✅ organization ${orgId}: ${members.length} members, ${invites.length} pending invites`);
      return c.json(result);
    } catch (error: any) { return handleError(c, 'Get Organization Members', error); }
  });

  // POST: Invite to organization
  app.post("/make-server-73d66528/organizations/:orgId/members", async (c) => {
    try {
      const orgId = c.req.param('orgId');
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);

      const { data: membership } = await supabase.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).single();
      if (!membership || membership.role !== 'owner') return c.json({ error: 'Only owner can invite' }, 403);

      const body = await c.req.json();
      const { emails, role } = body;
      if (!emails || !Array.isArray(emails) || emails.length === 0) return c.json({ error: 'emails required' }, 400);
      const validRole = role === 'editor' ? 'editor' : 'viewer';

      console.log(`📨 Приглашение ${emails.length} → organization ${orgId}, роль: ${validRole}`);

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
      } catch (e) { console.warn('⚠️ Failed to list auth users'); }

      const pendingInvites: any[] = [];
      for (const email of normalizedEmails) {
        const profile = profileByEmail.get(email);
        if (profile) {
          const { data: existing } = await supabase.from('organization_members').select('id').eq('organization_id', parseInt(orgId)).eq('user_id', profile.id).maybeSingle();
          if (existing) { console.log(`ℹ️ ${email} уже участник организации ${orgId}`); continue; }
        }
        pendingInvites.push({ organization_id: parseInt(orgId), email, role: validRole, invited_by: user.id, token: crypto.randomUUID(), created_at: new Date().toISOString() });
      }

      const { data: orgData } = await supabase.from('organizations').select('name').eq('id', orgId).single();
      const orgName = orgData?.name || 'Организация';
      const actorName = user.user_metadata?.name || user.email || 'Пользователь';
      const actorAvatar = user.user_metadata?.avatar_url || null;

      if (pendingInvites.length > 0) {
        const inviteEmails = pendingInvites.map((i: any) => i.email);
        await supabase.from('organization_invites').delete().eq('organization_id', orgId).in('email', inviteEmails).is('accepted_at', null);
        const { error: err } = await supabase.from('organization_invites').insert(pendingInvites);
        if (err) return c.json({ error: err.message }, 500);

        for (const invite of pendingInvites) {
          const profile = profileByEmail.get(invite.email);
          if (profile && profile.id !== user.id) {
            try {
              // Создаем notification через Admin клиент (Service Role)
              const { data: notif, error: notifErr } = await supabase.from('notifications').insert({
                organization_id: parseInt(orgId), actor_auth_user_id: user.id, type: 'org_invite',
                title: `Приглашение в «${orgName}»`,
                body: `${actorName} приглашает вас в организацию «${orgName}» с ролью «${validRole === 'editor' ? 'Редактор' : 'Просмотр'}»`,
                data: { organization_id: parseInt(orgId), role: validRole, actor_name: actorName, actor_avatar: actorAvatar },
              }).select('id').single();
              
              if (notifErr) {
                console.error(`❌ Ошибка создания notification:`, notifErr.message);
              }
              console.log(`📝 Notification created: id=${notif?.id || 'null'}`);
              
              if (notif) {
                // Создаем recipient через admin клиент
                const { data: recipientData, error: recipientErr } = await supabase
                  .from('notification_recipients')
                  .insert({
                    notification_id: notif.id,
                    user_id: profile.id,
                    is_read: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .select('id')
                  .single();
                
                if (recipientErr) {
                  console.error(`❌ Failed to create notification_recipient:`, recipientErr.message);
                } else {
                  console.log(`✅ notification_recipient created: id=${recipientData?.id}`);
                  
                  // 🔥 Отправляем Broadcast для Realtime уведомления получателю
                  const broadcastChannel = `notifications:user:${profile.id}`;
                  console.log(`📡 Sending broadcast to ${broadcastChannel}`);
                  const broadcastResult = await supabase.channel(broadcastChannel).send({
                    type: 'broadcast',
                    event: 'new_notification',
                    payload: { notification_id: notif.id, type: 'org_invite' },
                  });
                  console.log(`📡 Broadcast result:`, broadcastResult);
                }
              }
            } catch (e) { console.warn('⚠️ Failed to create org invite notification:', e); }
          }
        }
      }

      console.log(`📨 Результат: ${pendingInvites.length} приглашений создано для организации ${orgId}`);
      return c.json({ added_members: 0, created_invites: pendingInvites.length, pending_emails: pendingInvites.map((i: any) => i.email), direct_emails: [] });
    } catch (error: any) { return handleError(c, 'Invite Org Members', error); }
  });

  // PUT: Update organization member role
  app.put("/make-server-73d66528/organizations/:orgId/members/:userId", async (c) => {
    try {
      const orgId = c.req.param('orgId');
      const targetUserId = c.req.param('userId');
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);
      const { data: membership } = await supabase.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).single();
      if (!membership || membership.role !== 'owner') return c.json({ error: 'Only owner' }, 403);

      const { role } = await c.req.json();
      const validRole = role === 'editor' ? 'editor' : 'viewer';
      const { error: err } = await supabase.from('organization_members').update({ role: validRole, updated_at: new Date().toISOString() }).eq('organization_id', orgId).eq('user_id', targetUserId);
      if (err) return c.json({ error: err.message }, 500);

      // 📡 Broadcast: уведомляем пользователя о смене роли в организации
      console.log(`📡 Broadcasting access_changed (org role) to user ${targetUserId}`);
      await supabase.channel(`notifications:user:${targetUserId}`).send({
        type: 'broadcast',
        event: 'access_changed',
        payload: { action: 'role_changed', scope: 'organization', organization_id: orgId, new_role: validRole },
      }).catch((e: any) => console.warn('⚠️ Broadcast failed:', e));

      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Update Org Member Role', error); }
  });

  // PUT: Update organization invite role
  app.put("/make-server-73d66528/organizations/:orgId/invites/:inviteId", async (c) => {
    try {
      const orgId = c.req.param('orgId');
      const inviteId = c.req.param('inviteId');
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);
      const { data: membership } = await supabase.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).single();
      if (!membership || membership.role !== 'owner') return c.json({ error: 'Only owner' }, 403);

      const { role } = await c.req.json();
      const validRole = role === 'editor' ? 'editor' : 'viewer';
      const { error: err } = await supabase.from('organization_invites').update({ role: validRole }).eq('id', inviteId).eq('organization_id', orgId).is('accepted_at', null);
      if (err) return c.json({ error: err.message }, 500);
      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Update Org Invite Role', error); }
  });

  // DELETE: Remove organization member
  app.delete("/make-server-73d66528/organizations/:orgId/members/:userId", async (c) => {
    try {
      const orgId = c.req.param('orgId');
      const targetUserId = c.req.param('userId');
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);
      const { data: membership } = await supabase.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).single();
      if (!membership || membership.role !== 'owner') return c.json({ error: 'Only owner' }, 403);

      const { error: err } = await supabase.from('organization_members').delete().eq('organization_id', orgId).eq('user_id', targetUserId);
      if (err) return c.json({ error: err.message }, 500);
      console.log(`✅ Member ${targetUserId} удалён из organization ${orgId}`);

      // 📡 Broadcast: уведомляем пользователя об удалении из организации
      console.log(`📡 Broadcasting access_changed (org removed) to user ${targetUserId}`);
      await supabase.channel(`notifications:user:${targetUserId}`).send({
        type: 'broadcast',
        event: 'access_changed',
        payload: { action: 'removed', scope: 'organization', organization_id: orgId },
      }).catch((e: any) => console.warn('⚠️ Broadcast failed:', e));

      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Remove Org Member', error); }
  });

  // DELETE: Revoke organization invite
  app.delete("/make-server-73d66528/organizations/:orgId/invites/:inviteId", async (c) => {
    try {
      const orgId = c.req.param('orgId');
      const inviteId = c.req.param('inviteId');
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) return c.json({ error: 'Unauthorized' }, 401);
      const { data: membership } = await supabase.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).single();
      if (!membership || membership.role !== 'owner') return c.json({ error: 'Only owner' }, 403);

      const { data: invite } = await supabase.from('organization_invites').select('email').eq('id', inviteId).eq('organization_id', orgId).single();
      const { error: err } = await supabase.from('organization_invites').delete().eq('id', inviteId).eq('organization_id', orgId);
      if (err) return c.json({ error: err.message }, 500);

      // Clean up notifications
      if (invite?.email) {
        try {
          const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
          const targetUser = listData?.users?.find((u: any) => (u.email || '').toLowerCase() === invite.email.toLowerCase());
          if (targetUser) {
            const { data: notifs } = await supabase.from('notifications').select('id').eq('organization_id', parseInt(orgId)).eq('type', 'org_invite');
            if (notifs && notifs.length > 0) {
              const notifIds = notifs.map((n: any) => n.id);
              await supabase.from('notification_recipients').delete().in('notification_id', notifIds).eq('user_id', targetUser.id);
              console.log(`🗑️ Удалены уведомления org_invite для ${invite.email}`);
              
              // 🔥 Broadcast: уведомляем получателя об удалении
              const broadcastChannel = `notifications:user:${targetUser.id}`;
              console.log(`📡 Sending notification_updated broadcast to ${broadcastChannel}`);
              await supabase.channel(broadcastChannel).send({
                type: 'broadcast',
                event: 'notification_updated',
                payload: { action: 'revoked', type: 'org_invite' },
              });
            }
          }
        } catch (e) { console.warn('⚠️ Failed to clean up invite notifications:', e); }
      }

      console.log(`✅ Invite ${inviteId} отозван из organization ${orgId}`);
      return c.json({ success: true });
    } catch (error: any) { return handleError(c, 'Revoke Org Invite', error); }
  });

}