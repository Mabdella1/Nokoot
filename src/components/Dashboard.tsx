import React, { useState } from 'react';
import { 
  Calendar, Award, Gift, DollarSign, Plus, ArrowRightLeft, 
  Trash2, Edit, AlertTriangle, ArrowUpRight, ArrowDownLeft, TrendingUp, HelpCircle, 
  Clock, ShieldCheck, Sparkles, BellRing
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { Occasion, NoqootTransaction, OccasionType } from '../types';
import { decryptText } from '../utils/security';

interface DashboardProps {
  occasions: Occasion[];
  transactions: NoqootTransaction[];
  onSelectOccasion: (occasion: Occasion | null) => void;
  onAddOccasion: (data: { title: string; date: string; type: OccasionType; notes: string }) => void;
  onEditOccasion: (id: string, data: { title: string; date: string; type: OccasionType; notes: string }) => void;
  onDeleteOccasion: (id: string) => void;
  encryptionKey: string;
}

const getAutoOccasionDetails = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const dayName = days[now.getDay()];
  
  const hour = now.getHours();
  const minute = String(now.getMinutes()).padStart(2, '0');
  const period = hour >= 12 ? 'مساءً' : 'صباحاً';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const timeStr = `${displayHour}:${minute} ${period}`;
  
  return {
    date: dateStr,
    notes: `تم تسجيل المناسبة تلقائياً في يوم ${dayName} الموافق ${dateStr} في تمام الساعة ${timeStr}`
  };
};

