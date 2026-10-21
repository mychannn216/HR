import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  DatePicker,
  Select,
  Button,
  Card,
  Row,
  Col,
  Upload,
  message,
  Divider,
  Image,
  Alert,
} from 'antd';
import {
  UploadOutlined,
  SaveOutlined,
  CloseOutlined,
  IdcardOutlined,
  BankOutlined,
  FileProtectOutlined,
  UserOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Employee, EmployeeStatus } from '../types';
import { createEmployee, updateEmployee } from '../services/employeeService';
import { uploadEmployeeFile, type StorageFolder } from '../services/storageService';
import { isSupabaseConfigured } from '../services/supabaseClient';

const { Option } = Select;

// Danh sách ngân hàng phổ biến tại Việt Nam
const COMMON_BANKS = [
  'Vietcombank (VCB)',
  'MB Bank (MB)',
  'Techcombank (TCB)',
  'BIDV',
  'VietinBank',
  'Agribank',
  'ACB',
  'VPBank',
  'TPBank',
  'Sacombank',
  'HDBank',
  'VIB',
  'SHB',
  'MSB',
  'SeABank',
  'OCB',
  'Khác',
];

// Danh sách vị trí công việc
export const POSITION_OPTIONS = [
  'Quay phim',
  'Chụp ảnh',
  'Flycam',
  'Kỹ thuật',
  'Livestream',
  'Chỉnh ảnh',
  'Dựng phim',
  'Khác',
];

interface EmployeeFormProps {
  initialData?: Employee | null;
  onSuccess: () => void;
  onCancel?: () => void;
}

