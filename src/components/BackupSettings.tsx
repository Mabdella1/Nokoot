import React, { useState } from 'react';
import { Download, Upload, ShieldAlert, Key, CheckCircle2, RefreshCw, Cloud, Database, Check } from 'lucide-react';
import { UserSettings } from '../types';

interface BackupSettingsProps {
  settings: UserSettings;
  onUpdateSettings: (updates: Partial<UserSettings>) => void;
  onExportBackup: () => void;
  onImportBackup: (jsonData: string) => Promise<boolean>;
  onTriggerSync: () => void;
  isSyncing: boolean;
  
  // Google Drive integration props
  driveAccessToken: string | null;
  onConnectDrive: () => void;
  onDisconnectDrive: () => void;
  onBackupToDrive: () => void;
  onRestoreFromDrive: () => void;
  isDriveSyncing: boolean;
  lastDriveSync: string | null;
}

export default function BackupSettings({
  settings,
  onUpdateSettings,
  onExportBackup,
  onImportBackup,
  onTriggerSync,
  isSyncing,
  driveAccessToken,
  onConnectDrive,
  onDisconnectDrive,
  onBackupToDrive,
  onRestoreFromDrive,
  isDriveSyncing,
  lastDriveSync
}: BackupSettingsProps) {
  const [encryptionKey, setEncryptionKey] = useState(settings.encryptionKey || '');
  const [cryptoSuccess, setCryptoSuccess] = useState('');
  const [importStatus, setImportStatus] = useState<{ success?: boolean; msg?: string }>({});

  // Enable/Update local encryption key
  const handleSaveEncryptionKey = (e: React.FormEvent) => {
    e.preventDefault();
    setCryptoSuccess('');

    if (!encryptionKey.trim()) {
      onUpdateSettings({
        isEncryptionEnabled: false,
        encryptionKey: ""
      });
      setCryptoSuccess("تم إيقاف تشفير البيانات الحساسة.");
    } else {
      onUpdateSettings({
        isEncryptionEnabled: true,
        encryptionKey: encryptionKey
      });
      setCryptoSuccess("تم تفعيل نظام التشفير المتقدم بنجاح! سيتم تشفير الأسماء والملاحظات فورياً قبل حفظها سحابياً.");
    }
  };

  // Import JSON File
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportStatus({});
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonText = event.target?.result as string;
        const parseCheck = JSON.parse(jsonText);
        
        if (!parseCheck.occasions || !parseCheck.transactions) {
          setImportStatus({ success: false, msg: "صيغة ملف النسخة الاحتياطية غير صحيحة." });
          return;
        }

        const success = await onImportBackup(jsonText);
        if (success) {
          setImportStatus({ success: true, msg: "تم استيراد جميع البيانات والنسخة الاحتياطية بنجاح!" });
        } else {
          setImportStatus({ success: false, msg: "فشل استيراد النسخة الاحتياطية من الملف." });
        }
      } catch (err) {
        setImportStatus({ success: false, msg: "فشل في قراءة ملف النسخة الاحتياطية." });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans" dir="rtl">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">الأمان، التشفير والنسخ الاحتياطي</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">تحكم بخصوصية بياناتك المالية، رمز الحماية PIN، والنسخ الاحتياطي السحابي التلقائي واليدوي.</p>
        </div>
        <button
          onClick={onTriggerSync}
          disabled={isSyncing}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-200/50 dark:border-slate-700/50"
        >
          <RefreshCw size={14} className={isSyncing ? 'animate-spin text-blue-500' : ''} />
          <span>{isSyncing ? 'مزامنة جارية...' : 'مزامنة سحابية فورية'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Advanced Client-Side Encryption */}
        <div className="bg-white/80 dark:glass border border-slate-200/50 dark:border-white/5 p-6 rounded-3xl shadow-sm space-y-4 card-hover transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/40 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Key size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">نظام تشفير البيانات الحساسة</h3>
              <p className="text-xs text-slate-400">تشفير الأسماء والملاحظات محلياً قبل مزامنتها.</p>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            عند تحديد مفتاح تشفير سري، سيقوم التطبيق بتشفير أسماء الأشخاص والملاحظات الحساسة محلياً على جهازك باستخدام خوارزمية تشفير متطورة قبل إرسالها إلى السحابة، مما يمنحك أماناً كاملاً لسرية بياناتك المالية.
          </p>

          {cryptoSuccess && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 p-3 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 size={14} />
              <span>{cryptoSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSaveEncryptionKey} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">مفتاح التشفير الخاص بك</label>
              <input
                type="password"
                value={encryptionKey}
                onChange={(e) => setEncryptionKey(e.target.value)}
                placeholder={settings.isEncryptionEnabled ? "•••••••••••• (مشفر حالياً)" : "أدخل مفتاحاً سرياً قوياً لتشغيل التشفير"}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200 text-left"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/10 transition-all cursor-pointer"
              >
                حفظ مفتاح التشفير وتفعيل التشفير
              </button>
              {settings.isEncryptionEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    setEncryptionKey('');
                    onUpdateSettings({ isEncryptionEnabled: false, encryptionKey: '' });
                    setCryptoSuccess("تم إيقاف تشفير البيانات.");
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  تعطيل التشفير
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Data Backup Toggles */}
        <div className="bg-white/80 dark:glass border border-slate-200/50 dark:border-white/5 p-6 rounded-3xl shadow-sm space-y-4 card-hover transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/40 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Download size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">النسخ الاحتياطي التلقائي والمستمر</h3>
              <p className="text-xs text-slate-400">تخزين نسخ احتياطية دورية لضمان عدم الفقدان.</p>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            عند تفعيل خيار النسخ الاحتياطي التلقائي، يقوم التطبيق تلقائياً بتخزين وحفظ صورة كاملة من بياناتك المالية في ذاكرة التخزين المحلية الثانوية بشكل مشفر، لضمان استردادها في أي لحظة في حال انقطاع الخدمة أو مسح بيانات المتصفح.
          </p>

          <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
            <input
              type="checkbox"
              checked={settings.autoBackupEnabled}
              onChange={(e) => onUpdateSettings({ autoBackupEnabled: e.target.checked })}
              className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
            />
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">تشغيل النسخ الاحتياطي التلقائي المستمر</div>
              <div className="text-[10px] text-slate-400">النسخ الآمن يتم تلقائياً بالخلفية عند إجراء أي تعديل</div>
            </div>
          </label>
        </div>

        {/* Manual Export & Import JSON */}
        <div className="bg-white/80 dark:glass border border-slate-200/50 dark:border-white/5 p-6 rounded-3xl shadow-sm space-y-4 card-hover transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/40 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Upload size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">تصدير واستيراد ملفات البيانات</h3>
              <p className="text-xs text-slate-400">حفظ نسخة كاملة من بياناتك خارجياً كملف JSON.</p>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            يمكنك تحميل كافة المعاملات والمناسبات المسجلة كملف مشفر، أو استعادة بياناتك السابقة برفع ملف النسخة الاحتياطية.
          </p>

          {importStatus.msg && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
              importStatus.success 
                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30' 
                : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30'
            }`}>
              <CheckCircle2 size={14} />
              <span>{importStatus.msg}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onExportBackup}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download size={14} />
              <span>تصدير نسخة احتياطية (JSON)</span>
            </button>

            <label className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer text-center">
              <Upload size={14} />
              <span>استيراد نسخة احتياطية</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Google Drive Integration */}
        <div className="bg-white/80 dark:glass border border-slate-200/50 dark:border-white/5 p-6 rounded-3xl shadow-sm space-y-4 card-hover transition-all col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Cloud size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200">النسخ الاحتياطي والمزامنة عبر Google Drive</h3>
                <p className="text-xs text-slate-400">حفظ واسترجاع نسختك الاحتياطية مباشرة من حسابك في جوجل درايف.</p>
              </div>
            </div>
            {driveAccessToken && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-full">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span>متصل بنجاح</span>
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            تمكنك هذه الميزة من مزامنة كشف النقوط الخاص بك يدوياً عبر سحابة Google Drive لضمان عدم ضياع بياناتك وتسهيل الوصول إليها عند فتح التطبيق من أي جهاز آخر. يتم حفظ الملف كـ <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded text-[10px] font-mono font-semibold">noqoot_backup.json</code> في حسابك.
          </p>

          {!driveAccessToken ? (
            <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900/50 p-5 rounded-2xl flex flex-col items-center text-center space-y-3">
              <Database className="text-slate-300 dark:text-slate-700" size={32} />
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">لم يتم ربط حساب Google Drive بعد</h4>
                <p className="text-[10px] text-slate-400 mt-1">اضغط على الزر أدناه لتسجيل الدخول بأمان وتفعيل التخزين السحابي.</p>
              </div>
              <button
                onClick={onConnectDrive}
                disabled={isDriveSyncing}
                className="gsi-material-button w-full sm:w-auto px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer shadow-sm text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2.5"
              >
                <div className="gsi-material-button-icon w-5 h-5 flex items-center justify-center">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span>{isDriveSyncing ? 'جاري الاتصال...' : 'ربط ومزامنة مع Google Drive'}</span>
              </button>
            </div>
          ) : (
            <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/20 p-5 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-emerald-100/30 dark:border-emerald-900/20 pb-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Check size={16} className="text-emerald-500" />
                    <span>مزامنة Google Drive نشطة ومفعلة</span>
                  </div>
                  <p className="text-[10px] text-slate-400">آخر مزامنة صحيحة: {lastDriveSync || 'لم تتم المزامنة بعد'}</p>
                </div>
                <button
                  onClick={onDisconnectDrive}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  قطع الاتصال بحساب جوجل
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={onBackupToDrive}
                  disabled={isDriveSyncing}
                  className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/10"
                >
                  <RefreshCw size={14} className={isDriveSyncing ? 'animate-spin' : ''} />
                  <span>{isDriveSyncing ? 'جاري الرفع السحابي...' : 'رفع نسخة احتياطية الآن'}</span>
                </button>

                <button
                  onClick={onRestoreFromDrive}
                  disabled={isDriveSyncing}
                  className="py-3 px-4 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 disabled:opacity-50 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Cloud size={14} />
                  <span>استعادة نسخة احتياطية من السحابة</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
