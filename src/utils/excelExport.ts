import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';
import type { EmployeeSettlementSummary } from '../types';

/**
 * Định dạng viền mỏng chuẩn cho ô Excel
 */
const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
};

/**
 * Xuất Bảng kê Quyết toán chi tiết cá nhân theo tháng ra file Excel (.xlsx)
 */
export async function exportPersonalSettlementExcel(
  summary: EmployeeSettlementSummary
): Promise<void> {
  const { employee, month, year, items, totalIncome, taxDeduction } = summary;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Project Settlement System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(`Quyet_toan_T${month}_${year}`, {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });

  // 1. TIÊU ĐỀ CHÍNH
  worksheet.mergeCells('A1:G1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'BẢNG KÊ QUYẾT TOÁN CÔNG VIỆC VÀ THÙ LAO DỰ ÁN';
  titleCell.font = { name: 'Times New Roman', size: 16, bold: true, color: { argb: 'FF1677FF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 32;

  // 2. KỲ QUYẾT TOÁN
  worksheet.mergeCells('A2:G2');
  const subTitleCell = worksheet.getCell('A2');
  subTitleCell.value = `Kỳ quyết toán: Tháng ${month} năm ${year} (Ngày xuất: ${dayjs().format('DD/MM/YYYY')})`;
  subTitleCell.font = { name: 'Times New Roman', size: 11, italic: true };
  subTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // 3. THÔNG TIN NHÂN SỰ
  worksheet.addRow([]);
  worksheet.addRow(['Họ và tên:', employee.full_name, '', 'Số CCCD:', employee.id_card_no || '—']);
  worksheet.addRow([
    'Số điện thoại:',
    employee.phone || '—',
    '',
    'Ngân hàng:',
    `${employee.bank_name || '—'} - STK: ${employee.bank_account_no || '—'}`,
  ]);
  worksheet.addRow([]);

  // Định dạng in đậm cho nhãn thông tin nhân sự
  [4, 5].forEach((rowNum) => {
    const row = worksheet.getRow(rowNum);
    row.getCell(1).font = { bold: true };
    row.getCell(4).font = { bold: true };
  });

  // 4. TIÊU ĐỀ CỘT BẢNG CHI TIẾT
  const headerRow = worksheet.addRow([
    'STT',
    'Ngày làm',
    'Đơn vị tính',
    'Nội dung công việc (Job/PO)',
    'Số lượng',
    'Đơn giá (VNĐ)',
    'Thành tiền (VNĐ)',
  ]);
  headerRow.height = 26;

  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' }, // Xanh dương đậm
    };
    cell.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder;
  });

  // 5. NẠP DỮ LIỆU CÁC DÒNG JOB
  items.forEach((item, index) => {
    const row = worksheet.addRow([
      index + 1,
      dayjs(item.work_date).format('DD/MM/YYYY'),
      item.unit || 'Gói',
      item.job_title,
      Number(item.quantity) || 1,
      Number(item.unit_price) || 0,
      Number(item.total_amount) || 0,
    ]);

    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(5).alignment = { horizontal: 'right' };
    row.getCell(6).alignment = { horizontal: 'right' };
    row.getCell(7).alignment = { horizontal: 'right' };

    row.getCell(5).numFmt = '#,##0.00';
    row.getCell(6).numFmt = '#,##0 "₫"';
    row.getCell(7).numFmt = '#,##0 "₫"';

    row.eachCell((cell) => {
      cell.border = thinBorder;
      cell.font = { name: 'Times New Roman', size: 11 };
    });
  });

  // 6. PHẦN TỔNG KẾT TÀI CHÍNH
  worksheet.addRow([]);

  const settlementAmount = Math.max(0, totalIncome - taxDeduction);

  const addSummaryRow = (label: string, value: number, isHighlight = false) => {
    const row = worksheet.addRow(['', '', '', '', '', label, value]);
    worksheet.mergeCells(`A${row.number}:E${row.number}`);
    const labelCell = row.getCell(6);
    const valueCell = row.getCell(7);

    labelCell.font = { name: 'Times New Roman', size: 11, bold: true };
    labelCell.alignment = { horizontal: 'right' };

    valueCell.numFmt = '#,##0 "₫"';
    valueCell.alignment = { horizontal: 'right' };
    valueCell.font = {
      name: 'Times New Roman',
      size: 11,
      bold: true,
      color: isHighlight ? { argb: 'FF15803D' } : undefined, // Xanh lá nếu tổng thanh toán
    };

    if (isHighlight) {
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
    }
  };

  addSummaryRow('1. TỔNG THU NHẬP GỘP (VNĐ):', totalIncome);
  addSummaryRow(
    `2. KHẤU TRỪ THUẾ TNCN 10% (${totalIncome >= 5000000 ? 'Thu nhập ≥ 5tr' : 'Dưới mức khấu trừ (< 5tr)'}):`,
    taxDeduction
  );
  addSummaryRow('3. TỔNG TIỀN THANH TOÁN NGHIỆM THU ĐỢT NÀY (VNĐ):', settlementAmount, true);

  // 7. TỰ ĐỘNG CÂN CHỈNH ĐỘ RỘNG CỘT
  worksheet.columns = [
    { width: 8 },  // STT
    { width: 14 }, // Ngày làm
    { width: 16 }, // Đơn vị tính
    { width: 38 }, // Tên Job
    { width: 12 }, // SL
    { width: 30 }, // Đơn giá / Nhãn tổng
    { width: 24 }, // Thành tiền / Giá trị tổng
  ];

  // Xuất file
  const buffer = await workbook.xlsx.writeBuffer();
  const safeName = (employee.full_name || 'Nhan_su').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Bang_ke_quyet_toan_${safeName}_T${month}_${year}.xlsx`;
  saveAs(new Blob([buffer]), fileName);
}

/**
 * Xuất Bảng lương & quyết toán tổng hợp toàn công ty theo tháng ra file Excel (.xlsx)
 */
export async function exportCompanySettlementExcel(
  summaries: EmployeeSettlementSummary[],
  month: number,
  year: number
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Project Settlement System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(`Bang_luong_T${month}_${year}`, {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });

  // 1. TIÊU ĐỀ
  worksheet.mergeCells('A1:J1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'BẢNG LƯƠNG & QUYẾT TOÁN THU NHẬP TOÀN CÔNG TY';
  titleCell.font = { name: 'Times New Roman', size: 16, bold: true, color: { argb: 'FF1677FF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 32;

  // 2. KỲ QUYẾT TOÁN
  worksheet.mergeCells('A2:J2');
  const subTitleCell = worksheet.getCell('A2');
  subTitleCell.value = `Kỳ quyết toán: Tháng ${month} năm ${year} (Ngày xuất: ${dayjs().format('DD/MM/YYYY')})`;
  subTitleCell.font = { name: 'Times New Roman', size: 11, italic: true };
  subTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.addRow([]);

  // 3. TIÊU ĐỀ CỘT
  const headerRow = worksheet.addRow([
    'STT',
    'Họ và tên nhân sự',
    'Số CCCD',
    'Ngân hàng',
    'Số tài khoản',
    'Số Job',
    'Tổng thu nhập gộp (VNĐ)',
    'Khấu trừ thuế TNCN 10% (VNĐ)',
    'Đã thanh toán (VNĐ)',
    'Thực nhận (VNĐ)',
  ]);
  headerRow.height = 28;

  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' }, // Slate đậm chuyên nghiệp
    };
    cell.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder;
  });

  // 4. DỮ LIỆU TỪNG NHÂN SỰ
  let sumIncome = 0;
  let sumTax = 0;
  let sumPaid = 0;
  let sumNet = 0;

  summaries.forEach((sum, idx) => {
    sumIncome += sum.totalIncome;
    sumTax += sum.taxDeduction;
    sumPaid += sum.paidAmount;
    sumNet += sum.netIncome;

    const row = worksheet.addRow([
      idx + 1,
      sum.employee.full_name,
      sum.employee.id_card_no || '—',
      sum.employee.bank_name || '—',
      sum.employee.bank_account_no || '—',
      sum.totalJobs,
      sum.totalIncome,
      sum.taxDeduction,
      sum.paidAmount,
      sum.netIncome,
    ]);

    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(5).alignment = { horizontal: 'center' };
    row.getCell(6).alignment = { horizontal: 'center' };

    row.getCell(7).alignment = { horizontal: 'right' };
    row.getCell(8).alignment = { horizontal: 'right' };
    row.getCell(9).alignment = { horizontal: 'right' };
    row.getCell(10).alignment = { horizontal: 'right' };

    row.getCell(7).numFmt = '#,##0 "₫"';
    row.getCell(8).numFmt = '#,##0 "₫"';
    row.getCell(9).numFmt = '#,##0 "₫"';
    row.getCell(10).numFmt = '#,##0 "₫"';

    row.eachCell((cell) => {
      cell.border = thinBorder;
      cell.font = { name: 'Times New Roman', size: 11 };
    });
  });

  // 5. DÒNG TỔNG CỘNG TOÀN CÔNG TY
  const totalRow = worksheet.addRow([
    'TỔNG',
    `Tổng cộng: ${summaries.length} nhân sự`,
    '',
    '',
    '',
    summaries.reduce((acc, s) => acc + s.totalJobs, 0),
    sumIncome,
    sumTax,
    sumPaid,
    sumNet,
  ]);
  totalRow.height = 24;

  totalRow.eachCell((cell, colNumber) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.font = { name: 'Times New Roman', size: 11, bold: true };
    cell.border = {
      ...thinBorder,
      bottom: { style: 'double', color: { argb: 'FF0F172A' } },
    };
    if (colNumber >= 7) {
      cell.alignment = { horizontal: 'right' };
      cell.numFmt = '#,##0 "₫"';
    } else {
      cell.alignment = { horizontal: 'center' };
    }
  });

  // Độ rộng cột
  worksheet.columns = [
    { width: 8 },  // STT
    { width: 26 }, // Họ tên
    { width: 16 }, // CCCD
    { width: 22 }, // Ngân hàng
    { width: 18 }, // STK
    { width: 10 }, // Số job
    { width: 24 }, // Thu nhập gộp
    { width: 26 }, // Thuế 10%
    { width: 20 }, // Đã TT
    { width: 24 }, // Thực nhận
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `Bang_luong_tong_hop_T${month}_${year}.xlsx`;
  saveAs(new Blob([buffer]), fileName);
}

