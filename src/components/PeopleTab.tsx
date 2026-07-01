import React, { useState } from 'react';
import { 
  User, Search, Plus, ArrowUpRight, ArrowDownLeft, Scale, Calendar, 
  ChevronLeft, Trash2, Edit3, X, Users, TrendingUp, TrendingDown, Clock, MessageSquare, AlertCircle
} from 'lucide-react';
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
  // Navigation & Search State
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
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

  // Filter people based on search query
  const filteredPeople = allPeople.filter(person => 
    person.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get active selected person's detailed aggregates
  const selectedPersonData = selectedPerson 
    ? allPeople.find(p => p.name.toLowerCase() === selectedPerson.toLowerCase()) 
    : null;

  // Generate beautiful background gradients for initials
  const getAvatarGradient = (name: string) => {
    const colors = [
      'from-blue-500 to-indigo-600 text-blue-50',
      'from-emerald-500 to-teal-600 text-emerald-50',
      'from-purple-500 to-pink-600 text-purple-50',
      'from-rose-500 to-red-600 text-rose-50',
      'from-amber-500 to-orange-600 text-amber-50',
      'from-violet-500 to-fuchsia-600 text-violet-50'
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

  // Calculate Net overall stats for the header
  const totalReceivedAll = allPeople.reduce((sum, p) => sum + p.totalReceived, 0);
  const totalPaidAll = allPeople.reduce((sum, p) => sum + p.totalPaid, 0);
  const netBalanceAll = totalReceivedAll - totalPaidAll;

  return (
    <div className="space-y-6 font-sans text-right" dir="rtl">
      
      {/* 1. Main Directory Listing View */}
      {!selectedPerson && (
        <div className="space-y-6">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 dark:bg-[#1e293b]/30 p-5 rounded-3xl border border-slate-200/40 dark:border-white/5 backdrop-blur-sm">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-extrabold border border-blue-100 dark:border-blue-900/30">
                <Users size={12} />
                <span>دليل الأصدقاء والعائلة</span>
              </div>
              <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">سجل التبادل والنقوط الاجتماعية</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">تابع المبالغ المتبادلة مع كل جهة لموازنة الروابط ومعرفة المدفوع والمستلم بدقة.</p>
            </div>
            
            <button
              onClick={() => {
                setNewPersonOccasionId(occasions.length > 0 ? occasions[0].id : '');
                setShowAddPersonModal(true);
              }}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer self-start md:self-auto hover:scale-[1.02] duration-200"
            >
              <Plus size={16} />
              <span>إضافة شخص جديد</span>
            </button>
          </div>



          {/* Search bar card */}
          <div className="bg-white dark:bg-[#1e293b] p-3 rounded-2xl border border-slate-200/50 dark:border-white/5 shadow-sm">
            <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن شخص بالاسم الكامل..."
                className="w-full pr-11 pl-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/60 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 font-medium placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
          </div>

          {/* People cards grid */}
          {filteredPeople.length === 0 ? (
            <div className="bg-white dark:bg-[#1e293b] rounded-3xl p-14 border border-slate-200/50 dark:border-white/5 text-center shadow-sm space-y-3">
              <div className="w-14 h-14 bg-slate-50 dark:bg-slate-950 rounded-2xl flex items-center justify-center text-slate-400 mx-auto">
                <User size={28} />
              </div>
              <h4 className="font-extrabold text-slate-700 dark:text-slate-300 text-sm">لا يوجد أشخاص مسجلين حالياً</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">ابدأ بإضافة شخص وتحديد النقوط المتبادلة، أو ابحث باسم آخر.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPeople.map((person) => {
                const balance = person.totalReceived - person.totalPaid;
                const lastDateFormatted = new Date(person.lastDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
                const isCreditor = balance > 0;
                const isDebtor = balance < 0;
                
                return (
                  <div 
                    key={person.name}
                    onClick={() => setSelectedPerson(person.name)}
                    className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200/50 dark:border-white/5 p-5 hover:border-blue-500/50 hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                  >
                    {/* Status vertical color bar */}
                    <div className={`absolute top-0 bottom-0 right-0 w-1.5 ${
                      isCreditor 
                        ? 'bg-emerald-500' 
                        : isDebtor 
                        ? 'bg-rose-500' 
                        : 'bg-slate-300 dark:bg-slate-700'
                    }`} />

                    <div className="space-y-4">
                      {/* Name & Basic Info */}
                      <div className="flex items-start justify-between gap-3 mr-1.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black bg-gradient-to-br ${getAvatarGradient(person.name)} shadow-sm`}>
                            {getInitials(person.name)}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-xs leading-tight line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{person.name}</h4>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">{person.txCount} نقوط مسجلة</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const txIds = person.txs.map(tx => tx.id);
                              onDeleteMultipleTransactions(txIds, person.name);
                            }}
                            className="p-1.5 bg-slate-50 hover:bg-rose-50 dark:bg-slate-900 dark:hover:bg-rose-950/45 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="حذف هذا الشخص وجميع معاملاته"
                          >
                            <Trash2 size={13} />
                          </button>
                          <ChevronLeft size={16} className="text-slate-400 dark:text-slate-600 group-hover:text-blue-500 transform group-hover:-translate-x-1 transition-all shrink-0" />
                        </div>
                      </div>

                      {/* Financial details row */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/40 text-[10px] mr-1.5">
                        <div className="space-y-0.5">
                          <span className="text-slate-400 dark:text-slate-500 font-semibold block">وارد (استلمته)</span>
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400">+{person.totalReceived.toLocaleString()} ج.م</span>
                        </div>
                        <div className="border-r border-slate-200 dark:border-slate-800 pr-3 space-y-0.5">
                          <span className="text-slate-400 dark:text-slate-500 font-semibold block">صادر (دفعته)</span>
                          <span className="font-extrabold text-rose-600 dark:text-rose-400">-{person.totalPaid.toLocaleString()} ج.م</span>
                        </div>
                      </div>
                    </div>

                    {/* Balance Status indicator at footer */}
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-4 mr-1.5 text-[10px]">
                      <span className="text-slate-400 dark:text-slate-500 font-medium">آخر تبادل: {lastDateFormatted}</span>
                      
                      <div className={`px-2.5 py-1 rounded-lg font-extrabold flex items-center gap-1 text-[9px] ${
                        isCreditor 
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' 
                          : isDebtor 
                          ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400' 
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        <span>{isCreditor ? 'له عندك' : isDebtor ? 'لك عنده' : 'متعادل'}</span>
                        <span className="font-black">{Math.abs(balance).toLocaleString()} ج.م</span>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. Detailed Profile View of Selected Person */}
      {selectedPerson && selectedPersonData && (
        <div className="space-y-6">
          
          {/* Back Header */}
          <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedPerson(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="rotate-180" size={14} />
                <span>رجوع للجميع</span>
              </button>

              <button
                onClick={() => {
                  const txIds = selectedPersonData.txs.map(tx => tx.id);
                  onDeleteMultipleTransactions(txIds, selectedPersonData.name, () => setSelectedPerson(null));
                }}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="حذف هذا الشخص وجميع معاملاته"
              >
                <Trash2 size={13} />
                <span>حذف الشخص</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black bg-gradient-to-br ${getAvatarGradient(selectedPersonData.name)} shadow-sm`}>
                {getInitials(selectedPersonData.name)}
              </div>
              <div className="text-right">
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm leading-tight">
                  كشف تبادل: {selectedPersonData.name}
                </h3>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">تفاصيل وتبادل النقود المتبادلة</span>
              </div>
            </div>
          </div>

          {/* 3. Metrics Cards & Balance Calculation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Received Metric */}
            <div className="bg-white dark:bg-[#1e293b] border border-slate-200/40 dark:border-white/5 p-5 rounded-2xl flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-slate-400 dark:text-slate-500 block text-xs font-bold">النقود المستلمة (وارد منه)</span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">+{selectedPersonData.totalReceived.toLocaleString()} ج.م</span>
              </div>
              <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shadow-inner shrink-0">
                <ArrowDownLeft size={22} />
              </div>
            </div>

            {/* Paid Metric */}
            <div className="bg-white dark:bg-[#1e293b] border border-slate-200/40 dark:border-white/5 p-5 rounded-2xl flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-slate-400 dark:text-slate-500 block text-xs font-bold">النقود المدفوعة (صادر له)</span>
                <span className="text-xl font-black text-rose-600 dark:text-rose-400">-{selectedPersonData.totalPaid.toLocaleString()} ج.م</span>
              </div>
              <div className="w-11 h-11 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center shadow-inner shrink-0">
                <ArrowUpRight size={22} />
              </div>
            </div>

            {/* Balance Calculation Metric */}
            {(() => {
              const balance = selectedPersonData.totalReceived - selectedPersonData.totalPaid;
              let description = "المعاملات الاجتماعية متعادلة تماماً بينكما.";
              let badgeStyle = "bg-slate-50 border border-slate-200 dark:bg-slate-900/40 dark:border-slate-800 text-slate-700 dark:text-slate-300";
              let balanceIcon = <Scale size={22} className="text-slate-500" />;
              
              if (balance > 0) {
                description = `له عندك نقوط بقيمة ${balance.toLocaleString()} ج.م (قدم لك أكثر)`;
                badgeStyle = "bg-emerald-50/50 border border-emerald-200/40 dark:bg-emerald-950/15 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400";
                balanceIcon = <ArrowDownLeft size={22} className="text-emerald-600" />;
              } else if (balance < 0) {
                description = `لك عنده نقوط بقيمة ${Math.abs(balance).toLocaleString()} ج.م (أنت قدمت له أكثر)`;
                badgeStyle = "bg-rose-50/50 border border-rose-200/40 dark:bg-rose-950/15 dark:border-rose-900/30 text-rose-700 dark:text-rose-400";
                balanceIcon = <ArrowUpRight size={22} className="text-rose-600" />;
              }

              return (
                <div className={`${badgeStyle} p-5 rounded-2xl flex items-center justify-between shadow-sm`}>
                  <div className="space-y-1">
                    <span className="block text-xs font-bold text-slate-400 dark:text-slate-500">التوازن الصافي للنقوط</span>
                    <span className="text-xl font-black">{balance > 0 ? `+${balance.toLocaleString()}` : balance.toLocaleString()} ج.م</span>
                    <p className="text-[10px] font-bold leading-normal">{description}</p>
                  </div>
                  <div className="w-11 h-11 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                    {balanceIcon}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Action Row for quick insertion */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setQuickAmount('');
                setQuickNotes('');
                setQuickOccasionId(occasions.length > 0 ? occasions[0].id : '');
                setShowQuickTxModal('received');
              }}
              className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20 cursor-pointer hover:scale-[1.01] duration-150"
            >
              <ArrowDownLeft size={16} />
              <span>تسجيل مستلم (وارد جديد منه)</span>
            </button>
            <button
              onClick={() => {
                setQuickAmount('');
                setQuickNotes('');
                setQuickOccasionId(occasions.length > 0 ? occasions[0].id : '');
                setShowQuickTxModal('paid');
              }}
              className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-rose-600/10 hover:shadow-rose-600/20 cursor-pointer hover:scale-[1.01] duration-150"
            >
              <ArrowUpRight size={16} />
              <span>تسجيل مدفوع (صادر جديد له)</span>
            </button>
          </div>

          {/* Detailed Transaction Log Table */}
          <div className="bg-white dark:bg-[#1e293b] rounded-3xl border border-slate-200/50 dark:border-white/5 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">تاريخ المعاملات والنقوط المتبادلة</h4>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-bold text-slate-500 dark:text-slate-400">{selectedPersonData.txs.length} حركة</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right whitespace-nowrap">
                <thead>
                  <tr className="text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                    <th className="py-3 font-extrabold">المناسبة الاجتماعية</th>
                    <th className="py-3 font-extrabold">الحركة</th>
                    <th className="py-3 font-extrabold">المبلغ / القيمة</th>
                    <th className="py-3 font-extrabold">الملاحظات</th>
                    <th className="py-3 font-extrabold">تاريخ الحركة</th>
                    <th className="py-3 font-extrabold text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {selectedPersonData.txs.map((tx) => {
                    const decTx = getDecryptedTx(tx);
                    const matchedOcc = occasions.find(o => o.id === tx.occasionId);
                    const decOccTitle = matchedOcc ? decryptText(matchedOcc.title, encryptionKey) : 'كشف المناسبات العام';
                    const txDateStr = new Date(tx.createdAt).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors group">
                        <td className="py-3.5 font-bold text-slate-800 dark:text-slate-200">{decOccTitle}</td>
                        <td className="py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold ${
                            tx.type === 'received' 
                              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' 
                              : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'
                          }`}>
                            {tx.type === 'received' ? 'وارد استلمته' : 'صادر دفعته'}
                          </span>
                        </td>
                        <td className="py-3.5 font-black text-slate-900 dark:text-slate-100">{tx.amount.toLocaleString()} ج.م</td>
                        <td className="py-3.5 text-slate-500 dark:text-slate-400 max-w-[200px] truncate" title={decTx.notes || decTx.giftDescription}>
                          {decTx.notes || decTx.giftDescription || <span className="text-slate-300 dark:text-slate-600 font-normal">لا توجد ملاحظات</span>}
                        </td>
                        <td className="py-3.5 text-slate-400 font-medium">{txDateStr}</td>
                        <td className="py-3.5">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => onEditTransaction(tx)}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                              title="تعديل"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => {
                                onDeleteTransaction(tx.id);
                              }}
                              className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal: Add New Person (with optional amount and notes) */}
      {showAddPersonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden font-sans transform scale-100 transition-all duration-300">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-slate-850 dark:text-slate-100 text-sm">إضافة شخص ومعاملة مالية جديدة</h3>
              <button 
                onClick={() => setShowAddPersonModal(false)} 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddNewPersonSubmit} className="p-6 space-y-4">
              
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">الاسم الكامل للشخص (مطلوب)</label>
                <input
                  type="text"
                  required
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  placeholder="مثال: يوسف أحمد الهواري"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">المبلغ المالي (ج.م - اختياري)</label>
                  <input
                    type="number"
                    min={0}
                    value={newPersonAmount}
                    onChange={(e) => setNewPersonAmount(e.target.value)}
                    placeholder="مثال: 500"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">نوع المعاملة</label>
                  <select
                    value={newPersonTxType}
                    onChange={(e) => setNewPersonTxType(e.target.value as TransactionType)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 cursor-pointer font-bold"
                  >
                    <option value="received">نقوط وارد (استلمته)</option>
                    <option value="paid">نقوط صادر (دفعته)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">المناسبة التابعة لها</label>
                {occasions.length === 0 ? (
                  <div className="text-[10px] bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 p-3 rounded-xl leading-normal border border-blue-100/30">
                    لا توجد لديك مناسبات مسجلة بعد. سنقوم بإنشاء كشف مناسبات عام تلقائياً لتسجيل هذا الشخص تحته.
                  </div>
                ) : (
                  <select
                    value={newPersonOccasionId}
                    onChange={(e) => setNewPersonOccasionId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 cursor-pointer font-semibold"
                  >
                    <option value="">-- اختر المناسبة --</option>
                    {occasions.map(o => (
                      <option key={o.id} value={o.id}>{decryptText(o.title, encryptionKey)}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">ملاحظة وتفاصيل النقوط (اختياري)</label>
                <textarea
                  rows={2}
                  value={newPersonNotes}
                  onChange={(e) => setNewPersonNotes(e.target.value)}
                  placeholder="مثال: بمناسبة حفل زفافه، أو هدية عينية مميزة..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 font-medium"
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPersonModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/10 transition-all cursor-pointer hover:scale-[1.01]"
                >
                  حفظ وتسجيل النقوط
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 7. Modal: Quick Add Transaction (from Person Details Profile screen) */}
      {showQuickTxModal && selectedPersonData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden font-sans transform scale-100 transition-all duration-300">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-slate-805 dark:text-slate-100 text-sm">
                {showQuickTxModal === 'received' ? 'وارد جديد مستلم منه' : 'صادر جديد مدفوع له'}
              </h3>
              <button 
                onClick={() => setShowQuickTxModal(null)} 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleQuickTxSubmit} className="p-6 space-y-4">
              <div className="text-center bg-slate-50 dark:bg-slate-950/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/60 flex items-center gap-2.5 justify-center">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black bg-gradient-to-br ${getAvatarGradient(selectedPersonData.name)} shrink-0`}>
                  {getInitials(selectedPersonData.name)}
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-450 block font-semibold leading-none mb-1">تسجيل للحساب المالي لـ</span>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100 leading-none">{selectedPersonData.name}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">المبلغ المالي (ج.م)</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(e.target.value)}
                  placeholder="مثال: 500"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">المناسبة التابعة لها</label>
                {occasions.length === 0 ? (
                  <div className="text-[10px] bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 p-3 rounded-xl leading-normal border border-blue-100/30">
                    لا توجد مناسبات مسجلة بعد. سيقوم النظام بإنشاء كشف مناسبات عام تلقائياً لتسجيل هذا الشخص تحته.
                  </div>
                ) : (
                  <select
                    value={quickOccasionId}
                    onChange={(e) => setQuickOccasionId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 cursor-pointer font-semibold"
                  >
                    <option value="">-- اختر المناسبة --</option>
                    {occasions.map(o => (
                      <option key={o.id} value={o.id}>{decryptText(o.title, encryptionKey)}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">ملاحظة سريعة (اختياري)</label>
                <textarea
                  rows={2}
                  value={quickNotes}
                  onChange={(e) => setQuickNotes(e.target.value)}
                  placeholder="ملاحظات حول النقوط أو المناسبة..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 font-medium"
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickTxModal(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer text-white ${
                    showQuickTxModal === 'received' 
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10' 
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/10'
                  }`}
                >
                  تسجيل الحركة
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
