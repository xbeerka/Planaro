import { Hono } from "npm:hono";
import { createAdminClient, createAuthClient, handleError, retryOperation } from './server_utils.tsx';

// Initialize clients
const supabase = createAdminClient();
const supabaseAuth = createAuthClient();

export function registerProfileRoutes(app: Hono) {

  // ==================== PROFILE ====================

  // Ensure profile exists (called after login)
  app.post("/make-server-73d66528/profile/ensure", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      
      const { data: { user }, error: authError } = await retryOperation(
        () => supabaseAuth.auth.getUser(accessToken),
        3, 1000, 'Auth check (Ensure Profile)'
      );

      if (authError || !user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const displayName = user.user_metadata?.name || user.user_metadata?.display_name || user.email?.split('@')[0] || '';
      const avatarUrl = user.user_metadata?.avatar_url || null;

      console.log(`👤 Ensure profile for ${user.email}, name="${displayName}"`);

      const { data: profile, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: displayName,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        console.warn('⚠️ Profile ensure failed (non-critical):', error.message);
        // Return basic profile from auth metadata (map to frontend format)
        return c.json({
          id: user.id,
          email: user.email,
          display_name: displayName,
          full_name: displayName,
          avatar_url: avatarUrl
        });
      }

      console.log(`✅ Profile ensured for ${user.email}`);

      // Ensure user has an organization (create if none exists)
      try {
        const { data: existingMembership } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .limit(1)
          .single();

        if (!existingMembership) {
          console.log(`🏢 Создание организации для ${user.email}...`);
          
          const orgName = displayName ? `${displayName}` : (user.email || 'My Organization');
          
          const { data: newOrg, error: orgError } = await supabase
            .from('organizations')
            .insert({
              name: orgName,
              created_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (orgError) {
            console.error('❌ Ошибка создания организации:', orgError.message);
          } else if (newOrg) {
            const { error: memError } = await supabase
              .from('organization_members')
              .insert({
                organization_id: newOrg.id,
                user_id: user.id,
                role: 'owner',
                created_at: new Date().toISOString(),
              });

            if (memError) {
              console.error('❌ Ошибка добавления owner в organization_members:', memError.message);
            } else {
              console.log(`✅ Организация создана: id=${newOrg.id}, name="${orgName}"`);
            }
          }
        } else {
          console.log(`🏢 Организация уже есть: ${existingMembership.organization_id}`);
        }
      } catch (orgErr) {
        console.warn('⚠️ Ensure organization skipped:', orgErr);
      }

      // Auto-accept pending workspace invites for this email
      try {
        const userEmail = (user.email || '').toLowerCase();
        
        // Find pending workspace_invites
        const { data: pendingWsInvites } = await supabase
          .from('workspace_invites')
          .select('id, workspace_id, role, email')
          .eq('email', userEmail)
          .is('accepted_at', null);

        if (pendingWsInvites && pendingWsInvites.length > 0) {
          console.log(`🔗 Найдено ${pendingWsInvites.length} pending workspace invites для ${userEmail}`);

          // Create workspace_members for each invite
          const memberRows = pendingWsInvites.map((inv: any) => ({
            workspace_id: inv.workspace_id,
            user_id: user.id,
            role: inv.role || 'viewer',
            created_at: new Date().toISOString(),
          }));

          // Insert members one by one, skipping duplicates
          let memberErr: any = null;
          for (const row of memberRows) {
            const { data: existing } = await supabase.from('workspace_members')
              .select('id').eq('workspace_id', row.workspace_id).eq('user_id', row.user_id).maybeSingle();
            if (!existing) {
              const { error } = await supabase.from('workspace_members').insert(row);
              if (error) { memberErr = error; break; }
            }
          }

          if (memberErr) {
            console.warn('⚠️ Ошибка auto-accept workspace invites:', memberErr.message);
          } else {
            // Mark invites as accepted
            const inviteIds = pendingWsInvites.map((inv: any) => inv.id);
            await supabase
              .from('workspace_invites')
              .update({ accepted_at: new Date().toISOString() })
              .in('id', inviteIds);

            console.log(`✅ Auto-accepted ${pendingWsInvites.length} workspace invites`);
          }
        }

        // Same for organization_invites
        const { data: pendingOrgInvites } = await supabase
          .from('organization_invites')
          .select('id, organization_id, role, email')
          .eq('email', userEmail)
          .is('accepted_at', null);

        if (pendingOrgInvites && pendingOrgInvites.length > 0) {
          console.log(`🔗 Найдено ${pendingOrgInvites.length} pending org invites для ${userEmail}`);

          const orgMemberRows = pendingOrgInvites.map((inv: any) => ({
            organization_id: inv.organization_id,
            user_id: user.id,
            role: inv.role || 'viewer',
            created_at: new Date().toISOString(),
          }));

          let orgErr: any = null;
          for (const row of orgMemberRows) {
            const { data: existing } = await supabase.from('organization_members')
              .select('id').eq('organization_id', row.organization_id).eq('user_id', row.user_id).maybeSingle();
            if (!existing) {
              const { error } = await supabase.from('organization_members').insert(row);
              if (error) { orgErr = error; break; }
            }
          }

          if (!orgErr) {
            const orgInviteIds = pendingOrgInvites.map((inv: any) => inv.id);
            await supabase
              .from('organization_invites')
              .update({ accepted_at: new Date().toISOString() })
              .in('id', orgInviteIds);

            console.log(`✅ Auto-accepted ${pendingOrgInvites.length} org invites`);
          }
        }
      } catch (inviteErr) {
        // Non-critical: tables may not exist yet
        console.log('ℹ️ Auto-accept invites skipped (tables may not exist)');
      }

      return c.json({
        ...profile,
        email: user.email,
        display_name: profile.full_name || displayName,
      });
    } catch (error: any) {
      return handleError(c, 'Ensure Profile', error);
    }
  });

  // Get current user profile
  app.get("/make-server-73d66528/profile", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      
      const { data: { user }, error: authError } = await retryOperation(
        () => supabaseAuth.auth.getUser(accessToken),
        3, 1000, 'Auth check (Get Profile)'
      );

      if (authError || !user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        return c.json({
          ...profile,
          email: user.email,
          display_name: profile.full_name || '',
        });
      }

      // Fallback: return from auth metadata
      return c.json({
        id: user.id,
        email: user.email,
        display_name: user.user_metadata?.name || user.user_metadata?.display_name || '',
        full_name: user.user_metadata?.name || user.user_metadata?.display_name || '',
        avatar_url: user.user_metadata?.avatar_url || null
      });
    } catch (error: any) {
      return handleError(c, 'Get Profile', error);
    }
  });

  // Upload avatar (for current user profile)
  app.post("/make-server-73d66528/profile/upload-avatar", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      
      // Verify user
      const { data: { user }, error: authError } = await retryOperation(
        () => supabaseAuth.auth.getUser(accessToken),
        3, 1000, 'Auth check (Upload Avatar)'
      );
      
      if (authError || !user) {
        console.error('❌ Ошибка авторизации при загрузке аватара:', authError);
        return c.json({ error: 'Unauthorized' }, 401);
      }

      console.log(`📤 Загрузка аватара для пользователя ${user.email}`);

      // Parse multipart form data
      const formData = await c.req.formData();
      const avatarFile = formData.get('avatar') as File;

      if (!avatarFile) {
        return c.json({ error: 'Файл не найден' }, 400);
      }

      // Validate file type
      if (!avatarFile.type.startsWith('image/')) {
        return c.json({ error: 'Можно загружать только изображения' }, 400);
      }

      // Validate file size (max 5MB)
      if (avatarFile.size > 5 * 1024 * 1024) {
        return c.json({ error: 'Размер файла не должен превышать 5MB' }, 400);
      }

      // Create bucket if not exists
      const bucketName = 'make-73d66528-avatars';
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
      
      if (!bucketExists) {
        console.log(`📦 Создание bucket ${bucketName}...`);
        const { error: createError } = await supabase.storage.createBucket(bucketName, {
          public: true // Аватары публичные
        });
        if (createError) {
          console.error('❌ Ошибка создания bucket:', createError);
          return c.json({ error: 'Ошибка создания хранилища' }, 500);
        }
      }

      // Generate unique filename
      const fileExt = avatarFile.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Convert File to ArrayBuffer
      const arrayBuffer = await avatarFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Upload to Supabase Storage
      console.log(`💾 Загрузка файла ${filePath} в Supabase Storage...`);
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, uint8Array, {
          contentType: avatarFile.type,
          upsert: true
        });

      if (uploadError) {
        console.error('❌ Ошибка заг��узки в Storage:', uploadError);
        return c.json({ error: 'Ошибка загрузки файла' }, 500);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      // Add cache-busting parameter to prevent browser caching
      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

      console.log(`✅ Аватар загружен: ${cacheBustedUrl}`);

      return c.json({ avatarUrl: cacheBustedUrl });
    } catch (error: any) {
      return handleError(c, 'Upload Avatar', error);
    }
  });

  // Update profile (display_name, avatar_url)
  app.post("/make-server-73d66528/profile/update", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      
      // Verify user
      const { data: { user }, error: authError } = await retryOperation(
        () => supabaseAuth.auth.getUser(accessToken),
        3, 1000, 'Auth check (Update Profile)'
      );

      if (authError || !user) {
        console.error('❌ Ошибка авторизации при обновлении профиля:', authError);
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const body = await c.req.json();
      const { display_name, avatar_url } = body;

      console.log(`💾 Обновление профиля для ${user.email}:`, { 
        display_name, 
        avatar_url: avatar_url ? avatar_url.substring(0, 80) + '...' : 'нет' 
      });

      // Update user metadata using service role (admin.updateUserById)
      const updateData: any = {};
      
      if (display_name !== undefined) {
        updateData.name = display_name;
      }
      
      if (avatar_url !== undefined) {
        updateData.avatar_url = avatar_url;
      }

      console.log('📝 Данные для обновления user_metadata:', {
        name: updateData.name || '(без изменений)',
        avatar_url: updateData.avatar_url ? updateData.avatar_url.substring(0, 80) + '...' : '(без изменений)'
      });

      const { data, error } = await supabase.auth.admin.updateUserById(
        user.id,
        {
          user_metadata: {
            ...user.user_metadata,
            ...updateData
          }
        }
      );

      if (error) {
        console.error('❌ Ошибка обновления профиля:', error);
        return c.json({ error: 'Ошибка обновления профиля' }, 500);
      }

      // Upsert into profiles table
      const profileData: any = { id: user.id, updated_at: new Date().toISOString() };
      if (display_name !== undefined) profileData.full_name = display_name;
      if (avatar_url !== undefined) profileData.avatar_url = avatar_url;

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' });

      if (profileError) {
        console.warn('⚠️ Ошибка upsert profiles (не критично):', profileError.message);
      } else {
        console.log('✅ Профиль в таблице profiles обновлён');
      }

      console.log(`✅ Профиль обновлён для ${user.email}`);
      console.log('   User metadata после обновления:', {
        name: data.user.user_metadata?.name,
        display_name: data.user.user_metadata?.display_name,
        avatar_url: data.user.user_metadata?.avatar_url ? 'да (' + data.user.user_metadata.avatar_url.substring(0, 50) + '...)' : 'нет'
      });

      return c.json({ success: true, user: data.user });
    } catch (error: any) {
      return handleError(c, 'Update Profile', error);
    }
  });

  // ==================== USER AVATARS (for UsersManagementModal) ====================

  // Upload user avatar (for UsersManagementModal)
  app.post("/make-server-73d66528/users/upload-avatar", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      
      // Verify user
      const { data: { user }, error: authError } = await retryOperation(
        () => supabaseAuth.auth.getUser(accessToken),
        3, 1000, 'Auth check (Upload User Avatar)'
      );

      if (authError || !user) {
        console.error('❌ Ошибка авторизации при загрузке аватара пользователя:', authError);
        return c.json({ error: 'Unauthorized' }, 401);
      }

      // Parse multipart form data
      const formData = await c.req.formData();
      const avatarFile = formData.get('avatar') as File;
      const userId = formData.get('userId') as string;

      if (!avatarFile) {
        return c.json({ error: 'Файл не найден' }, 400);
      }

      if (!userId) {
        return c.json({ error: 'userId обязателен' }, 400);
      }

      console.log(`📤 Загрузка аватара для пользователя ${userId}`);

      // Validate file type
      if (!avatarFile.type.startsWith('image/')) {
        return c.json({ error: 'Можно загружать только изображения' }, 400);
      }

      // Validate file size (max 5MB)
      if (avatarFile.size > 5 * 1024 * 1024) {
        return c.json({ error: 'Размер файла не должен превышать 5MB' }, 400);
      }

      // Create bucket if not exists
      const bucketName = 'make-73d66528-avatars';
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
      
      if (!bucketExists) {
        console.log(`📦 Создание bucket ${bucketName}...`);
        const { error: createError } = await supabase.storage.createBucket(bucketName, {
          public: true // Аватары публичные
        });
        if (createError) {
          console.error('❌ Ошибка создания bucket:', createError);
          return c.json({ error: 'Ошибка создания хранилища' }, 500);
        }
      }

      // Generate unique filename
      const fileExt = avatarFile.name.split('.').pop() || 'jpg';
      const fileName = `user_${userId}_${Date.now()}.${fileExt}`;
      const filePath = `users/${fileName}`;

      // Convert File to ArrayBuffer
      const arrayBuffer = await avatarFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Upload to Supabase Storage
      console.log(`💾 Загрузка файла ${filePath} в Supabase Storage...`);
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, uint8Array, {
          contentType: avatarFile.type,
          upsert: true
        });

      if (uploadError) {
        console.error('❌ Ошибка загрузки в Storage:', uploadError);
        return c.json({ error: 'Ошибка загрузки файла' }, 500);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      // Add cache-busting parameter to prevent browser caching
      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

      console.log(`✅ Аватар пользователя загружен: ${cacheBustedUrl}`);

      return c.json({ avatarUrl: cacheBustedUrl });
    } catch (error: any) {
      return handleError(c, 'Upload User Avatar', error);
    }
  });

}