import { Hono } from "npm:hono";
import { createAdminClient, createAuthClient, handleError } from './server_utils.tsx';

// Initialize clients
const supabase = createAdminClient();
const supabaseAuth = createAuthClient();

export function registerProfileRoutes(app: Hono) {

  // ==================== PROFILE ====================

  // Upload avatar (for current user profile)
  app.post("/make-server-73d66528/profile/upload-avatar", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      
      // Verify user
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
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
        console.error('❌ Ошибка загрузки в Storage:', uploadError);
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
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
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
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
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
