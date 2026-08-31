# Dental Chain OS v15.73 — Durable Web + Windows

## v15.73

- تخزين المرضى والخطط في IndexedDB بدل `localStorage` المحدود في المتصفح، مع ترحيل آمن للبيانات القديمة.
- نسخة Windows مستقلة تستخدم SQLite محلياً وتبقى متصلة بنفس Firebase والحسابات الحالية.
- يبني GitHub Actions ملف تثبيت ونسخة Portable من المصدر نفسه.
- تبقى الصور الأصلية في أرشيف المرضى المنفصل، ولا تُعاد إضافتها إلى سجل Firebase.

## v15.72

- تقدم مراحل خطط المساعد يُقرأ تلقائياً من Controller 3.3.0؛ لا يطلب من الطبيب وضع علامة «تم» يدوياً في البرنامج الرئيسي.
- بطاقة الخطة تعرض حالتها ونسبتها وآخر حدث سريري وصل من Doctor Assistant 8.7.0.
- يحتفظ كل حدث بالملخص والتفاصيل الخام: المادة والكمية والمقاس والقناة والسن والواجهة والتوقيت.
- نافذة السن الذكية تعرض خطط السن وحالاتها، ثم قائمة خدمات العيادة ذات الألوان التلقائية وملاحظات السن.
- إلغاء حقول الحالة اليدوية القديمة و«جسر على…» من بطاقة السن.
- أداة «إضافة جسر» بجانب خريطة الأسنان: خزف، خزف معدن، أو زركون؛ ثم تحديد الأسنان ضمن فك واحد ورسم خط موف فاتح عليها.
- إصلاح خلفية نافذة السن وظلها لتظهر كاملة ومتوازنة.

## v15.71

- أصبحت بنود الخطة للقراءة فقط، ويأتي اكتمال كل مرحلة تلقائياً من مساعد الطبيب عبر الكونترولر.
- لا تُغلق الخطة عند اكتمال المراحل؛ تتحول إلى «جاهزة للإنهاء» حتى يؤكد الطبيب الإنهاء من بطاقة المساعد.
- تحديث بطاقات الخطط وحالات وألوان خريطة الأسنان وملخص السن وفق الخدمات المعتمدة.
- إصلاح تخطيط بطاقات خطة العلاج ومنع تداخلها بصرياً.
- مطابقة المريض برقم الملف أو المعرّف لتفادي فقدان أحداث المزامنة.
- ترقية بروتوكول النقل المحلي إلى 5 مع Controller 3.2.0، والمتوافق مع Display 5.6.0 وDoctor Assistant 8.6.0.

## v15.70
- محرر خطة علاج مفصّل يعتمد أسماء الخدمات الـ26 نفسها في تطبيق المساعد.
- يحفظ `serviceId` ثابتاً، المنطقة المستهدفة، الأولوية، عدد الجلسات، التكلفة والملاحظات مع إبقاء حقول الخطط القديمة متوافقة.
- يرسل سياق المريض وخططه إلى Controller وفق `dtdc-clinical-link-v1` وبروتوكول النقل 4.
- يستقبل نتائج جلسات المساعد من Controller محلياً ويضمّها إلى الخطة من دون اعتبار انتهاء الجلسة إنهاءً تلقائياً للخطة.
- لا تُرسل بيانات الخطط إلى شاشة الكرسي؛ يفصل Controller الأدوار على مستوى WebSocket.

هذه الإضافة فوق v15.69 ولا تغيّر Firebase أو الخزنة المحلية أو آلية حفظ المرضى الحالية.

Development build. Patient persistence is handled by `js/hybrid/v15.48-patient-vault.js` using redundant local mirrors, recovery snapshots, and a retrying Firebase queue.

Do not delete `_archive/readme-history` until the development build is fully accepted.


## v15.57 Professional Icon Pack
- Added full Dental Chain OS icon family (16–1024 px).
- Added favicon.ico, Apple Touch icon, Android/PWA icons.
- Updated manifest and page icon references.

