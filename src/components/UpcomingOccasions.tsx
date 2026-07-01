import React, { useState } from 'react';
import { Calendar, Clock, Plus, Trash2, Bell, AlertCircle, Sparkles, Heart, CalendarDays } from 'lucide-react';
import { UpcomingOccasion } from '../types';
import { decryptText, encryptText } from '../utils/security';

interface UpcomingOccasionsProps {
  upcomingOccasions: UpcomingOccasion[];
  onAddUpcoming: (data: { title: string; date: string; day: string; notes: string }) => void;
  onDeleteUpcoming: (id: string, title: string) => void;
  encryptionKey: string;
}

const getArabicDayName = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  return days[date.getDay()];
};

export default function UpcomingOccasions({
  upcomingOccasions,
  onAddUpcoming,
  onDeleteUpcoming,
  encryptionKey
}: UpcomingOccasionsProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) return;
    const day = getArabicDayName(date);
    onAddUpcoming({
      title,
      date,
      day,
      notes
    });
    setTitle('');
    setDate('');
    setNotes('');
    setShowAddForm(false);
  };

  // Helper to calculate days remaining
  const getDaysRemaining = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Filter soon events
  const soonEvents = upcomingOccasions.filter(occ => {
    const days = getDaysRemaining(occ.date);
    return days >= 0 && days <= 14; // next 2 weeks
  });

  return (
    <div className="space-y-6 font-sans" dir="rtl">
      
      {/* Alert Header/Banner for very close events */}
      {soonEvents.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
          <div className="w-10 h-10 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center shrink-0">
            <Bell size={20} className="animate-bounce" />
          </div>
          <div className="flex-1 space-y-1">
            <h4 className="font-extrabold text-sm text-amber-800 dark:text-amber-400">تنبيه بالمناسبات القادمة قريباً</h4>
            <p className="text-xs text-amber-700/85 dark:text-amber-500/85">
              لديك {soonEvents.length} مناسبة اجتماعية قادمة خلال الأسبوعين القادمين. استعد لمشاركتهم فرحتهم!
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {soonEvents.map(ev => {
                const decTitle = decryptText(ev.title, encryptionKey) || ev.title;
                const rem = getDaysRemaining(ev.date);
                return (
                  <span key={ev.id} className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                    <span>{decTitle}</span>
                    <span>({rem === 0 ? 'اليوم!' : rem === 1 ? 'غداً' : `بعد ${rem} يوم`})</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Title & Add Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">جدولة المناسبات القادمة والتنبيهات</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">سجل المناسبات الاجتماعية المنتظرة بالتاريخ واليوم لتلقي التنبيهات المسبقة والاستعداد لها.</p>
        </div>
        
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/10 transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Plus size={14} />
          <span>إضافة مناسبة منتظرة</span>
        </button>
      </div>

      {/* Expandable Add Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4 max-w-3xl">
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b border-slate-200/50 dark:border-slate-800 pb-2">
            إضافة مناسبة قادمة جديدة
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">اسم المناسبة</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: حفل زفاف صديقي أحمد"
                className="w-full px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">تاريخ وقوع المناسبة</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
                />
                {date && (
                  <span className="absolute left-3 top-2 px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded text-[10px] font-bold">
                    {getArabicDayName(date)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">ملاحظات / تذكير</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: تجهيز الهدية العينية أو التخطيط للميزانية المطلوبة..."
              className="w-full px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-300"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md shadow-blue-500/10"
            >
              حفظ وتفعيل التنبيه
            </button>
          </div>
        </form>
      )}

      {/* List Grid */}
      {upcomingOccasions.length === 0 ? (
        <div className="bg-white/80 dark:glass border border-slate-200/50 dark:border-white/5 p-12 rounded-3xl text-center space-y-3">
          <div className="w-14 h-14 bg-slate-50 dark:bg-slate-950 rounded-2xl flex items-center justify-center text-slate-400 mx-auto">
            <CalendarDays size={28} />
          </div>
          <h4 className="font-extrabold text-slate-700 dark:text-slate-300 text-sm">لا توجد مناسبات قادمة مجدولة</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">سجل المناسبات والولائم والزواجات القادمة هنا لتذكيرك بها وتجهيز الميزانية المناسبة.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {upcomingOccasions.map(occ => {
            const decTitle = decryptText(occ.title, encryptionKey) || occ.title;
            const decNotes = decryptText(occ.notes || '', encryptionKey) || occ.notes;
            const remaining = getDaysRemaining(occ.date);
            const isOver = remaining < 0;

            return (
              <div
                key={occ.id}
                className="bg-white/90 dark:glass border border-slate-200/50 dark:border-white/5 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative group overflow-hidden"
              >
                {/* Visual Status Indicator */}
                <div className={`absolute top-0 right-0 left-0 h-1 ${isOver ? 'bg-slate-300 dark:bg-slate-700' : remaining <= 3 ? 'bg-rose-500' : remaining <= 7 ? 'bg-amber-500' : 'bg-blue-500'}`} />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-extrabold flex items-center gap-1">
                      <Clock size={12} />
                      <span>{occ.day}</span>
                    </span>

                    <span className={`text-[9px] px-2 py-0.5 rounded-lg font-bold ${
                      isOver 
                        ? 'bg-slate-100 text-slate-500 dark:bg-slate-900/50 dark:text-slate-400'
                        : remaining === 0
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 animate-pulse'
                        : remaining <= 3
                        ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'
                        : remaining <= 7
                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400'
                        : 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400'
                    }`}>
                      {isOver ? 'منتهية' : remaining === 0 ? 'اليوم 🎉' : remaining === 1 ? 'غداً' : `متبقي ${remaining} يوم`}
                    </span>
                  </div>

                  <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">{decTitle}</h4>
                  
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-200/20 dark:border-slate-800/20">
                    <Calendar size={13} className="text-blue-500 shrink-0" />
                    <span>{new Date(occ.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>

                  {decNotes && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-2 leading-relaxed bg-slate-50/50 dark:bg-slate-900/20 p-2 rounded-xl">
                      {decNotes}
                    </p>
                  )}
                </div>

                <div className="flex justify-end border-t border-slate-100 dark:border-slate-800/40 pt-3 mt-4">
                  <button
                    onClick={() => {
                      onDeleteUpcoming(occ.id, decTitle);
                    }}
                    className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                  >
                    <Trash2 size={13} />
                    <span>حذف التنبيه</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
