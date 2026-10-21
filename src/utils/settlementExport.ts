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
import dayjs from 'dayjs';
import type { EmployeeSettlementSummary } from '../types';
import { generateContractCode, removeVietnameseDiacriticsAndSpaces } from './contractExport';
import { formatDateVN } from './formatters';

/**
 * Loại bỏ dấu tiếng Việt giữ khoảng trắng và in hoa
 * Ví dụ: "Đỗ Tràng Tiến" -> "DO TRANG TIEN"
 */
export function removeVietnameseDiacritics(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Đọc số tiền thành chữ tiếng Việt chuẩn kế toán
 * Ví dụ:
 *  14130000 -> "Mười bốn triệu một trăm ba mươi nghìn"
 *  15700000 -> "Mười lăm triệu bảy trăm nghìn"
 *  1500000  -> "Một triệu năm trăm nghìn"
 */
export function numberToVietnameseWords(num: number): string {
  if (!num || isNaN(num) || num <= 0) return 'Không';

  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

  function readThreeDigits(n: number, isHighest: boolean): string {
    const hundreds = Math.floor(n / 100);
    const tens = Math.floor((n % 100) / 10);
    const ones = n % 10;
    let res = '';

    if (hundreds > 0 || !isHighest) {
      res += digits[hundreds] + ' trăm ';
    }

    if (tens > 1) {
      res += digits[tens] + ' mươi ';
      if (ones === 1) res += 'mốt ';
      else if (ones === 5) res += 'lăm ';
      else if (ones > 0) res += digits[ones] + ' ';
    } else if (tens === 1) {
      res += 'mười ';
      if (ones === 5) res += 'lăm ';
      else if (ones > 0) res += digits[ones] + ' ';
    } else {
      if (ones > 0) {
        if (hundreds > 0 || !isHighest) {
          res += 'lẻ ' + digits[ones] + ' ';
        } else {
          res += digits[ones] + ' ';
        }
      }
    }
    return res.trim();
  }

  const integerPart = Math.floor(Math.abs(num));
  if (integerPart === 0) return 'Không';

  let n = integerPart;
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }

  let result = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    const grp = groups[i];
    if (grp > 0) {
      const read = readThreeDigits(grp, i === groups.length - 1);
      const unit = units[i];
      result += (read ? read + ' ' : '') + (unit ? unit + ' ' : '');
    }
  }

  result = result.trim();
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Định dạng số với dấu chấm phân cách hàng nghìn (không kèm đơn vị tiền tệ)
 */
function formatNumber(val?: number | null): string {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return new Intl.NumberFormat('vi-VN').format(val);
}

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

/**
 * Tạo đoạn văn bản chuẩn Times New Roman
 */
function pText(
  text: string,
  options?: {
    bold?: boolean;
    italics?: boolean;
    underline?: boolean;
    size?: number; // half-points: 23 = 11.5pt, 24 = 12pt, 26 = 13pt, 28 = 14pt
    spacingBefore?: number;
    spacingAfter?: number;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    indent?: number;
  }
): Paragraph {
  return new Paragraph({
    alignment: options?.alignment || AlignmentType.LEFT,
    indent: options?.indent ? { left: options.indent } : undefined,
    spacing: {
      before: options?.spacingBefore ?? 40,
      after: options?.spacingAfter ?? 40,
      line: 260,
    },
    children: [
      new TextRun({
        text,
        bold: options?.bold ?? false,
        italics: options?.italics ?? false,
        underline: options?.underline ? {} : undefined,
        size: options?.size ?? 23,
        font: 'Times New Roman',
      }),
    ],
  });
}

/**
 * Tạo hàng thông tin 2 cột không viền (Bên A / Bên B)
 */
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
 * Tạo TableCell cho bảng dữ liệu có viền
 */
function createTableCell(
  content: string,
  widthPercent: number,
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
  bold: boolean = false,
  shadingColor?: string
): TableCell {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    margins: cellMargins,
    shading: shadingColor ? { fill: shadingColor } : undefined,
    children: [
      new Paragraph({
        alignment,
        spacing: { before: 20, after: 20, line: 240 },
        children: [
          new TextRun({
            text: content,
            bold,
            size: 21,
            font: 'Times New Roman',
          }),
        ],
      }),
    ],
  });
}

