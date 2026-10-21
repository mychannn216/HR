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
import type { Employee } from '../types';

/**
 * Loại bỏ dấu tiếng Việt và khoảng trắng, chuyển thành in hoa
 * Ví dụ: "Đỗ Tràng Tiến" -> "DOTRANGTIEN"
 */
export function removeVietnameseDiacriticsAndSpaces(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

/**
 * Sinh số hợp đồng chuẩn quy tắc: [STT]/HDDV/TOGOO-[HOTEN_VIET_LIEN_KHONG_DAU_IN_HOA]
 * Ví dụ: 01/HDDV/TOGOO-DOTRANGTIEN
 */
export function generateContractCode(stt: number = 1, fullName: string = ''): string {
  const sttStr = String(stt).padStart(2, '0');
  const nameStr = removeVietnameseDiacriticsAndSpaces(fullName);
  return `${sttStr}/HDDV/TOGOO-${nameStr}`;
}

/**
 * Format ngày tháng sang định dạng Việt Nam DD/MM/YYYY
 */
function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '...';
  const d = dayjs(dateStr);
  return d.isValid() ? d.format('DD/MM/YYYY') : '...';
}

const borderNone = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

/**
 * Tạo một dòng trong bảng thông tin các bên (không viền)
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
      size: 24, // 12pt
      font: 'Times New Roman',
    }),
  ];

  if (extra) {
    valueRuns.push(
      new TextRun({
        text: `                   ${extra.label} : `,
        size: 24,
        font: 'Times New Roman',
      }),
      new TextRun({
        text: extra.value,
        bold: true,
        size: 24,
        font: 'Times New Roman',
      })
    );
  }

  return new TableRow({
    children: [
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        borders: borderNone,
        children: [
          new Paragraph({
            spacing: { before: 30, after: 30, line: 276 },
            children: [
              new TextRun({
                text: label,
                bold: isBoldLabel,
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        borders: borderNone,
        children: [
          new Paragraph({
            spacing: { before: 30, after: 30, line: 276 },
            children: valueRuns,
          }),
        ],
      }),
    ],
  });
}

/**
 * Tạo đoạn văn bản với cấu hình chuẩn Times New Roman
 */
function pText(
  text: string,
  options?: {
    bold?: boolean;
    italics?: boolean;
    size?: number;
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
      before: options?.spacingBefore ?? 0,
      after: options?.spacingAfter ?? 60,
      line: 276, // 1.15 line spacing
    },
    children: [
      new TextRun({
        text,
        bold: options?.bold ?? false,
        italics: options?.italics ?? false,
        size: options?.size ?? 24, // default 12pt
        font: 'Times New Roman',
      }),
    ],
  });
}

/**
 * Xuất Hợp đồng dịch vụ khung cho nhân sự dưới dạng file .docx
 * @param employee Đối tượng nhân sự
 * @param stt Số thứ tự của nhân sự (1, 2, 3...)
 */
