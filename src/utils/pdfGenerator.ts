import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Occasion, NoqootTransaction } from '../types';
import { decryptText } from './security';

// Quick helper to reverse Arabic text so it appears correctly in standard non-unicode jsPDF environments
export function prepareArabicText(text: string): string {
  if (!text) return "";
  const arabicPattern = /[\u0600-\u06FF]/;
  if (!arabicPattern.test(text)) return text;
  
  // A simple character reversal to prevent backwards letters in standard PDF generators
  return text.split(' ').map(word => {
    if (arabicPattern.test(word)) {
      return word.split('').reverse().join('');
    }
    return word;
  }).reverse().join(' ');
}

interface ReportTotals {
  totalReceived: number;
  totalPaid: number;
  net: number;
  countReceived: number;
  countPaid: number;
}

/**
 * Triggers a highly-styled, native browser print layout optimized for PDF saving.
 * This handles Arabic text rendering, CSS typography, tables, and colors perfectly.
 */
export function printReport(
  occasion: Occasion | null,
  transactions: NoqootTransaction[],
  totals: ReportTotals,
  encryptionKey: string
) {
  const isAll = !occasion;
  const titleText = isAll 
    ? "تقرير النقوط الشامل لجميع المناسبات" 
    : `تقرير نقوط مناسبة: ${decryptText(occasion.title, encryptionKey)}`;
  const dateText = isAll 
    ? new Date().toLocaleDateString('ar-EG') 
    : new Date(occasion.date).toLocaleDateString('ar-EG');
  const typeLabel = isAll 
    ? "جميع المناسبات" 
    : translateOccasionType(occasion.type);

  // Decrypt transaction details
  const preparedTx = transactions.map(t => ({
    ...t,
    personName: decryptText(t.personName, encryptionKey),
    notes: t.notes ? decryptText(t.notes, encryptionKey) : "",
    giftDescription: t.giftDescription ? decryptText(t.giftDescription, encryptionKey) : ""
  }));

  // Create an elegant iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) return;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>${titleText}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
        body {
          font-family: 'Cairo', sans-serif;
          margin: 30px;
          padding: 0;
          color: #1e293b;
          background-color: #ffffff;
          line-height: 1.6;
        }
        .header {
          border-bottom: 3px double #0f766e;
          padding-bottom: 20px;
          margin-bottom: 30px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .header h1 {
          font-size: 24px;
          color: #0f766e;
          margin: 0;
          font-weight: 700;
        }
        .header .meta {
          text-align: left;
          font-size: 14px;
          color: #64748b;
        }
        .info-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-bottom: 30px;
        }
        .card {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 15px;
          text-align: center;
        }
        .card-title {
          font-size: 14px;
          color: #64748b;
          margin-bottom: 5px;
        }
        .card-value {
          font-size: 20px;
          font-weight: 600;
          color: #0f766e;
        }
        .card-value.negative {
          color: #be123c;
        }
        .card-value.positive {
          color: #047857;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          font-size: 14px;
        }
        th, td {
          border: 1px solid #cbd5e1;
          padding: 10px 12px;
          text-align: right;
        }
        th {
          background-color: #f1f5f9;
          color: #334155;
          font-weight: 600;
        }
        tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }
        .badge-received {
          background-color: #d1fae5;
          color: #065f46;
        }
        .badge-paid {
          background-color: #fee2e2;
          color: #991b1b;
        }
        .badge-repaid {
          background-color: #e0f2fe;
          color: #075985;
        }
        .badge-pending {
          background-color: #fef3c7;
          color: #92400e;
        }
        .footer {
          margin-top: 50px;
          text-align: center;
          font-size: 12px;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
          padding-top: 15px;
        }
        @media print {
          body { margin: 15px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>${titleText}</h1>
          <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">التصنيف: ${typeLabel}</p>
        </div>
        <div class="meta">
          <div>تاريخ التصدير: ${dateText}</div>
          <div>برنامج كشف النقوط والمناسبات الذكي</div>
        </div>
      </div>

      <div class="info-cards">
        <div class="card bg-emerald-500/5 border border-emerald-500/10 p-5 rounded-2xl flex items-center justify-between">
          <div class="card-title">إجمالي النقوط المستلمة (الواردة)</div>
          <div class="card-value positive">+ ${totals.totalReceived.toLocaleString()} ج.م</div>
        </div>
        <div class="card">
          <div class="card-title">إجمالي النقوط المدفوعة (الصادرة)</div>
          <div class="card-value negative">- ${totals.totalPaid.toLocaleString()} ج.م</div>
        </div>
        <div class="card">
          <div class="card-title">صافي التبادل المالي</div>
          <div class="card-value ${totals.net >= 0 ? 'positive' : 'negative'}">
            ${totals.net >= 0 ? '+' : ''} ${totals.net.toLocaleString()} ج.م
          </div>
        </div>
      </div>

      <h3 style="color: #0f766e; margin-bottom: 10px;">تفاصيل المعاملات والهدايا</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>الاسم</th>
            <th>النوع</th>
            <th>المبلغ / القيمة</th>
            <th>شكل الهدية</th>
            <th>تاريخ الاستحقاق / السداد</th>
            <th>الحالة</th>
            <th>ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${preparedTx.map((t, index) => `
            <tr>
              <td>${index + 1}</td>
              <td style="font-weight: 600;">${t.personName}</td>
              <td>
                <span class="badge ${t.type === 'received' ? 'badge-received' : 'badge-paid'}">
                  ${t.type === 'received' ? 'مستلم (وارد)' : 'مدفوع (صادر)'}
                </span>
              </td>
              <td style="font-weight: 600;">${t.amount.toLocaleString()} ج.م</td>
              <td>${t.giftType === 'monetary' ? 'نقدي' : `عيني (${t.giftDescription || 'هدية'})`}</td>
              <td>${t.repaymentDueDate ? new Date(t.repaymentDueDate).toLocaleDateString('ar-EG') : '---'}</td>
              <td>
                <span class="badge ${t.isRepaid ? 'badge-repaid' : 'badge-pending'}">
                  ${t.type === 'received' ? (t.isRepaid ? 'تم ردها' : 'لم ترد بعد') : (t.isRepaid ? 'سداد لنقوط سابق' : 'مبادرة جديدة')}
                </span>
              </td>
              <td style="color: #64748b; font-size: 12px;">${t.notes || '---'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        <p>تم إنشاء هذا التقرير تلقائياً عبر نظام "كشف النقوط" ومحفوظ بشكل آمن.</p>
      </div>
    </body>
    </html>
  `;

  doc.open();
  doc.write(htmlContent);
  doc.close();

  // Wait for fonts/styles to load and trigger print
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    // Clean up
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 500);
}

/**
 * Fast, elegant client-side PDF Generator using html2canvas + jsPDF.
 * This works perfectly inside sandboxed iframes by rendering off-screen and downloading instantly.
 */
export function exportToPDF(
  occasion: Occasion | null,
  transactions: NoqootTransaction[],
  totals: ReportTotals,
  encryptionKey: string
) {
  const isAll = !occasion;
  const titleText = isAll 
    ? "تقرير النقوط الشامل لجميع المناسبات" 
    : `تقرير نقوط مناسبة: ${decryptText(occasion.title, encryptionKey)}`;
  const dateText = isAll 
    ? new Date().toLocaleDateString('ar-EG') 
    : new Date(occasion.date).toLocaleDateString('ar-EG');
  const typeLabel = isAll 
    ? "جميع المناسبات" 
    : translateOccasionType(occasion.type);

  // Decrypt transaction details
  const preparedTx = transactions.map(t => ({
    ...t,
    personName: decryptText(t.personName, encryptionKey),
    notes: t.notes ? decryptText(t.notes, encryptionKey) : "",
    giftDescription: t.giftDescription ? decryptText(t.giftDescription, encryptionKey) : ""
  }));

  // Create temporary off-screen iframe for rendering to completely isolate from main document CSS containing oklch
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  iframe.style.width = '800px';
  iframe.style.height = '1200px';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const styleBlock = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
      
      body {
        margin: 0;
        padding: 0;
        background-color: #ffffff;
      }
      
      .pdf-container {
        font-family: 'Cairo', sans-serif;
        color: #1e293b;
        background-color: #ffffff;
        line-height: 1.6;
        direction: rtl;
        padding: 35px;
        box-sizing: border-box;
        width: 800px;
      }
      .header {
        border-bottom: 3px double #0f766e;
        padding-bottom: 20px;
        margin-bottom: 30px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .header h1 {
        font-size: 24px;
        color: #0f766e;
        margin: 0;
        font-weight: 700;
      }
      .header .meta {
        text-align: left;
        font-size: 14px;
        color: #64748b;
      }
      .info-cards {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 15px;
        margin-bottom: 30px;
      }
      .card {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 15px;
        text-align: center;
      }
      .card-title {
        font-size: 12px;
        color: #64748b;
        margin-bottom: 5px;
        font-weight: 600;
      }
      .card-value {
        font-size: 18px;
        font-weight: 700;
        color: #0f766e;
      }
      .card-value.negative {
        color: #be123c;
      }
      .card-value.positive {
        color: #047857;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 30px;
        font-size: 13px;
      }
      th, td {
        border: 1px solid #cbd5e1;
        padding: 10px 12px;
        text-align: right;
      }
      th {
        background-color: #f1f5f9;
        color: #334155;
        font-weight: 700;
      }
      tr:nth-child(even) {
        background-color: #f8fafc;
      }
      .badge {
        display: inline-block;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
      }
      .badge-received {
        background-color: #d1fae5;
        color: #065f46;
        border: 1px solid #a7f3d0;
      }
      .badge-paid {
        background-color: #fee2e2;
        color: #991b1b;
        border: 1px solid #fecaca;
      }
      .badge-repaid {
        background-color: #e0f2fe;
        color: #075985;
        border: 1px solid #bae6fd;
      }
      .badge-pending {
        background-color: #fef3c7;
        color: #92400e;
        border: 1px solid #fde68a;
      }
      .footer {
        margin-top: 50px;
        text-align: center;
        font-size: 12px;
        color: #94a3b8;
        border-top: 1px solid #e2e8f0;
        padding-top: 15px;
      }
    </style>
  `;

  const innerContent = `
    <div class="pdf-container" id="pdf-container">
      <div class="header">
        <div>
          <h1>${titleText}</h1>
          <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px; font-weight: 600;">التصنيف: ${typeLabel}</p>
        </div>
        <div class="meta">
          <div>تاريخ التصدير: ${dateText}</div>
          <div style="font-weight: 600; color: #0f766e; margin-top: 3px;">برنامج كشف النقوط والمناسبات الذكي</div>
        </div>
      </div>

      <div class="info-cards">
        <div class="card" style="background-color: #f0fdf4; border-color: #bbf7d0;">
          <div class="card-title" style="color: #166534;">إجمالي النقوط المستلمة (الواردة)</div>
          <div class="card-value positive" style="color: #15803d; font-weight: bold;">+ ${totals.totalReceived.toLocaleString()} ج.م</div>
        </div>
        <div class="card" style="background-color: #fef2f2; border-color: #fca5a5;">
          <div class="card-title" style="color: #991b1b;">إجمالي النقوط المدفوعة (الصادرة)</div>
          <div class="card-value negative" style="color: #b91c1c; font-weight: bold;">- ${totals.totalPaid.toLocaleString()} ج.م</div>
        </div>
        <div class="card" style="background-color: #f0f9ff; border-color: #bae6fd;">
          <div class="card-title" style="color: #0369a1;">صافي التبادل المالي</div>
          <div class="card-value ${totals.net >= 0 ? 'positive' : 'negative'}" style="font-weight: bold;">
            ${totals.net >= 0 ? '+' : ''} ${totals.net.toLocaleString()} ج.م
          </div>
        </div>
      </div>

      <h3 style="color: #0f766e; margin-bottom: 15px; font-size: 16px; border-bottom: 2px solid #0f766e; padding-bottom: 5px; font-weight: 700;">تفاصيل المعاملات والهدايا</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 5%;">#</th>
            <th style="width: 25%;">الاسم</th>
            <th style="width: 15%;">النوع</th>
            <th style="width: 15%;">القيمة</th>
            <th style="width: 15%;">شكل الهدية</th>
            <th style="width: 15%;">تاريخ السداد/الاستحقاق</th>
            <th style="width: 10%;">الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${preparedTx.map((t, index) => `
            <tr>
              <td>${index + 1}</td>
              <td style="font-weight: 700; color: #0f172a;">${t.personName}</td>
              <td>
                <span class="badge ${t.type === 'received' ? 'badge-received' : 'badge-paid'}">
                  ${t.type === 'received' ? 'مستلم (وارد)' : 'مدفوع (صادر)'}
                </span>
              </td>
              <td style="font-weight: 700; color: #1e293b;">${t.amount.toLocaleString()} ج.م</td>
              <td>${t.giftType === 'monetary' ? 'نقدي' : `عيني (${t.giftDescription || 'هدية'})`}</td>
              <td>${t.repaymentDueDate ? new Date(t.repaymentDueDate).toLocaleDateString('ar-EG') : '---'}</td>
              <td>
                <span class="badge ${t.isRepaid ? 'badge-repaid' : 'badge-pending'}">
                  ${t.type === 'received' ? (t.isRepaid ? 'تم ردها' : 'لم ترد') : (t.isRepaid ? 'سداد سابق' : 'مبادرة')}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        <p style="margin: 0; font-weight: 600;">تم إنشاء هذا التقرير تلقائياً عبر نظام "كشف النقوط" ومحفوظ بشكل آمن.</p>
        <p style="margin: 5px 0 0 0; font-size: 10px;">جميع الحقوق محفوظة © ${new Date().getFullYear()}</p>
      </div>
    </div>
  `;

  const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!iframeDoc) {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
    return;
  }

  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      ${styleBlock}
    </head>
    <body>
      ${innerContent}
    </body>
    </html>
  `);
  iframeDoc.close();

  // Wait a short moment to ensure Cairo font imports are fully loaded & elements are correctly styled
  setTimeout(() => {
    const elementToCapture = iframeDoc.getElementById('pdf-container');
    if (!elementToCapture) {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      return;
    }

    html2canvas(elementToCapture, {
      scale: 2, // 2x scale for crisp high-density PDF image quality
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false
    }).then(canvas => {
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgWidth = 210; // A4 size width in mm
      const pageHeight = 297; // A4 size height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      const rawFileName = isAll 
        ? `تقرير_النقوط_الشامل_${new Date().toISOString().slice(0, 10)}`
        : `تقرير_نقوط_${decryptText(occasion.title, encryptionKey)}`;
      
      // Clean up unsafe filename characters
      const cleanFileName = rawFileName.replace(/[\s\/:*?"<>|]+/g, '_') + '.pdf';
        
      pdf.save(cleanFileName);
      
      // Clean up DOM node
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }).catch(err => {
      console.error("PDF generation failed:", err);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      alert("عذراً، حدث خطأ أثناء تصدير ملف الـ PDF. يرجى المحاولة ثانية.");
    });
  }, 500);
}

function translateOccasionType(type: string): string {
  switch (type) {
    case 'wedding': return "زفاف / خطوبة";
    case 'graduation': return "تخرج";
    case 'birth': return "مولود جديد / عقيقة";
    case 'eid': return "أعياد ومناسبات موسمية";
    case 'other': return "أخرى";
    default: return type;
  }
}
