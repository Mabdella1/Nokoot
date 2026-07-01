import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { 
  collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, writeBatch, query
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { encryptText, decryptText } from './utils/security';
import { UserSettings, Occasion, NoqootTransaction, OccasionType, UpcomingOccasion } from './types';

// Component Imports
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import OccasionDetails from './components/OccasionDetails';
import BackupSettings from './components/BackupSettings';
import TransactionModal from './components/TransactionModal';
import PeopleTab from './components/PeopleTab';
import UpcomingOccasions from './components/UpcomingOccasions';

// Icons
import { 
  LayoutDashboard, FolderHeart, ShieldAlert, Sparkles, 
  Moon, Sun, LogOut, RefreshCw, EyeOff, Eye, UserCheck, ShieldCheck, Users,
  Coins, CalendarDays
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // Authentication & Session States
  const [userId, setUserId] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [pinRequired, setPinRequired] = useState(false);
  const [showAuthManual, setShowAuthManual] = useState(false);
  
  // Tracks if the user has unlocked the PIN lock screen in the current session
  const hasUnlockedPinRef = React.useRef(false);

  // Core Data States
  const [settings, setSettings] = useState<UserSettings>({
    uid: '',
    email: '',
    theme: 'light',
    securityPinEnabled: false,
    isEncryptionEnabled: false,
    autoBackupEnabled: true,
    createdAt: new Date().toISOString()
  });

  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [upcomingOccasions, setUpcomingOccasions] = useState<UpcomingOccasion[]>([]);
  const [transactions, setTransactions] = useState<NoqootTransaction[]>([]);
  const [activeOccasion, setActiveOccasion] = useState<Occasion | null>(null);

  // Navigation Screen State
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'details' | 'settings' | 'people' | 'upcoming'>('dashboard');

  // Encryption Display state (allow users to toggling view of decrypted text or raw encryptions)
  const [showEncryptedFieldsRaw, setShowEncryptedFieldsRaw] = useState(false);
  const [encryptionPassphrase, setEncryptionPassphrase] = useState('');

  // UI loading states
  const [isSyncing, setIsSyncing] = useState(false);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<NoqootTransaction | null>(null);

  // Google Drive integration states
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [lastDriveSync, setLastDriveSync] = useState<string | null>(() => localStorage.getItem('last_drive_sync_time'));

  // Custom confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    isDestructive: boolean;
    onConfirm: () => void;
  } | null>(null);

  // 1. Firebase Auth state listener
  useEffect(() => {
    // If user requested to cancel login / sign out, we do a one-time sign out
    if (!localStorage.getItem('signed_out_by_ai')) {
      localStorage.setItem('signed_out_by_ai', 'true');
      signOut(auth).catch(err => console.error("Signout error:", err));
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setIsGuest(false);
        // Load initial local caches if any, before sync resolves
        const cachedSettings = localStorage.getItem(`noqoot_settings_${user.uid}`);
        if (cachedSettings) {
          const parsed = JSON.parse(cachedSettings);
          setSettings(parsed);
          setEncryptionPassphrase(parsed.encryptionKey || '');
        }
      } else {
        // "الغي وضع التسجيل المحلي" -> Do NOT automatically default to guest mode!
        // Instead, keep userId as empty and isGuest as false, showing the AuthScreen.
        setUserId("");
        setIsGuest(false);
        setPinRequired(false);
        
        setSettings({
          uid: "",
          email: "",
          theme: 'light',
          securityPinEnabled: false,
          isEncryptionEnabled: false,
          autoBackupEnabled: true,
          createdAt: new Date().toISOString()
        });
        setEncryptionPassphrase('');
      }
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Database Synchronizer
  useEffect(() => {
    if (!userId) return;

    setIsSyncing(true);

    if (isGuest) {
      // Offline Local Storage sync
      const guestOcc = localStorage.getItem('noqoot_guest_occasions');
      const guestTx = localStorage.getItem('noqoot_guest_transactions');
      const guestUpcoming = localStorage.getItem('noqoot_guest_upcoming');
      const guestSet = localStorage.getItem('noqoot_guest_settings');

      if (guestOcc) setOccasions(JSON.parse(guestOcc));
      if (guestTx) setTransactions(JSON.parse(guestTx));
      if (guestUpcoming) setUpcomingOccasions(JSON.parse(guestUpcoming));
      if (guestSet) {
        const parsed = JSON.parse(guestSet);
        setSettings(parsed);
        setEncryptionPassphrase(parsed.encryptionKey || '');
      }
      setIsSyncing(false);
      return;
    }

    // Cloud Firestore synchronization paths
    const userDocRef = doc(db, 'users', userId);
    const occasionsColRef = collection(db, 'users', userId, 'occasions');
    const transactionsColRef = collection(db, 'users', userId, 'transactions');
    const upcomingColRef = collection(db, 'users', userId, 'upcoming_occasions');

    // Subscribe to settings
    const unsubSettings = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserSettings;
        setSettings(data);
        setEncryptionPassphrase(data.encryptionKey || '');
        localStorage.setItem(`noqoot_settings_${userId}`, JSON.stringify(data));
      } else {
        // Init fresh settings
        const freshSettings: UserSettings = {
          uid: userId,
          email: auth.currentUser?.email || '',
          displayName: auth.currentUser?.displayName || '',
          theme: 'light',
          securityPinEnabled: false,
          isEncryptionEnabled: false,
          autoBackupEnabled: true,
          createdAt: new Date().toISOString()
        };
        setDoc(userDocRef, freshSettings).catch(err => console.error("Init settings fail", err));
        setSettings(freshSettings);
      }
    }, (err) => {
      console.error("Firestore settings sync error:", err);
    });

    // Subscribe to occasions
    const unsubOccasions = onSnapshot(occasionsColRef, (colSnap) => {
      const list: Occasion[] = [];
      colSnap.forEach(d => {
        list.push(d.data() as Occasion);
      });
      setOccasions(list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      localStorage.setItem(`noqoot_occasions_${userId}`, JSON.stringify(list));
    }, (err) => {
      console.error("Firestore occasions sync error:", err);
    });

    // Subscribe to upcoming occasions
    const unsubUpcoming = onSnapshot(upcomingColRef, (colSnap) => {
      const list: UpcomingOccasion[] = [];
      colSnap.forEach(d => {
        list.push(d.data() as UpcomingOccasion);
      });
      setUpcomingOccasions(list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      localStorage.setItem(`noqoot_upcoming_${userId}`, JSON.stringify(list));
    }, (err) => {
      console.error("Firestore upcoming occasions sync error:", err);
    });

    // Subscribe to transactions
    const unsubTransactions = onSnapshot(transactionsColRef, (colSnap) => {
      const list: NoqootTransaction[] = [];
      colSnap.forEach(d => {
        list.push(d.data() as NoqootTransaction);
      });
      setTransactions(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      localStorage.setItem(`noqoot_transactions_${userId}`, JSON.stringify(list));
      setIsSyncing(false);
    }, (err) => {
      console.error("Firestore sync error, offline mode active.", err);
      setIsSyncing(false);
    });

    return () => {
      unsubSettings();
      unsubOccasions();
      unsubUpcoming();
      unsubTransactions();
    };
  }, [userId, isGuest]);

  // 3. Theme application side-effect
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  // Trigger automatic secondary local cache backup on database change
  useEffect(() => {
    if (!userId || !settings.autoBackupEnabled) return;
    const backupObj = {
      occasions,
      transactions,
      settings,
      backupDate: new Date().toISOString()
    };
    localStorage.setItem(`noqoot_auto_backup_${userId}`, JSON.stringify(backupObj));
  }, [occasions, transactions, settings, userId]);

  // Handle successful login
  const handleAuthSuccess = (uId: string, guestMode: boolean) => {
    setUserId(uId);
    setIsGuest(guestMode);
    setPinRequired(false);
    hasUnlockedPinRef.current = true; // mark PIN as successfully unlocked
    setCurrentScreen('dashboard');

    if (!guestMode) {
      localStorage.removeItem('signed_out_by_ai');
    }

    if (guestMode) {
      // Initialize guest profile settings
      const guestSettings: UserSettings = {
        uid: "guest_user_id_2026",
        email: "guest@noqoot.local",
        theme: 'light',
        securityPinEnabled: false,
        isEncryptionEnabled: false,
        autoBackupEnabled: true,
        createdAt: new Date().toISOString()
      };
      setSettings(guestSettings);
    }
  };

  // Sign out
  const handleSignOut = () => {
    localStorage.setItem('signed_out_by_ai', 'true');
    signOut(auth);
    setUserId("");
    setIsGuest(false);
    setPinRequired(false);
    hasUnlockedPinRef.current = false; // reset session PIN lock state
    setShowAuthManual(false);
    
    // Clear state
    setOccasions([]);
    setTransactions([]);
    setUpcomingOccasions([]);
    setSettings({
      uid: "",
      email: "",
      theme: 'light',
      securityPinEnabled: false,
      isEncryptionEnabled: false,
      autoBackupEnabled: true,
      createdAt: new Date().toISOString()
    });
    setEncryptionPassphrase('');
    setCurrentScreen('dashboard');
    setActiveOccasion(null);
  };

  // Theme switcher
  const handleToggleTheme = () => {
    const newTheme = settings.theme === 'light' ? 'dark' : 'light';
    updateUserSettings({ theme: newTheme });
  };

  // Update Settings
  const updateUserSettings = async (updates: Partial<UserSettings>) => {
    const nextSettings = { ...settings, ...updates };
    setSettings(nextSettings);

    if (updates.encryptionKey !== undefined) {
      setEncryptionPassphrase(updates.encryptionKey);
    }

    if (isGuest) {
      localStorage.setItem('noqoot_guest_settings', JSON.stringify(nextSettings));
    } else if (userId) {
      await setDoc(doc(db, 'users', userId), nextSettings, { merge: true });
    }
  };

  // Create or Edit Occasion
  const handleSaveOccasion = async (data: { title: string; date: string; type: OccasionType; notes: string }): Promise<string | undefined> => {
    if (!userId) return;
    const cleanTitle = settings.isEncryptionEnabled ? encryptText(data.title, encryptionPassphrase) : data.title;
    const cleanNotes = settings.isEncryptionEnabled ? encryptText(data.notes, encryptionPassphrase) : data.notes;

    const newOccasionId = Math.random().toString(36).substring(2, 11) + "_occ";
    const newOccasion: Occasion = {
      id: newOccasionId,
      userId,
      title: cleanTitle,
      date: data.date,
      type: data.type,
      notes: cleanNotes,
      totalReceived: 0,
      totalPaid: 0,
      createdAt: new Date().toISOString()
    };

    if (isGuest) {
      const nextList = [...occasions, newOccasion];
      setOccasions(nextList);
      localStorage.setItem('noqoot_guest_occasions', JSON.stringify(nextList));
    } else {
      await setDoc(doc(db, 'users', userId, 'occasions', newOccasionId), newOccasion);
    }
    return newOccasionId;
  };

  const handleEditOccasion = async (id: string, data: { title: string; date: string; type: OccasionType; notes: string }) => {
    if (!userId) return;
    const cleanTitle = settings.isEncryptionEnabled ? encryptText(data.title, encryptionPassphrase) : data.title;
    const cleanNotes = settings.isEncryptionEnabled ? encryptText(data.notes, encryptionPassphrase) : data.notes;

    if (isGuest) {
      const nextList = occasions.map(o => o.id === id ? { ...o, title: cleanTitle, date: data.date, type: data.type, notes: cleanNotes } : o);
      setOccasions(nextList);
      localStorage.setItem('noqoot_guest_occasions', JSON.stringify(nextList));
    } else {
      await setDoc(doc(db, 'users', userId, 'occasions', id), {
        title: cleanTitle,
        date: data.date,
        type: data.type,
        notes: cleanNotes
      }, { merge: true });
    }
  };

  const handleSaveUpcomingOccasion = async (data: { title: string; date: string; day: string; notes: string }) => {
    if (!userId) return;
    const cleanTitle = settings.isEncryptionEnabled ? encryptText(data.title, encryptionPassphrase) : data.title;
    const cleanNotes = settings.isEncryptionEnabled ? encryptText(data.notes, encryptionPassphrase) : data.notes;

    const id = Math.random().toString(36).substring(2, 11) + "_up";
    const newUpcoming: UpcomingOccasion = {
      id,
      userId,
      title: cleanTitle,
      date: data.date,
      day: data.day,
      notes: cleanNotes,
      createdAt: new Date().toISOString()
    };

    if (isGuest) {
      const nextList = [...upcomingOccasions, newUpcoming];
      setUpcomingOccasions(nextList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      localStorage.setItem('noqoot_guest_upcoming', JSON.stringify(nextList));
    } else {
      await setDoc(doc(db, 'users', userId, 'upcoming_occasions', id), newUpcoming);
    }
  };

  const handleDeleteUpcomingOccasion = (id: string, title?: string) => {
    if (!userId) return;
    setConfirmModal({
      isOpen: true,
      title: "تأكيد حذف المناسبة القادمة",
      message: `هل أنت متأكد من مسح المناسبة القادمة "${title || ''}"؟`,
      confirmText: "نعم، احذف",
      cancelText: "إلغاء",
      isDestructive: true,
      onConfirm: async () => {
        if (isGuest) {
          const nextList = upcomingOccasions.filter(o => o.id !== id);
          setUpcomingOccasions(nextList);
          localStorage.setItem('noqoot_guest_upcoming', JSON.stringify(nextList));
        } else {
          await deleteDoc(doc(db, 'users', userId, 'upcoming_occasions', id));
        }
        setConfirmModal(null);
      }
    });
  };

  const handleDeleteOccasion = (id: string) => {
    if (!userId) return;
    setConfirmModal({
      isOpen: true,
      title: "حذف المناسبة بالكامل",
      message: "هل أنت متأكد من حذف هذه المناسبة بالكامل؟ سيتم مسح جميع النقود والهدايا التابعة لها نهائياً.",
      confirmText: "نعم، احذف نهائياً",
      cancelText: "إلغاء",
      isDestructive: true,
      onConfirm: async () => {
        if (isGuest) {
          const nextOccs = occasions.filter(o => o.id !== id);
          const nextTxs = transactions.filter(t => t.occasionId !== id);
          setOccasions(nextOccs);
          setTransactions(nextTxs);
          localStorage.setItem('noqoot_guest_occasions', JSON.stringify(nextOccs));
          localStorage.setItem('noqoot_guest_transactions', JSON.stringify(nextTxs));
        } else {
          // Transaction batch delete
          const batch = writeBatch(db);
          batch.delete(doc(db, 'users', userId, 'occasions', id));
          
          const relatedTxs = transactions.filter(t => t.occasionId === id);
          relatedTxs.forEach(t => {
            batch.delete(doc(db, 'users', userId, 'transactions', t.id));
          });

          await batch.commit();
        }
        setActiveOccasion(null);
        setCurrentScreen('dashboard');
        setConfirmModal(null);
      }
    });
  };

  const handleSaveOccasionNotes = async (notes: string) => {
    if (!userId || !activeOccasion) return;
    const encNotes = settings.isEncryptionEnabled ? encryptText(notes, encryptionPassphrase) : notes;

    if (isGuest) {
      const next = occasions.map(o => o.id === activeOccasion.id ? { ...o, notes: encNotes } : o);
      setOccasions(next);
      localStorage.setItem('noqoot_guest_occasions', JSON.stringify(next));
    } else {
      await setDoc(doc(db, 'users', userId, 'occasions', activeOccasion.id), { notes: encNotes }, { merge: true });
    }
  };

  // Save Transaction
  const handleSaveTransaction = async (txData: Partial<NoqootTransaction>) => {
    if (!userId) return;

    const encName = settings.isEncryptionEnabled ? encryptText(txData.personName || '', encryptionPassphrase) : txData.personName || '';
    const encDesc = settings.isEncryptionEnabled ? encryptText(txData.giftDescription || '', encryptionPassphrase) : txData.giftDescription || '';
    const encNotes = settings.isEncryptionEnabled ? encryptText(txData.notes || '', encryptionPassphrase) : txData.notes || '';

    if (txData.id) {
      // Editing transaction
      const updatedTx: NoqootTransaction = {
        ...editingTransaction!,
        ...txData,
        personName: encName,
        giftDescription: encDesc,
        notes: encNotes,
        repaymentDueDate: txData.repaymentDueDate || '',
        giftImageUrl: txData.giftImageUrl || '',
        purchaseLink: txData.purchaseLink || ''
      } as NoqootTransaction;

      if (isGuest) {
        const nextList = transactions.map(t => t.id === txData.id ? updatedTx : t);
        setTransactions(nextList);
        localStorage.setItem('noqoot_guest_transactions', JSON.stringify(nextList));
      } else {
        await setDoc(doc(db, 'users', userId, 'transactions', txData.id), updatedTx);
      }
    } else {
      // Adding transaction
      const newTxId = Math.random().toString(36).substring(2, 11) + "_tx";
      const newTx: NoqootTransaction = {
        id: newTxId,
        userId,
        occasionId: txData.occasionId!,
        type: txData.type!,
        personName: encName,
        amount: txData.amount!,
        giftType: txData.giftType!,
        giftDescription: encDesc,
        giftImageUrl: txData.giftImageUrl || '',
        isRepaid: txData.isRepaid || false,
        repaymentDueDate: txData.repaymentDueDate || '',
        purchaseLink: txData.purchaseLink || '',
        notes: encNotes,
        createdAt: new Date().toISOString()
      };

      if (isGuest) {
        const nextList = [newTx, ...transactions];
        setTransactions(nextList);
        localStorage.setItem('noqoot_guest_transactions', JSON.stringify(nextList));
      } else {
        await setDoc(doc(db, 'users', userId, 'transactions', newTxId), newTx);
      }
    }
    setEditingTransaction(null);
  };

  const handleDeleteTransaction = (txId: string) => {
    if (!userId) return;
    setConfirmModal({
      isOpen: true,
      title: "تأكيد حذف المعاملة",
      message: "هل أنت متأكد من حذف هذه المعاملة نهائياً؟",
      confirmText: "نعم، احذف",
      cancelText: "إلغاء",
      isDestructive: true,
      onConfirm: async () => {
        if (isGuest) {
          setTransactions(prev => {
            const nextList = prev.filter(t => t.id !== txId);
            localStorage.setItem('noqoot_guest_transactions', JSON.stringify(nextList));
            return nextList;
          });
        } else {
          await deleteDoc(doc(db, 'users', userId, 'transactions', txId));
        }
        setConfirmModal(null);
      }
    });
  };

  const handleDeleteMultipleTransactions = (txIds: string[], personName: string, callback?: () => void) => {
    if (!userId) return;
    setConfirmModal({
      isOpen: true,
      title: "تأكيد حذف الشخص",
      message: `هل أنت متأكد من حذف الشخص "${personName}" وجميع معاملاته المسجلة بالكامل؟ لا يمكن التراجع عن هذا الإجراء.`,
      confirmText: "نعم، احذف بالكامل",
      cancelText: "إلغاء",
      isDestructive: true,
      onConfirm: async () => {
        if (isGuest) {
          setTransactions(prev => {
            const nextList = prev.filter(t => !txIds.includes(t.id));
            localStorage.setItem('noqoot_guest_transactions', JSON.stringify(nextList));
            return nextList;
          });
        } else {
          const batch = writeBatch(db);
          txIds.forEach(id => {
            const docRef = doc(db, 'users', userId, 'transactions', id);
            batch.delete(docRef);
          });
          await batch.commit();
        }
        if (callback) callback();
        setConfirmModal(null);
      }
    });
  };

  // Google Drive Handlers
  const handleConnectDrive = async () => {
    setIsDriveSyncing(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setDriveAccessToken(credential.accessToken);
        alert("تم ربط حساب Google Drive الخاص بك بنجاح!");
      } else {
        throw new Error("لم يتم الحصول على رمز الوصول من جوجل.");
      }
    } catch (err: any) {
      console.error("Failed to connect Google Drive:", err);
      alert(`فشل الاتصال بـ Google Drive: ${err.message || err}`);
    } finally {
      setIsDriveSyncing(false);
    }
  };

  const handleDisconnectDrive = () => {
    setConfirmModal({
      isOpen: true,
      title: "قطع الاتصال بـ Google Drive",
      message: "هل أنت متأكد من رغبتك في قطع الاتصال بـ Google Drive؟",
      confirmText: "قطع الاتصال",
      cancelText: "إلغاء",
      isDestructive: true,
      onConfirm: () => {
        setDriveAccessToken(null);
        alert("تم قطع الاتصال بحساب Google Drive.");
        setConfirmModal(null);
      }
    });
  };

  const handleBackupToDrive = async () => {
    if (!driveAccessToken) {
      alert("يرجى الاتصال بحساب Google Drive أولاً.");
      return;
    }
    setIsDriveSyncing(true);
    try {
      const backupData = {
        occasions,
        transactions,
        upcomingOccasions,
        settings,
        backupDate: new Date().toISOString()
      };
      
      const { uploadBackupToDrive } = await import('./utils/googleDrive');
      await uploadBackupToDrive(driveAccessToken, backupData);
      
      const nowStr = new Date().toLocaleString('ar-EG');
      setLastDriveSync(nowStr);
      localStorage.setItem('last_drive_sync_time', nowStr);
      alert("تم رفع النسخة الاحتياطية وتحديثها على Google Drive بنجاح!");
    } catch (err: any) {
      console.error("Backup to Google Drive failed:", err);
      alert(`فشل رفع النسخة الاحتياطية: ${err.message || err}`);
    } finally {
      setIsDriveSyncing(false);
    }
  };

  const handleRestoreFromDrive = async () => {
    if (!driveAccessToken) {
      alert("يرجى الاتصال بحساب Google Drive أولاً.");
      return;
    }
    
    setConfirmModal({
      isOpen: true,
      title: "استعادة النسخة الاحتياطية",
      message: "تحذير: سيقوم استرجاع النسخة الاحتياطية باستبدال وتحديث كافة المناسبات والمعاملات الحالية. هل أنت متأكد من الاستمرار؟",
      confirmText: "نعم، استرجع واستبدل",
      cancelText: "إلغاء",
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModal(null);
        setIsDriveSyncing(true);
        try {
          const { findBackupFile, downloadBackupFromDrive } = await import('./utils/googleDrive');
          const fileId = await findBackupFile(driveAccessToken);
          
          if (!fileId) {
            alert("لم يتم العثور على أي نسخة احتياطية سابقة على Google Drive الخاص بك باسم 'noqoot_backup.json'.");
            return;
          }

          const backupData = await downloadBackupFromDrive(driveAccessToken, fileId);
          if (!backupData || (!backupData.occasions && !backupData.transactions)) {
            alert("محتوى ملف النسخة الاحتياطية غير صالح أو فارغ.");
            return;
          }

          // Restore data
          if (backupData.occasions) {
            if (isGuest) {
              setOccasions(backupData.occasions);
              localStorage.setItem('noqoot_guest_occasions', JSON.stringify(backupData.occasions));
            } else {
              // Sync with Firestore in a batch
              const batch = writeBatch(db);
              backupData.occasions.forEach((occ: Occasion) => {
                const ref = doc(db, 'users', userId!, 'occasions', occ.id);
                batch.set(ref, { ...occ, userId });
              });
              await batch.commit();
            }
          }

          if (backupData.transactions) {
            if (isGuest) {
              setTransactions(backupData.transactions);
              localStorage.setItem('noqoot_guest_transactions', JSON.stringify(backupData.transactions));
            } else {
              // Sync with Firestore in a batch
              const batch = writeBatch(db);
              backupData.transactions.forEach((tx: NoqootTransaction) => {
                const ref = doc(db, 'users', userId!, 'transactions', tx.id);
                batch.set(ref, { ...tx, userId });
              });
              await batch.commit();
            }
          }

          if (backupData.upcomingOccasions) {
            if (isGuest) {
              setUpcomingOccasions(backupData.upcomingOccasions);
              localStorage.setItem('noqoot_guest_upcoming', JSON.stringify(backupData.upcomingOccasions));
            } else {
              const batch = writeBatch(db);
              backupData.upcomingOccasions.forEach((upc: UpcomingOccasion) => {
                const ref = doc(db, 'users', userId!, 'upcoming_occasions', upc.id);
                batch.set(ref, { ...upc, userId });
              });
              await batch.commit();
            }
          }

          if (backupData.settings) {
            const nextSet = { ...settings, ...backupData.settings };
            setSettings(nextSet);
            if (isGuest) {
              localStorage.setItem('noqoot_guest_settings', JSON.stringify(backupData.settings));
            } else {
              await setDoc(doc(db, 'users', userId!), nextSet, { merge: true });
            }
          }

          alert("تم استيراد واستعادة النسخة الاحتياطية بالكامل من Google Drive بنجاح!");
        } catch (err: any) {
          console.error("Restore from Google Drive failed:", err);
          alert(`فشل استرجاع النسخة الاحتياطية: ${err.message || err}`);
        } finally {
          setIsDriveSyncing(false);
        }
      }
    });
  };

  // Export local JSON database backup
  const handleExportBackup = () => {
    const backupObj = {
      occasions,
      transactions,
      settings,
      backupDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noqoot-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Import JSON backup
  const handleImportBackup = async (jsonData: string): Promise<boolean> => {
    if (!userId) return false;
    try {
      const parsed = JSON.parse(jsonData);
      if (!parsed.occasions || !parsed.transactions) return false;

      if (isGuest) {
        setOccasions(parsed.occasions);
        setTransactions(parsed.transactions);
        localStorage.setItem('noqoot_guest_occasions', JSON.stringify(parsed.occasions));
        localStorage.setItem('noqoot_guest_transactions', JSON.stringify(parsed.transactions));
      } else {
        // Upload batch to Firestore
        const batch = writeBatch(db);
        
        parsed.occasions.forEach((occ: Occasion) => {
          const ref = doc(db, 'users', userId, 'occasions', occ.id);
          batch.set(ref, { ...occ, userId });
        });

        parsed.transactions.forEach((tx: NoqootTransaction) => {
          const ref = doc(db, 'users', userId, 'transactions', tx.id);
          batch.set(ref, { ...tx, userId });
        });

        await batch.commit();
      }
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const handleTriggerSync = () => {
    if (isGuest) return;
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1200); // Trigger visual sync animation
  };

  // If Auth screen is loading
  if (!authChecked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 font-sans p-6">
        <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-4" />
        <h3 className="text-slate-600 dark:text-slate-300 font-bold text-sm animate-pulse">جاري فك تشفير وتأمين مساحة العمل...</h3>
      </div>
    );
  }

  // If user not logged in
  if (!userId || showAuthManual) {
    return (
      <AuthScreen
        onAuthSuccess={(uId, guestMode) => {
          setShowAuthManual(false);
          handleAuthSuccess(uId, guestMode);
        }}
        isDarkMode={settings.theme === 'dark'}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] text-slate-800 dark:text-slate-100 flex font-sans transition-colors duration-300" dir="rtl">
      
      {/* Sidebar - Desktop Only */}
      <aside className="w-64 hidden lg:flex flex-col border-l border-slate-200 dark:border-white/10 bg-white dark:bg-[#1e293b] shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-amber-500 via-yellow-500 to-amber-600 dark:from-amber-600 dark:to-yellow-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20 border border-amber-400/20">
            <Coins size={20} className="text-white drop-shadow-md" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-slate-800 dark:text-white">كشف النقوط</span>
            <span className="text-[9px] text-slate-400 block mt-0.5">مساحة عمل ذكية وآمنة</span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <button
            onClick={() => { setCurrentScreen('dashboard'); setActiveOccasion(null); }}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-xs font-bold transition-colors cursor-pointer text-right ${
              currentScreen === 'dashboard'
                ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-[#60a5fa] border-r-3 border-blue-500'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <LayoutDashboard size={16} />
            <span>لوحة التحكم والرئيسية</span>
          </button>

          <button
            onClick={() => setCurrentScreen('people')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-xs font-bold transition-colors cursor-pointer text-right ${
              currentScreen === 'people'
                ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-[#60a5fa] border-r-3 border-blue-500'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <Users size={16} />
            <span>الأشخاص والأرصدة</span>
          </button>

          <button
            onClick={() => setCurrentScreen('upcoming')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-xs font-bold transition-colors cursor-pointer text-right ${
              currentScreen === 'upcoming'
                ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-[#60a5fa] border-r-3 border-blue-500'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <CalendarDays size={16} />
            <span>المناسبات القادمة</span>
          </button>

          {occasions.length > 0 && (
            <button
              onClick={() => setCurrentScreen('details')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-xs font-bold transition-colors cursor-pointer text-right ${
                currentScreen === 'details'
                  ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-[#60a5fa] border-r-3 border-blue-500'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <FolderHeart size={16} />
              <span>المعاملات التفصيلية</span>
            </button>
          )}

          <button
            onClick={() => setCurrentScreen('settings')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-xs font-bold transition-colors cursor-pointer text-right ${
              currentScreen === 'settings'
                ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-[#60a5fa] border-r-3 border-blue-500'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <ShieldCheck size={16} />
            <span>الإعدادات والنسخ الاحتياطي</span>
          </button>
        </nav>

        {/* Sidebar Bottom Widgets */}
        <div className="p-6 mt-auto border-t border-slate-100 dark:border-white/5 space-y-4">
          <div className="bg-blue-500/5 dark:bg-blue-500/10 rounded-xl p-4 border border-blue-500/10">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold">مساحة السحاب</span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">نشطة ومحمية</span>
            </div>
            <div className="w-full bg-blue-100 dark:bg-blue-900/30 h-1.5 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full w-full"></div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-200/50 dark:border-slate-700">
              {isGuest ? 'G' : ((settings.displayName || settings.email)?.charAt(0).toUpperCase() || 'U')}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{isGuest ? 'زائر محلي' : (settings.displayName || settings.email?.split('@')[0])}</div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 italic">{isGuest ? 'وضع محلي آمن' : 'حساب بريميوم موثق'}</div>
            </div>
          </div>
          {isGuest && (
            <button
              onClick={() => setShowAuthManual(true)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer mt-1"
            >
              <UserCheck size={13} />
              <span>تسجيل الدخول / ربط حساب</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Header - Desktop Only */}
        <header className="h-20 hidden lg:flex border-b border-slate-200/60 dark:border-slate-800/60 px-8 items-center justify-between bg-white/70 dark:bg-slate-950/60 backdrop-blur-xl sticky top-0 z-30 transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="h-8 w-1 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full" />
            <div>
              <h1 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-none mb-1.5">
                {currentScreen === 'dashboard' ? 'لوحة التحكم والمؤشرات الإحصائية العامة' : currentScreen === 'details' ? 'كشف تفصيلي بالمعاملات والنقود' : currentScreen === 'people' ? 'دليل الأصدقاء وأرصدة المبادلة والنقود' : currentScreen === 'upcoming' ? 'جدول المناسبات الاجتماعية القادمة' : 'خيارات الحماية والتأمين والنسخ الاحتياطي'}
              </h1>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-md font-extrabold text-slate-500 dark:text-slate-400 border border-slate-200/30 dark:border-slate-800/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>مساحة العمل آمنة وسحابية</span>
                </span>
                {settings.isEncryptionEnabled && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded-md font-extrabold text-indigo-600 dark:text-indigo-400 border border-indigo-100/30 dark:border-indigo-900/20">
                    <span>قاعدة البيانات مشفرة</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-slate-100/60 dark:bg-slate-900/60 p-1 rounded-2xl border border-slate-200/40 dark:border-slate-800/40">
              {/* Decrypting state indicators */}
              {settings.isEncryptionEnabled && (
                <button
                  onClick={() => setShowEncryptedFieldsRaw(!showEncryptedFieldsRaw)}
                  className={`p-2 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center ${
                    showEncryptedFieldsRaw 
                      ? 'bg-amber-500 text-white shadow-md shadow-amber-500/10' 
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                  title={showEncryptedFieldsRaw ? 'معروض الآن: نصوص مشفرة غير مقروءة' : 'معروض الآن: فك تشفير تلقائي بالرمز السري'}
                >
                  {showEncryptedFieldsRaw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              )}

              <button
                onClick={handleToggleTheme}
                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center"
                title="تبديل مظهر الإضاءة / الليل"
              >
                {settings.theme === 'dark' ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-indigo-600" />}
              </button>
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800/80" />

            {/* Profile widget */}
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/40 py-1.5 pr-2.5 pl-3.5 rounded-2xl border border-slate-200/40 dark:border-slate-800/40">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-sm uppercase border border-white/10">
                {isGuest ? 'G' : ((settings.displayName || settings.email)?.charAt(0).toUpperCase() || 'U')}
              </div>
              
              <div className="text-right max-w-[130px]">
                <div className="text-[11px] font-black text-slate-700 dark:text-slate-200 truncate leading-tight">
                  {isGuest ? 'زائر محلي آمن' : (settings.displayName || settings.email?.split('@')[0])}
                </div>
                <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold leading-none mt-0.5">
                  {isGuest ? 'مساحة ذاكرة مؤقتة' : 'عضوية سحابية مفعّلة'}
                </div>
              </div>

              {isGuest ? (
                <button
                  onClick={() => setShowAuthManual(true)}
                  className="mr-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-bold shadow-md shadow-blue-500/10 transition-all cursor-pointer flex items-center gap-1"
                  title="تسجيل الدخول أو إنشاء حساب لحفظ البيانات بشكل دائم"
                >
                  <UserCheck size={11} />
                  <span>حفظ سحابي</span>
                </button>
              ) : (
                <button
                  onClick={handleSignOut}
                  className="mr-2 p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-650 dark:hover:text-rose-450 rounded-lg transition-all cursor-pointer"
                  title="تسجيل الخروج"
                >
                  <LogOut size={13} />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Mobile Header (Sticky) */}
        <header className="lg:hidden sticky top-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 shadow-sm transition-all duration-300" dir="rtl">
          <div className="px-4 py-3 flex items-center justify-between">
            {/* Logo and Brand Title */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-tr from-amber-500 via-yellow-500 to-amber-600 dark:from-amber-600 dark:to-yellow-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-amber-500/20 border border-amber-400/20">
                <Coins size={15} className="text-white drop-shadow-sm" />
              </div>
              <div>
                <h1 className="font-extrabold text-slate-800 dark:text-white text-xs leading-none">كشف النقوط</h1>
                <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5 leading-none">شريكك الاجتماعي المنظم</span>
              </div>
            </div>

            {/* Utility shortcuts */}
            <div className="flex items-center gap-1.5">
              {settings.isEncryptionEnabled && (
                <button
                  onClick={() => setShowEncryptedFieldsRaw(!showEncryptedFieldsRaw)}
                  className={`p-1.5 rounded-lg transition-all duration-150 ${
                    showEncryptedFieldsRaw 
                      ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/10' 
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title={showEncryptedFieldsRaw ? 'نصوص مشفرة' : 'فك تشفير تلقائي'}
                >
                  {showEncryptedFieldsRaw ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              )}
              
              <button
                onClick={handleToggleTheme}
                className="p-1.5 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-lg hover:scale-105 active:scale-95 transition-all"
                title="تبديل المظهر"
              >
                {settings.theme === 'dark' ? <Sun size={13} className="text-amber-450" /> : <Moon size={13} className="text-indigo-600" />}
              </button>

              {isGuest ? (
                <button
                  onClick={() => setShowAuthManual(true)}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 text-[9px] font-black shadow-md shadow-blue-500/10 transition-all hover:scale-[1.02]"
                >
                  <UserCheck size={10} />
                  <span>ربط سحابي</span>
                </button>
              ) : (
                <button
                  onClick={handleSignOut}
                  className="p-1.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-lg hover:scale-105 active:scale-95 transition-all"
                  title="تسجيل الخروج"
                >
                  <LogOut size={13} />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Content body frame */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8 flex-grow w-full pb-24 lg:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentScreen + (activeOccasion ? activeOccasion.id : 'none')}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
            >
              {/* 1. Settings View */}
              {currentScreen === 'settings' && (
                <BackupSettings
                  settings={settings}
                  onUpdateSettings={updateUserSettings}
                  onExportBackup={handleExportBackup}
                  onImportBackup={handleImportBackup}
                  onTriggerSync={handleTriggerSync}
                  isSyncing={isSyncing}
                  driveAccessToken={driveAccessToken}
                  onConnectDrive={handleConnectDrive}
                  onDisconnectDrive={handleDisconnectDrive}
                  onBackupToDrive={handleBackupToDrive}
                  onRestoreFromDrive={handleRestoreFromDrive}
                  isDriveSyncing={isDriveSyncing}
                  lastDriveSync={lastDriveSync}
                />
              )}

              {/* 1.5 People Tab View */}
              {currentScreen === 'people' && (
                <PeopleTab
                  occasions={occasions}
                  transactions={transactions}
                  onAddTransaction={handleSaveTransaction}
                  onEditTransaction={(tx) => {
                    setEditingTransaction(tx);
                    setTxModalOpen(true);
                  }}
                  onDeleteTransaction={handleDeleteTransaction}
                  onDeleteMultipleTransactions={handleDeleteMultipleTransactions}
                  onAddOccasion={handleSaveOccasion}
                  encryptionKey={showEncryptedFieldsRaw ? "" : encryptionPassphrase}
                  isGuest={isGuest}
                />
              )}

              {/* 1.75 Upcoming Occasions View */}
              {currentScreen === 'upcoming' && (
                <UpcomingOccasions
                  upcomingOccasions={upcomingOccasions}
                  onAddUpcoming={handleSaveUpcomingOccasion}
                  onDeleteUpcoming={handleDeleteUpcomingOccasion}
                  encryptionKey={showEncryptedFieldsRaw ? "" : encryptionPassphrase}
                />
              )}

              {/* 2. Details Screen */}
              {currentScreen === 'details' && (
                <OccasionDetails
                  occasion={activeOccasion}
                  transactions={activeOccasion ? transactions.filter(t => t.occasionId === activeOccasion.id) : transactions}
                  onBack={() => {
                    setCurrentScreen('dashboard');
                    setActiveOccasion(null);
                  }}
                  onAddTransaction={() => {
                    setEditingTransaction(null);
                    setTxModalOpen(true);
                  }}
                  onEditTransaction={(tx) => {
                    setEditingTransaction(tx);
                    setTxModalOpen(true);
                  }}
                  onDeleteTransaction={handleDeleteTransaction}
                  onSaveOccasionNotes={activeOccasion ? handleSaveOccasionNotes : undefined}
                  encryptionKey={showEncryptedFieldsRaw ? "" : encryptionPassphrase}
                />
              )}

              {/* 3. Dashboard View */}
              {currentScreen === 'dashboard' && (
                <Dashboard
                  occasions={occasions}
                  transactions={transactions}
                  onSelectOccasion={(occ) => {
                    setActiveOccasion(occ);
                    setCurrentScreen('details');
                  }}
                  onAddOccasion={handleSaveOccasion}
                  onEditOccasion={handleEditOccasion}
                  onDeleteOccasion={handleDeleteOccasion}
                  encryptionKey={showEncryptedFieldsRaw ? "" : encryptionPassphrase}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-[#0f172a] py-8 pb-32 lg:pb-8" dir="rtl">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <div className="inline-flex flex-col items-center justify-center">
              <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">تم التصميم بواسطة</span>
              <span className="mt-1.5 text-base font-extrabold text-blue-600 dark:text-blue-400 tracking-tight transition-all hover:scale-105 duration-300">
                Mohamed Abdella ( Abo Selim )
              </span>
            </div>
          </div>
        </footer>

        {/* Mobile Sticky Bottom Navigation Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800/80 shadow-2xl px-2 py-2 flex items-center justify-around pb-safe" dir="rtl">
          <button
            onClick={() => { setCurrentScreen('dashboard'); setActiveOccasion(null); }}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-[9px] font-bold transition-all duration-200 gap-0.5 cursor-pointer ${
              currentScreen === 'dashboard' 
                ? 'text-blue-600 dark:text-blue-400 scale-105 font-black' 
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350'
            }`}
          >
            <LayoutDashboard size={18} className={currentScreen === 'dashboard' ? 'stroke-[2.5px]' : 'stroke-[2px]'} />
            <span>الرئيسية</span>
          </button>

          <button
            onClick={() => { setCurrentScreen('people'); }}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-[9px] font-bold transition-all duration-200 gap-0.5 cursor-pointer ${
              currentScreen === 'people' 
                ? 'text-blue-600 dark:text-blue-400 scale-105 font-black' 
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350'
            }`}
          >
            <Users size={18} className={currentScreen === 'people' ? 'stroke-[2.5px]' : 'stroke-[2px]'} />
            <span>الأشخاص</span>
          </button>

          <button
            onClick={() => { setCurrentScreen('upcoming'); }}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-[9px] font-bold transition-all duration-200 gap-0.5 cursor-pointer ${
              currentScreen === 'upcoming' 
                ? 'text-blue-600 dark:text-blue-400 scale-105 font-black' 
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350'
            }`}
          >
            <CalendarDays size={18} className={currentScreen === 'upcoming' ? 'stroke-[2.5px]' : 'stroke-[2px]'} />
            <span>القادمة</span>
          </button>

          {occasions.length > 0 && (
            <button
              onClick={() => { setCurrentScreen('details'); }}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-[9px] font-bold transition-all duration-200 gap-0.5 cursor-pointer ${
                currentScreen === 'details' 
                  ? 'text-blue-600 dark:text-blue-400 scale-105 font-black' 
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350'
              }`}
            >
              <FolderHeart size={18} className={currentScreen === 'details' ? 'stroke-[2.5px]' : 'stroke-[2px]'} />
              <span>المعاملات</span>
            </button>
          )}

          <button
            onClick={() => setCurrentScreen('settings')}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-[9px] font-bold transition-all duration-200 gap-0.5 cursor-pointer ${
              currentScreen === 'settings' 
                ? 'text-blue-600 dark:text-blue-400 scale-105 font-black' 
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350'
            }`}
          >
            <ShieldCheck size={18} className={currentScreen === 'settings' ? 'stroke-[2.5px]' : 'stroke-[2px]'} />
            <span>الإعدادات</span>
          </button>
        </div>

      </div>

      {/* Transaction Add/Edit Modal */}
      {txModalOpen && (
        <TransactionModal
          isOpen={txModalOpen}
          onClose={() => {
            setTxModalOpen(false);
            setEditingTransaction(null);
          }}
          onSave={handleSaveTransaction}
          transaction={editingTransaction}
          occasionId={activeOccasion?.id || occasions[0]?.id || ''}
        />
      )}

      {/* Interactive global sync loader status bar */}
      {isSyncing && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900 text-white border border-slate-800 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-bold animate-pulse">
          <RefreshCw size={14} className="animate-spin text-blue-400" />
          <span>جاري تحديث السحابة وتأمين المزامنة...</span>
        </div>
      )}

      {/* Elegant Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" dir="rtl">
          <div 
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setConfirmModal(null)}
          />
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/50 dark:border-white/5 shadow-2xl p-6 w-full max-w-md relative z-10 text-right animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mb-2">
              {confirmModal.title}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950 text-xs font-bold transition-all cursor-pointer"
              >
                {confirmModal.cancelText}
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                }}
                className={`px-4 py-2.5 rounded-xl text-white text-xs font-bold transition-all cursor-pointer shadow-lg ${
                  confirmModal.isDestructive 
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/10' 
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/10'
                }`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
