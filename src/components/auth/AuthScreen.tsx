import Planaro from "../../imports/Planaro-825-771";
import { useState, useEffect, useRef } from "react";
import {
  projectId,
  publicAnonKey,
} from "../../utils/supabase/info";
import { removeStorageItem } from "../../utils/storage";
import {
  Upload,
  ArrowRight,
  Mail,
  Lock,
  User,
  Check,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface AuthScreenProps {
  onAuthSuccess: (
    accessToken: string,
    authType: "signin" | "signup",
    displayName?: string,
    sessionId?: string,
  ) => void;
}

export function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<
    "signin" | "signup" | "verify-otp"
  >("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setlastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(
    null,
  );
  const [avatarPreview, setAvatarPreview] = useState<
    string | null
  >(null);
  const [resendTimer, setResendTimer] = useState(0);

  // Helper function to fetch OTP rate limit from server
  const fetchOTPRateLimit = async (emailToCheck: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/auth/otp-rate-limit/${encodeURIComponent(emailToCheck)}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        if (data.remainingSeconds > 0) {
          console.log(
            `⏱️ Синхронизация таймера с сервером: ${data.remainingSeconds} сек`,
          );
          setResendTimer(data.remainingSeconds);
        }
      }
    } catch (err) {
      console.error("Ошибка проверки rate limit:", err);
      // Не показываем ошибку пользователю, просто не обновляем таймер
    }
  };

  // Helper function to safely parse JSON response
  const safeJsonParse = async (response: Response) => {
    const contentType = response.headers.get("content-type");
    if (
      contentType &&
      contentType.includes("application/json")
    ) {
      try {
        return await response.json();
      } catch (e) {
        console.error("JSON parse error:", e);
        throw new Error("Ошибка парсинга ответа сервера");
      }
    } else {
      const text = await response.text();
      console.error(
        "Non-JSON response:",
        text.substring(0, 200),
      );
      throw new Error("Сервер вернул некорректный ответ");
    }
  };

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendTimer <= 0) return;

    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [resendTimer]);

  // Fetch rate limit when entering OTP mode
  useEffect(() => {
    if (mode === "verify-otp" && email) {
      fetchOTPRateLimit(email);
    }
  }, [mode, email]);

  const validateEmail = (email: string): boolean => {
    const trimmedEmail = email.toLowerCase().trim();
    if (trimmedEmail.includes(" ")) return false;
    const atIndex = trimmedEmail.indexOf("@");
    if (atIndex < 1) return false;
    const localPart = trimmedEmail.substring(0, atIndex);
    const domain = trimmedEmail.substring(atIndex + 1);
    if (!domain || !domain.includes(".")) return false;
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
  const handleAvatarSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Размер файла не должен превышать 5MB");
        return;
      }
      if (!file.type.startsWith("image/")) {
        setError("Можно загружать только изображения");
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Function to send/resend OTP
  const sendOTP = async (
    emailToSend: string,
    passwordToSend: string,
    firstNameToSend?: string,
    lastNameToSend?: string,
    avatarFileToSend?: File | null,
  ) => {
    const displayName =
      firstNameToSend && lastNameToSend
        ? `${firstNameToSend} ${lastNameToSend}`.trim()
        : undefined;

    if (avatarFileToSend) {
      const formData = new FormData();
      formData.append("email", emailToSend);
      formData.append("password", passwordToSend);
      if (displayName) {
        formData.append("displayName", displayName);
      }
      formData.append("avatar", avatarFileToSend);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/auth/signup`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        const errorData = await safeJsonParse(response);
        throw new Error(
          errorData.error || "Ошибка отправки кода",
        );
      }

      const result = await safeJsonParse(response);
      return result;
    } else {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/auth/signup`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: emailToSend,
            password: passwordToSend,
            displayName,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await safeJsonParse(response);
        throw new Error(
          errorData.error || "Ошибка отправки кода",
        );
      }

      const result = await response.json();
      return result;
    }
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0) return;

    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      await sendOTP(email, password);
      setMessage("Код подтверждения отправлен повторно");
      setResendTimer(120);
    } catch (err: any) {
      setError(err.message || "Ошибка повторной отправки кода");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      if (!firstName.trim() || !lastName.trim()) {
        setError("Имя и Фамилия обязательны для заполнения");
        setIsLoading(false);
        return;
      }

      if (!validateEmail(email)) {
        setError(
          "Неверный формат email",
        );
        setIsLoading(false);
        return;
      }

      if (password.length < 6) {
        setError("Пароль должен содержать минимум 6 символов");
        setIsLoading(false);
        return;
      }

      const result = await sendOTP(
        email,
        password,
        firstName,
        lastName,
        selectedFile,
      );

      // Проверяем, нужна ли верификация OTP или пользователь сразу залогинен
      if (result.access_token && result.session_id) {
        // Успешная регистрация и автоматический вход (v3.0+)
        console.log(
          "✅ Регистрация успешна, пользователь автоматически залогинен",
        );
        const displayName = `${firstName} ${lastName}`.trim();
        onAuthSuccess(
          result.access_token,
          "signup",
          displayName,
          result.session_id,
        );
      } else if (result.requiresOTP) {
        // Старая логика с OTP (для обратной совместимости)
        setMode("verify-otp");
        setMessage("Код подтверждения отправлен");
        setResendTimer(120);
      } else if (result.requiresSignIn) {
        // Пользователь создан, но нужно войти вручную
        setMode("signin");
        setMessage(
          "Регистрация успешна. Пожалуйста, войдите в систему.",
        );
      } else {
        // Неизвестный ответ
        setError(
          "Произошла ошибка при регистрации. Попробуйте войти.",
        );
      }
    } catch (err: any) {
      if (
        err.message &&
        (err.message.includes("уже зарегистрирован") ||
          err.message.includes("already registered"))
      ) {
        try {
          const checkResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/auth/check-user`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${publicAnonKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ email }),
            },
          );

          if (checkResponse.ok) {
            const checkData = await checkResponse.json();
            if (
              checkData.exists &&
              !checkData.user.email_confirmed
            ) {
              try {
                await sendOTP(email, password);
                setMode("verify-otp");
                setMessage(
                  "Email не был подтвержден. Новый код отправлен на вашу почту",
                );
                setResendTimer(120);
                setIsLoading(false);
                return;
              } catch (resendErr: any) {
                setError(
                  "Не удалось отправить код подтверждения",
                );
              }
            } else {
              setError(
                "Пользователь с этим email уже зарегистрирован",
              );
            }
          } else {
            setError(
              "Пользователь с этим email уже зарегистрирован",
            );
          }
        } catch (checkErr) {
          setError(
            "Пользователь с этим email уже зарегистрирован",
          );
        }
      } else {
        setError(err.message || "Ошибка регистрации");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      if (!validateEmail(email)) {
        setError(
          "Неверный формат email",
        );
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/auth/signin`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        },
      );

      if (!response.ok) {
        const errorData = await safeJsonParse(response);
        throw new Error(
          errorData.error || "Неверный email или пароль",
        );
      }

      const data = await response.json();

      // Check if OTP is required (server handles unconfirmed email)
      if (data.requiresOTP) {
        setMode("verify-otp");
        setMessage(
          data.message ||
            "Код подтверждения отправлен на ваш email",
        );
        setResendTimer(120);
        setIsLoading(false);
        return;
      }

      if (!data.access_token) {
        throw new Error("Не удалось получить токен доступа");
      }

      const displayName =
        data.user?.user_metadata?.display_name || null;
      onAuthSuccess(
        data.access_token,
        "signin",
        displayName,
        data.session_id,
      );
    } catch (err: any) {
      if (
        err.message &&
        err.message.includes("Email не подтвержден")
      ) {
        setError(
          "Email не подтвержден. Хотите получить новый код подтверждения?",
        );
      } else if (
        err.message &&
        err.message.includes("Пользователь не найден")
      ) {
        setError(
          "Пользователь не найден. Пожалуйста, зарегистрируйтесь.",
        );
      } else {
        setError(err.message || "Неверный email или пароль");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/auth/verify-otp`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, token: otp }),
        },
      );

      if (!response.ok) {
        const errorData = await safeJsonParse(response);
        throw new Error(
          errorData.error || "Неверный код подтверждения",
        );
      }

      const data = await response.json();

      if (!data.access_token) {
        throw new Error("Не удалось получить токен доступа");
      }

      const displayName =
        `${firstName} ${lastName}`.trim() ||
        data.user?.user_metadata?.display_name ||
        null;
      onAuthSuccess(
        data.access_token,
        "signup",
        displayName,
        data.session_id,
      );
    } catch (err: any) {
      // Упрощённая обработка: показываем сообщение от сервера как есть
      setError(
        err.message ||
          "Ошибка проверки кода. Попробуйте запросить новый код.",
      );
      setOtp("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        {/* Card container - белый фон, обводка абсолютным позиционированием, скругление 16px */}
        <div className="relative bg-white rounded-[16px] p-8 md:p-10">
          <div className="absolute border border-[#f0f0f0] border-solid inset-0 pointer-events-none rounded-[16px]" />

          {/* Header */}
          <div className="text-center mb-8 relative z-10 flex flex-col items-center px-[0px] py-[16px]">
            <div className="h-6 w-auto aspect-[987/143] mb-2">
              <Planaro />
            </div>
            <p className="text-sm text-muted-foreground">
              Управление ресурсами
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 rounded-[10px] bg-red-50 border border-red-200 text-sm flex gap-3 items-start relative z-10">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-600 font-medium">
                  {(() => {
                    // Дружелюбные сообщения вместо технических
                    if (
                      error.includes("Email не подтвержден")
                    ) {
                      return "Email не подтвержден. Введите код из письма.";
                    }
                    if (
                      error.includes("Пользователь не найден")
                    ) {
                      return "Аккаунт с этой почтой не найден. Хотите зарегистрироваться?";
                    }
                    if (
                      error.includes("Неправильный пароль") ||
                      error.includes(
                        "Invalid login credentials",
                      )
                    ) {
                      return "Неверный пароль. Попробуйте ещё раз";
                    }
                    if (
                      error.includes(
                        "Email должен быть @kode.ru",
                      )
                    ) {
                      return "Неверный формат email";
                    }
                    if (
                      error.includes("Код подтверждения истек")
                    ) {
                      return "Срок действия кода истёк. Запросите новый код";
                    }
                    if (error.includes("Неверный код")) {
                      return "Код не подходит. Проверьте и попробуйте снова";
                    }
                    if (
                      error.includes("User already registered")
                    ) {
                      return "Этот email уже зарегистрирован. Попробуйте войти";
                    }
                    if (
                      error.includes("Failed to fetch") ||
                      error.includes("Network")
                    ) {
                      return "Проблема с подключением. Проверьте интернет и попробуйте снова";
                    }
                    // Если не нашли совпадения - показываем как есть
                    return error;
                  })()}
                </p>

                {error.includes("Email не подтвержден") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 h-8 text-red-700 hover:bg-red-100 hover:text-red-800 bg-white"
                    onClick={() => {
                      setMode("verify-otp");
                      setError("");
                    }}
                  >
                    Ввести код подтверждения
                  </Button>
                )}

                {error.includes("Пользователь не найден") && (
                  <Button
                    variant="link"
                    className="h-auto p-0 text-red-700 underline mt-2 font-normal"
                    onClick={() => {
                      setMode("signup");
                      setError("");
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
            <div className="mb-6 p-4 rounded-[10px] bg-emerald-50 border border-emerald-200 text-sm flex gap-3 items-center relative z-10">
              <Check className="w-5 h-5 text-emerald-500 shrink-0" />
              <p className="text-emerald-700 font-medium">
                {message}
              </p>
            </div>
          )}

          {/* OTP Verification Form */}
          {mode === "verify-otp" && (
            <form
              onSubmit={handleVerifyOTP}
              className="space-y-6 relative z-10"
            >
              <div className="space-y-2">
                <Input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Код из письма (6 цифр)"
                  required
                  maxLength={6}
                  className="text-2xl h-16"
                />
                <div className="flex justify-between text-xs text-muted-foreground px-1">
                  <span>Отправлено на {email}</span>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={isLoading || otp.length < 6}
              >
                {isLoading ? "Проверка..." : "Подтвердить"}
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
                    : "Отправить код повторно"}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setMode("signin");
                    setOtp("");
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
          {mode === "signin" && (
            <form
              onSubmit={handleSignIn}
              className="space-y-6 relative z-10"
            >
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) =>
                        setEmail(e.target.value.toLowerCase())
                      }
                      placeholder="Email"
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
                      onChange={(e) =>
                        setPassword(e.target.value)
                      }
                      placeholder="Пароль"
                      required
                      autoComplete="current-password"
                      className="pl-12"
                    />
                  </div>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={isLoading}
              >
                {isLoading ? "Вход..." : "Войти"}
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-muted" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">
                    или
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setMode("signup");
                  setError("");
                  setMessage("");
                }}
                className="w-full h-12"
              >
                Создать аккаунт
              </Button>
            </form>
          )}

          {/* Sign Up Form */}
          {mode === "signup" && (
            <form
              onSubmit={handleSignUp}
              className="space-y-6 relative z-10"
            >
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <Input
                    value={firstName}
                    onChange={(e) =>
                      setFirstName(e.target.value)
                    }
                    placeholder="Имя"
                    required
                  />
                  <Input
                    value={lastName}
                    onChange={(e) =>
                      setlastName(e.target.value)
                    }
                    placeholder="Фамилия"
                    required
                  />
                </div>

                <Input
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value.toLowerCase())
                  }
                  placeholder="Email"
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

              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={isLoading}
              >
                {isLoading
                  ? "Регистрация..."
                  : "Зарегистрироваться"}
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-muted" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">
                    или
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setMode("signin");
                  setError("");
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
          <p>&copy; 2026 Planaro</p>
        </div>
      </div>
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={3}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}