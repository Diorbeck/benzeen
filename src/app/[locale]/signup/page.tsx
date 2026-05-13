'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Mail, Phone, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthLayout, inputClass } from '@/components/auth/auth-layout';

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 60;

type Step = 1 | 2 | 3 | 4;
type VerificationMethod = 'email' | 'phone';

export default function SignupPage() {
  const t = useTranslations('signup');
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const locale = pathname.split('/')[1] || 'ru';

  const [step, setStep] = useState<Step>(1);
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [success, setSuccess] = useState(false);
  const resendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
    };
  }, []);

  const validateStep1 = (): boolean => {
    setError('');
    const trimmedName = fullName.trim();
    const trimmedCompany = companyName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedCompany || !trimmedEmail || !password) {
      setError(t('validation.requiredFields'));
      return false;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError(t('validation.emailInvalid'));
      return false;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('validation.passwordMin'));
      return false;
    }
    return true;
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1()) return;
    setLoading(true);
    setError('');
    try {
      // Simulate check (e.g. email already in use)
      await new Promise((r) => setTimeout(r, 400));
      setStep(2);
    } catch {
      setError(t('validation.emailInUse'));
    } finally {
      setLoading(false);
    }
  };

  const sendVerificationCode = async (method: VerificationMethod) => {
    const identifier = method === 'email' ? email.trim() : phone.trim();
    if (!identifier) {
      setError(t('validation.requiredFields'));
      return false;
    }
    const res = await fetch('/api/auth/send-verification-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier,
        method,
        purpose: 'signup',
        signupPayload: {
          fullName: fullName.trim(),
          companyName: companyName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || t('validation.invalidCode'));
      return false;
    }
    return true;
  };

  const handleSelectMethod = async (method: VerificationMethod) => {
    setError('');
    setLoading(true);
    try {
      const ok = await sendVerificationCode(method);
      if (!ok) {
        setLoading(false);
        return;
      }
      if (resendIntervalRef.current) {
        clearInterval(resendIntervalRef.current);
        resendIntervalRef.current = null;
      }
      setVerificationMethod(method);
      setStep(3);
      setCode('');
      setResendCooldown(RESEND_COOLDOWN_SEC);
      resendIntervalRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
            resendIntervalRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = code.replace(/\D/g, '');
    if (trimmed.length !== CODE_LENGTH) {
      setError(t('validation.invalidCode'));
      return;
    }
    if (!verificationMethod) return;
    const identifier =
      verificationMethod === 'email' ? email.trim() : phone.trim();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          code: trimmed,
          purpose: 'signup',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error === 'Invalid or expired code. Please request a new one.'
            ? t('validation.codeExpired')
            : data.error || t('validation.invalidCode')
        );
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        router.push(`/${locale}/manager-login`);
      }, 2000);
    } catch {
      setError(t('validation.codeExpired'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || !verificationMethod) return;
    setError('');
    setLoading(true);
    try {
      const ok = await sendVerificationCode(verificationMethod);
      if (!ok) {
        setLoading(false);
        return;
      }
      if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
      setResendCooldown(RESEND_COOLDOWN_SEC);
      resendIntervalRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
            resendIntervalRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  const handleBackFromStep3 = () => {
    if (resendIntervalRef.current) {
      clearInterval(resendIntervalRef.current);
      resendIntervalRef.current = null;
    }
    setStep(2);
    setVerificationMethod(null);
    setCode('');
    setError('');
    setResendCooldown(0);
  };

  const handleBackFromStep2 = () => {
    setStep(1);
    setVerificationMethod(null);
    setError('');
  };

  if (success) {
    return (
      <AuthLayout
        title={t('title')}
        subtitle={t('subtitle')}
        backHref={`/${locale}/manager-login`}
        backLabel={t('backToLogin')}
      >
        <div
          className="rounded-xl bg-emerald-500/10 px-4 py-4 text-center text-sm text-emerald-600 dark:text-emerald-400"
          role="status"
        >
          <p className="font-medium">{t('success')}</p>
          <p className="mt-1 text-xs opacity-90">{t('successSubtitle')}</p>
        </div>
        <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
          {t('redirecting')}
        </p>
      </AuthLayout>
    );
  }

  if (step === 1) {
    return (
      <AuthLayout title={t('title')} subtitle={t('subtitleStep1')}>
        <form onSubmit={handleStep1Submit} className="space-y-4">
          {error && (
            <p
              className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
              role="alert"
            >
              {error}
            </p>
          )}
          <div>
            <label
              htmlFor="signup-name"
              className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              {t('fullName')}
            </label>
            <input
              id="signup-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
              disabled={loading}
            />
          </div>
          <div>
            <label
              htmlFor="signup-company"
              className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              {t('companyName')}
            </label>
            <input
              id="signup-company"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              className={inputClass}
              disabled={loading}
            />
          </div>
          <div>
            <label
              htmlFor="signup-email"
              className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              {t('email')}
            </label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
              disabled={loading}
            />
          </div>
          <div>
            <label
              htmlFor="signup-phone"
              className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              {t('phone')}
            </label>
            <input
              id="signup-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              disabled={loading}
            />
          </div>
          <div>
            <label
              htmlFor="signup-password"
              className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              {t('password')}
            </label>
            <div className="relative">
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                className={inputClass}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? t('submitting') : t('continue')}
          </Button>
        </form>
      </AuthLayout>
    );
  }

  if (step === 2) {
    const methodBtnClass =
      'flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-left transition hover:border-primary-500/40 hover:bg-primary-500/5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:border-white/10 dark:bg-white/5 dark:hover:border-primary-500/40 dark:hover:bg-primary-500/10 dark:focus:ring-offset-gray-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
    return (
      <AuthLayout title={t('step2Title')} subtitle={t('step2Subtitle')}>
        <div className="relative z-10 space-y-4">
          {error && (
            <p
              className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
              role="alert"
            >
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleSelectMethod('email')}
            className={methodBtnClass}
            aria-label={t('verifyByEmail')}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/20 text-primary-500 dark:text-primary-400">
              <Mail className="h-5 w-5" />
            </div>
            <span className="font-medium text-gray-900 dark:text-white">
              {loading ? t('submitting') : t('verifyByEmail')}
            </span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleSelectMethod('phone')}
            className={methodBtnClass}
            aria-label={t('verifyByPhone')}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/20 text-primary-500 dark:text-primary-400">
              <Phone className="h-5 w-5" />
            </div>
            <span className="font-medium text-gray-900 dark:text-white">
              {loading ? t('submitting') : t('verifyByPhone')}
            </span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleBackFromStep2}
            className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </button>
        </div>
      </AuthLayout>
    );
  }

  if (step === 3 && verificationMethod) {
    return (
      <AuthLayout title={t('step3Title')} subtitle={verificationMethod === 'email' ? t('sentToEmail') : t('sentToPhone')}>
        <form onSubmit={handleConfirmCode} className="space-y-4">
          {error && (
            <p
              className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
              role="alert"
            >
              {error}
            </p>
          )}
          <div>
            <label
              htmlFor="signup-code"
              className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              {t('codePlaceholder')}
            </label>
            <input
              id="signup-code"
              type="text"
              inputMode="numeric"
              maxLength={CODE_LENGTH}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
              placeholder="000000"
              className={inputClass}
              disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading || code.replace(/\D/g, '').length !== CODE_LENGTH} className="w-full">
            {loading ? t('submitting') : t('confirmCode')}
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleResendCode}
              disabled={loading || resendCooldown > 0}
              className="text-sm text-primary-500 hover:underline disabled:opacity-50 dark:text-primary-400"
            >
              {resendCooldown > 0 ? `${t('resendCode')} (${resendCooldown}s)` : t('resendCode')}
            </button>
            <button
              type="button"
              onClick={handleBackFromStep3}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t('changeMethod')}
            </button>
          </div>
          <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
            {t('noEmailHint')}
          </p>
        </form>
      </AuthLayout>
    );
  }

  return null;
}
