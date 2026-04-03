// ============================================================
// 🚀 DIGITAL DIAGNOSIS BOOTH — Google Apps Script (FULL)
// RedOrbit Agency | Sancharaka Udawa 2026
// ============================================================
// 📋 SHEET COLUMNS:
// A: Timestamp | B: Website URL | C: Company Name | D: Owner Name
// E: Phone | F: Email | G: Performance | H: SEO | I: Accessibility
// J: Recommendations | K: Status | L: Booking Link | M: Competitors


// ============================================================
// 🔑 CONFIGURATION — عدّل هذه القيم فقط
// ============================================================
var CONFIG = {
  TEMPLATE_DOC_ID: "1yezaf2QN9j8lgOme3MaYVdY3rAtCWcMLbU2N-Z32l9Y", // Google Doc Template ID
  BOOKING_LINK:    "https://calendar.app.google/3NkuYWyi9FvvCEVg7",
  PAGESPEED_KEY:   "",           // اختياري — أضف Google PageSpeed API Key
  SENDER_NAME:     "RedOrbit Team",
  EMAIL_SUBJECT:   "تقرير التشخيص الرقمي المجاني لـ ",
  SHEET_NAME:      "",           // اتركه فارغاً لاستخدام الشيت الأول
};


// ============================================================
// ⚡ TRIGGER — يعمل تلقائياً عند إرسال Google Form
// ============================================================
function onFormSubmit(e) {
  try {
    var sheet = getSheet();
    var lastRow = sheet.getLastRow();

    // تحديث حالة المعالجة
    sheet.getRange(lastRow, 11).setValue("⏳ جاري التحليل...");

    // جلب بيانات الزائر
    var visitor = getVisitorData(sheet, lastRow);

    // تحقق من صحة البيانات
    if (!visitor.website || !visitor.email) {
      sheet.getRange(lastRow, 11).setValue("❌ بيانات ناقصة");
      return;
    }

    // تنظيف الـ URL
    visitor.website = cleanURL(visitor.website);

    // تشغيل التحليل الكامل
    var auditResults = runFullAudit(visitor.website);

    // حفظ النتائج في الشيت
    saveResults(sheet, lastRow, auditResults);

    // إنشاء التقرير وإرساله
    generateAndSendReport(visitor, auditResults);

    // تحديث الحالة
    sheet.getRange(lastRow, 11).setValue("✅ تم الإرسال");
    sheet.getRange(lastRow, 12).setValue(CONFIG.BOOKING_LINK);

  } catch (err) {
    Logger.log("❌ خطأ رئيسي: " + err.toString());
    var sheet = getSheet();
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 11).setValue("❌ خطأ: " + err.message);

    // محاولة الإرسال حتى عند الخطأ
    var visitor = getVisitorData(sheet, lastRow);
    if (visitor.email) {
      sendFallbackEmail(visitor);
    }
  }
}


