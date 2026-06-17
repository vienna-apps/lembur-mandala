import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET() {
  const wb = XLSX.utils.book_new()

  // Headers row 1
  const headers = [
    'NIK', 'Nama Karyawan', 'Kegiatan', 'Hari, Tanggal',
    'Dari Jam', 'Sampai Jam', 'Selama (Jam)',
    'WFO', 'Standby', 'Akhir Pekan / Tanggal Merah', 'Total (Jam)',
  ]

  // Hint row 2
  const hints = [
    'Sesuai NIK di Gadjian', 'Nama lengkap', '[NAMA PROJECT] Deskripsi kegiatan',
    'Nama Hari, DD Bulan YYYY', 'HH:MM', 'HH:MM', 'contoh: 2.5',
    'Ya/Tidak', 'Ya/Tidak', 'Ya/Tidak', 'contoh: 3.75',
  ]

  // Example rows
  const examples = [
    [170068, 'Vania Sanjaya',  '[RECON QNB] Testing preprod recon revamp',      'Selasa, 03 Juni 2026',  '18:00', '21:00', 3,    'Ya',    'Tidak', 'Tidak', 3.0  ],
    [170068, 'Vania Sanjaya',  '[RECON QNB] Monitoring & fixing post-deploy',    'Sabtu, 07 Juni 2026',   '09:00', '12:30', 3.5,  'Ya',    'Tidak', 'Ya',    5.25 ],
    [170068, 'Vania Sanjaya',  '[CAMBER BMS] Assist deployment production',      'Minggu, 08 Juni 2026',  '20:00', '23:00', 3,    'Tidak', 'Tidak', 'Ya',    4.5  ],
    [170068, 'Vania Sanjaya',  '[ATM - RECON] Standby deployment & cek log',    'Jumat, 13 Juni 2026',   '22:00', '01:00', 3,    'Tidak', 'Ya',    'Tidak', 1.5  ],
  ]

  const rows = [headers, hints, ...examples]
  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Column widths
  ws['!cols'] = [
    { wch: 10 }, { wch: 22 }, { wch: 48 }, { wch: 24 },
    { wch: 10 }, { wch: 10 }, { wch: 14 },
    { wch: 8  }, { wch: 9  }, { wch: 26 }, { wch: 12 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Lembur')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Template Lembur - MANDALA.xlsx"',
    },
  })
}
