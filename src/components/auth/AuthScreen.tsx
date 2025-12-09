import { useState, useEffect, useRef } from 'react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { removeStorageItem } from '../../utils/storage';
import { Upload, ArrowRight, Mail, Lock, User, Check, Clock, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

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
    if (trimmedEmail.includes(' ')) return false;
    if (!trimmedEmail.endsWith('@kode.ru')) return false;
    const localPart = trimmedEmail.replace('@kode.ru', '');
    if (!localPart || localPart.length === 0) return false;
    if (!/^[a-z]/.test(localPart)) return false;
    if (localPart.length === 1) {
      return /^[a-z]$/.test(localPart);
    }
    if (!/^[a-z][a-z0-9._-]*[a-z0-9]$/.test(localPart)) {
      return false;
    }
    if (/\.\./.test(localPart)) return false;
    return true;
  };

  // Handle avatar selection
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Размер файла не должен превышать 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError('Можно загружать только изображения');
        return;
      }
      setAvatarFile(file);
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
    if (resendTimer > 0) return;
    
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      await sendOTP(email, password);
      setMessage('Код подтверждения отправлен повторно');
      setResendTimer(120);
    } catch (err: any) {
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
      if (!firstName.trim() || !lastName.trim()) {
        setError('Имя и Фамилия обязательны для заполнения');
        setIsLoading(false);
        return;
      }

      if (!validateEmail(email)) {
        setError('Неверный формат email. Email должен начинаться с буквы до @kode.ru');
        setIsLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('Пароль должен содержать минимум 6 символов');
        setIsLoading(false);
        return;
      }

      const result = await sendOTP(email, password, firstName, lastName, avatarFile);
      setMode('verify-otp');
      setMessage(result.message || 'Код подтверждения отправлен на ваш email');
      setResendTimer(120);
    } catch (err: any) {
      if (err.message && (err.message.includes('уже зарегистрирован') || err.message.includes('already registered'))) {
        try {
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
            if (checkData.exists && !checkData.user.email_confirmed) {
              try {
                await sendOTP(email, password);
                setMode('verify-otp');
                setMessage('Email не был подтвержден. Новый код отправлен на вашу почту');
                setResendTimer(120);
                setIsLoading(false);
                return;
              } catch (resendErr: any) {
                setError('Не удалось отправить код подтверждения');
              }
            } else {
              setError('Пользователь с этим email уже зарегистрирован');
            }
          } else {
            setError('Пользователь с этим email уже зарегистрирован');
          }
        } catch (checkErr) {
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
      if (!validateEmail(email)) {
        setError('Неверный формат email. Email должен начинаться с буквы до @kode.ru');
        setIsLoading(false);
        return;
      }

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

      const displayName = data.user?.user_metadata?.display_name || null;
      onAuthSuccess(data.access_token, 'signin', displayName, data.session_id);
    } catch (err: any) {
      if (err.message && err.message.includes('Email не подтвержден')) {
        setError('Email не подтвержден. Хотите получить новый код подтверждения?');
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

      const displayName = `${firstName} ${lastName}`.trim() || data.user?.user_metadata?.display_name || null;
      onAuthSuccess(data.access_token, 'signup', displayName, data.session_id);
    } catch (err: any) {
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
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#f0f4f8] p-4">
      <div className="w-full max-w-md">
        {/* Card container - rounded-3xl, no shadow, border */}
        <div className="bg-white rounded-[28px] border border-border/50 p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-6 bg-secondary/20 rounded-2xl py-6 px-4">
            <div className="inline-flex items-center justify-center w-20 h-20 mb-4">
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
            <h1 className="text-3xl font-normal text-foreground tracking-tight">
              Planaro
            </h1>

          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50/50 border border-red-200 text-sm flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-600 font-medium">
                  {(() => {
                    // Дружелюбные сообщения вместо технических
                    if (error.includes('Email не подтвержден')) {
                      return 'Проверьте вашу почту и введите код подтверждения';
                    }
                    if (error.includes('Пользователь не найден')) {
                      return 'Аккаунт с этой почтой не найден. Хотите зарегистрироваться?';
                    }
                    if (error.includes('Неправильный пароль') || error.includes('Invalid login credentials')) {
                      return 'Неверный пароль. Попробуйте ещё раз';
                    }
                    if (error.includes('Email должен быть @kode.ru')) {
                      return 'Используйте корпоративную почту @kode.ru для входа';
                    }
                    if (error.includes('Код подтверждения истек')) {
                      return 'Срок действия кода истёк. Запросите новый код';
                    }
                    if (error.includes('Неверный код')) {
                      return 'Код не подходит. Проверьте и попробуйте снова';
                    }
                    if (error.includes('User already registered')) {
                      return 'Этот email уже зарегистрирован. Попробуйте войти';
                    }
                    if (error.includes('Failed to fetch') || error.includes('Network')) {
                      return 'Проблема с подключением. Проверьте интернет и попробуйте снова';
                    }
                    // Если не нашли совпадения - показываем как есть
                    return error;
                  })()}
                </p>
                
                {error.includes('Email не подтвержден') && (
                  <Button 
                    variant="link" 
                    className="h-auto p-0 text-red-700 underline mt-2 font-normal"
                    onClick={() => {
                      setMode('signup');
                      setError('');
                      setMessage('Введите данные для получения нового кода');
                    }}
                  >
                    Получить новый код
                  </Button>
                )}
                
                {error.includes('Пользователь не найден') && (
                  <Button 
                    variant="link" 
                    className="h-auto p-0 text-red-700 underline mt-2 font-normal"
                    onClick={() => {
                      setMode('signup');
                      setError('');
                    }}
                  >
                    Зарегистрироваться
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Success message */}
          {message && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 text-sm flex gap-3 items-center">
              <Check className="w-5 h-5 text-emerald-500 shrink-0" />
              <p className="text-emerald-700 font-medium">{message}</p>
            </div>
          )}

          {/* OTP Verification Form */}
          {mode === 'verify-otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-6">
              <div className="space-y-2">
                <Input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Код из письма (6 цифр)"
                  required
                  maxLength={6}
                  className="text-center text-2xl tracking-[0.5em] h-16"
                />
                <div className="flex justify-between text-xs text-muted-foreground px-1">
                  <span>Отправлено на {email}</span>
                  {resendTimer > 0 && (
                    <span className="flex items-center text-amber-600">
                      <Clock className="w-3 h-3 mr-1" /> {Math.floor(resendTimer / 60)}:{(resendTimer % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base" 
                disabled={isLoading || otp.length < 6}
              >
                {isLoading ? 'Проверка...' : 'Подтвердить'}
              </Button>

              <div className="flex flex-col gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResendOTP}
                  disabled={resendTimer > 0 || isLoading}
                  className="w-full text-sm"
                >
                  {resendTimer > 0 
                    ? `Отправить повторно через ${resendTimer} сек`
                    : 'Отправить код повторно'
                  }
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setMode('signin');
                    setOtp('');
                    setResendTimer(0);
                  }}
                  className="w-full text-sm text-muted-foreground"
                >
                  Вернуться к входу
                </Button>
              </div>
            </form>
          )}

          {/* Sign In Form */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-6">
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value.toLowerCase())}
                      placeholder="Email (@kode.ru)"
                      required
                      autoComplete="email"
                      className="pl-12"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Пароль"
                      required
                      autoComplete="current-password"
                      className="pl-12"
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full h-12 text-base" disabled={isLoading}>
                {isLoading ? 'Вход...' : 'Войти'}
              </Button>
              
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-muted" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">или</span>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setMode('signup');
                  setError('');
                  setMessage('');
                }}
                className="w-full h-12"
              >
                Создать аккаунт
              </Button>
              
              {/* Helper text for demo */}
              <div className="text-center">
                 <button
                    type="button"
                    onClick={() => {
                      setEmail('test@kode.ru');
                      setPassword('test123');
                    }}
                    className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    Заполнить тестовые данные
                  </button>
              </div>
            </form>
          )}

          {/* Sign Up Form */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-6">
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Имя"
                    required
                  />
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Фамилия"
                    required
                  />
                </div>

                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  placeholder="Email (@kode.ru)"
                  required
                />

                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Пароль (мин. 6 символов)"
                  required
                  minLength={6}
                />
              </div>

              <Button type="submit" className="w-full h-12 text-base" disabled={isLoading}>
                {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-muted" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">или</span>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setMode('signin');
                  setError('');
                }}
                className="w-full h-12"
              >
                Войти в аккаунт
              </Button>
            </form>
          )}
        </div>
        
        {/* Footer info */}
        <div className="text-center mt-8 text-xs text-muted-foreground opacity-60">
          <p>© 2025 Planaro. Внутренний сервис Kode.</p>
        </div>
      </div>
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}