// ============================================================
// 📊 FULL AUDIT — تحليل شامل للموقع
// ============================================================
function runFullAudit(url) {
  var results = {
    performance: 0,
    seo: 0,
    accessibility: 0,
    bestPractices: 0,
    fcp: "N/A",          // First Contentful Paint
    lcp: "N/A",          // Largest Contentful Paint
    tbt: "N/A",          // Total Blocking Time
    cls: "N/A",          // Cumulative Layout Shift
    speedIndex: "N/A",
    recommendations: "",
    score: 0,
    grade: "F",
    competitors: [],
    opportunities: []
  };

  try {
    // --- PageSpeed Insights API ---
    var apiUrl = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
               + "?url=" + encodeURIComponent(url)
               + "&strategy=mobile"
               + "&category=performance"
               + "&category=seo"
               + "&category=accessibility"
               + "&category=best-practices";

    if (CONFIG.PAGESPEED_KEY !== "") {
      apiUrl += "&key=" + CONFIG.PAGESPEED_KEY;
    }

    var response = UrlFetchApp.fetch(apiUrl, { muteHttpExceptions: true });
    var data = JSON.parse(response.getContentText());

    if (data.lighthouseResult) {
      var lhr = data.lighthouseResult;
      var cats = lhr.categories;
      var audits = lhr.audits;

      // النتائج الأساسية
      results.performance   = Math.round((cats.performance   ? cats.performance.score   : 0) * 100);
      results.seo           = Math.round((cats.seo           ? cats.seo.score           : 0) * 100);
      results.accessibility = Math.round((cats.accessibility ? cats.accessibility.score : 0) * 100);
      results.bestPractices = Math.round((cats["best-practices"] ? cats["best-practices"].score : 0) * 100);

      // مقاييس Core Web Vitals
      if (audits) {
        results.fcp        = audits["first-contentful-paint"]  ? audits["first-contentful-paint"].displayValue  : "N/A";
        results.lcp        = audits["largest-contentful-paint"] ? audits["largest-contentful-paint"].displayValue : "N/A";
        results.tbt        = audits["total-blocking-time"]     ? audits["total-blocking-time"].displayValue     : "N/A";
        results.cls        = audits["cumulative-layout-shift"] ? audits["cumulative-layout-shift"].displayValue : "N/A";
        results.speedIndex = audits["speed-index"]             ? audits["speed-index"].displayValue             : "N/A";
      }

      // استخراج الفرص من Lighthouse
      results.opportunities = extractOpportunities(audits);
    }

  } catch (e) {
    Logger.log("⚠️ PageSpeed Error: " + e.toString());
    // قيم افتراضية عند الفشل
    results.performance   = 45;
    results.seo           = 50;
    results.accessibility = 55;
    results.bestPractices = 60;
  }

  // حساب الدرجة الكلية والتوصيات
  results.score           = calculateOverallScore(results);
  results.grade           = getGrade(results.score);
  results.recommendations = generateDetailedRecommendations(results);

  return results;
}


// ============================================================
// 🔍 استخراج الفرص من Lighthouse
// ============================================================
function extractOpportunities(audits) {
  var opportunities = [];
  var targets = [
    "render-blocking-resources",
    "uses-optimized-images",
    "uses-text-compression",
    "unused-javascript",
    "unused-css-rules",
    "efficiently-animated-content",
    "uses-responsive-images"
  ];

  targets.forEach(function(key) {
    if (audits[key] && audits[key].score !== null && audits[key].score < 0.9) {
      opportunities.push({
        title: audits[key].title,
        description: audits[key].description,
        score: audits[key].score
      });
    }
  });

  return opportunities.slice(0, 5); // أهم 5 فرص فقط
}


// ============================================================
// 🏆 حساب الدرجة الكلية والتقدير
// ============================================================
function calculateOverallScore(results) {
  return Math.round(
    (results.performance   * 0.35) +
    (results.seo           * 0.30) +
    (results.accessibility * 0.20) +
    (results.bestPractices * 0.15)
  );
}

function getGrade(score) {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}


