(function () {
  var pages = window.VIE_TRANSLATIONS && window.VIE_TRANSLATIONS.pages;
  if (!pages || !pages['*']) return;

  Object.assign(pages['*'].locales.en, {
    'Coba demo tanpa akun': 'Try the demo without an account',
    'Data contoh aman · tidak terhubung ke data karyawan': 'Safe sample data · not connected to employee records'
  });
  Object.assign(pages['*'].locales['zh-Hant-TW'], {
    'Coba demo tanpa akun': '免帳號試用',
    'Data contoh aman · tidak terhubung ke data karyawan': '安全範例資料 · 不連接員工紀錄'
  });

  pages['/demo'] = {
    source: 'en',
    default: 'en',
    locales: {
      id: {
        'Read-only public demo': 'Demo publik hanya-baca',
        'Explore the employee dashboard with safe sample data. No account is required, and nothing here is connected to real employee records.': 'Jelajahi dashboard karyawan dengan data contoh yang aman. Tidak perlu akun dan tidak ada yang terhubung ke data karyawan asli.',
        'Demo actions': 'Aksi demo',
        'Open full app': 'Buka aplikasi lengkap',
        'Back to portfolio': 'Kembali ke portfolio',
        'Demo mode: actions are previews only and do not save or submit data.': 'Mode demo: semua aksi hanya pratinjau dan tidak menyimpan atau mengirim data.',
        'Sample overtime dashboard': 'Contoh dashboard lembur',
        'August 2026': 'Agustus 2026',
        'Status: Draft · editable until submission': 'Status: Draf · dapat diedit sebelum dikirim',
        'Events': 'Event', 'Total duration': 'Total durasi', 'Compensation': 'Kompensasi', 'Projects': 'Proyek',
        'Submission progress': 'Progres pengiriman', 'Entries created': 'Entri dibuat',
        'Three sample overtime events': 'Tiga contoh event lembur', 'Review and edit': 'Tinjau dan edit',
        'Check hours, project, and evidence': 'Periksa jam, proyek, dan bukti', 'Submit to admin': 'Kirim ke admin',
        'Locked in this public demo': 'Dikunci pada demo publik ini', 'Overtime events': 'Event lembur',
        '3 sample events': '3 event contoh', 'BI-FAST reconciliation support': 'Dukungan rekonsiliasi BI-FAST',
        'Production release monitoring': 'Pemantauan rilis produksi', 'Monthly report validation': 'Validasi laporan bulanan'
      },
      'zh-Hant-TW': {
        'Read-only public demo': '公開唯讀試用版',
        'Explore the employee dashboard with safe sample data. No account is required, and nothing here is connected to real employee records.': '使用安全的範例資料瀏覽員工儀表板；不需帳號，也不會連接任何真實員工紀錄。',
        'Demo actions': '試用操作', 'Open full app': '開啟完整應用程式', 'Back to portfolio': '返回作品集',
        'Demo mode: actions are previews only and do not save or submit data.': '試用模式：所有操作僅供預覽，不會儲存或提交資料。',
        'Sample overtime dashboard': '加班儀表板範例', 'August 2026': '2026 年 8 月',
        'Status: Draft · editable until submission': '狀態：草稿 · 提交前可編輯',
        'Events': '事件', 'Total duration': '總時數', 'Compensation': '補償時數', 'Projects': '專案',
        'Submission progress': '提交進度', 'Entries created': '已建立紀錄',
        'Three sample overtime events': '三筆加班事件範例', 'Review and edit': '檢查與編輯',
        'Check hours, project, and evidence': '檢查時數、專案與證明', 'Submit to admin': '提交給管理員',
        'Locked in this public demo': '公開試用版中已鎖定', 'Overtime events': '加班事件',
        '3 sample events': '3 筆範例事件', 'BI-FAST reconciliation support': 'BI-FAST 對帳支援',
        'Production release monitoring': '正式環境上線監控', 'Monthly report validation': '每月報表驗證'
      }
    }
  };
})();
