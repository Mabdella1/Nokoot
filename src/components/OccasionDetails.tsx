import React, { useState } from 'react';
import { 
  ArrowLeft, Plus, Download, Printer, Share2, Search, Filter, 
  Trash2, Edit, HelpCircle, Check, DollarSign, Gift, ExternalLink, Calendar, AlertCircle, FileText
} from 'lucide-react';
import { Occasion, NoqootTransaction } from '../types';
import { printReport, exportToPDF } from '../utils/pdfGenerator';
import { decryptText } from '../utils/security';

interface OccasionDetailsProps {
  occasion: Occasion | null; // null represents "All Occasions Report"
  transactions: NoqootTransaction[];
  onBack: () => void;
  onAddTransaction: () => void;
  onEditTransaction: (tx: NoqootTransaction) => void;
  onDeleteTransaction: (txId: string) => void;
  onSaveOccasionNotes?: (notes: string) => void;
  encryptionKey: string;
}

export default function OccasionDetails({
  occasion,
  transactions,
  onBack,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onSaveOccasionNotes,
  encryptionKey
}: OccasionDetailsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'received' | 'paid'>('all');
  const [giftFilter, setGiftFilter] = useState<'all' | 'monetary' | 'physical'>('all');
  const [repaidFilter, setRepaidFilter] = useState<'all' | 'repaid' | 'pending'>('all');

  const [occasionNotes, setOccasionNotes] = useState(
    occasion ? decryptText(occasion.notes, encryptionKey) : ''
  );
  const [saveNotesSuccess, setSaveNotesSuccess] = useState(false);

  const isAll = !occasion;

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    // Check search name (decrypted)
    const decryptedName = decryptText(tx.personName, encryptionKey).toLowerCase();
    const matchesSearch = decryptedName.includes(searchTerm.toLowerCase());

    // Type filter
    const matchesType = typeFilter === 'all' || tx.type === typeFilter;

    // Gift filter
    const matchesGift = giftFilter === 'all' || tx.giftType === giftFilter;

    // Repaid filter
    const matchesRepaid = repaidFilter === 'all' || 
      (repaidFilter === 'repaid' && tx.isRepaid) || 
      (repaidFilter === 'pending' && !tx.isRepaid);

    return matchesSearch && matchesType && matchesGift && matchesRepaid;
  });

  // Calculate totals for this subset
  const totalReceived = filteredTransactions
    .filter(t => t.type === 'received')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalPaid = filteredTransactions
    .filter(t => t.type === 'paid')
    .reduce((sum, t) => sum + t.amount, 0);

  const net = totalReceived - totalPaid;

  const totals = {
    totalReceived,
    totalPaid,
    net,
    countReceived: filteredTransactions.filter(t => t.type === 'received').length,
    countPaid: filteredTransactions.filter(t => t.type === 'paid').length
  };

  const handleNotesSave = () => {
    if (onSaveOccasionNotes) {
      onSaveOccasionNotes(occasionNotes);
      setSaveNotesSuccess(true);
      setTimeout(() => setSaveNotesSuccess(false), 3000);
    }
  };

  // Share gift list to family/friends (WhatsApp/Universal)
  const handleShare = () => {
    const decTitle = occasion ? decryptText(occasion.title, encryptionKey) : "جميع المناسبات";
    let shareText = `📝 *قائمة هدايا ونقوط مناسبة: ${decTitle}* \n\n`;
    
    filteredTransactions.forEach((t, i) => {
      const decName = decryptText(t.personName, encryptionKey);
      const decGift = t.giftType === 'monetary' ? 'نقدي' : decryptText(t.giftDescription || '', encryptionKey) || 'هدية عينية';
      const status = t.isRepaid ? '✅ تم الرد' : '⏳ لم يرد بعد';
      shareText += `${i + 1}. *${decName}* - ${t.amount} ج.م (${decGift}) [${status}]\n`;
    });

    shareText += `\n_تمت المشاركة عبر تطبيق كشف النقوط_ ✨`;

    if (navigator.share) {
      navigator.share({
        title: `قائمة نقوط: ${decTitle}`,
        text: shareText
      }).catch(err => console.log(err));
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(shareText);
      alert("📋 تم نسخ قائمة النقوط المنسقة إلى الحافظة! يمكنك الآن لصقها ومشاركتها مباشرة على واتساب أو تيليجرام.");
    }
  };

  const translateOccasionType = (type: string) => {
    switch (type) {
      case 'wedding': return "زفاف / خطوبة";
      case 'graduation': return "تخرج";
      case 'birth': return "مولود جديد / عقيقة";
      case 'eid': return "أعياد ومناسبات موسمية";
      case 'other': return "أخرى";
      default: return type;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans" dir="rtl">
      
      {/* Header action bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              {isAll ? 'التقرير المالي الشامل' : decryptText(occasion.title, encryptionKey)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAll 
                ? 'استعراض مدمج وتصفية ذكية لجميع المعاملات المالية والهدايا من كافة المناسبات'
                : `مناسبة ${translateOccasionType(occasion.type)} - ${new Date(occasion.date).toLocaleDateString('ar-EG')}`}
            </p>
          </div>
        </div>

        {/* Action Triggers */}
        <div className="flex flex-wrap items-center gap-2">
          {!isAll && (
            <button
              onClick={onAddTransaction}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/10 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>إضافة نقوط / هدية</span>
            </button>
          )}

          <button
            onClick={() => printReport(occasion, filteredTransactions, totals, encryptionKey)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Printer size={14} />
            <span>طباعة التقرير (PDF)</span>
          </button>

          <button
            onClick={() => exportToPDF(occasion, filteredTransactions, totals, encryptionKey)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200/50 dark:border-slate-700/50"
          >
            <Download size={14} />
            <span>تصدير سريع (PDF)</span>
          </button>

          {filteredTransactions.length > 0 && (
            <button
              onClick={handleShare}
              className="px-4 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Share2 size={14} />
              <span>مشاركة القائمة</span>
            </button>
          )}
        </div>
      </div>

      {/* Occasion custom notes for single occasion */}
      {!isAll && onSaveOccasionNotes && (
        <div className="bg-white/80 dark:glass border border-slate-200/50 dark:border-white/5 p-5 rounded-3xl shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-sm">
            <FileText size={16} className="text-blue-600 dark:text-blue-400" />
            <span>ملاحظات وتجهيزات المناسبة الخاصة بك</span>
          </div>
          <div className="flex gap-2">
            <textarea
              rows={2}
              value={occasionNotes}
              onChange={(e) => setOccasionNotes(e.target.value)}
              placeholder="اكتب تجهيزات المناسبة، تفاصيل الحجز، أو أي تذكيرات هامة أخرى هنا..."
              className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
            />
            <button
              onClick={handleNotesSave}
              className="px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center shrink-0"
            >
              حفظ
            </button>
          </div>
          {saveNotesSuccess && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mr-1">
              ✓ تم حفظ الملاحظات وتشفيرها سحابياً بنجاح!
            </span>
          )}
        </div>
      )}

      {/* Occasion Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50/30 dark:bg-blue-950/15 border border-blue-100/30 dark:border-blue-900/20 p-5 rounded-3xl">
          <span className="text-xs text-slate-400 block mb-1">النقوط المستلمة (الواردة)</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-blue-600 dark:text-[#60a5fa]">
              + {totals.totalReceived.toLocaleString()} ج.م
            </span>
            <span className="text-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md font-bold">
              {totals.countReceived} معامِلة
            </span>
          </div>
        </div>

        <div className="bg-rose-50/30 dark:bg-rose-950/15 border border-rose-100/30 dark:border-rose-900/20 p-5 rounded-3xl">
          <span className="text-xs text-slate-400 block mb-1">النقوط المدفوعة (الصادرة)</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              - {totals.totalPaid.toLocaleString()} ج.م
            </span>
            <span className="text-xs bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-md font-bold">
              {totals.countPaid} معامِلة
            </span>
          </div>
        </div>

        <div className="bg-slate-50/50 dark:glass border border-slate-200/50 dark:border-white/5 p-5 rounded-3xl">
          <span className="text-xs text-slate-400 block mb-1">صافي التبادل المالي</span>
          <div className="flex items-baseline justify-between">
            <span className={`text-2xl font-bold ${totals.net >= 0 ? 'text-blue-600 dark:text-[#60a5fa]' : 'text-rose-600 dark:text-rose-400'}`}>
              {totals.net >= 0 ? '+' : ''} {totals.net.toLocaleString()} ج.م
            </span>
            <span className="text-xs text-slate-400">القيمة الإجمالية</span>
          </div>
        </div>
      </div>

      {/* Advanced search and filter panel */}
      <div className="bg-white/80 dark:glass border border-slate-200/50 dark:border-white/5 p-5 rounded-3xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="البحث عن شخص بالاسم..."
              className="w-full pr-11 pl-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Interactive Filters row */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Filter by Type */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
              <span className="text-[10px] text-slate-400 px-2 font-bold">النوع</span>
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  typeFilter === 'all' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => setTypeFilter('received')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  typeFilter === 'received' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'
                }`}
              >
                وارد (استلمت)
              </button>
              <button
                onClick={() => setTypeFilter('paid')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  typeFilter === 'paid' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'
                }`}
              >
                صادر (دفعت)
              </button>
            </div>

            {/* Filter by Form */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
              <span className="text-[10px] text-slate-400 px-2 font-bold">الشكل</span>
              <button
                onClick={() => setGiftFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  giftFilter === 'all' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => setGiftFilter('monetary')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  giftFilter === 'monetary' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'
                }`}
              >
                نقدي
              </button>
              <button
                onClick={() => setGiftFilter('physical')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  giftFilter === 'physical' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'
                }`}
              >
                عيني
              </button>
            </div>

            {/* Filter by Repaid */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
              <span className="text-[10px] text-slate-400 px-2 font-bold">الحالة</span>
              <button
                onClick={() => setRepaidFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  repaidFilter === 'all' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => setRepaidFilter('repaid')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  repaidFilter === 'repaid' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'
                }`}
              >
                مسدد
              </button>
              <button
                onClick={() => setRepaidFilter('pending')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  repaidFilter === 'pending' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'
                }`}
              >
                غير مسدد
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* Transactions list layout */}
      {filteredTransactions.length === 0 ? (
        <div className="bg-white/85 dark:glass border border-slate-200/50 dark:border-white/5 p-10 rounded-3xl text-center space-y-3">
          <div className="w-12 h-12 bg-slate-50 dark:bg-slate-950 rounded-2xl flex items-center justify-center text-slate-400 mx-auto">
            <HelpCircle size={24} />
          </div>
          <h4 className="font-bold text-slate-700 dark:text-slate-300">لا يوجد أي معاملات مطابقة</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">قم بتعديل خيارات التصفية والبحث في الأعلى، أو ابدأ بتسجيل نقود جديدة بالضغط على زر الإضافة.</p>
        </div>
      ) : (
        <div className="bg-white/85 dark:glass border border-slate-200/50 dark:border-white/5 p-2 rounded-3xl shadow-sm overflow-x-auto">
          <table className="w-full text-right border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-xs font-bold">
                <th className="p-4">الاسم</th>
                <th className="p-4">النوع والاتجاه</th>
                <th className="p-4">شكل ومضمون الهدية</th>
                <th className="p-4 text-left">المبلغ / القيمة</th>
                <th className="p-4">تاريخ الاستحقاق والتنبيهات</th>
                <th className="p-4">الحالة</th>
                <th className="p-4 text-center">خيارات</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => {
                const decName = decryptText(tx.personName, encryptionKey);
                const decNotes = tx.notes ? decryptText(tx.notes, encryptionKey) : '';
                const decDesc = tx.giftDescription ? decryptText(tx.giftDescription, encryptionKey) : '';

                return (
                  <tr 
                    key={tx.id} 
                    className="border-b border-slate-50 dark:border-slate-800/30 hover:bg-slate-50/50 dark:hover:bg-slate-950/20 text-xs text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    {/* Name */}
                    <td className="p-4 font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-3">
                        {tx.giftImageUrl && (
                          <img 
                            src={tx.giftImageUrl} 
                            alt={decName} 
                            className="w-8 h-8 rounded-lg object-cover border border-slate-200/50 dark:border-slate-800/50"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div>
                          <div>{decName}</div>
                          {decNotes && <div className="text-[10px] text-slate-400 font-normal mt-0.5">{decNotes}</div>}
                        </div>
                      </div>
                    </td>

                    {/* Direction type badge */}
                    <td className="p-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                        tx.type === 'received' 
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                      }`}>
                        {tx.type === 'received' ? 'وارد (استلمته)' : 'صادر (دفعته)'}
                      </span>
                    </td>

                    {/* Format */}
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        {tx.giftType === 'monetary' ? (
                          <>
                            <DollarSign size={14} className="text-slate-400" />
                            <span>مبلغ نقدي مالي</span>
                          </>
                        ) : (
                          <>
                            <Gift size={14} className="text-slate-400" />
                            <span className="font-semibold">{decDesc || 'هدية عينية'}</span>
                            {tx.purchaseLink && (
                              <a 
                                href={tx.purchaseLink} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-blue-600 dark:text-blue-400 p-0.5 hover:bg-blue-50 dark:hover:bg-blue-950 rounded"
                              >
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </>
                        )}
                      </div>
                    </td>

                    {/* Value Amount */}
                    <td className="p-4 text-left font-bold text-slate-950 dark:text-white">
                      {tx.amount.toLocaleString()} ج.م
                    </td>

                    {/* Repayment Due Alert */}
                    <td className="p-4 text-slate-500 dark:text-slate-400">
                      {tx.repaymentDueDate ? (
                        <div className="flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          <span>{new Date(tx.repaymentDueDate).toLocaleDateString('ar-EG')}</span>
                          {!tx.isRepaid && new Date(tx.repaymentDueDate) < new Date() && (
                            <AlertCircle size={12} className="text-rose-500" />
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-700">---</span>
                      )}
                    </td>

                    {/* Settlement State */}
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold ${
                        tx.isRepaid 
                          ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' 
                          : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                      }`}>
                        {tx.isRepaid ? 'مسدد ومسترجع' : 'مستحق السداد'}
                      </span>
                    </td>

                    {/* Options Actions */}
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onEditTransaction(tx)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => onDeleteTransaction(tx.id)}
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