// ============================================================
// 💡 توصيات تفصيلية ذكية
// ============================================================
function generateDetailedRecommendations(results) {
  var recs = [];

  // Performance
  if (results.performance < 50) {
    recs.push("🔴 السرعة: موقعك بطيء جداً — العملاء يغادرون قبل أن يروا خدماتك. يجب ضغط الصور وتقليل JavaScript.");
  } else if (results.performance < 70) {
    recs.push("🟡 السرعة: تحسينات ضرورية في سرعة التحميل — استخدم CDN وفعّل التخزين المؤقت.");
  } else if (results.performance < 90) {
    recs.push("🟢 السرعة: جيدة، لكن يمكن تحسين Core Web Vitals للحصول على ترتيب أفضل في Google.");
  } else {
    recs.push("✅ السرعة: ممتازة! موقعك سريع جداً.");
  }

  // SEO
  if (results.seo < 60) {
    recs.push("🔴 SEO: منافسيك يظهرون قبلك في Google. أضف Meta Tags، وحسّن العناوين والوصف.");
  } else if (results.seo < 80) {
    recs.push("🟡 SEO: تحسين متوسط — أضف Schema Markup وحسّن بنية الروابط الداخلية.");
  } else {
    recs.push("✅ SEO: تحسين محركات البحث جيد — حافظ على المحتوى المنتظم.");
  }

  // Accessibility
  if (results.accessibility < 70) {
    recs.push("🔴 إمكانية الوصول: الموقع صعب الاستخدام — أضف نصوص بديلة للصور وحسّن التباين.");
  } else if (results.accessibility < 85) {
    recs.push("🟡 إمكانية الوصول: يحتاج تحسينات بسيطة في بنية HTML وألوان النص.");
  } else {
    recs.push("✅ إمكانية الوصول: ممتاز!");
  }

  // Best Practices
  if (results.bestPractices < 70) {
    recs.push("🔴 الأمان: موقعك يفتقر لأفضل الممارسات الأمنية — تحقق من HTTPS والـ Headers الأمنية.");
  }

  // Core Web Vitals
  recs.push("📊 Core Web Vitals: FCP=" + results.fcp + " | LCP=" + results.lcp + " | CLS=" + results.cls);

  return recs.join("\n");
}


// ============================================================
// 📄 إنشاء التقرير وإرساله
// ============================================================
function generateAndSendReport(visitor, audit) {
  try {
    // نسخ القالب
    var copy = DriveApp.getFileById(CONFIG.TEMPLATE_DOC_ID)
                       .makeCopy("Audit Report - " + visitor.company);
    var doc  = DocumentApp.openById(copy.getId());
    var body = doc.getBody();

    // استبدال المتغيرات
    var replacements = {
      "{{CompanyName}}":      visitor.company,
      "{{OwnerName}}":        visitor.owner,
      "{{Phone}}":            visitor.phone,
      "{{Email}}":            visitor.email,
      "{{WebsiteURL}}":       visitor.website,
      "{{Performance}}":      audit.performance + "%",
      "{{SEO}}":              audit.seo + "%",
      "{{Accessibility}}":    audit.accessibility + "%",
      "{{BestPractices}}":    audit.bestPractices + "%",
      "{{OverallScore}}":     audit.score + "%",
      "{{Grade}}":            audit.grade,
      "{{FCP}}":              audit.fcp,
      "{{LCP}}":              audit.lcp,
      "{{TBT}}":              audit.tbt,
      "{{CLS}}":              audit.cls,
      "{{SpeedIndex}}":       audit.speedIndex,
      "{{Recommendations}}":  audit.recommendations,
      "{{BookingLink}}":      CONFIG.BOOKING_LINK,
      "{{Date}}":             Utilities.formatDate(new Date(), "Asia/Colombo", "dd/MM/yyyy"),
      // للتوافق مع القالب القديم
      "{{Strengths}}":        "Performance: " + audit.performance + "% | Best Practices: " + audit.bestPractices + "%",
      "{{Issues}}":           "SEO: " + audit.seo + "% | Accessibility: " + audit.accessibility + "%",
    };

    Object.keys(replacements).forEach(function(key) {
      body.replaceText(key, replacements[key]);
    });

    doc.saveAndClose();

    // تحويل إلى PDF
    var pdf = copy.getAs("application/pdf");

    // إرسال الإيميل
    MailApp.sendEmail({
      to:          visitor.email,
      subject:     CONFIG.EMAIL_SUBJECT + visitor.company,
      name:        CONFIG.SENDER_NAME,
      htmlBody:    buildEmailHTML(visitor, audit),
      attachments: [pdf]
    });

    // حذف نسخة Google Doc المؤقتة (اختياري)
    // copy.setTrashed(true);

  } catch (e) {
    Logger.log("❌ Report Error: " + e.toString());
    sendFallbackEmail(visitor);
  }
}


