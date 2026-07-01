import React, { useState, useEffect } from 'react';
import { X, DollarSign, Gift, Calendar, User, FileText, ShoppingCart, Image as ImageIcon, Sparkles, CheckCircle2 } from 'lucide-react';
import { NoqootTransaction, GiftType, TransactionType } from '../types';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transactionData: Partial<NoqootTransaction>) => void;
  transaction?: NoqootTransaction | null;
  occasionId: string;
}

const GIFT_PRESETS = [
  { name: 'ظرف نقوط تقليدي', url: 'https://images.unsplash.com/photo-1580519542036-c47de6196ba5?w=400&auto=format&fit=crop&q=80', desc: 'envelope' },
  { name: 'ساعة يد فاخرة', url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=80', desc: 'watch' },
  { name: 'طقم عطور راقي', url: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&auto=format&fit=crop&q=80', desc: 'perfume' },
  { name: 'مجوهرات وذهب', url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&auto=format&fit=crop&q=80', desc: 'jewelry' },
  { name: 'عربة ولعبة أطفال', url: 'https://images.unsplash.com/photo-1515488042361-404e9250afef?w=400&auto=format&fit=crop&q=80', desc: 'baby' },
  { name: 'باقة ورد أنيقة', url: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=400&auto=format&fit=crop&q=80', desc: 'flowers' },
  { name: 'صندوق هدايا فاخر', url: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400&auto=format&fit=crop&q=80', desc: 'giftbox' },
  { name: 'جهاز منزلي ذكي', url: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=400&auto=format&fit=crop&q=80', desc: 'appliance' }
];

export default function TransactionModal({
  isOpen,
  onClose,
  onSave,
  transaction,
  occasionId
}: TransactionModalProps) {
  const [personName, setPersonName] = useState('');
  const [type, setType] = useState<TransactionType>('received');
  const [amount, setAmount] = useState<number>(10);
  const [giftType, setGiftType] = useState<GiftType>('monetary');
  const [giftDescription, setGiftDescription] = useState('');
  const [giftImageUrl, setGiftImageUrl] = useState('');
  const [isRepaid, setIsRepaid] = useState(false);
  const [repaymentDueDate, setRepaymentDueDate] = useState('');
  const [purchaseLink, setPurchaseLink] = useState('');
  const [notes, setNotes] = useState('');

  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  // Set initial form states if editing
  useEffect(() => {
    if (transaction) {
      setPersonName(transaction.personName || '');
      setType(transaction.type || 'received');
      setAmount(transaction.amount || 0);
      setGiftType(transaction.giftType || 'monetary');
      setGiftDescription(transaction.giftDescription || '');
      setGiftImageUrl(transaction.giftImageUrl || '');
      setIsRepaid(transaction.isRepaid || false);
      setRepaymentDueDate(transaction.repaymentDueDate || '');
      setPurchaseLink(transaction.purchaseLink || '');
      setNotes(transaction.notes || '');

      const idx = GIFT_PRESETS.findIndex(p => p.url === transaction.giftImageUrl);
      setSelectedPreset(idx !== -1 ? idx : null);
    } else {
      // Set fresh defaults
      setPersonName('');
      setType('received');
      setAmount(10);
      setGiftType('monetary');
      setGiftDescription('');
      setGiftImageUrl('');
      setIsRepaid(false);
      setRepaymentDueDate('');
      setPurchaseLink('');
      setNotes('');
      setSelectedPreset(null);
    }
  }, [transaction, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim()) return;

    onSave({
      id: transaction?.id,
      occasionId,
      personName,
      type,
      amount: Number(amount) || 0,
      giftType,
      giftDescription: giftType === 'physical' ? giftDescription : '',
      giftImageUrl,
      isRepaid,
      repaymentDueDate: repaymentDueDate || '',
      purchaseLink: giftType === 'physical' ? purchaseLink : '',
      notes
    });
    onClose();
  };

  const handlePresetSelect = (index: number, url: string) => {
    setSelectedPreset(index);
    setGiftImageUrl(url);
  };

  // Generate automated purchase query link for direct shopping
  const handleAutoShoppingQuery = () => {
    const query = giftDescription || 'هدايا مناسبات';
    const amazonUrl = `https://www.amazon.ae/s?k=${encodeURIComponent(query)}`;
    setPurchaseLink(amazonUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity" dir="rtl">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto font-sans flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-950/40 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400">
              {giftType === 'monetary' ? <DollarSign size={16} /> : <Gift size={16} />}
            </div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100">
              {transaction ? 'تعديل المعاملة المالية' : 'تسجيل نقوط أو هدية جديدة'}
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-grow overflow-y-auto">
          
          {/* Row 1: Type Selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 mr-1">طبيعة المعاملة</label>
              <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200/40 dark:border-slate-800/40">
                <button
                  type="button"
                  onClick={() => setType('received')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    type === 'received' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  نقوط وارد (استلمته)
                </button>
                <button
                  type="button"
                  onClick={() => setType('paid')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    type === 'paid' 
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-500/10' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  نقوط صادر (دفعته)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 mr-1">شكل الهدية</label>
              <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200/40 dark:border-slate-800/40">
                <button
                  type="button"
                  onClick={() => setGiftType('monetary')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    giftType === 'monetary' 
                      ? 'bg-slate-800 dark:bg-slate-800 text-white shadow-md' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  نقدي (مبلغ مالي)
                </button>
                <button
                  type="button"
                  onClick={() => setGiftType('physical')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    giftType === 'physical' 
                      ? 'bg-slate-800 dark:bg-slate-800 text-white shadow-md' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  عيني (هدية)
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Name & Amount */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 mr-1">الاسم الكامل (للشخص المعني)</label>
              <div className="relative">
                <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  required
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="مثال: محمد أحمد علي"
                  className="w-full pr-11 pl-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 mr-1">المبلغ المالي أو القيمة المقدرة (بالجنيه المصري ج.م) - اختياري</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">ج.م</span>
                <input
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="مثال: 50"
                  className="w-full pr-4 pl-12 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* For Physical Gifts Only */}
          {giftType === 'physical' && (
            <div className="space-y-4 border-t border-dashed border-slate-200 dark:border-slate-800 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 mr-1">تصنيف أو وصف الهدية العينية</label>
                  <div className="relative">
                    <Gift className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={giftDescription}
                      onChange={(e) => setGiftDescription(e.target.value)}
                      placeholder="مثال: ساعة يد ذهبية ماركة فاخرة"
                      className="w-full pr-11 pl-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5 mr-1">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">رابط الشراء المباشر للهدية</label>
                    <button
                      type="button"
                      onClick={handleAutoShoppingQuery}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles size={10} />
                      <span>بحث سريع في أمازون الإمارات</span>
                    </button>
                  </div>
                  <div className="relative">
                    <ShoppingCart className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="url"
                      value={purchaseLink}
                      onChange={(e) => setPurchaseLink(e.target.value)}
                      placeholder="https://example.com/item"
                      className="w-full pr-11 pl-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200 text-left"
                    />
                  </div>
                </div>
              </div>

              {/* Gift Visual Image Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 mr-1">صورة الهدية التوضيحية</label>
                <div className="relative mb-3">
                  <ImageIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="url"
                    value={giftImageUrl}
                    onChange={(e) => {
                      setGiftImageUrl(e.target.value);
                      setSelectedPreset(null);
                    }}
                    placeholder="أدخل رابط صورة الهدية مباشرة أو اختر من المعرض أدناه"
                    className="w-full pr-11 pl-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
                  />
                </div>

                {/* Grid of Preset Illustrations */}
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {GIFT_PRESETS.map((preset, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handlePresetSelect(index, preset.url)}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                        selectedPreset === index 
                          ? 'border-blue-500 scale-105 shadow-md shadow-blue-500/20' 
                          : 'border-transparent hover:border-slate-300'
                      }`}
                    >
                      <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <span className="text-[9px] text-white font-bold text-center p-1 leading-tight">{preset.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Warnings & repayment setups */}
          <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRepaid}
                  onChange={(e) => setIsRepaid(e.target.checked)}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {type === 'received' ? 'تم رد / سداد هذا النقوط' : 'هذا سداد لنقوط سابق مستحق'}
                  </span>
                  <p className="text-[10px] text-slate-400">تفعيل هذه الحالة سيصنف المعاملة كمكتملة / مسددة في الإحصائيات</p>
                </div>
              </label>

              <div className="flex items-center gap-2">
                <Calendar className="text-slate-400 shrink-0" size={16} />
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">تاريخ الرد / السداد المتوقع (تنبيه ذكي)</label>
                  <input
                    type="date"
                    value={repaymentDueDate}
                    onChange={(e) => setRepaymentDueDate(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            
            {repaymentDueDate && (
              <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100/30 p-2.5 rounded-xl text-[10px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Sparkles size={12} className="shrink-0" />
                <span>سيقوم النظام بإرسال تذكيرات ذكية تلقائية مسبقة قبل 3 أيام و7 أيام من تاريخ الاستحقاق المحدد.</span>
              </div>
            )}
          </div>

          {/* Row 4: Custom Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 mr-1">ملاحظات مخصصة لهذه الهدية أو النقود</label>
            <div className="relative">
              <FileText className="absolute right-4 top-3 text-slate-400" size={16} />
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: تمت المبادرة بمبلغ مالي إضافي، أو هدية عينية تكميلية..."
                className="w-full pr-11 pl-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-950/20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/10 cursor-pointer"
          >
            حفظ المعاملة
          </button>
        </div>

      </div>
    </div>
  );
}
