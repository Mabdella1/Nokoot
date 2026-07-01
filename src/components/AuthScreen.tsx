import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth } from '../firebase';
import { Mail, Key, User, ShieldAlert, Sparkles, CheckCircle, Moon, Sun, Coins } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthScreenProps {
  onAuthSuccess: (userId: string, isGuest: boolean) => void;
  savedPinHash?: string;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onCancelGuest?: () => void;
  showCancelButton?: boolean;
  forcePin?: boolean;
  onDisablePin?: () => void;
}

export default function AuthScreen({ 
  onAuthSuccess, 
  savedPinHash, 
  isDarkMode, 
  onToggleTheme,
  onCancelGuest,
  showCancelButton = false,
  forcePin,
  onDisablePin
}: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Handle standard login/signup
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("الرجاء ملء جميع الحقول المطلوبة.");
      return;
    }

    setLoading(true);
    setError('');
    setInfoMessage('');

    try {
      if (isSignUp) {
        if (password.length < 6) {
          setError("يجب أن تكون كلمة المرور 6 خانات على الأقل لضمان الأمان.");
          setLoading(false);
          return;
        }
        const userCred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        if (displayName.trim()) {
          try {
            await updateProfile(userCred.user, { displayName: displayName.trim() });
          } catch (profileErr) {
            console.error("Failed to update profile display name:", profileErr);
          }
        }
        onAuthSuccess(userCred.user.uid, false);
      } else {
        const userCred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        onAuthSuccess(userCred.user.uid, false);
      }
    } catch (err: any) {
      const errorCode = err?.code || '';
      const errorMessage = err?.message || String(err || '');
      
      console.warn("Auth operation failed:", errorCode, errorMessage);
      
      if (
        errorCode === 'auth/user-not-found' || 
        errorCode === 'auth/wrong-password' || 
        errorCode === 'auth/invalid-credential' ||
        errorMessage.includes('auth/user-not-found') ||
        errorMessage.includes('auth/wrong-password') ||
        errorMessage.includes('auth/invalid-credential')
      ) {
        setError("خطأ في البريد الإلكتروني أو كلمة المرور. يرجى التأكد من البيانات والمحاولة ثانية.");
      } else if (
        errorCode === 'auth/invalid-email' ||
        errorMessage.includes('auth/invalid-email')
      ) {
        setError("البريد الإلكتروني المدخل غير صالح. يرجى كتابته بشكل صحيح بدون مسافات (مثال: name@example.com).");
      } else if (
        errorCode === 'auth/email-already-in-use' || 
        errorMessage.includes('auth/email-already-in-use')
      ) {
        setError("هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول بدلاً من ذلك.");
      } else if (
        errorCode === 'auth/weak-password' ||
        errorMessage.includes('auth/weak-password')
      ) {
        setError("كلمة المرور ضعيفة للغاية. يرجى استخدام كلمة مرور أقوى (6 أرقام/أحرف على الأقل).");
      } else {
        setError(`حدث خطأ أثناء الاتصال بالخادم السحابي (${errorCode || 'خطأ في الشبكة'}). التفاصيل: ${errorMessage}. يرجى التأكد من اتصالك بالإنترنت والتحقق من حسابك.`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    setInfoMessage('');
    try {
      const provider = new GoogleAuthProvider();
      const userCred = await signInWithPopup(auth, provider);
      onAuthSuccess(userCred.user.uid, false);
    } catch (err: any) {
      const errorCode = err?.code || '';
      const errorMessage = err?.message || String(err || '');
      console.warn("Google sign-in failed:", errorCode, errorMessage);
      if (errorCode === 'auth/popup-closed-by-user') {
        setError("تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.");
      } else {
        setError(`فشل تسجيل الدخول بواسطة جوجل: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Reset password
  const handlePasswordReset = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("يرجى إدخال البريد الإلكتروني أولاً لإرسال رابط استعادة كلمة المرور.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setInfoMessage("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.");
    } catch (err: any) {
      setError("فشل إرسال الرابط. تأكد من صحة البريد الإلكتروني المدخل.");
    } finally {
      setLoading(false);
    }
  };

  // Login / Registration form
  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6 font-sans" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center max-w-md mx-auto w-full mb-4">
        <button 
          onClick={onToggleTheme}
          className="p-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm text-slate-700 dark:text-slate-300 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          {isDarkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-indigo-600" />}
        </button>
        <div className="flex items-center gap-2.5">
          <div className="text-right">
            <span className="font-extrabold text-slate-900 dark:text-white text-base block tracking-tight leading-none">كشف النقوط</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">المساعد الذكي للمناسبات والديون</span>
          </div>
          <div className="w-9 h-9 bg-gradient-to-tr from-amber-500 via-yellow-500 to-amber-600 dark:from-amber-600 dark:to-yellow-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20 border border-amber-400/20">
            <Coins size={18} className="text-white drop-shadow-md" />
          </div>
        </div>
      </div>

      {/* Main card */}
      <div className="max-w-md mx-auto w-full py-4 flex-grow flex flex-col justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/60 dark:border-white/5 p-8 rounded-3xl shadow-xl shadow-slate-100/40 dark:shadow-none"
        >
          {/* Welcome Text */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mb-2">
              {isSignUp ? 'إنشاء حساب جديد' : 'أهلاً بك في كشف النقوط'}
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-400 leading-relaxed px-2">
              {isSignUp ? 'سجل معنا لمزامنة نقوطك وهداياك سحابياً والوصول إليها من كل مكان بأمان' : 'سجل دخولك لمتابعة مديونياتك وسداد النقوط وحساب ميزانية مناسباتك'}
            </p>
          </div>

          {/* Feedback Messages */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }}
              className="mb-5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 p-4 rounded-2xl text-xs flex items-start gap-2"
            >
              <ShieldAlert className="shrink-0 mt-0.5" size={16} />
              <span>{error}</span>
            </motion.div>
          )}

          {infoMessage && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }}
              className="mb-5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl text-xs flex items-start gap-2"
            >
              <CheckCircle className="shrink-0 mt-0.5" size={16} />
              <span>{infoMessage}</span>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 mr-1">الاسم الكامل</label>
                <div className="relative">
                  <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="مثال: أحمد محمد"
                    className="w-full pr-11 pl-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs focus:outline-none focus:border-teal-500 dark:focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 text-slate-800 dark:text-slate-200 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 mr-1">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pr-11 pl-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs focus:outline-none focus:border-teal-500 dark:focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 text-slate-800 dark:text-slate-200 transition-all text-left"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5 mr-1">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">كلمة المرور</label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    نسيت كلمة المرور؟
                  </button>
                )}
              </div>
              <div className="relative">
                <Key className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="******"
                  className="w-full pr-11 pl-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs focus:outline-none focus:border-teal-500 dark:focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 text-slate-800 dark:text-slate-200 transition-all text-left"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl shadow-lg shadow-teal-500/10 active:scale-[0.98] transition-all cursor-pointer text-xs mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isSignUp ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}</span>
                </>
              )}
            </button>
          </form>

          {/* Toggle SignUp/SignIn */}
          <div className="text-center mt-5">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setInfoMessage('');
              }}
              className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
            >
              {isSignUp ? 'لديك حساب بالفعل؟ سجل دخولك من هنا' : 'ليس لديك حساب؟ قم بإنشاء حساب جديد بضغطة واحدة'}
            </button>
          </div>

          {/* Separator */}
          <div className="flex items-center my-5">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
            <span className="mx-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">أو الاتصال السريع</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
          </div>

          {/* Grid of Google & Guest Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="py-2.5 bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/60 text-slate-700 dark:text-slate-300 font-bold rounded-2xl active:scale-[0.98] transition-all cursor-pointer text-[11px] flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-800 shadow-sm"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.355 0 3.336 2.691 1.414 6.582l3.852 3.183z"
                />
                <path
                  fill="#4285F4"
                  d="M23.49 12.273c0-.818-.073-1.609-.209-2.373H12v4.5h6.49c-.281 1.482-1.118 2.736-2.373 3.582l3.709 2.873c2.164-1.99 3.41-4.91 3.41-8.582z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.266 14.235A7.01 7.01 0 0 1 4.909 12c0-.79.136-1.545.357-2.235L1.414 6.582A11.948 11.948 0 0 0 0 12c0 1.92.455 3.736 1.255 5.373l4.011-3.138z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.245 0 5.973-1.073 7.964-2.909l-3.709-2.873c-1.027.69-2.336 1.091-3.709 1.091-2.855 0-5.273-1.927-6.136-4.518l-4.011 3.138C4.345 21.845 7.891 24 12 24z"
                />
              </svg>
              <span>تسجيل بجوجل</span>
            </button>

            {/* Offline Local Guest Button */}
            <button
              type="button"
              onClick={() => onAuthSuccess("guest_user_id_2026", true)}
              className="py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold rounded-2xl active:scale-[0.98] transition-all cursor-pointer text-[11px] flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-800 shadow-sm"
              title="تجربة التطبيق وحفظ البيانات على المتصفح الحالي فقط"
            >
              <Sparkles size={13} className="text-amber-500 animate-pulse" />
              <span>استمرار كزائر</span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* Footer copyright */}
      <div className="text-center text-xs text-slate-400 dark:text-slate-600 py-2">
        نظام كشف النقوط والمناسبات 2026 • آمن ومزامن وسهل الاستخدام
      </div>
    </div>
  );
}