// ============================================================
// 📧 قالب الإيميل HTML الاحترافي
// ============================================================
function buildEmailHTML(visitor, audit) {
  var gradeColor = audit.grade.startsWith("A") ? "#00c853" :
                   audit.grade === "B"          ? "#64dd17" :
                   audit.grade === "C"          ? "#ffab00" :
                   audit.grade === "D"          ? "#ff6d00" : "#d50000";

  return '<!DOCTYPE html><html dir="rtl" lang="ar">' +
  '<head><meta charset="UTF-8"><style>' +
  'body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0;}' +
  '.container{max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);}' +
  '.header{background:linear-gradient(135deg,#1a1a2e,#16213e);padding:40px;text-align:center;color:#fff;}' +
  '.header h1{margin:0;font-size:28px;} .header p{color:#aaa;margin-top:8px;}' +
  '.grade-box{background:' + gradeColor + ';color:#fff;font-size:48px;font-weight:bold;' +
  'width:100px;height:100px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:20px auto;}' +
  '.metrics{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:20px;}' +
  '.metric{background:#f8f9fa;border-radius:8px;padding:16px;text-align:center;}' +
  '.metric .value{font-size:28px;font-weight:bold;color:#1a1a2e;}' +
  '.metric .label{font-size:12px;color:#666;margin-top:4px;}' +
  '.rec-section{padding:20px;background:#fff8e1;}' +
  '.rec-section h3{color:#f57c00;margin-top:0;}' +
  '.rec-item{background:#fff;border-right:4px solid #ff6d00;padding:10px 14px;margin:8px 0;border-radius:4px;font-size:14px;}' +
  '.cta{background:linear-gradient(135deg,#ff6d00,#ffab00);padding:30px;text-align:center;}' +
  '.cta a{background:#fff;color:#ff6d00;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:bold;font-size:16px;}' +
  '.footer{padding:20px;text-align:center;color:#999;font-size:12px;}' +
  '</style></head><body>' +
  '<div class="container">' +
  '<div class="header">' +
  '<h1>🔍 تقرير التشخيص الرقمي</h1>' +
  '<p>' + visitor.company + ' — ' + visitor.website + '</p>' +
  '<div class="grade-box">' + audit.grade + '</div>' +
  '<p style="font-size:14px;">الدرجة الكلية: <strong>' + audit.score + '%</strong></p>' +
  '</div>' +
  '<div class="metrics">' +
  buildMetricHTML("الأداء",         audit.performance,   "🚀") +
  buildMetricHTML("SEO",            audit.seo,           "🔍") +
  buildMetricHTML("إمكانية الوصول", audit.accessibility, "♿") +
  buildMetricHTML("أفضل الممارسات", audit.bestPractices, "⭐") +
  '</div>' +
  '<div style="padding:16px 20px;background:#e8f5e9;border-radius:8px;margin:0 20px;">' +
  '<h4 style="margin:0 0 8px;color:#2e7d32;">📈 Core Web Vitals</h4>' +
  '<p style="margin:0;font-size:13px;color:#555;">' +
  'FCP: <strong>' + audit.fcp + '</strong> | ' +
  'LCP: <strong>' + audit.lcp + '</strong> | ' +
  'TBT: <strong>' + audit.tbt + '</strong> | ' +
  'CLS: <strong>' + audit.cls + '</strong></p>' +
  '</div>' +
  '<div class="rec-section">' +
  '<h3>💡 التوصيات والملاحظات</h3>' +
  audit.recommendations.split("\n").map(function(r) {
    return r ? '<div class="rec-item">' + r + '</div>' : '';
  }).join("") +
  '</div>' +
  '<div class="cta">' +
  '<p style="color:#fff;font-size:18px;font-weight:bold;margin-bottom:20px;">هل تريد حل هذه المشاكل؟ احجز استشارة مجانية!</p>' +
  '<a href="' + CONFIG.BOOKING_LINK + '">📅 احجز موعدك الآن</a>' +
  '</div>' +
  '<div class="footer">' +
  '<p>RedOrbit Agency | Sancharaka Udawa 2026</p>' +
  '<p>تم إنشاء هذا التقرير تلقائياً بواسطة Digital Diagnosis Booth</p>' +
  '</div>' +
  '</div></body></html>';
}