export const EmployeeForm: React.FC<EmployeeFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [showOtherPosition, setShowOtherPosition] = useState(false);

  // Lưu trữ URLs ảnh
  const [idCardFrontUrl, setIdCardFrontUrl] = useState<string | null>(null);
  const [idCardBackUrl, setIdCardBackUrl] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  // Loading state cho từng ảnh upload
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);

  // Đồng bộ initialData vào form khi chỉnh sửa
  useEffect(() => {
    if (initialData) {
      let initialPositions: string[] = [];
      let initialOtherText = '';

      if (initialData.position) {
        const parts = initialData.position
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        parts.forEach((p) => {
          if (POSITION_OPTIONS.includes(p) && p !== 'Khác') {
            initialPositions.push(p);
          } else {
            initialPositions.push('Khác');
            const cleanOther = p.replace(/^Khác[:\s]*/i, '').trim();
            initialOtherText = initialOtherText
              ? `${initialOtherText}, ${cleanOther}`
              : cleanOther;
          }
        });
        initialPositions = Array.from(new Set(initialPositions));
      }

      form.setFieldsValue({
        full_name: initialData.full_name,
        dob: initialData.dob ? dayjs(initialData.dob) : null,
        phone: initialData.phone,
        email: initialData.email,
        positions: initialPositions,
        other_position: initialOtherText,
        status: initialData.status,
        id_card_no: initialData.id_card_no,
        id_card_issue_place: initialData.id_card_issue_place || 'Cục Cảnh sát QLHC về TTXH',
        id_card_issue_date: initialData.id_card_issue_date
          ? dayjs(initialData.id_card_issue_date)
          : null,
        id_card_expiry_date: initialData.id_card_expiry_date
          ? dayjs(initialData.id_card_expiry_date)
          : null,
        bank_name: initialData.bank_name,
        bank_account_no: initialData.bank_account_no,
        contract_start_date: initialData.contract_start_date
          ? dayjs(initialData.contract_start_date)
          : null,
        contract_end_date: initialData.contract_end_date
          ? dayjs(initialData.contract_end_date)
          : null,
      });

      setShowOtherPosition(initialPositions.includes('Khác'));
      setIdCardFrontUrl(initialData.id_card_front_url || null);
      setIdCardBackUrl(initialData.id_card_back_url || null);
      setQrCodeUrl(initialData.qr_code_url || null);
    } else {
      setShowOtherPosition(false);
      form.resetFields();
      form.setFieldsValue({
        status: 'active',
        id_card_issue_place: 'Cục Cảnh sát QLHC về TTXH',
        positions: [],
        other_position: '',
      });
      setIdCardFrontUrl(null);
      setIdCardBackUrl(null);
      setQrCodeUrl(null);
    }
  }, [initialData, form]);

  // Hàm xử lý upload ảnh lên Supabase Storage
  const handleUpload = async (
    file: File,
    folder: StorageFolder,
    setUrl: (url: string) => void,
    setLoading: (loading: boolean) => void
  ) => {
    setLoading(true);
    try {
      const publicUrl = await uploadEmployeeFile(file, folder);
      setUrl(publicUrl);
      message.success(`Tải ảnh lên thành công!`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi không xác định khi upload ảnh';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async (values: any) => {
    setSubmitting(true);
    try {
      // Xử lý vị trí công việc: gom mảng và vị trí khác thành chuỗi
      const selectedPositions: string[] = values.positions || [];
      const finalPositions: string[] = [];
      selectedPositions.forEach((pos) => {
        if (pos === 'Khác') {
          const custom = values.other_position?.trim();
          if (custom) {
            finalPositions.push(custom);
          } else {
            finalPositions.push('Khác');
          }
        } else {
          finalPositions.push(pos);
        }
      });
      const positionText = finalPositions.length > 0 ? finalPositions.join(', ') : null;

      const payload: Partial<Employee> = {
        full_name: values.full_name?.trim(),
        dob: values.dob ? values.dob.format('YYYY-MM-DD') : null,
        phone: values.phone?.trim() || null,
        email: values.email?.trim() || null,
        position: positionText,
        status: (values.status as EmployeeStatus) || 'active',
        id_card_no: values.id_card_no?.trim() || null,
        id_card_issue_place: values.id_card_issue_place?.trim() || null,
        id_card_issue_date: values.id_card_issue_date
          ? values.id_card_issue_date.format('YYYY-MM-DD')
          : null,
        id_card_expiry_date: values.id_card_expiry_date
          ? values.id_card_expiry_date.format('YYYY-MM-DD')
          : null,
        id_card_front_url: idCardFrontUrl,
        id_card_back_url: idCardBackUrl,
        bank_name: values.bank_name || null,
        bank_account_no: values.bank_account_no?.trim() || null,
        qr_code_url: qrCodeUrl,
        contract_start_date: values.contract_start_date
          ? values.contract_start_date.format('YYYY-MM-DD')
          : null,
        contract_end_date: values.contract_end_date
          ? values.contract_end_date.format('YYYY-MM-DD')
          : null,
      };

      if (!isSupabaseConfigured) {
        throw new Error(
          'Supabase chưa được kết nối! Vui lòng cập nhật VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trong file .env để lưu dữ liệu.'
        );
      }

      if (initialData?.id) {
        await updateEmployee(initialData.id, payload);
        message.success('Cập nhật hồ sơ nhân sự thành công!');
      } else {
        await createEmployee(payload);
        message.success('Thêm mới hồ sơ nhân sự thành công!');
      }

      onSuccess();
    } catch (err: unknown) {
      let errorMsg = err instanceof Error ? err.message : 'Lỗi khi lưu dữ liệu';
      if (errorMsg.includes('position') && (errorMsg.includes('column') || errorMsg.includes('schema cache'))) {
        errorMsg = 'Bảng employees trên Supabase chưa có cột "position". Vui lòng chạy lệnh SQL: ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS position TEXT;';
      } else if (errorMsg.includes('Failed to fetch')) {
        errorMsg =
          'Lỗi kết nối mạng: Không tìm thấy máy chủ Supabase. Vui lòng kiểm tra VITE_SUPABASE_URL trong file .env.';
      } else if (errorMsg.includes('row-level security')) {
        errorMsg =
          'Lỗi RLS Supabase: Quyền truy cập bị chặn. Hãy chạy lại file supabase/schema.sql để cấp quyền thao tác.';
      } else if (errorMsg.includes('duplicate key') && errorMsg.includes('id_card_no')) {
        errorMsg = 'Số CCCD này đã tồn tại trong hệ thống! Vui lòng kiểm tra lại.';
      }
      message.error(errorMsg, 6);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <UserOutlined className="text-blue-600" />
          <span className="font-semibold text-slate-800">
            {initialData ? 'Chỉnh sửa Hồ sơ Nhân sự' : 'Tạo mới Hồ sơ Nhân sự'}
          </span>
        </div>
      }
      extra={
        onCancel && (
          <Button icon={<CloseOutlined />} onClick={onCancel}>
            Hủy bỏ
          </Button>
        )
      }
      className="shadow-sm border-slate-200"
    >
      {!isSupabaseConfigured && (
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          message="Chưa cấu hình Supabase thực tế"
          description={
            <div>
              Dự án đang dùng thông tin mẫu trong file <code>.env</code>. Để lưu hồ sơ và tải ảnh lên server, bạn cần thay thế <code>VITE_SUPABASE_URL</code> và <code>VITE_SUPABASE_ANON_KEY</code> bằng thông tin từ dự án Supabase của bạn và chạy mã DDL trong file <code>supabase/schema.sql</code>.
            </div>
          }
        />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ status: 'active', id_card_issue_place: 'Cục Cảnh sát QLHC về TTXH' }}
      >
        {/* PHẦN 1: THÔNG TIN CÁ NHÂN CƠ BẢN */}
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
            <UserOutlined /> Thông tin cá nhân
          </h3>
          <Divider className="my-2" />
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="full_name"
                label="Họ và tên"
                rules={[
                  { required: true, message: 'Vui lòng nhập họ và tên nhân sự' },
                  { min: 2, message: 'Họ tên tối thiểu 2 ký tự' },
                ]}
              >
                <Input placeholder="Ví dụ: Nguyễn Văn A" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="dob" label="Ngày sinh">
                <DatePicker
                  className="w-full"
                  format="DD/MM/YYYY"
                  placeholder="Chọn ngày sinh"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item
                name="status"
                label="Trạng thái làm việc"
                rules={[{ required: true, message: 'Chọn trạng thái' }]}
              >
                <Select placeholder="Chọn trạng thái">
                  <Option value="active">Đang làm việc (Active)</Option>
                  <Option value="probation">Thử việc (Probation)</Option>
                  <Option value="inactive">Đã nghỉ việc (Inactive)</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="phone"
                label="Số điện thoại"
                rules={[
                  { required: true, message: 'Vui lòng nhập số điện thoại' },
                  {
                    pattern: /^(0|\+84)[3|5|7|8|9][0-9]{8}$/,
                    message: 'Số điện thoại không hợp lệ (Ví dụ: 0987654321)',
                  },
                ]}
              >
                <Input placeholder="0987654321" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="email"
                label="Email / Gmail"
                rules={[{ type: 'email', message: 'Địa chỉ email không hợp lệ' }]}
              >
                <Input placeholder="nguyenvana@gmail.com" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={showOtherPosition ? 14 : 24}>
              <Form.Item
                name="positions"
                label="Vị trí công việc (có thể chọn nhiều)"
                tooltip="Chọn một hoặc nhiều vị trí công việc mà nhân sự đảm nhận"
              >
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="Chọn các vị trí công việc (Quay phim, Chụp ảnh, Flycam...)"
                  onChange={(vals: string[]) => setShowOtherPosition(vals.includes('Khác'))}
                >
                  {POSITION_OPTIONS.map((pos) => (
                    <Option key={pos} value={pos}>
                      {pos}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            {showOtherPosition && (
              <Col xs={24} md={10}>
                <Form.Item
                  name="other_position"
                  label="Chi tiết vị trí khác"
                  rules={[{ required: true, message: 'Vui lòng nhập vị trí khác' }]}
                >
                  <Input placeholder="Ví dụ: Đạo diễn, Tổ chức sản xuất, Âm thanh..." />
                </Form.Item>
              </Col>
            )}
          </Row>
        </div>

        {/* PHẦN 2: CĂN CƯỚC CÔNG DÂN (CCCD) */}
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
            <IdcardOutlined /> Căn cước công dân & Định danh
          </h3>
          <Divider className="my-2" />
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="id_card_no"
                label="Số CCCD / Mã định danh"
                rules={[
                  { required: true, message: 'Vui lòng nhập số CCCD' },
                  {
                    pattern: /^[0-9]{9,12}$/,
                    message: 'Số CCCD gồm 9 hoặc 12 chữ số',
                  },
                ]}
              >
                <Input placeholder="12 chữ số trên thẻ CCCD" maxLength={12} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="id_card_issue_date" label="Ngày cấp CCCD">
                <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày cấp" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="id_card_expiry_date" label="Ngày hết hạn">
                <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày hết hạn" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item name="id_card_issue_place" label="Nơi cấp">
                <Input placeholder="Cục Cảnh sát QLHC về TTXH" />
              </Form.Item>
            </Col>
          </Row>

          {/* Upload ảnh CCCD 2 mặt */}
          <Row gutter={16} className="mt-2">
            <Col xs={24} md={12}>
              <div className="p-4 border border-dashed border-slate-300 rounded-lg bg-slate-50 flex flex-col items-center">
                <span className="font-medium text-slate-700 mb-2">Ảnh CCCD Mặt trước</span>
                {idCardFrontUrl ? (
                  <div className="relative mb-3 flex flex-col items-center">
                    <Image
                      src={idCardFrontUrl}
                      alt="CCCD mặt trước"
                      className="max-h-40 rounded object-cover shadow-sm"
                    />
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      className="mt-2"
                      onClick={() => setIdCardFrontUrl(null)}
                    >
                      Xóa ảnh
                    </Button>
                  </div>
                ) : null}
                <Upload
                  showUploadList={false}
                  beforeUpload={(file) => {
                    handleUpload(file, 'cccd-front', setIdCardFrontUrl, setUploadingFront);
                    return false;
                  }}
                  accept="image/*"
                >
                  <Button icon={<UploadOutlined />} loading={uploadingFront}>
                    {idCardFrontUrl ? 'Tải ảnh mặt trước khác' : 'Tải lên mặt trước'}
                  </Button>
                </Upload>
              </div>
            </Col>

            <Col xs={24} md={12}>
              <div className="p-4 border border-dashed border-slate-300 rounded-lg bg-slate-50 flex flex-col items-center mt-3 md:mt-0">
                <span className="font-medium text-slate-700 mb-2">Ảnh CCCD Mặt sau</span>
                {idCardBackUrl ? (
                  <div className="relative mb-3 flex flex-col items-center">
                    <Image
                      src={idCardBackUrl}
                      alt="CCCD mặt sau"
                      className="max-h-40 rounded object-cover shadow-sm"
                    />
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      className="mt-2"
                      onClick={() => setIdCardBackUrl(null)}
                    >
                      Xóa ảnh
                    </Button>
                  </div>
                ) : null}
                <Upload
                  showUploadList={false}
                  beforeUpload={(file) => {
                    handleUpload(file, 'cccd-back', setIdCardBackUrl, setUploadingBack);
                    return false;
                  }}
                  accept="image/*"
                >
                  <Button icon={<UploadOutlined />} loading={uploadingBack}>
                    {idCardBackUrl ? 'Tải ảnh mặt sau khác' : 'Tải lên mặt sau'}
                  </Button>
                </Upload>
              </div>
            </Col>
          </Row>
        </div>

        {/* PHẦN 3: TÀI KHOẢN NGÂN HÀNG & MÃ QR */}
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
            <BankOutlined /> Tài khoản ngân hàng & Thanh toán
          </h3>
          <Divider className="my-2" />
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="bank_name" label="Tên ngân hàng">
                <Select
                  showSearch
                  allowClear
                  placeholder="Chọn hoặc nhập tên ngân hàng"
                  filterOption={(input, option) =>
                    (option?.children as unknown as string)
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                >
                  {COMMON_BANKS.map((b) => (
                    <Option key={b} value={b}>
                      {b}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="bank_account_no" label="Số tài khoản ngân hàng">
                <Input placeholder="Nhập số tài khoản nhận tiền" />
              </Form.Item>
            </Col>
          </Row>

          {/* Upload ảnh mã QR */}
          <div className="p-4 border border-dashed border-slate-300 rounded-lg bg-slate-50 flex flex-col items-center max-w-sm mx-auto">
            <span className="font-medium text-slate-700 mb-2">Ảnh Mã QR Chuyển khoản</span>
            {qrCodeUrl ? (
              <div className="relative mb-3 flex flex-col items-center">
                <Image
                  src={qrCodeUrl}
                  alt="Mã QR ngân hàng"
                  className="max-h-40 rounded object-contain shadow-sm"
                />
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  className="mt-2"
                  onClick={() => setQrCodeUrl(null)}
                >
                  Xóa mã QR
                </Button>
              </div>
            ) : null}
            <Upload
              showUploadList={false}
              beforeUpload={(file) => {
                handleUpload(file, 'qr-code', setQrCodeUrl, setUploadingQr);
                return false;
              }}
              accept="image/*"
            >
              <Button icon={<UploadOutlined />} loading={uploadingQr}>
                {qrCodeUrl ? 'Tải ảnh mã QR khác' : 'Tải lên mã QR'}
              </Button>
            </Upload>
          </div>
        </div>

        {/* PHẦN 4: THỜI HẠN HỢP ĐỒNG */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
            <FileProtectOutlined /> Thời hạn hợp đồng
          </h3>
          <Divider className="my-2" />
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="contract_start_date" label="Ngày bắt đầu hợp đồng">
                <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày bắt đầu" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="contract_end_date" label="Ngày kết thúc hợp đồng (nếu có)">
                <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày kết thúc" />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* NÚT THAO TÁC */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          {onCancel && (
            <Button onClick={onCancel} disabled={submitting}>
              Hủy bỏ
            </Button>
          )}
          <Button
            type="primary"
            htmlType="submit"
            icon={<SaveOutlined />}
            loading={submitting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {initialData ? 'Lưu thay đổi' : 'Tạo hồ sơ nhân sự'}
          </Button>
        </div>
      </Form>
    </Card>
  );
};

export default EmployeeForm;