/**
 * Xuất Biên bản nghiệm thu sản phẩm và quyết toán thù lao tháng sang file Word (.docx)
 */
export async function exportSettlementWord(
  summary: EmployeeSettlementSummary,
  customStt?: number
): Promise<void> {
  const { employee, month, year, items, totalIncome, taxDeduction } = summary;

  // 1. Xác định số thứ tự STT
  const stt = customStt || summary.stt || 1;
  const sttStr = String(stt).padStart(2, '0');
  const mmStr = String(month).padStart(2, '0');

  // 2. Sinh số Biên bản và số Hợp đồng khung
  const settlementNo = `${sttStr}/BBNT-QT-${mmStr}${year}`;
  const contractCode = generateContractCode(stt, employee.full_name);
  const contractDate = employee.contract_start_date
    ? dayjs(employee.contract_start_date).format('DD/MM/YYYY')
    : '...../...../.....';

  // 3. Tính toán các giá trị tài chính theo đúng quy tắc
  // Thực nhận NET = Gross - Thuế (TUYỆT ĐỐI KHÔNG trừ số tiền đã thanh toán)
  const netIncome = Math.max(0, totalIncome - taxDeduction);
  const wordsAmount = numberToVietnameseWords(netIncome);

  // 4. Ngày cuối tháng
  const lastDayOfMonth = dayjs(`${year}-${mmStr}-01`).endOf('month').format('DD/MM/YYYY');

  // 5. Chủ tài khoản ngân hàng (viết hoa không dấu chuẩn ngân hàng)
  const accountHolderName = removeVietnameseDiacritics(employee.full_name) || employee.full_name.toUpperCase();

  // BẢNG BÊN A (Cố định)
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
      createPartyRow('Số tài khoản ngân hàng', '2228886666686'),
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
      createPartyRow('Ngày cấp', employee.id_card_issue_date ? formatDateVN(employee.id_card_issue_date) : '...'),
      createPartyRow('Nơi cấp', employee.id_card_issue_place || 'Cục Cảnh sát Quản lý Hành chính về Trật tự Xã hội'),
      createPartyRow('Sinh ngày', employee.dob ? formatDateVN(employee.dob) : '...'),
      createPartyRow(
        'Địa chỉ thường trú',
        (employee as any).permanent_address || (employee as any).address || '...'
      ),
      createPartyRow('Số điện thoại', employee.phone || '...'),
      createPartyRow('Email', employee.email || '...'),
      createPartyRow('Số tài khoản ngân hàng', employee.bank_account_no || '...'),
      createPartyRow('Ngân hàng thụ hưởng', employee.bank_name || '...'),
    ],
  });

  // MỤC 1: BẢNG NGHIỆM THU CÔNG VIỆC TRONG THÁNG
  const tableJobsHeader = new TableRow({
    children: [
      createTableCell('STT', 6, AlignmentType.CENTER, true, 'F2F4F8'),
      createTableCell('Hạng mục công việc / Sản phẩm bàn giao', 29, AlignmentType.CENTER, true, 'F2F4F8'),
      createTableCell('Thời gian thực hiện công việc', 14, AlignmentType.CENTER, true, 'F2F4F8'),
      createTableCell('Đơn vị', 8, AlignmentType.CENTER, true, 'F2F4F8'),
      createTableCell('Số lượng', 7, AlignmentType.CENTER, true, 'F2F4F8'),
      createTableCell('Đơn giá', 12, AlignmentType.CENTER, true, 'F2F4F8'),
      createTableCell('Thành tiền', 12, AlignmentType.CENTER, true, 'F2F4F8'),
      createTableCell('Đánh giá chất lượng', 12, AlignmentType.CENTER, true, 'F2F4F8'),
    ],
  });

  const tableJobsRows = items.map(
    (item, idx) =>
      new TableRow({
        children: [
          createTableCell(`${idx + 1}`, 6, AlignmentType.CENTER),
          createTableCell(item.job_title || '—', 29, AlignmentType.LEFT),
          createTableCell(formatDateVN(item.work_date), 14, AlignmentType.CENTER),
          createTableCell(item.unit || 'Gói', 8, AlignmentType.CENTER),
          createTableCell(`${item.quantity || 1}`, 7, AlignmentType.CENTER),
          createTableCell(formatNumber(item.unit_price), 12, AlignmentType.RIGHT),
          createTableCell(formatNumber(item.total_amount), 12, AlignmentType.RIGHT),
          createTableCell('Đạt yêu cầu', 12, AlignmentType.CENTER),
        ],
      })
  );

  const tableJobs = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [tableJobsHeader, ...tableJobsRows],
  });

  // MỤC 2: BẢNG QUYẾT TOÁN THÙ LAO THÁNG
  const tableSettlementHeader = new TableRow({
    children: [
      createTableCell('STT', 8, AlignmentType.CENTER, true, 'F2F4F8'),
      createTableCell('Nội dung chi tiết', 48, AlignmentType.CENTER, true, 'F2F4F8'),
      createTableCell('Số tiền (VNĐ)', 22, AlignmentType.CENTER, true, 'F2F4F8'),
      createTableCell('Ghi chú', 22, AlignmentType.CENTER, true, 'F2F4F8'),
    ],
  });

  const tableSettlement = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      tableSettlementHeader,
      // Dòng 1: Tổng thu nhập phát sinh trong tháng
      new TableRow({
        children: [
          createTableCell('1', 8, AlignmentType.CENTER),
          createTableCell(`Tổng thu nhập phát sinh trong tháng ${mmStr}`, 48, AlignmentType.LEFT),
          createTableCell(formatNumber(totalIncome), 22, AlignmentType.RIGHT),
          createTableCell('', 22, AlignmentType.LEFT),
        ],
      }),
      // Dòng 2: Khoản thưởng / Thưởng hiệu suất (nếu có)
      new TableRow({
        children: [
          createTableCell('2', 8, AlignmentType.CENTER),
          createTableCell('Khoản thưởng / Thưởng hiệu suất (nếu có)', 48, AlignmentType.LEFT),
          createTableCell('-', 22, AlignmentType.CENTER),
          createTableCell('', 22, AlignmentType.LEFT),
        ],
      }),
      // Dòng 3: Khoản giảm trừ / Phạt (nếu có)
      new TableRow({
        children: [
          createTableCell('3', 8, AlignmentType.CENTER),
          createTableCell('Khoản giảm trừ / Phạt (nếu có)', 48, AlignmentType.LEFT),
          createTableCell('-', 22, AlignmentType.CENTER),
          createTableCell('', 22, AlignmentType.LEFT),
        ],
      }),
      // Dòng 4: TỔNG THU NHẬP GROSS (1 + 2 - 3)
      new TableRow({
        children: [
          createTableCell('4', 8, AlignmentType.CENTER, true),
          createTableCell('TỔNG THU NHẬP GROSS (1 + 2 - 3)', 48, AlignmentType.LEFT, true),
          createTableCell(formatNumber(totalIncome), 22, AlignmentType.RIGHT, true),
          createTableCell('', 22, AlignmentType.LEFT),
        ],
      }),
      // Dòng 5: Thuế TNCN khấu trừ tạm tính (10%)
      new TableRow({
        children: [
          createTableCell('5', 8, AlignmentType.CENTER),
          createTableCell('Thuế TNCN khấu trừ tạm tính (10%)', 48, AlignmentType.LEFT),
          createTableCell(taxDeduction > 0 ? formatNumber(taxDeduction) : '-', 22, taxDeduction > 0 ? AlignmentType.RIGHT : AlignmentType.CENTER),
          createTableCell(taxDeduction > 0 ? 'Bên A nộp hộ ngân sách Nhà nước' : '', 22, AlignmentType.LEFT),
        ],
      }),
      // Dòng 6: Số tiền Bên A đã tạm ứng trong tháng
      new TableRow({
        children: [
          createTableCell('6', 8, AlignmentType.CENTER),
          createTableCell('Số tiền Bên A đã tạm ứng trong tháng', 48, AlignmentType.LEFT),
          createTableCell('-', 22, AlignmentType.CENTER),
          createTableCell('', 22, AlignmentType.LEFT),
        ],
      }),
      // Dòng 7: THỰC NHẬN (NET) (4 - 5 - 6)
      new TableRow({
        children: [
          createTableCell('7', 8, AlignmentType.CENTER, true),
          createTableCell('THỰC NHẬN (NET) (4 - 5 - 6)', 48, AlignmentType.LEFT, true),
          createTableCell(formatNumber(netIncome), 22, AlignmentType.RIGHT, true),
          createTableCell('', 22, AlignmentType.LEFT),
        ],
      }),
    ],
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
                children: [
                  new TextRun({
                    text: 'ĐẠI DIỆN BÊN A',
                    bold: true,
                    size: 24,
                    font: 'Times New Roman',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 1200 },
                children: [
                  new TextRun({
                    text: '(Ký và ghi rõ họ tên)',
                    italics: true,
                    size: 20,
                    font: 'Times New Roman',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'NGÔ HỮU THẾ',
                    bold: true,
                    size: 24,
                    font: 'Times New Roman',
                  }),
                ],
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
                children: [
                  new TextRun({
                    text: 'ĐẠI DIỆN BÊN B',
                    bold: true,
                    size: 24,
                    font: 'Times New Roman',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 1200 },
                children: [
                  new TextRun({
                    text: '(Ký và ghi rõ họ tên)',
                    italics: true,
                    size: 20,
                    font: 'Times New Roman',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: (employee.full_name || '').toUpperCase(),
                    bold: true,
                    size: 24,
                    font: 'Times New Roman',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // TẠO TÀI LIỆU DOCX
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
          pText('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', {
            bold: true,
            size: 24,
            alignment: AlignmentType.CENTER,
            spacingBefore: 0,
            spacingAfter: 30,
          }),
          pText('Độc lập - Tự do - Hạnh phúc', {
            bold: true,
            underline: true,
            size: 26,
            alignment: AlignmentType.CENTER,
            spacingBefore: 0,
            spacingAfter: 30,
          }),
          pText('---------------', {
            alignment: AlignmentType.CENTER,
            spacingBefore: 0,
            spacingAfter: 80,
          }),

          // NGÀY THÁNG
          pText(`Hà Nội, ngày ...... tháng ...... năm ${year}`, {
            italics: true,
            alignment: AlignmentType.RIGHT,
            spacingAfter: 120,
          }),

          // TIÊU ĐỀ BIÊN BẢN
          pText(`BIÊN BẢN NGHIỆM THU SẢN PHẨM VÀ QUYẾT TOÁN THÙ LAO THÁNG ${month}`, {
            bold: true,
            size: 28,
            alignment: AlignmentType.CENTER,
            spacingBefore: 100,
            spacingAfter: 40,
          }),
          pText(`Số: ${settlementNo}`, {
            bold: true,
            alignment: AlignmentType.CENTER,
            spacingAfter: 120,
          }),

          // CĂN CỨ HỢP ĐỒNG
          pText(
            `- Căn cứ Hợp đồng dịch vụ số: ${contractCode} ký ngày ${contractDate} giữa Công ty Cổ phần Truyền thông TOGOO và Ông/Bà ${employee.full_name}`,
            { italics: true, spacingAfter: 100 }
          ),

          pText('Hôm nay, chúng tôi gồm có:', {
            italics: true,
            spacingAfter: 60,
          }),

          // THÔNG TIN BÊN A
          tableBenA,

          // NGĂN CÁCH
          pText('Và', {
            bold: true,
            italics: true,
            spacingBefore: 60,
            spacingAfter: 60,
          }),

          // THÔNG TIN BÊN B
          tableBenB,

          // MỤC 1: NỘI DUNG NGHIỆM THU CÔNG VIỆC
          pText(`1. Nội dung nghiệm thu công việc tháng ${month}`, {
            bold: true,
            size: 24,
            spacingBefore: 160,
            spacingAfter: 40,
          }),
          pText(
            `Hai bên tiến hành kiểm tra, đánh giá khối lượng và chất lượng các sản phẩm/đầu việc đã thực hiện trong thời gian từ ngày 01/${mmStr}/${year} đến hết ngày ${lastDayOfMonth} :`,
            { italics: true, spacingAfter: 80 }
          ),
          tableJobs,

          // MỤC 2: NỘI DUNG QUYẾT TOÁN THÙ LAO
          pText(`2. Nội dung quyết toán thù lao tháng ${month}`, {
            bold: true,
            size: 24,
            spacingBefore: 160,
            spacingAfter: 40,
          }),
          pText(
            `Dựa trên bảng nghiệm thu sản phẩm ở Mục 1, hai bên thống nhất bảng quyết toán chi trả thu nhập tháng ${mmStr}/${year} như sau:`,
            { italics: true, spacingAfter: 80 }
          ),
          tableSettlement,

          // SỐ TIỀN BẰNG CHỮ
          pText(`(Số tiền thực bằng chữ: ${wordsAmount} đồng)`, {
            bold: true,
            italics: true,
            spacingBefore: 80,
            spacingAfter: 140,
          }),

          // MỤC 3: PHƯƠNG THỨC THANH TOÁN
          pText('3. Phương thức thanh toán', {
            bold: true,
            size: 24,
            spacingBefore: 120,
            spacingAfter: 40,
          }),
          pText(
            'Bên A cam kết chuyển khoản toàn bộ số tiền còn lại ở Điều 2 vào tài khoản của Bên B:',
            { spacingAfter: 40 }
          ),
          pText(`Chủ tài khoản: ${accountHolderName}`, {
            bold: true,
            indent: 360,
            spacingAfter: 30,
          }),
          pText(
            `Số tài khoản: ${employee.bank_account_no || '...'} — Ngân hàng: ${employee.bank_name || '...'}`,
            { indent: 360, spacingAfter: 120 }
          ),

          // MỤC 4: KẾT LUẬN CỦA BÊN A
          pText('4. Kết luận của Bên A', {
            bold: true,
            size: 24,
            spacingBefore: 120,
            spacingAfter: 40,
          }),
          pText(
            '- Bên A xác nhận đã kiểm tra, tiếp nhận đầy đủ số lượng và đồng ý với chất lượng của các sản phẩm được liệt kê tại Mục 1.',
            { spacingAfter: 30 }
          ),
          pText(
            '- Toàn bộ sản phẩm bàn giao đều đạt tiêu chuẩn kỹ thuật hình ảnh/âm thanh, đúng nội dung kịch bản thông qua và đáp ứng đầy đủ yêu cầu của dự án.',
            { spacingAfter: 30 }
          ),
          pText(
            `- Bên A đồng ý nghiệm thu toàn phần đối với dự án này. Biên bản nghiệm thu này sẽ làm cơ sở để hai bên tiến hành các thủ tục quyết toán chi phí và thanh toán thù lao theo quy định của Hợp đồng số ${contractCode}.`,
            { spacingAfter: 40 }
          ),
          pText(
            'Biên bản này được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 (bản) để lưu hồ sơ.',
            { italics: true, spacingAfter: 180 }
          ),

          // BẢNG CHỮ KÝ
          tableSignatures,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = removeVietnameseDiacriticsAndSpaces(employee.full_name) || 'Nhan_su';
  const fileName = `Bien_ban_nghiem_thu_${safeName}_Thang_${mmStr}_${year}.docx`;
  saveAs(blob, fileName);
}

/**
 * Xuất Biên bản nghiệm thu và quyết toán ra PDF chuẩn in A4 chất lượng cao
 */
export function exportSettlementPDF(
  summary: EmployeeSettlementSummary,
  customStt?: number
): void {
  const { employee, month, year, items, totalIncome, taxDeduction } = summary;

  const stt = customStt || summary.stt || 1;
  const sttStr = String(stt).padStart(2, '0');
  const mmStr = String(month).padStart(2, '0');
  const settlementNo = `${sttStr}/BBNT-QT-${mmStr}${year}`;
  const contractCode = generateContractCode(stt, employee.full_name);
  const contractDate = employee.contract_start_date
    ? dayjs(employee.contract_start_date).format('DD/MM/YYYY')
    : '...../...../.....';

  const netIncome = Math.max(0, totalIncome - taxDeduction);
  const wordsAmount = numberToVietnameseWords(netIncome);
  const lastDayOfMonth = dayjs(`${year}-${mmStr}-01`).endOf('month').format('DD/MM/YYYY');
  const accountHolderName = removeVietnameseDiacritics(employee.full_name) || employee.full_name.toUpperCase();

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Vui lòng cho phép mở popup trong trình duyệt để xuất PDF.');
    return;
  }

  const itemsHtml = items
    .map(
      (item, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${item.job_title}</td>
        <td style="text-align: center;">${formatDateVN(item.work_date)}</td>
        <td style="text-align: center;">${item.unit || 'Gói'}</td>
        <td style="text-align: center;">${item.quantity || 1}</td>
        <td style="text-align: right;">${formatNumber(item.unit_price)}</td>
        <td style="text-align: right; font-weight: 600;">${formatNumber(item.total_amount)}</td>
        <td style="text-align: center;">Đạt yêu cầu</td>
      </tr>
    `
    )
    .join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>Biên bản nghiệm thu & quyết toán - ${employee.full_name} (Tháng ${month}/${year})</title>
      <style>
        @page {
          size: A4;
          margin: 18mm 16mm;
        }
        body {
          font-family: 'Times New Roman', Times, serif;
          font-size: 12.5pt;
          line-height: 1.4;
          color: #000;
          margin: 0;
          padding: 10px;
        }
        .header {
          text-align: center;
          margin-bottom: 12px;
        }
        .national-title {
          font-size: 12pt;
          font-weight: bold;
        }
        .motto {
          font-size: 13pt;
          font-weight: bold;
          text-decoration: underline;
          margin-top: 2px;
        }
        .divider {
          margin: 6px auto;
          width: 140px;
          border-top: 1px solid #000;
        }
        .date-line {
          text-align: right;
          font-style: italic;
          font-size: 11.5pt;
          margin-bottom: 12px;
        }
        .doc-title {
          font-size: 14pt;
          font-weight: bold;
          text-align: center;
          margin-top: 10px;
          text-transform: uppercase;
        }
        .doc-no {
          font-size: 11.5pt;
          font-weight: bold;
          text-align: center;
          margin-bottom: 14px;
        }
        .legal-basis {
          font-style: italic;
          margin-bottom: 12px;
          font-size: 11.5pt;
        }
        .party-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 8px;
        }
        .party-table td {
          border: none;
          padding: 2px 0;
          vertical-align: top;
          font-size: 11.5pt;
        }
        .party-label {
          width: 28%;
        }
        .party-value {
          width: 72%;
        }
        .section-title {
          font-size: 12pt;
          font-weight: bold;
          margin-top: 14px;
          margin-bottom: 4px;
        }
        .section-desc {
          font-style: italic;
          font-size: 11.5pt;
          margin-bottom: 8px;
        }
        table.data-table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0;
          font-size: 11pt;
        }
        table.data-table th, table.data-table td {
          border: 1px solid #000;
          padding: 5px 6px;
        }
        table.data-table th {
          background-color: #f2f4f8;
          font-weight: bold;
          text-align: center;
        }
        .words-line {
          font-weight: bold;
          font-style: italic;
          font-size: 11.5pt;
          margin-top: 6px;
          margin-bottom: 12px;
        }
        .signature-table {
          width: 100%;
          margin-top: 24px;
          border-collapse: collapse;
        }
        .signature-table td {
          border: none;
          text-align: center;
          vertical-align: top;
          width: 50%;
          font-size: 12pt;
        }
        .signature-space {
          height: 75px;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="national-title">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
        <div class="motto">Độc lập - Tự do - Hạnh phúc</div>
        <div class="divider"></div>
      </div>

      <div class="date-line">Hà Nội, ngày ...... tháng ...... năm ${year}</div>

      <div class="doc-title">BIÊN BẢN NGHIỆM THU SẢN PHẨM VÀ QUYẾT TOÁN THÙ LAO THÁNG ${month}</div>
      <div class="doc-no">Số: ${settlementNo}</div>

      <div class="legal-basis">
        - Căn cứ Hợp đồng dịch vụ số: <strong>${contractCode}</strong> ký ngày ${contractDate} giữa Công ty Cổ phần Truyền thông TOGOO và Ông/Bà <strong>${employee.full_name}</strong><br>
        Hôm nay, chúng tôi gồm có:
      </div>

      <!-- BÊN A -->
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
          <td class="party-label">Số tài khoản ngân hàng</td>
          <td class="party-value">: 2228886666686</td>
        </tr>
        <tr>
          <td class="party-label">Ngân hàng thụ hưởng</td>
          <td class="party-value">: Ngân hàng TMCP Quân Đội – MB Bank</td>
        </tr>
      </table>

      <div style="font-weight: bold; font-style: italic; margin: 4px 0;">Và</div>

      <!-- BÊN B -->
      <table class="party-table">
        <tr>
          <td class="party-label"><strong>BÊN B</strong></td>
          <td class="party-value">: <strong>${(employee.full_name || '...').toUpperCase()}</strong></td>
        </tr>
        <tr>
          <td class="party-label">Số CMND/CCCD</td>
          <td class="party-value">: ${employee.id_card_no || '...'}</td>
        </tr>
        <tr>
          <td class="party-label">Ngày cấp</td>
          <td class="party-value">: ${employee.id_card_issue_date ? formatDateVN(employee.id_card_issue_date) : '...'}</td>
        </tr>
        <tr>
          <td class="party-label">Nơi cấp</td>
          <td class="party-value">: ${employee.id_card_issue_place || 'Cục Cảnh sát Quản lý Hành chính về Trật tự Xã hội'}</td>
        </tr>
        <tr>
          <td class="party-label">Sinh ngày</td>
          <td class="party-value">: ${employee.dob ? formatDateVN(employee.dob) : '...'}</td>
        </tr>
        <tr>
          <td class="party-label">Địa chỉ thường trú</td>
          <td class="party-value">: ${(employee as any).permanent_address || (employee as any).address || '...'}</td>
        </tr>
        <tr>
          <td class="party-label">Số điện thoại</td>
          <td class="party-value">: ${employee.phone || '...'}</td>
        </tr>
        <tr>
          <td class="party-label">Email</td>
          <td class="party-value">: ${employee.email || '...'}</td>
        </tr>
        <tr>
          <td class="party-label">Số tài khoản ngân hàng</td>
          <td class="party-value">: ${employee.bank_account_no || '...'}</td>
        </tr>
        <tr>
          <td class="party-label">Ngân hàng thụ hưởng</td>
          <td class="party-value">: ${employee.bank_name || '...'}</td>
        </tr>
      </table>

      <!-- MỤC 1 -->
      <div class="section-title">1. Nội dung nghiệm thu công việc tháng ${month}</div>
      <div class="section-desc">Hai bên tiến hành kiểm tra, đánh giá khối lượng và chất lượng các sản phẩm/đầu việc đã thực hiện trong thời gian từ ngày 01/${mmStr}/${year} đến hết ngày ${lastDayOfMonth} :</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 5%;">STT</th>
            <th style="width: 32%;">Hạng mục công việc / Sản phẩm bàn giao</th>
            <th style="width: 14%;">Thời gian thực hiện</th>
            <th style="width: 8%;">Đơn vị</th>
            <th style="width: 7%;">Số lượng</th>
            <th style="width: 11%;">Đơn giá</th>
            <th style="width: 11%;">Thành tiền</th>
            <th style="width: 12%;">Đánh giá CL</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <!-- MỤC 2 -->
      <div class="section-title">2. Nội dung quyết toán thù lao tháng ${month}</div>
      <div class="section-desc">Dựa trên bảng nghiệm thu sản phẩm ở Mục 1, hai bên thống nhất bảng quyết toán chi trả thu nhập tháng ${mmStr}/${year} như sau:</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 8%;">STT</th>
            <th style="width: 48%;">Nội dung chi tiết</th>
            <th style="width: 22%;">Số tiền (VNĐ)</th>
            <th style="width: 22%;">Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align: center;">1</td>
            <td>Tổng thu nhập phát sinh trong tháng ${mmStr}</td>
            <td style="text-align: right;">${formatNumber(totalIncome)}</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td>Khoản thưởng / Thưởng hiệu suất (nếu có)</td>
            <td style="text-align: center;">-</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">3</td>
            <td>Khoản giảm trừ / Phạt (nếu có)</td>
            <td style="text-align: center;">-</td>
            <td></td>
          </tr>
          <tr style="font-weight: bold; background-color: #fafafa;">
            <td style="text-align: center;">4</td>
            <td>TỔNG THU NHẬP GROSS (1 + 2 - 3)</td>
            <td style="text-align: right;">${formatNumber(totalIncome)}</td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align: center;">5</td>
            <td>Thuế TNCN khấu trừ tạm tính (10%)</td>
            <td style="text-align: ${taxDeduction > 0 ? 'right' : 'center'};">${taxDeduction > 0 ? formatNumber(taxDeduction) : '-'}</td>
            <td>${taxDeduction > 0 ? 'Bên A nộp hộ ngân sách Nhà nước' : ''}</td>
          </tr>
          <tr>
            <td style="text-align: center;">6</td>
            <td>Số tiền Bên A đã tạm ứng trong tháng</td>
            <td style="text-align: center;">-</td>
            <td></td>
          </tr>
          <tr style="font-weight: bold; background-color: #f0fdf4;">
            <td style="text-align: center;">7</td>
            <td>THỰC NHẬN (NET) (4 - 5 - 6)</td>
            <td style="text-align: right; color: #15803d;">${formatNumber(netIncome)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <div class="words-line">(Số tiền thực bằng chữ: ${wordsAmount} đồng)</div>

      <!-- MỤC 3 -->
      <div class="section-title">3. Phương thức thanh toán</div>
      <div>Bên A cam kết chuyển khoản toàn bộ số tiền còn lại ở Điều 2 vào tài khoản của Bên B:</div>
      <div style="margin-left: 20px; margin-top: 4px;">
        <strong>Chủ tài khoản: ${accountHolderName}</strong><br>
        Số tài khoản: <strong>${employee.bank_account_no || '...'}</strong> — Ngân hàng: <strong>${employee.bank_name || '...'}</strong>
      </div>

      <!-- MỤC 4 -->
      <div class="section-title">4. Kết luận của Bên A</div>
      <div>
        - Bên A xác nhận đã kiểm tra, tiếp nhận đầy đủ số lượng và đồng ý với chất lượng của các sản phẩm được liệt kê tại Mục 1.<br>
        - Toàn bộ sản phẩm bàn giao đều đạt tiêu chuẩn kỹ thuật hình ảnh/âm thanh, đúng nội dung kịch bản thông qua và đáp ứng đầy đủ yêu cầu của dự án.<br>
        - Bên A đồng ý nghiệm thu toàn phần đối với dự án này. Biên bản nghiệm thu này sẽ làm cơ sở để hai bên tiến hành các thủ tục quyết toán chi phí và thanh toán thù lao theo quy định của Hợp đồng số <strong>${contractCode}</strong>.<br>
        <em>Biên bản này được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 (bản) để lưu hồ sơ.</em>
      </div>

      <!-- CHỮ KÝ -->
      <table class="signature-table">
        <tr>
          <td>
            <strong>ĐẠI DIỆN BÊN A</strong><br>
            <em>(Ký và ghi rõ họ tên)</em>
            <div class="signature-space"></div>
            <strong>NGÔ HỮU THẾ</strong>
          </td>
          <td>
            <strong>ĐẠI DIỆN BÊN B</strong><br>
            <em>(Ký và ghi rõ họ tên)</em>
            <div class="signature-space"></div>
            <strong>${(employee.full_name || '').toUpperCase()}</strong>
          </td>
        </tr>
      </table>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