export async function exportContractToDocx(employee: Employee, stt: number = 1): Promise<void> {
  const today = dayjs();
  const dayStr = today.format('DD');
  const monthStr = today.format('MM');
  const yearStr = today.format('YYYY');

  const contractCode = generateContractCode(stt, employee.full_name);

  const startDateFormatted = employee.contract_start_date
    ? formatDate(employee.contract_start_date)
    : '…/…/……';
  const endDateFormatted = employee.contract_end_date
    ? formatDate(employee.contract_end_date)
    : (employee.contract_start_date ? 'khi hai bên có thỏa thuận chấm dứt' : '…/…/……');

  // Bảng thông tin BÊN A (Cố định)
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

  // Bảng thông tin BÊN B (Đồng bộ từ hồ sơ nhân sự)
  const tableBenB = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderNone,
    rows: [
      createPartyRow('BÊN B', employee.full_name ? employee.full_name.toUpperCase() : '...', true, true),
      createPartyRow('Số CMND/CCCD', employee.id_card_no || '...'),
      createPartyRow('Sinh ngày', employee.dob ? formatDate(employee.dob) : '...'),
      createPartyRow(
        'Địa chỉ thường trú',
        (employee as any).permanent_address || (employee as any).address || '....................................................................................'
      ),
      createPartyRow(
        'Địa chỉ liên hệ',
        (employee as any).address || (employee as any).permanent_address || '....................................................................................'
      ),
      createPartyRow('Số điện thoại', employee.phone || '...'),
      createPartyRow('Email', employee.email || '...'),
      createPartyRow('Số tài khoản ngân hàng', employee.bank_account_no || '...'),
      createPartyRow('Ngân hàng thụ hưởng', employee.bank_name || '...'),
    ],
  });

  // Bảng ký tên đại diện 2 bên
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
                spacing: { after: 40 },
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
                spacing: { after: 40 },
                children: [
                  new TextRun({
                    text: '(Ký và ghi rõ họ tên, đóng dấu)',
                    italics: true,
                    size: 20,
                    font: 'Times New Roman',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 1400, after: 40 },
                children: [
                  new TextRun({
                    text: 'CÔNG TY CỔ PHẦN TRUYỀN THÔNG TOGOO',
                    bold: true,
                    size: 22,
                    font: 'Times New Roman',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Tổng Giám đốc: NGÔ HỮU THẾ',
                    bold: true,
                    size: 22,
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
                spacing: { after: 40 },
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
                spacing: { after: 40 },
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
                spacing: { before: 1400, after: 40 },
                children: [
                  new TextRun({
                    text: employee.full_name ? employee.full_name.toUpperCase() : '...',
                    bold: true,
                    size: 22,
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

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch = 1440 dxa (~2.54 cm)
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: [
          // QUỐC HIỆU - TIÊU NGỮ
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
                bold: true,
                size: 24, // 12pt
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Độc lập - Tự do - Hạnh phúc',
                bold: true,
                underline: {},
                size: 26, // 13pt
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: '-----------------------------',
                font: 'Times New Roman',
              }),
            ],
          }),

          // TIÊU ĐỀ HỢP ĐỒNG & SỐ
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 60 },
            children: [
              new TextRun({
                text: 'HỢP ĐỒNG DỊCH VỤ',
                bold: true,
                size: 28, // 14pt
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: `Số: ${contractCode}`,
                italics: true,
                bold: true,
                size: 22, // 11pt
                font: 'Times New Roman',
              }),
            ],
          }),

          // CĂN CỨ PHÁP LÝ
          pText('Căn cứ Bộ luật Dân sự 2015 số 91/2015/QH13 và các văn bản hướng dẫn thi hành;', {
            italics: true,
            spacingAfter: 50,
          }),
          pText('Căn cứ nhu cầu và thỏa thuận giữa các bên', {
            italics: true,
            spacingAfter: 160,
          }),

          // LỜI MỞ ĐẦU
          pText(
            `Hôm nay, vào ngày ${dayStr} tháng ${monthStr} năm ${yearStr} tại trụ sở Công ty Cổ phần Truyền thông TOGOO, các bên bao gồm:`,
            { spacingAfter: 100 }
          ),

          // THÔNG TIN BÊN A
          tableBenA,

          // TỪ NỐI
          new Paragraph({
            spacing: { before: 100, after: 100, line: 276 },
            children: [
              new TextRun({
                text: 'Và',
                bold: true,
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),

          // THÔNG TIN BÊN B
          tableBenB,

          pText('Sau khi bàn bạc và thỏa thuận, hai bên đã thống nhất những nội dung như sau:', {
            italics: true,
            spacingBefore: 120,
            spacingAfter: 140,
          }),

          // ĐIỀU 1. NỘI DUNG CÔNG VIỆC
          pText('ĐIỀU 1. NỘI DUNG CÔNG VIỆC', { bold: true, spacingBefore: 120, spacingAfter: 60 }),
          new Paragraph({
            spacing: { before: 0, after: 40, line: 276 },
            children: [
              new TextRun({
                text: '1.1. ',
                bold: true,
                size: 24,
                font: 'Times New Roman',
              }),
              new TextRun({
                text: 'Bên B nhận thực hiện cho bên A công việc sau: ',
                size: 24,
                font: 'Times New Roman',
              }),
              new TextRun({
                text: employee.position || '........................................................................',
                bold: !!employee.position,
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),
          pText('Về chất lượng công việc theo yêu cầu của bên A.', { spacingAfter: 100 }),

          // ĐIỀU 2. THỜI GIAN VÀ ĐỊA ĐIỂM THỰC HIỆN HỢP ĐỒNG
          pText('ĐIỀU 2. THỜI GIAN VÀ ĐỊA ĐIỂM THỰC HIỆN HỢP ĐỒNG', {
            bold: true,
            spacingBefore: 120,
            spacingAfter: 60,
          }),
          pText('2.1. Thời gian thực hiện:', { bold: true, spacingAfter: 40 }),
          pText(
            `Bên B thực hiện công việc cho Bên A trong thời hạn từ ngày ${startDateFormatted} đến ngày ${endDateFormatted}.`,
            { spacingAfter: 60 }
          ),
          pText('2.2. Địa điểm thực hiện: Linh hoạt theo từng công việc', { spacingAfter: 100 }),

          // ĐIỀU 3. PHÍ DỊCH VỤ, HÌNH THỨC VÀ THỜI HẠN THANH TOÁN
          pText('ĐIỀU 3. PHÍ DỊCH VỤ, HÌNH THỨC VÀ THỜI HẠN THANH TOÁN', {
            bold: true,
            spacingBefore: 120,
            spacingAfter: 60,
          }),
          pText('3.1. Phí dịch vụ:', { bold: true, spacingAfter: 40 }),
          pText(
            'Do tính chất đặc thù của từng sự kiện, Phí dịch vụ sẽ được Bên A thỏa thuận cụ thể với Bên B theo từng dự án thực hiện dựa trên bảng báo giá tại thời điểm đó.',
            { spacingAfter: 40 }
          ),
          pText(
            'Bên A sẽ thực hiện khấu trừ thuế TNCN 10% tại nguồn đối với các khoản thu nhập từ 5.000.000 VNĐ (bằng chữ: Năm triệu đồng) trở lên.',
            { spacingAfter: 60 }
          ),
          pText('3.2. Hình thức thanh toán: Bằng tiền mặt/chuyển khoản qua ngân hàng.', {
            spacingAfter: 60,
          }),
          pText('3.3. Thời hạn thanh toán:', { bold: true, spacingAfter: 40 }),
          pText(
            'Bên A có trách nhiệm thanh toán cho Bên B ngay sau khi hai bên hoàn tất việc ký Biên bản nghiệm thu sản phẩm và Quyết toán thù lao tháng tương ứng.',
            { spacingAfter: 100 }
          ),

          // ĐIỀU 4. QUYỀN VÀ NGHĨA VỤ CỦA CÁC BÊN
          pText('ĐIỀU 4. QUYỀN VÀ NGHĨA VỤ CỦA CÁC BÊN', {
            bold: true,
            spacingBefore: 120,
            spacingAfter: 60,
          }),
          pText('4.1. Quyền và nghĩa vụ của Bên A:', { bold: true, spacingAfter: 40 }),
          pText('- Quyền của Bên A:', { italics: true, spacingAfter: 30 }),
          pText('+ Yêu cầu Bên B thực hiện đúng công việc đã thỏa thuận theo đúng thời gian trong hợp đồng;', {
            spacingAfter: 30,
          }),
          pText(
            '+ Đơn phương chấm dứt hợp đồng và yêu cầu bồi thường thiệt hại theo quy định của pháp luật và thỏa thuận trong hợp đồng này;',
            { spacingAfter: 30 }
          ),
          pText('+ Các quyền khác theo quy định của pháp luật.', { spacingAfter: 50 }),
          pText('- Nghĩa vụ của Bên A:', { italics: true, spacingAfter: 30 }),
          pText('+ Thanh toán đầy đủ và đúng hạn cho Bên B theo đúng thỏa thuận trong hợp đồng này;', {
            spacingAfter: 30,
          }),
          pText('+ Tạo điều kiện để Bên B hoàn thành công việc theo thỏa thuận;', {
            spacingAfter: 30,
          }),
          pText('+ Trích phí dịch vụ của Bên B để đóng thuế TNCN cho Bên B;', {
            spacingAfter: 30,
          }),
          pText('+ Kê khai, đóng thuế TNCN cho Bên B trong phạm vi liên quan đến hợp đồng này;', {
            spacingAfter: 30,
          }),
          pText('+ Các nghĩa vụ khác theo quy định của pháp luật.', { spacingAfter: 60 }),

          pText('4.2. Quyền và nghĩa vụ của Bên B:', { bold: true, spacingAfter: 40 }),
          pText('- Quyền của Bên B:', { italics: true, spacingAfter: 30 }),
          pText('+ Yêu cầu Bên A thanh toán đầy đủ và đúng hạn cho Bên B;', { spacingAfter: 30 }),
          pText('+ Yêu cầu Bên A trích phí dịch vụ để đóng thuế TNCN cho Bên B;', { spacingAfter: 30 }),
          pText(
            '+ Đơn phương chấm dứt hợp đồng và yêu cầu bồi thường thiệt hại theo quy định của pháp luật và thỏa thuận trong hợp đồng này;',
            { spacingAfter: 30 }
          ),
          pText('+ Các quyền lợi khác theo quy định của pháp luật.', { spacingAfter: 50 }),
          pText('- Nghĩa vụ của Bên B:', { italics: true, spacingAfter: 30 }),
          pText('+ Thực hiện các công việc đúng yêu cầu, thời gian, địa điểm và chất lượng theo thỏa thuận;', {
            spacingAfter: 30,
          }),
          pText('+ Chịu sự kiểm tra của Bên A và phải báo cáo thường xuyên công việc cho Bên A;', {
            spacingAfter: 30,
          }),
          pText('+ Có trách nhiệm bảo mật thông tin trong thời gian thực hiện công việc;', {
            spacingAfter: 30,
          }),
          pText('+ Bảo quản, giao lại cho bên A tài liệu, phương tiện được giao để hoàn thành công việc;', {
            spacingAfter: 30,
          }),
          pText(
            '+ Bồi thường thiệt hại trong trường hợp làm mất, hư hỏng tài liệu, phương tiện được giao để thực hiện công việc hoặc khi tiết lộ thông tin bí mật của bên A.',
            { spacingAfter: 30 }
          ),
          pText('+ Các nghĩa vụ khác theo quy định của pháp luật.', { spacingAfter: 100 }),

          // ĐIỀU 5. THANH LÝ HỢP ĐỒNG
          pText('ĐIỀU 5. THANH LÝ HỢP ĐỒNG', { bold: true, spacingBefore: 120, spacingAfter: 60 }),
          pText(
            '5.1. Hợp đồng chấm dứt khi hết thời hạn hợp đồng hoặc khi các bên hoàn thành quyền và nghĩa vụ với nhau và không có thỏa thuận gia hạn khác;',
            { spacingAfter: 40 }
          ),
          pText(
            '5.2. Nếu trong quá trình thực hiện hợp đồng, hai bên thỏa thuận được với nhau về việc chấm dứt hợp đồng, hợp đồng này sẽ chấm dứt kể từ thời điểm đạt được thỏa thuận giữa hai bên.',
            { spacingAfter: 40 }
          ),
          pText(
            '5.3. Hợp đồng chấm dứt khi một trong hai bên đơn phương chấm dứt hợp đồng theo quy định của pháp luật và hợp đồng này.',
            { spacingAfter: 100 }
          ),

          // ĐIỀU 6. ĐƠN PHƯƠNG CHẤM DỨT HỢP ĐỒNG
          pText('ĐIỀU 6. ĐƠN PHƯƠNG CHẤM DỨT HỢP ĐỒNG', {
            bold: true,
            spacingBefore: 120,
            spacingAfter: 60,
          }),
          pText(
            '6.1. Các bên không được đơn phương chấm dứt hợp đồng trừ những trường hợp do pháp luật quy định. Bên đơn phương chấm dứt hợp đồng phải bồi thường …% giá trị hợp đồng và bồi thường thiệt hại (nếu có) cho bên còn lại, trừ trường hợp chứng minh được bên kia vi phạm cơ bản nghĩa vụ hợp đồng hoặc các trường hợp khác theo quy định trong hợp đồng.',
            { spacingAfter: 50 }
          ),
          pText(
            '6.2. Một bên được quyền đơn phương chấm dứt hợp đồng mà không phải bồi thường thiệt hại nếu bên còn lại vi phạm nghiêm trọng nghĩa vụ trong hợp đồng hoặc những trường hợp pháp luật có quy định. Bên đơn phương chấm dứt hợp đồng có trách nhiệm chứng minh được lỗi của bên kia. Chi phí kiểm tra, chứng minh lỗi vi phạm và thiệt hại gây ra do bên có vi phạm nghĩa vụ chi trả.',
            { spacingAfter: 50 }
          ),
          pText(
            'Trường hợp đơn phương chấm dứt hợp đồng, bên đã thực hiện nghĩa vụ có quyền yêu cầu bên kia thanh toán hoặc hoàn trả phần nghĩa vụ đã thực hiện.',
            { spacingAfter: 50 }
          ),
          pText(
            '6.3. Bên đơn phương chấm dứt hợp đồng phải thông báo cho bên còn lại trước tối thiểu ....ngày. Nếu vi phạm thời gian tối thiểu báo trước, bên đơn phương chấm dứt hợp đồng sẽ bị phạt …% tổng giá trị hợp đồng và phải bồi thường thiệt hại (nếu có).',
            { spacingAfter: 100 }
          ),

          // ĐIỀU 7. BẢO MẬT THÔNG TIN
          pText('ĐIỀU 7. BẢO MẬT THÔNG TIN', { bold: true, spacingBefore: 120, spacingAfter: 60 }),
          pText(
            'Hai bên không được tiết lộ cho bên thứ ba những thông tin, tài liệu liên quan đến hợp đồng này, trừ trường hợp được sự chấp thuận bằng văn bản của bên còn lại hoặc theo yêu cầu của cơ quan nhà nước có thẩm quyền.',
            { spacingAfter: 50 }
          ),
          pText(
            'Trong khi thực hiện và sau khi hợp đồng này chấm dứt hoặc nếu xảy ra tranh chấp, điều khoản này vẫn sẽ còn hiệu lực pháp lý.',
            { spacingAfter: 50 }
          ),
          pText(
            'Trường hợp một bên vi phạm điều khoản này, bên còn lại có quyền đơn phương chấm dứt hợp đồng và yêu cầu bồi thường thiệt hại (nếu có).',
            { spacingAfter: 100 }
          ),

          // ĐIỀU 9. ĐIỀU KHOẢN CHUNG
          pText('ĐIỀU 9. ĐIỀU KHOẢN CHUNG', { bold: true, spacingBefore: 120, spacingAfter: 60 }),
          pText(
            '- Hai bên cam kết thực hiện đầy đủ các điều khoản của hợp đồng này. Nếu tranh chấp phát sinh trong quá trình thực hiện hợp đồng sẽ được giải quyết bằng thương lượng và hòa giải. Trường hợp các bên thương lượng, hòa giải không thành, tranh chấp sẽ được giải quyết tại Tòa án nhân dân.',
            { spacingAfter: 40 }
          ),
          pText(
            '- Hợp đồng này được lập thành 02 bản và có giá trị pháp lý như nhau, mỗi bên giữ một bản.',
            { spacingAfter: 40 }
          ),
          pText(
            `- Hợp đồng này có hiệu lực kể từ ngày ${employee.contract_start_date ? dayjs(employee.contract_start_date).format('DD') : '....'} tháng ${employee.contract_start_date ? dayjs(employee.contract_start_date).format('MM') : '....'} năm ${employee.contract_start_date ? dayjs(employee.contract_start_date).format('YYYY') : '........'}.`,
            { spacingAfter: 160 }
          ),

          // PHẦN KÝ TÊN HAI BÊN
          tableSignatures,
        ],
      },
    ],
  });

  // Tạo blob và tải về trực tiếp
  const blob = await Packer.toBlob(doc);
  const safeName = (employee.full_name || 'Nhan_su')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[\\/:*?"<>|]/g, '');
  const fileName = `Hop_dong_khung_${safeName}.docx`;

  saveAs(blob, fileName);
}