## v15.58
- Smart per-clinic prescription template settings with live preview.
- Per-clinic price list, viewable by doctor/manager/super owner.
- Price editing restricted to manager/super owner and protected by Ctrl+Alt+P + admin password.
- No changes to patient storage, finance, or sync engines.

## v15.59
- Unified the four main clinic action buttons in one aligned row on desktop.
- Replaced the smart RX text editor with a per-clinic prescription template image uploader.
- Added preview, automatic compression, cloud/local save, and protected reset to the default template.
- Clarified price-list categories as optional service groupings.


## v15.60
- أبقى زر تحميل قالب الوصفة حصراً داخل نافذة إدارة الوصفات الجاهزة ودليل الأدوية.
- أزيلت النسخ المكررة من بقية الواجهات.
- تغير اسم زر قائمة الأسعار إلى "الأسعار" بدون رمز القلب.

## v15.61 Adaptive UI Cleanup
- Dashboard counters use responsive auto-fit columns and fill all available width.
- Main clinic actions stay aligned to the left in one desktop row.
- Patient audit block is visually hidden without removing compatibility data.
- Patient timeline moved to a compact side drawer.
- Duplicate finance button below the finance cards is hidden; the main Finance & Installments action remains.
- Clinic price-list values use Western English numerals.


## v15.63
- Appointment QR reminder changed to 24 hours before the appointment.
- Added `عرض المريض على الشاشة` button in the active patient file.
- Uses `dentalchair://` custom protocol handled by Chair Controller.exe.


## Alpha 4 integration
- Patient button sends active patient to Chair Controller.
- Appointment-list QR button sends appointment ICS to Controller and Display automatically.
- QR alarm reminder is 24 hours before appointment.
- Hold Shift while clicking QR button to open the local browser modal instead.
# Dental Chain OS — Chair Integration 15.66

هذا التحديث يضيف تكامل شاشة الكرسي فقط فوق النسخة الحالية:

- اختيار مستقل لجنس المريض `male/female` لتحديد «سيد/سيدة» في ترحيب الشاشة.
- لا يستخدم حقل الجنس في أي وظيفة طبية أو مالية أو صلاحيات.
- المرضى القدامى يبقون متوافقين من دون تخمين الجنس؛ يظهر الترحيب بالاسم الأول فقط حتى يتم اختيار ذكر أو أنثى.
- إرسال مباشر محلي إلى الكونترولر من دون إعادة فتح التطبيق، مع إبقاء البروتوكول القديم كاحتياط.
- QR مختصر من نوع Raw VEVENT بلا رابط أو Base64 أو JSON، مع تنبيه تقويم قبل 24 ساعة.
- اختيار مجلد محلي لأرشيف صور المرضى من Data Manager مع نسخة مرتبة حسب رقم الملف والاسم ونوع الصورة.
- طبقة الأرشفة مستقلة ولا تغيّر حفظ الصور القديم أو Firebase.

## Chair Workflow 15.67
- عند فتح ملف مريض يُرسل رقم الملف والاسم بصمت إلى الكونترولر ليصبح مجلد المريض محدداً تلقائياً.
- لا يتم فتح نافذة الكونترولر عند مزامنة الهوية الصامتة، ولا تتغير مسارات الحفظ أو Firebase أو النسخ المحلية الحالية.

## Stable Restore 15.69

- حقل الجنس أصبح جزءاً ثابتاً من نموذج المريض ولم يعد يعتمد على إدخاله ديناميكياً كي لا يختفي.
- يُحفظ الجنس مع المريض وفي `_patient.json` ويُرسل إلى الكونترولر عند العرض.
- يرسل النظام الاسم الكامل ورقم الملف واسم مجلد الأرشيف ورقم جلسة ثابتاً للمريض الحالي.
- يستخدم تكامل الشاشة البروتوكول المحلي 3 مع بقاء رابط `dentalchair://` كخيار احتياطي.
