import { useState, useEffect, useRef } from 'react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { removeStorageItem } from '../../utils/storage';
import { Upload } from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: (accessToken: string, authType: 'signin' | 'signup', displayName?: string, sessionId?: string) => void;
}

export function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'verify-otp'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    
    const interval = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [resendTimer]);

  const validateEmail = (email: string): boolean => {
    const trimmedEmail = email.toLowerCase().trim();
    
    // Must not have spaces
    if (trimmedEmail.includes(' ')) return false;
    
    // Must end with @kode.ru
    if (!trimmedEmail.endsWith('@kode.ru')) return false;
    
    // Get the part before @kode.ru
    const localPart = trimmedEmail.replace('@kode.ru', '');
    
    // Local part must exist and be at least 1 character
    if (!localPart || localPart.length === 0) return false;
    
    // Local part must start with a letter
    if (!/^[a-z]/.test(localPart)) return false;
    
    // Single character - must be a letter
    if (localPart.length === 1) {
      return /^[a-z]$/.test(localPart);
    }
    
    // Multiple characters - can contain letters, numbers, dots, hyphens, underscores
    // But cannot end with dot/hyphen/underscore
    if (!/^[a-z][a-z0-9._-]*[a-z0-9]$/.test(localPart)) {
      return false;
    }
    
    // Cannot have consecutive dots
    if (/\.\./.test(localPart)) return false;
    
    return true;
  };

  // Timer countdown for resend OTP
  useEffect(() => {
    if (resendTimer > 0) {
      console.log('⏱️ Таймер OTP:', resendTimer, 'сек');
      const timer = setTimeout(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Handle avatar selection
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Проверка размера (макс 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Размер файла не должен превышать 5MB');
        return;
      }

      // Проверка типа
      if (!file.type.startsWith('image/')) {
        setError('Можно загружать только изображения');
        return;
      }

      setAvatarFile(file);

      // Создать preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Function to send/resend OTP
  const sendOTP = async (emailToSend: string, passwordToSend: string, firstNameToSend?: string, lastNameToSend?: string, avatarFileToSend?: File | null) => {
    const displayName = firstNameToSend && lastNameToSend 
      ? `${firstNameToSend} ${lastNameToSend}`.trim()
      : undefined;
    
    // Если есть аватар - используем FormData, иначе JSON
    if (avatarFileToSend) {
      const formData = new FormData();
      formData.append('email', emailToSend);
      formData.append('password', passwordToSend);
      if (displayName) {
        formData.append('displayName', displayName);
      }
      formData.append('avatar', avatarFileToSend);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/auth/signup`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
            // НЕ указываем Content-Type - браузер сам установит multipart/form-data с boundary
          },
          body: formData
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка отправки кода');
      }

      const result = await response.json();
      return result;
    } else {
      // Без аватара - обычный JSON
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/auth/signup`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            email: emailToSend, 
            password: passwordToSend,
            displayName
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка отправки кода');
      }

      const result = await response.json();
      return result;
    }
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0) {
      console.log('⏸️ Таймер еще активен:', resendTimer, 'сек');
      return;
    }
    
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      console.log('🔄 Повторная отправка OTP кода для:', email);
      
      await sendOTP(email, password);
      
      console.log('✅ OTP код отправлен повторно');
      setMessage('Код подтверждения отправлен повторно');
      console.log('⏱️ Запуск таймера на 120 секунд');
      setResendTimer(120);
    } catch (err: any) {
      console.error('❌ Ошибка повторной отправки OTP:', err);
      setError(err.message || 'Ошибка повторной отправки кода');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      // Validate name fields first
      if (!firstName.trim() || !lastName.trim()) {
        setError('Имя и Фамилия обязательны для заполнения');
        setIsLoading(false);
        return;
      }

      // Validate email domain
      if (!validateEmail(email)) {
        setError('Неверный формат email. Email должен начинаться с буквы до @kode.ru');
        setIsLoading(false);
        return;
      }

      // Validate password
      if (password.length < 6) {
        setError('Пароль должен содержать минимум 6 символов');
        setIsLoading(false);
        return;
      }

      console.log('🔄 Регистрация пользователя с OTP:', email, `${firstName} ${lastName}`, avatarFile ? 'с аватаркой' : 'без аватарки');

      const result = await sendOTP(email, password, firstName, lastName, avatarFile);
      console.log('✅ OTP отправлен:', result);

      // Switch to OTP verification mode and start timer
      console.log('🔄 Переключение на режим verify-otp');
      setMode('verify-otp');
      setMessage(result.message || 'Код подтверждения отправлен на ваш email');
      console.log('⏱️ Запуск таймера на 120 секунд');
      setResendTimer(120);
    } catch (err: any) {
      console.error('❌ Ошибка регистрации:', err);
      
      // Check if user already exists
      if (err.message && (err.message.includes('уже зарегистрирован') || err.message.includes('already registered'))) {
        // Check if email is confirmed
        try {
          console.log('🔍 Проверка статуса подтверждения email...');
          const checkResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/auth/check-user`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ email })
            }
          );
          
          if (checkResponse.ok) {
            const checkData = await checkResponse.json();
            console.log('📧 Статус email:', checkData);
            
            if (checkData.exists && !checkData.user.email_confirmed) {
              // Email not confirmed - resend OTP and switch to verify mode
              console.log('📨 Email не подтвержден, отправка нового OTP кода...');
              
              try {
                const resendResult = await sendOTP(email, password);
                console.log('✅ Новый OTP код отправлен');
                
                console.log('🔄 Переключение на режим verify-otp (незавершенная регистрация)');
                setMode('verify-otp');
                setMessage('Email не был подтвержден. Новый код отправлен на вашу почту');
                console.log('⏱️ Запуск таймера на 120 секунд');
                setResendTimer(120);
                setIsLoading(false);
                return;
              } catch (resendErr: any) {
                console.error('❌ Ошибка отправки нового OTP:', resendErr);
                setError('Не удалось отправить код подтверждения');
              }
            } else {
              // Email confirmed - show error
              setError('Пользователь с этим email уже зарегистрирован');
            }
          } else {
            setError('Пользователь с этим email уже зарегистрирован');
          }
        } catch (checkErr) {
          console.error('❌ Ошибка проверки статуса:', checkErr);
          setError('Пользователь с этим email уже зарегистрирован');
        }
      } else {
        setError(err.message || 'Ошибка регистрации');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      // Validate email format first
      if (!validateEmail(email)) {
        setError('Неверный формат email. Email должен начинаться с буквы до @kode.ru');
        setIsLoading(false);
        return;
      }

      console.log('🔄 Вход пользователя:', email);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/auth/signin`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Неверный email или пароль');
      }

      const data = await response.json();
      
      if (!data.access_token) {
        throw new Error('Не удалось получить токен доступа');
      }

      console.log('✅ Вход успешен');
      if (data.expires_at) {
        console.log('   Токен истекает:', new Date(data.expires_at * 1000).toLocaleString());
      }
      
      // Диагностика: что вернул сервер
      if (data._debug_server_tokens) {
        console.log('🖥️ СЕРВЕРНЫЕ ЛОГИ от Supabase:', data._debug_server_tokens);
      }
      
      console.log('🔍 Данные от сервера signin (получены клиентом):', {
        accessTokenLength: data.access_token?.length,
        sessionId: data.session_id ? data.session_id.substring(0, 8) + '...' : 'null',
        accessTokenPreview: data.access_token?.substring(0, 30) + '...'
      });
      const displayName = data.user?.user_metadata?.display_name || null;
      onAuthSuccess(data.access_token, 'signin', displayName, data.session_id);
    } catch (err: any) {
      console.error('❌ Ошибка входа:', err);
      
      // Check if it's an email not confirmed error
      if (err.message && err.message.includes('Email не подтвержден')) {
        // Automatically suggest resending OTP
        setError('Email не подтвержден. Хотите получить новый код подтверждения?');
        
        // Optionally try to check user status and offer to resend OTP
        try {
          console.log('🔍 Проверка статуса пользователя...');
          const checkResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/auth/check-user`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ email })
            }
          );
          
          if (checkResponse.ok) {
            const checkData = await checkResponse.json();
            console.log('   Результат проверки:', checkData);
            
            if (checkData.exists && !checkData.user.email_confirmed) {
              // User exists but email not confirmed - suggest switching to signup to resend OTP
              setError('Email не подтвержден. Нажмите "Создать аккаунт" для повторной отправки кода.');
            }
          }
        } catch (debugError) {
          console.error('❌ Ошибка проверки статуса:', debugError);
        }
      } else if (err.message && err.message.includes('Пользователь не найден')) {
        setError('Пользователь не найден. Пожалуйста, зарегистрируйтесь.');
      } else {
        setError(err.message || 'Неверный email или пароль');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      console.log('🔄 Проверка OTP кода...');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/auth/verify-otp`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, token: otp })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Неверный код подтверждения');
      }

      const data = await response.json();
      
      if (!data.access_token) {
        throw new Error('Не удалось получить токен доступа');
      }

      console.log('✅ Email подтвержден, вход выполнен');
      if (data.expires_at) {
        console.log('   Токен истекает:', new Date(data.expires_at * 1000).toLocaleString());
      }
      
      // Диагностика: что вернул сервер
      if (data._debug_server_tokens) {
        console.log('🖥️ СЕРВЕРНЫЕ ЛОГИ от Supabase:', data._debug_server_tokens);
      }
      
      console.log('🔍 Данные от сервера verify-otp (получены клиентом):', {
        accessTokenLength: data.access_token?.length,
        sessionId: data.session_id ? data.session_id.substring(0, 8) + '...' : 'null',
        accessTokenPreview: data.access_token?.substring(0, 30) + '...'
      });
      const displayName = `${firstName} ${lastName}`.trim() || data.user?.user_metadata?.display_name || null;
      onAuthSuccess(data.access_token, 'signup', displayName, data.session_id);
    } catch (err: any) {
      console.error('❌ Ошибка проверки OTP:', err);
      
      // Специальная обработка для истёкшего OTP
      if (err.message?.includes('expired') || err.message?.includes('invalid')) {
        setError('⏰ Код подтверждения истёк. Запросите новый код.');
        setOtp('');
      } else if (err.message?.includes('Неверный код')) {
        setError('❌ Неверный код подтверждения. Проверьте email и попробуйте снова.');
        setOtp('');
      } else {
        setError(err.message || 'Ошибка проверки кода. Попробуйте запросить новый код.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md px-6">
        <div className="bg-white rounded-2xl shadow-2xl pt-16 pb-8 px-8">
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 overflow-hidden">
              <svg width="80" height="80" viewBox="0 0 310 310" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_7774_71753)">
                <rect width="310" height="310" rx="72" fill="#39EC00"/>
                <path d="M245.732 225.863H267.872L267.392 165.327C264.438 158.235 261.189 151.061 257.937 144.087C248.871 124.654 240.379 104.964 231.552 85.4318L176.344 85.4698C157.43 127.128 140.373 169.865 121.304 211.483C119.165 216.152 117.097 220.891 115.133 225.638L162.931 225.819C164.899 221.181 167.104 215.585 169.199 211.085C188.844 210.352 211.144 210.851 230.982 210.845C226.293 200.107 220.618 186.796 215.416 176.393C205.085 176.403 193.931 176.6 183.657 176.385C189.681 161.054 196.399 145.732 202.644 130.429C213.917 154.227 224.353 178.639 235.575 202.487C239.186 210.161 242.608 217.975 245.732 225.863Z" fill="white"/>
                <path d="M246.073 225.819C244.105 221.181 241.9 215.585 239.805 211.085L224.633 95.4316V85.4698H232.66C251.574 127.128 268.631 169.865 287.7 211.483C289.839 216.152 291.907 220.891 293.871 225.638L246.073 225.819Z" fill="white"/>
                <path d="M214.133 0.5L78.1328 311.5H-1.36719V-6H217.133L214.133 0.5Z" fill="black"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M89.5634 85.4772C116.314 85.4453 151.887 83.5109 166.768 108.811L131.09 190.398C116.395 192.487 100.159 191.781 85.5039 191.78L85.5166 225.606L39.5185 225.592C39.3794 179.39 38.8382 131.695 39.3457 85.5827L89.5634 85.4772ZM113.296 122.019C104.079 120.941 94.7669 121.447 85.4922 121.58L85.3867 156.198C97.1124 156.272 115.241 158.339 124.12 151.212C133.316 140.046 128.347 123.779 113.296 122.019Z" fill="#39EC00"/>
                </g>
                <defs>
                <clipPath id="clip0_7774_71753">
                <rect width="310" height="310" rx="72" fill="white"/>
                </clipPath>
                </defs>
                </svg>

            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2 pb-8">
              Planaro v1.0
            </h1>
        
          </div>

          {/* Error message */}
          {error && (
            <div className={`mb-4 p-3 rounded-lg border ${
              error.includes('истёк') || error.includes('expired') 
                ? 'bg-amber-50 border-amber-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <p className={`text-sm mb-2 ${
                error.includes('истёк') || error.includes('expired')
                  ? 'text-amber-700'
                  : 'text-red-600'
              }`}>{error}</p>
              {error.includes('истёк') || error.includes('expired') ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-amber-700">
                    OTP коды действительны только 5 минут. Нажмите кнопку ниже для получения нового кода.
                  </p>
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={resendTimer > 0}
                    className="block w-full text-left text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resendTimer > 0 
                      ? `⏳ Подождите ${resendTimer} сек перед повторной отправкой`
                      : '📧 Отправить новый код подтверждения'
                    }
                  </button>
                </div>
              ) : error.includes('Invalid') || error.includes('Неверный формат') ? (
                <details className="mt-2">
                  <summary className="text-xs text-red-500 cursor-pointer hover:text-red-700">
                    📖 Как исправить?
                  </summary>
                  <div className="mt-2 text-xs text-red-600 space-y-1">
                    <p>• Email должен начинаться с буквы</p>
                    <p>• Минимум 1 символ до @kode.ru</p>
                    <p>• Разрешены: буквы, цифры, точки, дефисы</p>
                    <p>• Примеры: <code className="bg-red-100 px-1">a@kode.ru</code>, <code className="bg-red-100 px-1">ivan.petrov@kode.ru</code></p>
                  </div>
                </details>
              ) : error.includes('Email не подтвержден') || error.includes('not confirmed') ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-red-600">
                    Ваш email ещё не подтверждён. Для получения нового кода подтверждения:
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setError('');
                      setMessage('Введите данные для получения нового кода');
                    }}
                    className="block w-full text-left text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2 rounded transition-colors"
                  >
                    → Получить новый код подтверждения
                  </button>
                </div>
              ) : error.includes('уже зарегистрирован') || error.includes('already registered') ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-red-600">
                    Этот email уже зарегистрирован в системе.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setFirstName('');
                      setLastName('');
                      setError('');
                      setMessage('Войдите с существующими учетными данными');
                    }}
                    className="block w-full text-left text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2 rounded transition-colors"
                  >
                    → Перейти к входу
                  </button>
                </div>
              ) : error.includes('Пользователь не найден') ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-red-600">
                    Аккаунт с таким email не существует.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setError('');
                      setMessage('Создайте новый аккаунт');
                    }}
                    className="block w-full text-left text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2 rounded transition-colors"
                  >
                    → Зарегистрироваться
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* Success message */}
          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-600">{message}</p>
            </div>
          )}

          {/* OTP Verification Form */}
          {mode === 'verify-otp' && (
  <form onSubmit={handleVerifyOTP} className="space-y-4">
    
    

    {/* OTP input */}
    <div>
      <input
        id="otp"
        type="text"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        placeholder="Введите код из письма"
        required
        maxLength={6}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      />
      <p className="mt-2 text-xs text-gray-500">
        Проверьте почту <span className="font-medium">{email}</span> и введите 6-значный код
      </p>
      <p className="mt-1 text-xs text-amber-600">
        ⏰ Код действителен в течение 5 минут. Если код истёк, запросите новый.
      </p>
    </div>

    {/* Подтвердить OTP */}
    <button
      type="submit"
      disabled={isLoading || !otp}
      className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-center"
    >
      {isLoading ? 'Проверка...' : 'Подтвердить'}
    </button>

    {/* Resend OTP button */}
    <button
      type="button"
      onClick={handleResendOTP}
      disabled={resendTimer > 0 || isLoading}
      className="text-center w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors border border-transparent hover:border-blue-200 rounded-lg"
    >
      {resendTimer > 0 
        ? `Отправить повторно через ${resendTimer} сек`
        : 'Отправить код повторно'
      }
    </button>

    <button
                type="button"
                onClick={() => {
        setMode('signin');
        setOtp('');
        setFirstName('');
        setLastName('');
        setError('');
        setMessage('');
        setResendTimer(0);
      }}
                className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors text-center"
              >
                Вернуться на авторизацию
              </button>

  </form>
)}


          {/* Sign In Form */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    const value = e.target.value.toLowerCase();
                    setEmail(value);
                    // Clear error when user starts typing
                    if (error) setError('');
                  }}
                  onBlur={(e) => {
                    // Trim on blur
                    setEmail(e.target.value.trim());
                  }}
                  placeholder="your.name@kode.ru"
                  required
                  autoComplete="email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    // Clear error when user starts typing
                    if (error) setError('');
                  }}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-center"
              >
                {isLoading ? 'Вход...' : 'Войти'}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">или</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setFirstName('');
                  setLastName('');
                  setError('');
                  setMessage('');
                }}
                className="w-full py-3 px-4 bg-white text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium text-center"
              >
                Создать аккаунт
              </button>
            </form>
          )}

          {/* Sign Up Form */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <input
                  id="firstName-signup"
                  type="text"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    if (error) setError('');
                  }}
                  onBlur={(e) => setFirstName(e.target.value.trim())}
                  placeholder="Имя"
                  required
                  autoComplete="given-name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <input
                  id="lastName-signup"
                  type="text"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    if (error) setError('');
                  }}
                  onBlur={(e) => setLastName(e.target.value.trim())}
                  placeholder="Фамилия"
                  required
                  autoComplete="family-name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Avatar upload */}
              <div>
                <div className="flex items-center gap-4">
                  {/* Avatar preview */}
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center overflow-hidden">
                      {avatarPreview ? (
                        <img 
                          src={avatarPreview} 
                          alt="Avatar preview" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-white text-xl font-semibold">
                          {firstName && lastName 
                            ? `${firstName[0]}${lastName[0]}`.toUpperCase() 
                            : '?'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Upload button */}
                  <div className="flex-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-gray-700"
                    >
                      <Upload className="w-5 h-5" />
                      <span className="text-sm">
                        {avatarFile ? avatarFile.name : 'Загрузить фото (необязательно)'}
                      </span>
                    </button>
                    <p className="text-xs text-gray-500 mt-1">
                      Максимум 5MB
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarSelect}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              <div>
                <input
                  id="email-signup"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    const value = e.target.value.toLowerCase();
                    setEmail(value);
                    if (error) setError('');
                  }}
                  onBlur={(e) => setEmail(e.target.value.trim())}
                  placeholder="Почта на @kode.ru"
                  required
                  autoComplete="email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                
              </div>

              <div>
                <input
                  id="password-signup"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Минимум 6 символов"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-center"
              >
                {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setFirstName('');
                  setLastName('');
                  setError('');
                  setMessage('');
                }}
                className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors text-center"
              >
                Уже есть аккаунт? Войти
              </button>
            </form>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            {mode === 'signin' && (
              <div className="mb-4">
                
                
              </div>
            )}
          
            <p className="text-xs text-gray-500 text-center">
              Planaro © 2025
            </p>
            <p className="text-xs text-gray-400 text-center mt-2">
              Только для сотрудников с адресами @kode.ru
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