export default function Dashboard({
  occasions,
  transactions,
  onSelectOccasion,
  onAddOccasion,
  onEditOccasion,
  onDeleteOccasion,
  encryptionKey
}: DashboardProps) {
  
  // Occasion form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editOccasionId, setEditOccasionId] = useState<string | null>(null);
  
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formType, setFormType] = useState<OccasionType>('wedding');
  const [formNotes, setFormNotes] = useState('');
  const [occasionSearchQuery, setOccasionSearchQuery] = useState('');
  const [chartViewMode, setChartViewMode] = useState<'individual' | 'category'>('individual');

  // Filtered occasions list
  const filteredOccasions = occasions.filter(occ => {
    const decTitle = decryptText(occ.title, encryptionKey).toLowerCase();
    const decNotes = decryptText(occ.notes, encryptionKey).toLowerCase();
    const query = occasionSearchQuery.toLowerCase();
    return decTitle.includes(query) || decNotes.includes(query) || occ.type.includes(query);
  });

  // 1. Calculate General Financial Aggregations
  const totalReceived = transactions
    .filter(t => t.type === 'received')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalPaid = transactions
    .filter(t => t.type === 'paid')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalReceived - totalPaid;

  // 2. Extract Smart Alert Reminders (Repayment deadlines coming in the next 15 days or overdue)
  const today = new Date();
  const repaymentAlerts = transactions.filter(t => {
    if (t.isRepaid || !t.repaymentDueDate) return false;
    const dueDate = new Date(t.repaymentDueDate);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 15; // due within 15 days, or already overdue (negative diffDays)
  });

  // Sort alerts: most urgent/overdue first
  const sortedAlerts = [...repaymentAlerts].sort((a, b) => {
    const da = new Date(a.repaymentDueDate!).getTime();
    const db = new Date(b.repaymentDueDate!).getTime();
    return da - db;
  });

  // 3. Prepare Interactive Statistical Chart Data (Grouping transactions by occasion category)
  const categoryTotals: Record<OccasionType, { received: number; paid: number }> = {
    wedding: { received: 0, paid: 0 },
    graduation: { received: 0, paid: 0 },
    birth: { received: 0, paid: 0 },
    eid: { received: 0, paid: 0 },
    other: { received: 0, paid: 0 }
  };

  transactions.forEach(t => {
    // Find the associated occasion's category
    const occ = occasions.find(o => o.id === t.occasionId);
    const cat = occ ? occ.type : 'other';
    if (t.type === 'received') {
      categoryTotals[cat].received += t.amount;
    } else {
      categoryTotals[cat].paid += t.amount;
    }
  });

  const categoriesList: { type: OccasionType; label: string; received: number; paid: number }[] = [
    { type: 'wedding', label: 'أعراس / خطوبة', ...categoryTotals.wedding },
    { type: 'graduation', label: 'تخرج / نجاح', ...categoryTotals.graduation },
    { type: 'birth', label: 'مواليد / عقيقة', ...categoryTotals.birth },
    { type: 'eid', label: 'أعياد ومناسبات', ...categoryTotals.eid },
    { type: 'other', label: 'مناسبات أخرى', ...categoryTotals.other }
  ];

  // Maximum value for SVG scaling
  const maxVal = Math.max(...categoriesList.map(c => Math.max(c.received, c.paid, 100)));

  // Form submission handler
  const handleOccasionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDate) return;

    if (editOccasionId) {
      onEditOccasion(editOccasionId, {
        title: formTitle,
        date: formDate,
        type: formType,
        notes: formNotes
      });
      setEditOccasionId(null);
    } else {
      onAddOccasion({
        title: formTitle,
        date: formDate,
        type: formType,
        notes: formNotes
      });
    }

    // Reset Form
    setFormTitle('');
    setFormDate('');
    setFormType('wedding');
    setFormNotes('');
    setShowAddForm(false);
  };

  const handleTriggerEdit = (occ: Occasion) => {
    setEditOccasionId(occ.id);
    setFormTitle(decryptText(occ.title, encryptionKey));
    setFormDate(occ.date);
    setFormType(occ.type);
    setFormNotes(decryptText(occ.notes, encryptionKey));
    setShowAddForm(true);
  };

  const translateType = (type: OccasionType) => {
    switch (type) {
      case 'wedding': return "زفاف / خطوبة";
      case 'graduation': return "تخرج";
      case 'birth': return "مولود جديد";
      case 'eid': return "أعياد ومواسم";
      case 'other': return "أخرى";
      default: return type;
    }
  };

  // Calculations for current/filtered occasions
  const filteredOccasionIds = filteredOccasions.map(occ => occ.id);
  const currentOccasionsTransactions = transactions.filter(t => filteredOccasionIds.includes(t.occasionId));
  
  const currentOccasionsReceived = currentOccasionsTransactions
    .filter(t => t.type === 'received')
    .reduce((sum, t) => sum + t.amount, 0);

  const currentOccasionsPaid = currentOccasionsTransactions
    .filter(t => t.type === 'paid')
    .reduce((sum, t) => sum + t.amount, 0);

  const currentOccasionsNet = currentOccasionsReceived - currentOccasionsPaid;

  // Prepare datasets for Recharts comparison
  const individualChartData = occasions.map(occ => {
    const title = decryptText(occ.title, encryptionKey);
    const oTxs = transactions.filter(t => t.occasionId === occ.id);
    const rec = oTxs.filter(t => t.type === 'received').reduce((sum, t) => sum + t.amount, 0);
    const paid = oTxs.filter(t => t.type === 'paid').reduce((sum, t) => sum + t.amount, 0);
    return {
      name: title.length > 15 ? title.substring(0, 15) + '...' : title,
      fullName: title,
      'مستلم (وارد)': rec,
      'مدفوع (صادر)': paid,
    };
  });

  const categoryChartData = categoriesList.map(cat => ({
    name: cat.label,
    'مستلم (وارد)': cat.received,
    'مدفوع (صادر)': cat.paid,
  }));

  return (
    <div className="space-y-8 font-sans" dir="rtl">
      
      
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        
        {/* Card 1: Total Received */}
        <div className="bg-white/90 dark:glass border border-slate-200/50 dark:border-white/5 p-6 rounded-3xl shadow-sm relative overflow-hidden group card-hover transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">إجمالي النقوط المستلمة</span>
            <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ArrowDownLeft size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
            + {totalReceived.toLocaleString()} ج.م
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">نقود وهدايا واردة في مناسباتك الخاصة</p>
          <div className="absolute bottom-0 right-0 left-0 h-1 bg-emerald-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-right duration-300" />
        </div>

        {/* Card 2: Total Paid */}
        <div className="bg-white/90 dark:glass border border-slate-200/50 dark:border-white/5 p-6 rounded-3xl shadow-sm relative overflow-hidden group card-hover transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">إجمالي النقوط المدفوعة</span>
            <div className="w-9 h-9 bg-rose-50 dark:bg-rose-950/40 rounded-xl flex items-center justify-center text-rose-600 dark:text-rose-400">
              <ArrowUpRight size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">
            - {totalPaid.toLocaleString()} ج.م
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">موجبات مجتمعية قمت بتأديتها للآخرين</p>
          <div className="absolute bottom-0 right-0 left-0 h-1 bg-rose-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-right duration-300" />
        </div>

        {/* Card 3: Net Balance */}
        <div className="bg-white/90 dark:glass border border-slate-200/50 dark:border-white/5 p-6 rounded-3xl shadow-sm relative overflow-hidden group card-hover transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">صافي النقود</span>
            <div className="w-9 h-9 bg-blue-50 dark:bg-blue-950/40 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
              <TrendingUp size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400">
            {netBalance >= 0 ? '+' : ''} {netBalance.toLocaleString()} ج.م
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">الفرق الإجمالي بين ما دفعته وما استلمته</p>
          <div className="absolute bottom-0 right-0 left-0 h-1 bg-blue-600 scale-x-0 group-hover:scale-x-100 transition-transform origin-right duration-300" />
        </div>

        {/* Card 4: Overdue Alert Count */}
        <div className="bg-white/90 dark:glass border border-slate-200/50 dark:border-white/5 p-6 rounded-3xl shadow-sm relative overflow-hidden group card-hover transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">التنبيهات والمواعيد القريبة</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              sortedAlerts.length > 0 
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 animate-bounce' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}>
              <BellRing size={18} />
            </div>
          </div>
          <h3 className={`text-2xl font-extrabold tracking-tight ${sortedAlerts.length > 0 ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'}`}>
            {sortedAlerts.length} تنبيهات
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">مواعيد سداد قريبة أو مستحقة للآخرين</p>
          <div className="absolute bottom-0 right-0 left-0 h-1 bg-amber-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-right duration-300" />
        </div>

      </div>

      {/* Two Columns Section: Alerts Hub & Statistics Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Smart alert hub */}
        <div className="lg:col-span-5 bg-white/90 dark:glass border border-slate-200/50 dark:border-white/5 p-6 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={18} />
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">نظام التنبيهات الذكي والمواعيد</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-bold">دليل الالتزامات المالية</span>
          </div>

          <div className="space-y-3 max-h-[290px] overflow-y-auto pr-1">
            {sortedAlerts.length === 0 ? (
              <div className="bg-slate-50/50 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800/80 p-6 rounded-2xl text-center text-xs text-slate-400">
                <ShieldCheck className="mx-auto text-emerald-500 mb-2" size={24} />
                <span>أنت ملتزم بجميع السدادات المتبادلة! لا توجد مواعيد استحقاق قريبة حالياً.</span>
              </div>
            ) : (
              sortedAlerts.map(alert => {
                const decName = decryptText(alert.personName, encryptionKey);
                const due = new Date(alert.repaymentDueDate!);
                const diffTime = due.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const isOverdue = diffDays < 0;

                return (
                  <div 
                    key={alert.id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs transition-all hover:scale-[1.01] ${
                      isOverdue 
                        ? 'bg-rose-50/50 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/30 text-rose-800 dark:text-rose-300' 
                        : 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/30 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <span>{alert.type === 'received' ? 'رد نقوط مستلم لـ' : 'مستحق السداد لـ'}:</span>
                        <span className="underline">{decName}</span>
                      </div>
                      <div className="text-[10px] opacity-75">
                        القيمة المستحقة: <span className="font-bold">{alert.amount} ج.م</span> | 
                        تاريخ الاستحقاق: {due.toLocaleDateString('ar-EG')}
                      </div>
                    </div>
                    
                    <div className="text-left font-bold text-[10px] bg-white/80 dark:bg-slate-900/80 px-2.5 py-1 rounded-xl shadow-sm shrink-0">
                      {isOverdue ? (
                        <span className="text-rose-600 dark:text-rose-400 font-bold">متأخر بـ {Math.abs(diffDays)} يوم</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">متبقي {diffDays} يوم</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Interactive Recharts Statistical Chart */}
        <div className="lg:col-span-7 bg-white/80 dark:glass border border-slate-200/50 dark:border-white/5 p-6 rounded-3xl shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Clock className="text-blue-600 dark:text-blue-400" size={18} />
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-xs md:text-sm">توزيع تبادل النقود والالتزامات</h3>
            </div>
            
            {/* View Mode Toggle Buttons */}
            <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200/40 dark:border-slate-800/40 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setChartViewMode('individual')}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-black transition-all ${
                  chartViewMode === 'individual'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-[#60a5fa] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                المناسبات المحددة
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode('category')}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-black transition-all ${
                  chartViewMode === 'category'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-[#60a5fa] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                تصنيف الفئات
              </button>
            </div>
          </div>

          {/* Recharts Bar Chart Container */}
          {chartViewMode === 'individual' && individualChartData.length === 0 ? (
            <div className="flex-grow flex flex-col items-center justify-center p-8 text-center text-xs text-slate-450 dark:text-slate-500 min-h-[220px]">
              <Sparkles className="text-blue-500 mb-2 animate-pulse" size={24} />
              <p className="font-bold">لا توجد مناسبات مسجلة بعد</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[280px]">قم بتسجيل مناسبتك الاجتماعية الأولى لتفعيل تحليلات الرسم البياني التفاعلي.</p>
            </div>
          ) : (
            <div className="relative flex-grow w-full h-[220px] my-3" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartViewMode === 'individual' ? individualChartData : categoryChartData}
                  margin={{ top: 10, right: 5, left: -25, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="receivedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#e11d48" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.08)" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700, fontFamily: 'sans-serif' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 600 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '16px',
                      color: '#fff',
                      textAlign: 'right',
                      direction: 'rtl',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      fontFamily: 'sans-serif',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)'
                    }}
                    cursor={{ fill: 'rgba(148, 163, 184, 0.04)' }}
                  />
                  <Bar 
                    dataKey="مستلم (وارد)" 
                    fill="url(#receivedGrad)" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={22}
                    name="نقوط مستلم (وارد)"
                  />
                  <Bar 
                    dataKey="مدفوع (صادر)" 
                    fill="url(#paidGrad)" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={22}
                    name="نقوط مدفوع (صادر)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Interactive Chart Legends */}
          <div className="flex justify-center gap-6 text-[9px] border-t border-slate-100/60 dark:border-slate-800/60 pt-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-md shadow-sm shadow-emerald-500/10" />
              <span className="text-slate-500 dark:text-slate-400 font-extrabold">المبالغ المستلمة (النقوط الواردة)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-md shadow-sm shadow-rose-500/10" />
              <span className="text-slate-500 dark:text-slate-400 font-extrabold">المبالغ المدفوعة (النقوط الصادرة)</span>
            </div>
          </div>
        </div>

      </div>

      {/* Occasions Section - HIGHLY PROFESSIONAL REDESIGN */}
      <div className="bg-white/80 dark:glass border border-slate-200/50 dark:border-white/5 p-6 rounded-3xl shadow-sm space-y-6">
        
        {/* Header Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-slate-800/60 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">المناسبات الاجتماعية المسجلة</h3>
              <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-full text-xs font-bold border border-blue-100/30 dark:border-blue-900/20">
                {occasions.length} مناسبات
              </span>
            </div>
            <p className="text-xs text-slate-400">إدارة ومتابعة مناسباتك العائلية والاجتماعية وتفاصيل كشوفها المالية</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Box */}
            <div className="relative">
              <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                value={occasionSearchQuery}
                onChange={(e) => setOccasionSearchQuery(e.target.value)}
                placeholder="ابحث عن مناسبة..."
                className="w-full sm:w-56 pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Add Button */}
            <button
              onClick={() => {
                if (showAddForm) {
                  setShowAddForm(false);
                  setEditOccasionId(null);
                  setFormTitle('');
                  setFormDate('');
                  setFormNotes('');
                } else {
                  setShowAddForm(true);
                }
              }}
              className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/10 shrink-0"
            >
              <Plus size={14} />
              <span>{showAddForm ? 'إلغاء' : 'تسجيل مناسبة جديدة'}</span>
            </button>
          </div>
        </div>

        {/* Current Occasions Stat Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/40">
          {/* Card: Current Received */}
          <div className="bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/50 dark:border-white/5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">مستلم المناسبات الحالية</span>
              <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 block mt-1">
                + {currentOccasionsReceived.toLocaleString()} ج.م
              </span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ArrowDownLeft size={16} />
            </div>
          </div>

          {/* Card: Current Paid */}
          <div className="bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/50 dark:border-white/5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">مدفوع المناسبات الحالية</span>
              <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400 block mt-1">
                - {currentOccasionsPaid.toLocaleString()} ج.م
              </span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <ArrowUpRight size={16} />
            </div>
          </div>

          {/* Card: Current Net */}
          <div className="bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/50 dark:border-white/5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">صافي المناسبات الحالية</span>
              <span className={`text-sm font-extrabold block mt-1 ${currentOccasionsNet >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {currentOccasionsNet >= 0 ? '+' : ''} {currentOccasionsNet.toLocaleString()} ج.م
              </span>
            </div>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${currentOccasionsNet >= 0 ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400' : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400'}`}>
              <TrendingUp size={16} />
            </div>
          </div>
        </div>

        {/* Sliding Form Card */}
        {showAddForm && (
          <form 
            onSubmit={handleOccasionSubmit}
            className="p-5 bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl space-y-4 animate-fadeIn"
          >
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {editOccasionId ? '✏️ تعديل بيانات المناسبة' : '✨ تسجيل مناسبة اجتماعية جديدة'}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">عنوان المناسبة / الحدث</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: حفل زفاف أخي أحمد، تخرج منى..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">تاريخ المناسبة</label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">تصنيف ونوع المناسبة</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as OccasionType)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
                >
                  <option value="wedding">زفاف / خطوبة</option>
                  <option value="graduation">تخرج / نجاح</option>
                  <option value="birth">مولود جديد / عقيقة</option>
                  <option value="eid">أعياد ومناسبات عامة</option>
                  <option value="other">أخرى / تصنيف مخصص</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400">ملاحظات أو تفاصيل إضافية</label>
              <textarea
                rows={2}
                placeholder="اكتب هنا أي تفاصيل، تجهيزات خاصة، أو ملاحظات هامة..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditOccasionId(null);
                  setFormTitle('');
                  setFormDate('');
                  setFormNotes('');
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md shadow-blue-500/15"
              >
                {editOccasionId ? 'حفظ التعديلات' : 'تسجيل الحدث الآن'}
              </button>
            </div>
          </form>
        )}

        {/* Occasions Cards Grid */}
        {filteredOccasions.length === 0 ? (
          <div className="p-8 bg-slate-50 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-850 rounded-2xl text-center text-xs text-slate-400">
            لم يتم العثور على أي مناسبات مسجلة تطابق بحثك. ابدأ بتسجيل أول مناسبة الآن!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredOccasions.map(occ => {
              const decTitle = decryptText(occ.title, encryptionKey);
              const decNotes = decryptText(occ.notes, encryptionKey);
              
              // Get style mapping
              const styles = (() => {
                switch (occ.type) {
                  case 'wedding':
                    return {
                      bg: 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/20',
                      icon: <Gift size={16} />
                    };
                  case 'graduation':
                    return {
                      bg: 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900/20',
                      icon: <Award size={16} />
                    };
                  case 'birth':
                    return {
                      bg: 'bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 border-teal-100 dark:border-teal-900/20',
                      icon: <Gift size={16} />
                    };
                  case 'eid':
                    return {
                      bg: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/20',
                      icon: <Sparkles size={16} />
                    };
                  case 'other':
                  default:
                    return {
                      bg: 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800',
                      icon: <Calendar size={16} />
                    };
                }
              })();

              // Calculate metrics for this specific occasion
              const occasionTxs = transactions.filter(t => t.occasionId === occ.id);
              const rec = occasionTxs.filter(t => t.type === 'received').reduce((s, t) => s + t.amount, 0);
              const paid = occasionTxs.filter(t => t.type === 'paid').reduce((s, t) => s + t.amount, 0);

              return (
                <div 
                  key={occ.id}
                  className="bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 p-5 rounded-2xl flex flex-col justify-between space-y-4 hover:shadow-md transition-all group relative overflow-hidden"
                >
                  <div className="space-y-3">
                    {/* Top Type Badge & Options */}
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-black rounded-lg border ${styles.bg}`}>
                        {styles.icon}
                        <span>{translateType(occ.type)}</span>
                      </span>

                      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleTriggerEdit(occ)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-500 transition-colors cursor-pointer"
                          title="تعديل"
                        >
                          <Edit size={12} />
                        </button>
                        <button
                          onClick={() => {
                            onDeleteOccasion(occ.id);
                          }}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Occasion Title & Date */}
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-snug">{decTitle}</h4>
                      <p className="text-[10px] text-slate-400 mt-1">🗓️ {new Date(occ.date).toLocaleDateString('ar-EG')}</p>
                    </div>

                    {/* Notes summary */}
                    {decNotes && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 italic bg-slate-50/50 dark:bg-slate-950/20 p-2 rounded-xl">
                        {decNotes}
                      </p>
                    )}
                  </div>

                  {/* Financial Balance Summary */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 grid grid-cols-2 gap-2 text-center">
                    <div className="bg-emerald-50/30 dark:bg-emerald-950/10 p-2 rounded-xl">
                      <span className="text-[9px] text-slate-400 block leading-none">مستلم (وارد)</span>
                      <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">
                        + {rec.toLocaleString()} ج.م
                      </span>
                    </div>
                    <div className="bg-rose-50/30 dark:bg-rose-950/10 p-2 rounded-xl">
                      <span className="text-[9px] text-slate-400 block leading-none">مدفوع (صادر)</span>
                      <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400 mt-1 block">
                        - {paid.toLocaleString()} ج.م
                      </span>
                    </div>
                  </div>

                  {/* Open details action */}
                  <button
                    onClick={() => onSelectOccasion(occ)}
                    className="w-full py-2 bg-slate-50 hover:bg-blue-50 dark:bg-slate-900/60 dark:hover:bg-blue-950/20 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/60 dark:border-slate-800 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>استعراض كشف النقود التفصيلي</span>
                    <ArrowRightLeft size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

// Simple local alias for Search icon to prevent import clashes
function SearchIcon({ className, size }: { className?: string; size?: number }) {
  return (
    <svg 
      className={className} 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  );
}
