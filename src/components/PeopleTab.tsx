import React, { useState } from 'react';
import { 
  User, Search, Plus, ArrowUpRight, ArrowDownLeft, Scale, Calendar, 
  ChevronLeft, Trash2, Edit3, X, Users, TrendingUp, TrendingDown, Clock, 
  MessageSquare, AlertCircle, Filter, Info, ChevronRight, Sparkles, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NoqootTransaction, Occasion, TransactionType } from '../types';
import { decryptText } from '../utils/security';

interface PeopleTabProps {
  occasions: Occasion[];
  transactions: NoqootTransaction[];
  onAddTransaction: (txData: Partial<NoqootTransaction>) => void;
  onEditTransaction: (tx: NoqootTransaction) => void;
  onDeleteTransaction: (txId: string) => void;
  onDeleteMultipleTransactions: (txIds: string[], personName: string, callback?: () => void) => void;
  onAddOccasion: (data: { title: string; date: string; type: 'wedding' | 'graduation' | 'birth' | 'eid' | 'other'; notes: string }) => Promise<string | undefined>;
  encryptionKey: string;
  isGuest: boolean;
}

type FilterType = 'all' | 'creditor' | 'debtor' | 'balanced';

export default function PeopleTab({
  occasions,
  transactions,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onDeleteMultipleTransactions,
  onAddOccasion,
  encryptionKey,
  isGuest
}: PeopleTabProps) {
  // Navigation, Search, & Filtering State
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  
  // Modals / Quick Form State
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [showQuickTxModal, setShowQuickTxModal] = useState<TransactionType | null>(null);

  // New Person Form State
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonOccasionId, setNewPersonOccasionId] = useState('');
  const [newPersonAmount, setNewPersonAmount] = useState<string>('');
  const [newPersonNotes, setNewPersonNotes] = useState('');
  const [newPersonTxType, setNewPersonTxType] = useState<TransactionType>('received');

  // Quick Transaction Form State
  const [quickAmount, setQuickAmount] = useState<string>('');
  const [quickNotes, setQuickNotes] = useState('');
  const [quickOccasionId, setQuickOccasionId] = useState('');

  // 1. Helper to decrypt a transaction's fields safely
  const getDecryptedTx = (tx: NoqootTransaction) => {
    return {
      ...tx,
      personName: decryptText(tx.personName, encryptionKey) || 'بدون اسم',
      notes: tx.notes ? decryptText(tx.notes, encryptionKey) : '',
      giftDescription: tx.giftDescription ? decryptText(tx.giftDescription, encryptionKey) : ''
    };
  };

  // 2. Get list of all unique people from transactions
  const getUniquePeople = () => {
    const peopleMap: Record<string, {
      name: string;
      totalReceived: number;
      totalPaid: number;
      lastDate: string;
      txCount: number;
      txs: NoqootTransaction[];
    }> = {};

    transactions.forEach(tx => {
      const decTx = getDecryptedTx(tx);
      const normalizedName = decTx.personName.trim();
      if (!normalizedName) return;

      const key = normalizedName.toLowerCase();

      if (!peopleMap[key]) {
        peopleMap[key] = {
          name: normalizedName,
          totalReceived: 0,
          totalPaid: 0,
          lastDate: tx.createdAt,
          txCount: 0,
          txs: []
        };
      }

      peopleMap[key].txCount += 1;
      peopleMap[key].txs.push(tx);

      if (tx.type === 'received') {
        peopleMap[key].totalReceived += tx.amount;
      } else {
        peopleMap[key].totalPaid += tx.amount;
      }

      if (new Date(tx.createdAt) > new Date(peopleMap[key].lastDate)) {
        peopleMap[key].lastDate = tx.createdAt;
      }
    });

    return Object.values(peopleMap);
  };

  const allPeople = getUniquePeople();

  // Filter people based on search query AND net balance filter type
  const filteredPeople = allPeople.filter(person => {
    const matchesSearch = person.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    const balance = person.totalReceived - person.totalPaid;
    if (filterType === 'creditor') return balance > 0; // You owe them
    if (filterType === 'debtor') return balance < 0;   // They owe you
    if (filterType === 'balanced') return balance === 0; // Perfectly balanced
    return true; // All
  });

  // Get active selected person's detailed aggregates
  const selectedPersonData = selectedPerson 
    ? allPeople.find(p => p.name.toLowerCase() === selectedPerson.toLowerCase()) 
    : null;

  // Generate beautiful background gradients for initials
  const getAvatarGradient = (name: string) => {
    const colors = [
      'from-blue-500 to-indigo-600 text-blue-50 shadow-blue-500/10',
      'from-emerald-500 to-teal-600 text-emerald-50 shadow-emerald-500/10',
      'from-purple-500 to-pink-600 text-purple-50 shadow-purple-500/10',
      'from-rose-500 to-red-600 text-rose-50 shadow-rose-500/10',
      'from-amber-500 to-orange-600 text-amber-50 shadow-amber-500/10',
      'from-violet-500 to-fuchsia-600 text-violet-50 shadow-violet-500/10'
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  // Get first letter of the name
  const getInitials = (name: string) => {
    const cleanName = name.trim();
    return cleanName ? cleanName.charAt(0) : 'و';
  };

  // Handle adding a new person directly
  const handleAddNewPersonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;

    let targetOccasionId = newPersonOccasionId;

    // If no occasion exists or was selected, create a general one automatically!
    if (!targetOccasionId) {
      if (occasions.length > 0) {
        targetOccasionId = occasions[0].id;
      } else {
        // Create a default occasion
        const todayStr = new Date().toISOString().slice(0, 10);
        const createdId = await onAddOccasion({
          title: 'كشف النقوط العام للمناسبات',
          date: todayStr,
          type: 'other',
          notes: 'تم إنشاء هذا الكشف تلقائياً لتسجيل النقود والهدايا السريعة.'
        });
        targetOccasionId = createdId || '';
      }
    }

    if (!targetOccasionId) return;

    // Save as a transaction
    onAddTransaction({
      occasionId: targetOccasionId,
      personName: newPersonName.trim(),
      type: newPersonTxType,
      amount: Number(newPersonAmount) || 0,
      giftType: 'monetary',
      isRepaid: false,
      notes: newPersonNotes.trim()
    });

    // Reset Form
    setNewPersonName('');
    setNewPersonOccasionId('');
    setNewPersonAmount('');
    setNewPersonNotes('');
    setNewPersonTxType('received');
    setShowAddPersonModal(false);
  };

  // Handle saving a quick transaction from the detailed profile (Green/Red buttons)
  const handleQuickTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonData || !showQuickTxModal) return;

    let targetOccasionId = quickOccasionId;

    // Auto-create or select first occasion if none
    if (!targetOccasionId) {
      if (occasions.length > 0) {
        targetOccasionId = occasions[0].id;
      } else {
        const todayStr = new Date().toISOString().slice(0, 10);
        const createdId = await onAddOccasion({
          title: 'كشف النقوط العام للمناسبات',
          date: todayStr,
          type: 'other',
          notes: 'تم إنشاء هذا الكشف تلقائياً لتسجيل النقود والهدايا السريعة.'
        });
        targetOccasionId = createdId || '';
      }
    }

    if (!targetOccasionId) return;

    onAddTransaction({
      occasionId: targetOccasionId,
      personName: selectedPersonData.name,
      type: showQuickTxModal,
      amount: Number(quickAmount) || 0,
      giftType: 'monetary',
      isRepaid: false,
      notes: quickNotes.trim()
    });

    // Reset Form
    setQuickAmount('');
    setQuickNotes('');
    setQuickOccasionId('');
    setShowQuickTxModal(null);
  };

  // Calculate overall directory totals
  const totalContacts = allPeople.length;
  const totalReceivedAll = allPeople.reduce((sum, p) => sum + p.totalReceived, 0);
  const totalPaidAll = allPeople.reduce((sum, p) => sum + p.totalPaid, 0);
  const netBalanceAll = totalReceivedAll - totalPaidAll;

  // Render container variants for smooth entry stagger
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 20 } }
  };

  return (
    <div className="space-y-6 font-sans text-right" dir="rtl">
      
      {/* 1. Main Directory Listing View */}
      {!selectedPerson && (
        <div className="space-y-6">
          
          {/* Header Section */}
          <div className="relative overflow-hidden bg-white/80 dark:bg-slate-900/60 p-6 md:p-8 rounded-3xl border border-slate-200/50 dark:border-white/5 shadow-sm backdrop-blur-md">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-black border border-blue-100 dark:border-blue-900/30">
                  <Sparkles size={12} className="animate-pulse" />
                  <span>دليل الأصدقاء والعائلة</span>
                </div>
                <h3 className="text-xl md:text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">سجل التبادل والنقوط الاجتماعية</h3>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                  تابع المبالغ المتبادلة والهدايا العينية مع كل جهة لموازنة الروابط الاجتماعية ومعرفة الواجبات والالتزامات المتبادلة بدقة.
                </p>
              </div>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setNewPersonOccasionId(occasions.length > 0 ? occasions[0].id : '');
                  setShowAddPersonModal(true);
                }}
                className="px-6 py-3.5 bg-gradient-to-l from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-500/15 hover:shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer self-start md:self-auto shrink-0"
              >
                <Plus size={16} />
                <span>إضافة شخص جديد</span>
              </motion.button>
            </div>
          </div>

          {/* Directory Summary Statistics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stat 1: Total Contacts */}
            <div className="bg-white/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-white/5 p-4 rounded-2xl shadow-sm backdrop-blur-md flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Users size={18} />
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold block">إجمالي الأشخاص</span>
                <span className="text-base font-black text-slate-800 dark:text-slate-100 font-mono">{totalContacts}</span>
              </div>
            </div>

            {/* Stat 2: Total Received */}
            <div className="bg-white/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-white/5 p-4 rounded-2xl shadow-sm backdrop-blur-md flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ArrowDownLeft size={18} />
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold block">إجمالي الوارد (استلمته)</span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">+{totalReceivedAll.toLocaleString()} ج.م</span>
              </div>
            </div>

            {/* Stat 3: Total Paid */}
            <div className="bg-white/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-white/5 p-4 rounded-2xl shadow-sm backdrop-blur-md flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <ArrowUpRight size={18} />
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold block">إجمالي الصادر (قدمته)</span>
                <span className="text-base font-black text-rose-600 dark:text-rose-400 font-mono">-{totalPaidAll.toLocaleString()} ج.م</span>
              </div>
            </div>

            {/* Stat 4: Net Balance */}
            <div className="bg-white/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-white/5 p-4 rounded-2xl shadow-sm backdrop-blur-md flex items-center gap-3 col-span-2 lg:col-span-1">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                netBalanceAll > 0 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' 
                  : netBalanceAll < 0 
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400' 
                  : 'bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400'
              }`}>
                <Scale size={18} />
              </div>
              <div className="w-full">
                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold block">الرصيد الصافي المتبادل</span>
                <span className={`text-base font-black font-mono block leading-none ${
                  netBalanceAll > 0 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : netBalanceAll < 0 
                    ? 'text-rose-600 dark:text-rose-400' 
                    : 'text-slate-600 dark:text-slate-300'
                }`}>
                  {netBalanceAll > 0 ? '+' : ''}{netBalanceAll.toLocaleString()} ج.م
                </span>
              </div>
            </div>
          </div>

          {/* Search Bar & Smart Filter Controls Container */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/50 dark:border-white/5 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
              
              {/* Search input */}
              <div className="relative flex-grow max-w-full lg:max-w-md">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={15} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن شخص بالاسم الكامل..."
                  className="w-full pr-11 pl-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/60 rounded-2xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 font-bold placeholder-slate-400 dark:placeholder-slate-500 transition-all"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/40 dark:border-slate-800/40">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    filterType === 'all'
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Filter size={11} />
                  <span>الكل ({allPeople.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('debtor')}
                  className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    filterType === 'debtor'
                      ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 shadow-sm'
                      : 'text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300'
                  }`}
                >
                  <TrendingUp size={11} />
                  <span>لك عندهم ({allPeople.filter(p => (p.totalReceived - p.totalPaid) < 0).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('creditor')}
                  className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    filterType === 'creditor'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-300'
                  }`}
                >
                  <TrendingDown size={11} />
                  <span>لهم عندك ({allPeople.filter(p => (p.totalReceived - p.totalPaid) > 0).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('balanced')}
                  className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    filterType === 'balanced'
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                  }`}
                >
                  <Scale size={11} />
                  <span>متعادل ({allPeople.filter(p => (p.totalReceived - p.totalPaid) === 0).length})</span>
                </button>
              </div>

            </div>
          </div>

          {/* People Grid View */}
          <AnimatePresence mode="popLayout">
            {filteredPeople.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-slate-900 rounded-3xl p-14 border border-slate-200/50 dark:border-white/5 text-center shadow-sm space-y-4"
              >
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-950 rounded-2xl flex items-center justify-center text-slate-400 mx-auto border border-slate-100 dark:border-slate-800/80">
                  <User size={28} className="text-slate-300 dark:text-slate-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-slate-700 dark:text-slate-300 text-sm">لا يوجد أشخاص متطابقين حالياً</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    لم نجد نتائج بحث مطابقة أو لا توجد حسابات تحت الفئة المحددة. حاول تغيير خيارات التصفية أو أضف شخصاً جديداً لتسجيل الواجب.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
              >
                {filteredPeople.map((person) => {
                  const balance = person.totalReceived - person.totalPaid;
                  const lastDateFormatted = new Date(person.lastDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
                  const isCreditor = balance > 0; // He gave you more, you owe him
                  const isDebtor = balance < 0;   // You gave him more, he owes you
                  
                  // Calculate mutual progress bar ratio
                  const totalTxAmount = person.totalReceived + person.totalPaid;
                  const receivedPercentage = totalTxAmount > 0 ? (person.totalReceived / totalTxAmount) * 100 : 50;

                  return (
                    <motion.div 
                      key={person.name}
                      variants={itemVariants}
                      whileHover={{ y: -4, transition: { duration: 0.2 } }}
                      onClick={() => setSelectedPerson(person.name)}
                      className="bg-white dark:bg-[#1e293b]/70 rounded-3xl border border-slate-200/50 dark:border-white/5 p-5 hover:border-blue-500/50 dark:hover:border-blue-500/30 hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between group relative overflow-hidden shadow-sm"
                    >
                      {/* Status indicator bar top accent */}
                      <div className={`absolute top-0 right-0 left-0 h-1.5 ${
                        isCreditor 
                          ? 'bg-gradient-to-l from-emerald-400 to-emerald-500' 
                          : isDebtor 
                          ? 'bg-gradient-to-l from-rose-400 to-rose-500' 
                          : 'bg-gradient-to-l from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800'
                      }`} />

                      <div className="space-y-4 pt-1.5">
                        {/* Name, Avatar and quick actions */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-black bg-gradient-to-br ${getAvatarGradient(person.name)} shadow-md border border-white/10`}>
                              {getInitials(person.name)}
                            </div>
                            <div>
                              <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-xs leading-tight line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {person.name}
                              </h4>
                              <span className="text-[10px] text-slate-450 dark:text-slate-500 font-bold flex items-center gap-1 mt-0.5">
                                <Clock size={10} />
                                <span>{person.txCount} واجبات مسجلة</span>
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const txIds = person.txs.map(tx => tx.id);
                                onDeleteMultipleTransactions(txIds, person.name);
                              }}
                              className="p-1.5 bg-slate-50 hover:bg-rose-50 dark:bg-slate-900/60 dark:hover:bg-rose-950/45 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                              title="حذف هذا الشخص وجميع معاملاته"
                            >
                              <Trash2 size={13} />
                            </button>
                            <div className="w-7 h-7 rounded-xl bg-slate-50 dark:bg-slate-900/60 text-slate-400 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/20 flex items-center justify-center transform group-hover:-translate-x-1 transition-all">
                              <ChevronLeft size={14} />
                            </div>
                          </div>
                        </div>

                        {/* Financial figures with ratio comparison tracks */}
                        <div className="space-y-2 bg-slate-50/50 dark:bg-slate-950/30 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/40 text-[10px]">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-0.5">
                              <span className="text-slate-400 dark:text-slate-500 font-bold block">وارد (استلمته)</span>
                              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs font-mono">+{person.totalReceived.toLocaleString()} ج.م</span>
                            </div>
                            <div className="border-r border-slate-200/60 dark:border-slate-800/60 pr-3.5 space-y-0.5">
                              <span className="text-slate-400 dark:text-slate-500 font-bold block">صادر (دفعته)</span>
                              <span className="font-extrabold text-rose-600 dark:text-rose-400 text-xs font-mono">-{person.totalPaid.toLocaleString()} ج.م</span>
                            </div>
                          </div>

                          {/* Dual progress exchange bar */}
                          {totalTxAmount > 0 && (
                            <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                              <div className="h-1.5 w-full bg-rose-500 dark:bg-rose-600/80 rounded-full overflow-hidden flex flex-row-reverse">
                                <div 
                                  style={{ width: `${receivedPercentage}%` }} 
                                  className="h-full bg-emerald-500 dark:bg-emerald-600" 
                                  title={`استلمت نسبة ${Math.round(receivedPercentage)}% من إجمالي التبادل`}
                                />
                              </div>
                              <div className="flex justify-between items-center text-[8px] text-slate-400 dark:text-slate-500 font-bold">
                                <span>وارد {Math.round(receivedPercentage)}%</span>
                                <span>صادر {Math.round(100 - receivedPercentage)}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Balance Status indicator at footer */}
                      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-4 text-[10px]">
                        <span className="text-slate-400 dark:text-slate-500 font-bold">آخر واجب: {lastDateFormatted}</span>
                        
                        <div className={`px-2.5 py-1 rounded-xl font-extrabold flex items-center gap-1 text-[9px] border ${
                          isCreditor 
                            ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/20 text-emerald-600 dark:text-emerald-400' 
                            : isDebtor 
                            ? 'bg-rose-50/50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/20 text-rose-600 dark:text-rose-400' 
                            : 'bg-slate-50 border-slate-100 dark:bg-slate-800 dark:border-slate-700/50 text-slate-500 dark:text-slate-400'
                        }`}>
                          <span>{isCreditor ? 'له عندك' : isDebtor ? 'لك عنده' : 'متعادل'}</span>
                          <span className="font-mono font-black">{Math.abs(balance).toLocaleString()} ج.م</span>
                        </div>
                      </div>

                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 2. Detailed Profile View of Selected Person */}
      {selectedPerson && selectedPersonData && (
        <div className="space-y-6">
          
          {/* Back Header navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/50 dark:border-slate-800/60 pb-5">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedPerson(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer hover:scale-[1.02]"
              >
                <ChevronRight size={14} />
                <span>العودة للدليل</span>
              </button>

              <button
                onClick={() => {
                  const txIds = selectedPersonData.txs.map(tx => tx.id);
                  onDeleteMultipleTransactions(txIds, selectedPersonData.name, () => setSelectedPerson(null));
                }}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="حذف هذا الشخص وجميع واجباته المسجلة"
              >
                <Trash2 size={13} />
                <span>حذف السجل بالكامل</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-base font-black bg-gradient-to-br ${getAvatarGradient(selectedPersonData.name)} shadow-md border border-white/10`}>
                {getInitials(selectedPersonData.name)}
              </div>
              <div className="text-right">
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm md:text-base leading-tight">
                  كشف تبادل: {selectedPersonData.name}
                </h3>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5">تفاصيل المعاملات الاجتماعية والتوازن بينكما</span>
              </div>
            </div>
          </div>

          {/* 3. Metrics Cards & Balance Calculation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Received Metric Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/40 dark:border-white/5 p-5 rounded-3xl flex items-center justify-between shadow-sm relative overflow-hidden">
              <div className="space-y-1 relative z-10">
                <span className="text-slate-400 dark:text-slate-500 block text-xs font-bold">نقود مستلمة (وارد منه)</span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">+{selectedPersonData.totalReceived.toLocaleString()} ج.م</span>
                <span className="text-[9px] text-slate-400 block font-semibold">بمثابة واجبات استلمتها في مناسباتك</span>
              </div>
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shadow-inner shrink-0 relative z-10">
                <ArrowDownLeft size={24} />
              </div>
              <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
            </div>

            {/* Paid Metric Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/40 dark:border-white/5 p-5 rounded-3xl flex items-center justify-between shadow-sm relative overflow-hidden">
              <div className="space-y-1 relative z-10">
                <span className="text-slate-400 dark:text-slate-500 block text-xs font-bold">نقود مدفوعة (صادر له)</span>
                <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">-{selectedPersonData.totalPaid.toLocaleString()} ج.م</span>
                <span className="text-[9px] text-slate-400 block font-semibold">بمثابة واجبات قدمتها في مناسباته</span>
              </div>
              <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center shadow-inner shrink-0 relative z-10">
                <ArrowUpRight size={24} />
              </div>
              <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
            </div>

            {/* Balance Calculation Metric */}
            {(() => {
              const balance = selectedPersonData.totalReceived - selectedPersonData.totalPaid;
              let description = "المعاملات الاجتماعية والواجبات متعادلة تماماً بينكما.";
              let badgeStyle = "bg-white dark:bg-slate-900 border border-slate-200/40 dark:border-white/5 text-slate-700 dark:text-slate-300";
              let balanceIcon = <Scale size={24} className="text-slate-500" />;
              let glowColor = "bg-slate-500/5";
              
              if (balance > 0) {
                description = `له عندك واجب بقيمة ${balance.toLocaleString()} ج.م (هو مبادر بالتقديم)`;
                badgeStyle = "bg-emerald-500/[0.02] border-emerald-500/20 dark:bg-emerald-950/15 dark:border-emerald-900/30 text-slate-800 dark:text-slate-200";
                balanceIcon = <ArrowDownLeft size={24} className="text-emerald-600" />;
                glowColor = "bg-emerald-500/5";
              } else if (balance < 0) {
                description = `لك عنده واجب بقيمة ${Math.abs(balance).toLocaleString()} ج.م (أنت مبادر بالتقديم)`;
                badgeStyle = "bg-rose-500/[0.02] border-rose-500/20 dark:bg-rose-950/15 dark:border-rose-900/30 text-slate-800 dark:text-slate-200";
                balanceIcon = <ArrowUpRight size={24} className="text-rose-600" />;
                glowColor = "bg-rose-500/5";
              }

              return (
                <div className={`${badgeStyle} p-5 rounded-3xl flex items-center justify-between shadow-sm relative overflow-hidden`}>
                  <div className="space-y-1 relative z-10">
                    <span className="block text-xs font-bold text-slate-400 dark:text-slate-500">التوازن الصافي الحالي</span>
                    <span className="text-2xl font-black font-mono block leading-none">
                      {balance > 0 ? `+${balance.toLocaleString()}` : balance.toLocaleString()} ج.م
                    </span>
                    <p className="text-[10px] font-bold leading-normal text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                      <Info size={11} className="shrink-0" />
                      <span>{description}</span>
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-white dark:bg-slate-950 rounded-2xl flex items-center justify-center shadow-md shrink-0 relative z-10">
                    {balanceIcon}
                  </div>
                  <div className={`absolute -bottom-8 -left-8 w-24 h-24 ${glowColor} rounded-full blur-xl pointer-events-none`} />
                </div>
              );
            })()}
          </div>

          {/* Action Row for quick insertion */}
          <div className="flex flex-col sm:flex-row gap-3">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                setQuickAmount('');
                setQuickNotes('');
                setQuickOccasionId(occasions.length > 0 ? occasions[0].id : '');
                setShowQuickTxModal('received');
              }}
              className="flex-1 py-3.5 px-4 bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-2.5 transition-all shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20 cursor-pointer"
            >
              <ArrowDownLeft size={16} />
              <span>تسجيل نقوط مستلم (وارد جديد منه)</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                setQuickAmount('');
                setQuickNotes('');
                setQuickOccasionId(occasions.length > 0 ? occasions[0].id : '');
                setShowQuickTxModal('paid');
              }}
              className="flex-1 py-3.5 px-4 bg-gradient-to-l from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-2.5 transition-all shadow-md shadow-rose-600/10 hover:shadow-rose-600/20 cursor-pointer"
            >
              <ArrowUpRight size={16} />
              <span>تسجيل نقوط مدفوع (صادر جديد له)</span>
            </motion.button>
          </div>

          {/* Custom Info Callout */}
          <div className="bg-blue-50/50 dark:bg-slate-900/60 p-4 rounded-2xl border border-blue-100/30 dark:border-blue-900/10 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Info size={16} />
            </div>
            <div className="space-y-1">
              <h5 className="font-extrabold text-slate-800 dark:text-slate-100 text-[11px]">مبدأ التبادل والواجب العائلي</h5>
              <p className="text-[10px] text-slate-500 dark:text-slate-450 leading-relaxed">
                يساعدك هذا السجل على الحفاظ على متانة الروابط العائلية عبر التأكد من أن التبادل المالي والهدايا الاجتماعية تتم بروح من المبادرة المتبادلة والتقدير الصادق.
              </p>
            </div>
          </div>

          {/* Detailed Transaction Log & Timeline */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/50 dark:border-white/5 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <div className="flex items-center gap-2">
                <Clock className="text-blue-600 dark:text-blue-400" size={16} />
                <h4 className="font-extrabold text-xs md:text-sm text-slate-850 dark:text-slate-200">سجل وتاريخ التبادل المتسلسل</h4>
              </div>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full font-black text-slate-500 dark:text-slate-400">
                {selectedPersonData.txs.length} حركة مسجلة
              </span>
            </div>

            {/* Custom Responsive Transaction List (Vertical Timeline) */}
            <div className="relative border-r-2 border-slate-100 dark:border-slate-800/60 mr-3.5 pl-1 space-y-6">
              {selectedPersonData.txs.map((tx, idx) => {
                const decTx = getDecryptedTx(tx);
                const matchedOcc = occasions.find(o => o.id === tx.occasionId);
                const decOccTitle = matchedOcc ? decryptText(matchedOcc.title, encryptionKey) : 'كشف المناسبات العام';
                
                // Formatted Date (e.g. June 17, 2026)
                const txDateStr = new Date(tx.createdAt).toLocaleDateString('ar-EG', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                });

                const isReceived = tx.type === 'received';

                return (
                  <div key={tx.id} className="relative pr-6 group">
                    {/* Timeline Node Point Indicator */}
                    <div className={`absolute right-[-7px] top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 z-10 transition-all group-hover:scale-125 ${
                      isReceived 
                        ? 'bg-emerald-500 shadow-sm shadow-emerald-500/20' 
                        : 'bg-rose-500 shadow-sm shadow-rose-500/20'
                    }`} />

                    <div className="bg-slate-50/50 dark:bg-slate-950/20 hover:bg-slate-50 dark:hover:bg-slate-950/40 p-4 rounded-2xl border border-slate-100/80 dark:border-slate-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300">
                      
                      {/* Left Block: Info, Title, Notes */}
                      <div className="space-y-1.5 flex-grow">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black ${
                            isReceived 
                              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' 
                              : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'
                          }`}>
                            {isReceived ? 'وارد استلمته' : 'صادر قدمته'}
                          </span>
                          
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1">
                            <Calendar size={10} />
                            <span>{txDateStr}</span>
                          </span>
                        </div>

                        <h5 className="font-extrabold text-slate-800 dark:text-slate-100 text-xs">
                          {decOccTitle}
                        </h5>

                        {/* Decrypted Notes */}
                        {decTx.notes ? (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800/40 inline-block">
                            {decTx.notes}
                          </p>
                        ) : (
                          <span className="text-[9px] text-slate-300 dark:text-slate-600 font-semibold block italic">لا توجد ملاحظات أو هدايا عينية مسجلة لهذه الحركة.</span>
                        )}
                      </div>

                      {/* Right Block: Price amount and action buttons */}
                      <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 border-slate-100 dark:border-slate-800/40 pt-3 md:pt-0 shrink-0">
                        <div className="text-right">
                          <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold block">القيمة المالية</span>
                          <span className={`text-base font-black font-mono ${
                            isReceived ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {isReceived ? '+' : '-'}{tx.amount.toLocaleString()} ج.م
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onEditTransaction(tx)}
                            className="p-2 hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-all border border-transparent hover:border-slate-200/40 dark:hover:border-slate-700/40 shadow-sm cursor-pointer"
                            title="تعديل"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => onDeleteTransaction(tx.id)}
                            className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-all border border-transparent hover:border-rose-200/20 shadow-sm cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal: Add New Person (with optional amount and notes) */}
      <AnimatePresence>
        {showAddPersonModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden font-sans"
            >
              
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <User size={18} />
                  <h3 className="font-extrabold text-slate-850 dark:text-slate-100 text-sm">تسجيل شخص وواجب جديد</h3>
                </div>
                <button 
                  onClick={() => setShowAddPersonModal(false)} 
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleAddNewPersonSubmit} className="p-6 space-y-4">
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-450 mb-1">الاسم الكامل للشخص (مطلوب)</label>
                  <input
                    type="text"
                    required
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                    placeholder="مثال: يوسف أحمد الهواري"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-450 mb-1">القيمة المالية (ج.م - اختياري)</label>
                    <input
                      type="number"
                      min={0}
                      value={newPersonAmount}
                      onChange={(e) => setNewPersonAmount(e.target.value)}
                      placeholder="مثال: 500"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-450 mb-1">نوع الواجب</label>
                    <select
                      value={newPersonTxType}
                      onChange={(e) => setNewPersonTxType(e.target.value as TransactionType)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 cursor-pointer font-bold"
                    >
                      <option value="received">وارد (استلمته منه)</option>
                      <option value="paid">صادر (قدمته له)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-450 mb-1">المناسبة الاجتماعية التابعة لها</label>
                  {occasions.length === 0 ? (
                    <div className="text-[10px] bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 p-3.5 rounded-xl leading-normal border border-blue-100/30">
                      لا توجد مناسبات اجتماعية مسجلة حالياً. سنقوم بإنشاء "كشف مناسبات عام" تلقائياً لحفظ هذه المعاملة تحته بشكل منظم.
                    </div>
                  ) : (
                    <select
                      value={newPersonOccasionId}
                      onChange={(e) => setNewPersonOccasionId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-805 dark:text-slate-200 cursor-pointer font-bold"
                    >
                      <option value="">-- اختر المناسبة --</option>
                      {occasions.map(o => (
                        <option key={o.id} value={o.id}>{decryptText(o.title, encryptionKey)}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-450 mb-1">تفاصيل الواجب أو الهدية العينية (اختياري)</label>
                  <textarea
                    rows={2}
                    value={newPersonNotes}
                    onChange={(e) => setNewPersonNotes(e.target.value)}
                    placeholder="مثال: بمناسبة حفل زفافه، أو طقم هدايا عينية..."
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 font-bold"
                  />
                </div>

                <div className="flex gap-2 justify-end border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddPersonModal(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all cursor-pointer hover:scale-[1.01]"
                  >
                    تسجيل وحفظ البيانات
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. Modal: Quick Add Transaction (from Person Details Profile screen) */}
      <AnimatePresence>
        {showQuickTxModal && selectedPersonData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden font-sans"
            >
              
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800">
                <div className={`flex items-center gap-2 ${
                  showQuickTxModal === 'received' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {showQuickTxModal === 'received' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                  <h3 className="font-extrabold text-slate-850 dark:text-slate-100 text-sm">
                    {showQuickTxModal === 'received' ? 'وارد جديد مستلم منه' : 'صادر جديد مقدم له'}
                  </h3>
                </div>
                <button 
                  onClick={() => setShowQuickTxModal(null)} 
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleQuickTxSubmit} className="p-6 space-y-4">
                
                <div className="text-center bg-slate-50 dark:bg-slate-950/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/60 flex items-center gap-3 justify-center">
                  <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center text-xs font-black bg-gradient-to-br ${getAvatarGradient(selectedPersonData.name)} shrink-0 border border-white/5`}>
                    {getInitials(selectedPersonData.name)}
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 block font-bold leading-none mb-1">تسجيل واجب جديد لحساب</span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 leading-none">{selectedPersonData.name}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-450 mb-1">القيمة المالية بالجنيه (ج.م)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={quickAmount}
                    onChange={(e) => setQuickAmount(e.target.value)}
                    placeholder="مثال: 500"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-450 mb-1">المناسبة التابعة لها</label>
                  {occasions.length === 0 ? (
                    <div className="text-[10px] bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 p-3 rounded-xl leading-normal border border-blue-100/30">
                      لا توجد مناسبات مسجلة حالياً. سيقوم النظام بإنشاء "كشف مناسبات عام" تلقائياً لتثبيت الحركة المالية تحته بشكل صحيح.
                    </div>
                  ) : (
                    <select
                      value={quickOccasionId}
                      onChange={(e) => setQuickOccasionId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-850 dark:text-slate-200 cursor-pointer font-bold"
                    >
                      <option value="">-- اختر المناسبة --</option>
                      {occasions.map(o => (
                        <option key={o.id} value={o.id}>{decryptText(o.title, encryptionKey)}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-455 mb-1">ملاحظة وتفاصيل سريعة (اختياري)</label>
                  <textarea
                    rows={2}
                    value={quickNotes}
                    onChange={(e) => setQuickNotes(e.target.value)}
                    placeholder="ملاحظات حول الواجب، أو تفاصيل الهدية العينية..."
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 font-bold"
                  />
                </div>

                <div className="flex gap-2 justify-end border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickTxModal(null)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className={`px-5 py-2 rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer text-white ${
                      showQuickTxModal === 'received' 
                        ? 'bg-gradient-to-l from-emerald-600 to-emerald-700 shadow-emerald-500/10' 
                        : 'bg-gradient-to-l from-rose-600 to-rose-700 shadow-rose-500/10'
                    }`}
                  >
                    تسجيل الواجب
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