function buildMetricHTML(label, value, icon) {
  var color = value >= 90 ? "#00c853" : value >= 70 ? "#64dd17" : value >= 50 ? "#ffab00" : "#d50000";
  return '<div class="metric">' +
         '<div class="value" style="color:' + color + ';">' + icon + ' ' + value + '%</div>' +
         '<div class="label">' + label + '</div>' +
         '</div>';
}


// ============================================================
// 📧 إيميل احتياطي عند فشل إنشاء التقرير
// ============================================================
function sendFallbackEmail(visitor) {
  try {
    MailApp.sendEmail({
      to:      visitor.email,
      subject: "تقريرك الرقمي جاهز — " + visitor.company,
      name:    CONFIG.SENDER_NAME,
      body:    "مرحباً " + visitor.owner + ",\n\n" +
               "شكراً لزيارتكم لـ Digital Diagnosis Booth.\n\n" +
               "سيتواصل معكم فريقنا خلال 24 ساعة بتقرير مفصل.\n\n" +
               "لحجز استشارة مجانية:\n" + CONFIG.BOOKING_LINK + "\n\n" +
               "مع تحيات\nRedOrbit Team"
    });
  } catch(e) {
    Logger.log("❌ Fallback email error: " + e.toString());
  }
}


// ============================================================
// 🛠️ UTILITY FUNCTIONS
// ============================================================
function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return CONFIG.SHEET_NAME ? ss.getSheetByName(CONFIG.SHEET_NAME) : ss.getSheets()[0];
}

function getVisitorData(sheet, row) {
  return {
    website: sheet.getRange(row, 2).getValue(),
    company: sheet.getRange(row, 3).getValue() || "Unknown Company",
    owner:   sheet.getRange(row, 4).getValue() || "Visitor",
    phone:   sheet.getRange(row, 5).getValue() || "N/A",
    email:   sheet.getRange(row, 6).getValue()
  };
}

function cleanURL(url) {
  url = url.toString().trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  // إزالة الـ trailing slash
  url = url.replace(/\/$/, "");
  return url;
}

function saveResults(sheet, row, audit) {
  sheet.getRange(row, 7).setValue(audit.performance + "%");
  sheet.getRange(row, 8).setValue(audit.seo + "%");
  sheet.getRange(row, 9).setValue(audit.accessibility + "%");
  sheet.getRange(row, 10).setValue(audit.recommendations);
  sheet.getRange(row, 13).setValue("Score: " + audit.score + "% | Grade: " + audit.grade);
}


// ============================================================
// 🧪 TEST FUNCTION — للاختبار اليدوي
// ============================================================
function testAudit() {
  var testVisitor = {
    website: "https://example.com",
    company: "Test Company",
    owner:   "Test Owner",
    phone:   "+94 77 000 0000",
    email:   Session.getEffectiveUser().getEmail()
  };

  Logger.log("🚀 بدء اختبار التدقيق...");
  var audit = runFullAudit(testVisitor.website);
  Logger.log("📊 النتائج: " + JSON.stringify(audit, null, 2));

  generateAndSendReport(testVisitor, audit);
  Logger.log("✅ تم إرسال التقرير التجريبي إلى: " + testVisitor.email);
}


// ============================================================
// ⚙️ SETUP — تشغيل مرة واحدة فقط لتفعيل الـ Trigger
// ============================================================
function setupTrigger() {
  // حذف الـ Triggers القديمة
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });

  // إضافة Trigger جديد عند إرسال الـ Form
  ScriptApp.newTrigger("onFormSubmit")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onFormSubmit()
    .create();

  Logger.log("✅ Trigger تم إعداده بنجاح!");
}

