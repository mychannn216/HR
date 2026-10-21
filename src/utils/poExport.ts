import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from 'docx';
import { saveAs } from 'file-saver';
import type { PurchaseOrder, Employee, Job } from '../types';
import { formatVND, formatDateVN } from './formatters';

const borderNone = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: '333333' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: '333333' },
  left: { style: BorderStyle.SINGLE, size: 4, color: '333333' },
  right: { style: BorderStyle.SINGLE, size: 4, color: '333333' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: '333333' },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: '333333' },
};

const cellMargins = {
  top: 80,
  bottom: 80,
  left: 100,
  right: 100,
};

function createPartyRow(
  label: string,
  value: string,
  isBoldLabel: boolean = false,
  isBoldValue: boolean = false,
  extra?: { label: string; value: string }
): TableRow {
  const valueRuns: TextRun[] = [
    new TextRun({
      text: `: ${value}`,
      bold: isBoldValue,
      size: 23,
      font: 'Times New Roman',
    }),
  ];

  if (extra) {
    valueRuns.push(
      new TextRun({
        text: `                   ${extra.label} : `,
        size: 23,
        font: 'Times New Roman',
      }),
      new TextRun({
        text: extra.value,
        bold: true,
        size: 23,
        font: 'Times New Roman',
      })
    );
  }

  return new TableRow({
    children: [
      new TableCell({
        width: { size: 28, type: WidthType.PERCENTAGE },
        borders: borderNone,
        children: [
          new Paragraph({
            spacing: { before: 20, after: 20, line: 260 },
            children: [
              new TextRun({
                text: label,
                bold: isBoldLabel,
                size: 23,
                font: 'Times New Roman',
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 72, type: WidthType.PERCENTAGE },
        borders: borderNone,
        children: [
          new Paragraph({
            spacing: { before: 20, after: 20, line: 260 },
            children: valueRuns,
          }),
        ],
      }),
    ],
  });
}

/**
 * Xuất đơn PO (Purchase Order) sang file Word (.docx)
 */
export async function exportPOWord(
  po: PurchaseOrder,
  employee: Employee,
  jobs: Job[]
): Promise<void> {
  // BẢNG BÊN A (Cố định TOGOO)
  const tableBenA = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderNone,
    rows: [
      createPartyRow('BÊN A', 'CÔNG TY CỔ PHẦN TRUYỀN THÔNG TOGOO', true, true),
      createPartyRow('Địa chỉ trụ sở', '64 phố Dương Khuê, Phường Từ Liêm, Thành phố Hà Nội, Việt Nam'),
      createPartyRow('Mã số thuế', '0109656311'),
      createPartyRow('Đại diện', 'Ông NGÔ HỮU THẾ', false, true, { label: 'Chức vụ', value: 'Tổng Giám đốc' }),
      createPartyRow('Số điện thoại', '0964221233'),
      createPartyRow('Email', 'Togoomedia@gmail.com'),
      createPartyRow('Số tài khoản', '2228886666686'),
      createPartyRow('Ngân hàng thụ hưởng', 'Ngân hàng TMCP Quân Đội – MB Bank'),
    ],
  });

  // BẢNG BÊN B (Đồng bộ từ hồ sơ nhân sự)
  const tableBenB = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderNone,
    rows: [
      createPartyRow('BÊN B', employee.full_name ? employee.full_name.toUpperCase() : '...', true, true),
      createPartyRow('Số CMND/CCCD', employee.id_card_no || '...'),
      createPartyRow('Điện thoại', employee.phone || '...'),
      createPartyRow('Email', employee.email || '...'),
      createPartyRow('Số tài khoản', employee.bank_account_no || '...'),
      createPartyRow('Ngân hàng', employee.bank_name || '...'),
    ],
  });

  // BẢNG CÔNG VIỆC
  const tableJobsHeader = new TableRow({
    children: [
      new TableCell({
        width: { size: 6, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        margins: cellMargins,
        shading: { fill: 'F2F4F8' },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'STT', bold: true, size: 21, font: 'Times New Roman' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 34, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        margins: cellMargins,
        shading: { fill: 'F2F4F8' },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Nội dung công việc (Job/PO)', bold: true, size: 21, font: 'Times New Roman' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 12, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        margins: cellMargins,
        shading: { fill: 'F2F4F8' },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Đơn vị tính', bold: true, size: 21, font: 'Times New Roman' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 14, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        margins: cellMargins,
        shading: { fill: 'F2F4F8' },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Ngày làm', bold: true, size: 21, font: 'Times New Roman' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 8, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        margins: cellMargins,
        shading: { fill: 'F2F4F8' },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'SL', bold: true, size: 21, font: 'Times New Roman' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 13, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        margins: cellMargins,
        shading: { fill: 'F2F4F8' },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Đơn giá (VNĐ)', bold: true, size: 21, font: 'Times New Roman' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 13, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        margins: cellMargins,
        shading: { fill: 'F2F4F8' },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Thành tiền (VNĐ)', bold: true, size: 21, font: 'Times New Roman' })],
          }),
        ],
      }),
    ],
  });

  const tableJobsRows = jobs.map(
    (job, idx) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 6, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            margins: cellMargins,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `${idx + 1}`, size: 21, font: 'Times New Roman' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            margins: cellMargins,
            children: [
              new Paragraph({
                children: [new TextRun({ text: job.job_title, size: 21, font: 'Times New Roman' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            margins: cellMargins,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: job.unit || 'Gói', size: 21, font: 'Times New Roman' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 14, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            margins: cellMargins,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: formatDateVN(job.work_date), size: 21, font: 'Times New Roman' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            margins: cellMargins,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `${job.quantity || 1}`, size: 21, font: 'Times New Roman' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 13, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            margins: cellMargins,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: formatVND(job.unit_price), size: 21, font: 'Times New Roman' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 13, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            margins: cellMargins,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: formatVND(job.total_amount), bold: true, size: 21, font: 'Times New Roman' })],
              }),
            ],
          }),
        ],
      })
  );

  const tableJobs = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [tableJobsHeader, ...tableJobsRows],
  });

  // BẢNG CHỮ KÝ 2 BÊN
  const tableSignatures = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderNone,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 30 },
                children: [new TextRun({ text: 'ĐẠI DIỆN BÊN A', bold: true, size: 24, font: 'Times New Roman' })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 1200 },
                children: [new TextRun({ text: '(Ký duyệt và đóng dấu)', italics: true, size: 20, font: 'Times New Roman' })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'NGÔ HỮU THẾ', bold: true, size: 24, font: 'Times New Roman' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 30 },
                children: [new TextRun({ text: 'ĐẠI DIỆN BÊN B', bold: true, size: 24, font: 'Times New Roman' })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 1200 },
                children: [new TextRun({ text: '(Ký xác nhận và ghi rõ họ tên)', italics: true, size: 20, font: 'Times New Roman' })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: (employee.full_name || '').toUpperCase(), bold: true, size: 24, font: 'Times New Roman' })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          // QUỐC HIỆU - TIÊU NGỮ
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, size: 24, font: 'Times New Roman' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', bold: true, underline: {}, size: 26, font: 'Times New Roman' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 150 },
            children: [new TextRun({ text: '---------------', font: 'Times New Roman' })],
          }),

          // TIÊU ĐỀ
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'ĐƠN ĐẶT HÀNG & GIAO VIỆC DỰ ÁN',
                bold: true,
                size: 28,
                font: 'Times New Roman',
                color: '1E40AF',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 150 },
            children: [
              new TextRun({
                text: `Mã đơn: ${po.po_code}  |  Ngày phát hành: ${formatDateVN(po.issue_date)}`,
                italics: true,
                bold: true,
                size: 22,
                font: 'Times New Roman',
              }),
            ],
          }),

          // BÊN A
          new Paragraph({
            spacing: { before: 100, after: 40 },
            children: [new TextRun({ text: '1. ĐƠN VỊ ĐIỀU HÀNH DỰ ÁN (BÊN A):', bold: true, size: 24, font: 'Times New Roman' })],
          }),
          tableBenA,

          // BÊN B
          new Paragraph({
            spacing: { before: 120, after: 40 },
            children: [new TextRun({ text: '2. NHÂN SỰ NHẬN VIỆC (BÊN B):', bold: true, size: 24, font: 'Times New Roman' })],
          }),
          tableBenB,

          // DANH MỤC CÔNG VIỆC
          new Paragraph({
            spacing: { before: 150, after: 80 },
            children: [new TextRun({ text: '3. DANH MỤC CÔNG VIỆC VÀ ĐƠN GIÁ THEO ĐƠN PO:', bold: true, size: 24, font: 'Times New Roman' })],
          }),
          tableJobs,

          // TỔNG TIỀN
          new Paragraph({
            spacing: { before: 180, after: 60 },
            children: [
              new TextRun({ text: 'TỔNG GIÁ TRỊ ĐƠN ĐẶT HÀNG (PO): ', bold: true, size: 24, font: 'Times New Roman' }),
              new TextRun({ text: formatVND(po.total_amount), bold: true, size: 26, font: 'Times New Roman', color: '1E40AF' }),
            ],
          }),

          ...(po.notes
            ? [
                new Paragraph({
                  spacing: { after: 150 },
                  children: [
                    new TextRun({ text: 'Ghi chú thêm: ', bold: true, font: 'Times New Roman', size: 22 }),
                    new TextRun({ text: po.notes, italics: true, font: 'Times New Roman', size: 22 }),
                  ],
                }),
              ]
            : []),

          new Paragraph({
            spacing: { before: 100, after: 180 },
            children: [
              new TextRun({
                text: 'Đơn đặt hàng này được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 (bản) để thực hiện.',
                italics: true,
                font: 'Times New Roman',
                size: 22,
              }),
            ],
          }),

          tableSignatures,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = (employee.full_name || 'Nhan_su').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Don_dat_hang_PO_${po.po_code}_${safeName}.docx`;
  saveAs(blob, fileName);
}

/**
 * Xuất đơn PO ra PDF chuẩn in A4 chất lượng cao
 */
export function exportPOPDF(po: PurchaseOrder, employee: Employee, jobs: Job[]): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Vui lòng cho phép mở popup trong trình duyệt để xuất PDF.');
    return;
  }

  const jobsHtml = jobs
    .map(
      (job, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${job.job_title}</td>
        <td style="text-align: center;">${job.unit || 'Gói'}</td>
        <td style="text-align: center;">${formatDateVN(job.work_date)}</td>
        <td style="text-align: center;">${job.quantity || 1}</td>
        <td style="text-align: right;">${formatVND(job.unit_price)}</td>
        <td style="text-align: right; font-weight: bold;">${formatVND(job.total_amount)}</td>
      </tr>
    `
    )
    .join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>Đơn đặt hàng & Giao việc PO - ${po.po_code} - ${employee.full_name}</title>
      <style>
        @page { size: A4; margin: 18mm 16mm; }
        body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.4; color: #000; margin: 0; padding: 10px; }
        .header { text-align: center; margin-bottom: 12px; }
        .national-title { font-size: 12pt; font-weight: bold; }
        .motto { font-size: 13pt; font-weight: bold; text-decoration: underline; margin-top: 2px; }
        .divider { margin: 6px auto; width: 140px; border-top: 1px solid #000; }
        .doc-title { font-size: 15pt; font-weight: bold; text-align: center; margin-top: 10px; color: #1e40af; }
        .po-code { font-size: 11.5pt; font-style: italic; font-weight: bold; text-align: center; margin-bottom: 15px; }
        .section-title { font-size: 12pt; font-weight: bold; margin-top: 12px; margin-bottom: 4px; }
        .party-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 11pt; }
        .party-table td { border: none; padding: 2px 0; vertical-align: top; }
        .party-label { width: 28%; }
        .party-value { width: 72%; }
        table.data-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11pt; }
        table.data-table th, table.data-table td { border: 1px solid #333; padding: 5px 6px; }
        table.data-table th { background-color: #f1f5f9; font-weight: bold; text-align: center; }
        .summary-box { margin-top: 12px; padding: 10px; background-color: #f8fafc; border: 1px dashed #94a3b8; font-size: 12pt; }
        .signature-table { width: 100%; margin-top: 24px; border-collapse: collapse; }
        .signature-table td { border: none; text-align: center; vertical-align: top; width: 50%; font-size: 12pt; }
        .signature-space { height: 75px; }
        @media print { body { padding: 0; } .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="national-title">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
        <div class="motto">Độc lập - Tự do - Hạnh phúc</div>
        <div class="divider"></div>
        <div class="doc-title">ĐƠN ĐẶT HÀNG & GIAO VIỆC DỰ ÁN (PURCHASE ORDER)</div>
        <div class="po-code">Mã đơn: ${po.po_code} | Ngày phát hành: ${formatDateVN(po.issue_date)}</div>
      </div>

      <div class="section-title">1. Đơn vị điều hành dự án (Bên A):</div>
      <table class="party-table">
        <tr>
          <td class="party-label"><strong>BÊN A</strong></td>
          <td class="party-value">: <strong>CÔNG TY CỔ PHẦN TRUYỀN THÔNG TOGOO</strong></td>
        </tr>
        <tr>
          <td class="party-label">Địa chỉ trụ sở</td>
          <td class="party-value">: 64 phố Dương Khuê, Phường Từ Liêm, Thành phố Hà Nội, Việt Nam</td>
        </tr>
        <tr>
          <td class="party-label">Mã số thuế</td>
          <td class="party-value">: 0109656311</td>
        </tr>
        <tr>
          <td class="party-label">Đại diện</td>
          <td class="party-value">: <strong>Ông NGÔ HỮU THẾ</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Chức vụ : <strong>Tổng Giám đốc</strong></td>
        </tr>
        <tr>
          <td class="party-label">Số điện thoại</td>
          <td class="party-value">: 0964221233</td>
        </tr>
        <tr>
          <td class="party-label">Email</td>
          <td class="party-value">: Togoomedia@gmail.com</td>
        </tr>
        <tr>
          <td class="party-label">Số tài khoản</td>
          <td class="party-value">: 2228886666686 — Ngân hàng TMCP Quân Đội – MB Bank</td>
        </tr>
      </table>

      <div class="section-title">2. Nhân sự nhận việc (Bên B):</div>
      <table class="party-table">
        <tr>
          <td class="party-label"><strong>BÊN B</strong></td>
          <td class="party-value">: <strong>${(employee.full_name || '...').toUpperCase()}</strong></td>
        </tr>
        <tr>
          <td class="party-label">Số CCCD</td>
          <td class="party-value">: ${employee.id_card_no || '—'}</td>
        </tr>
        <tr>
          <td class="party-label">Điện thoại</td>
          <td class="party-value">: ${employee.phone || '—'}</td>
        </tr>
        <tr>
          <td class="party-label">Email</td>
          <td class="party-value">: ${employee.email || '—'}</td>
        </tr>
        <tr>
          <td class="party-label">Tài khoản ngân hàng</td>
          <td class="party-value">: ${employee.bank_account_no || '—'} tại ${employee.bank_name || '—'}</td>
        </tr>
      </table>

      <div class="section-title">3. Danh mục công việc và đơn giá theo đơn PO:</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 5%;">STT</th>
            <th>Nội dung công việc</th>
            <th style="width: 10%;">ĐVT</th>
            <th style="width: 12%;">Ngày làm</th>
            <th style="width: 8%;">SL</th>
            <th style="width: 15%;">Đơn giá</th>
            <th style="width: 15%;">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          ${jobsHtml}
        </tbody>
      </table>

      <div class="summary-box">
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>TỔNG GIÁ TRỊ ĐƠN HÀNG (PO):</span>
          <span style="color: #1e40af; font-size: 13pt;">${formatVND(po.total_amount)}</span>
        </div>
        ${po.notes ? `<div style="font-size: 11pt; color: #475569; margin-top: 4px;"><em>Ghi chú: ${po.notes}</em></div>` : ''}
      </div>

      <div style="font-style: italic; margin-top: 10px; font-size: 11pt;">
        Đơn đặt hàng này được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 (bản) để thực hiện.
      </div>

      <table class="signature-table">
        <tr>
          <td>
            <strong>ĐẠI DIỆN BÊN A</strong><br>
            <em>(Ký duyệt và đóng dấu)</em>
            <div class="signature-space"></div>
            <strong>NGÔ HỮU THẾ</strong>
          </td>
          <td>
            <strong>ĐẠI DIỆN BÊN B</strong><br>
            <em>(Ký xác nhận và ghi rõ họ tên)</em>
            <div class="signature-space"></div>
            <strong>${(employee.full_name || '').toUpperCase()}</strong>
          </td>
        </tr>
      </table>

      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
