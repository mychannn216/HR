import React, { useState } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Image,
  Popconfirm,
  message,
  Input,
  Select,
  Card,
  Descriptions,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileWordOutlined,
  SearchOutlined,
  ReloadOutlined,
  PhoneOutlined,
  MailOutlined,
  BankOutlined,
  IdcardOutlined,
  FileProtectOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import type { Employee, EmployeeStatus } from '../types';
import { getEmployees, deleteEmployee } from '../services/employeeService';
import { exportContractToDocx, generateContractCode } from '../utils/contractExport';
import { EmployeeJobManagement } from './EmployeeJobManagement';

const { Option } = Select;

interface EmployeeListProps {
  onAddNew: () => void;
  onEdit: (employee: Employee) => void;
  onManageJobs?: (employee: Employee) => void;
}

export const EmployeeList: React.FC<EmployeeListProps> = ({
  onAddNew,
  onEdit,
  onManageJobs,
}) => {
  const queryClient = useQueryClient();

  // Search và Filter state
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Detail Modal state
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Drawer Quản lý Job & PO state
  const [selectedJobEmployee, setSelectedJobEmployee] = useState<Employee | null>(null);

  // Loading state cho từng nhân sự khi bấm Xuất HĐ
  const [exportingId, setExportingId] = useState<string | null>(null);

  // React Query fetch danh sách nhân sự
  const {
    data: employees = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['employees'],
    queryFn: getEmployees,
  });

  // Mutation xóa nhân sự
  const deleteMutation = useMutation({
    mutationFn: deleteEmployee,
    onSuccess: () => {
      message.success('Đã xóa hồ sơ nhân sự!');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Lỗi khi xóa nhân sự';
      message.error(msg);
    },
  });

  // Lấy STT cố định theo danh sách tổng (sắp xếp created_at ASC)
  const getEmployeeFixedIndex = (empId: string): number => {
    const idx = employees.findIndex((e) => e.id === empId);
    return idx !== -1 ? idx + 1 : 1;
  };

  // Xử lý xuất hợp đồng docx
  const handleExportContract = async (emp: Employee) => {
    setExportingId(emp.id);
    try {
      const orderNumber = getEmployeeFixedIndex(emp.id);
      await exportContractToDocx(emp, orderNumber);
      const contractCode = generateContractCode(orderNumber, emp.full_name);
      message.success(`Đã xuất Hợp đồng khung (${contractCode}) cho ${emp.full_name}!`);
    } catch (err: unknown) {
      console.error(err);
      message.error('Lỗi khi xuất file Word hợp đồng');
    } finally {
      setExportingId(null);
    }
  };

  // Lọc dữ liệu theo search và status
  const filteredEmployees = employees.filter((emp) => {
    const searchLower = searchText.toLowerCase().trim();
    const matchSearch =
      !searchLower ||
      emp.full_name?.toLowerCase().includes(searchLower) ||
      emp.position?.toLowerCase().includes(searchLower) ||
      emp.phone?.includes(searchLower) ||
      emp.email?.toLowerCase().includes(searchLower) ||
      emp.id_card_no?.includes(searchLower);

    const matchStatus =
      statusFilter === 'all' || emp.status === statusFilter;

    return matchSearch && matchStatus;
  });

  // Render tag trạng thái
  const renderStatusTag = (status: EmployeeStatus) => {
    switch (status) {
      case 'active':
        return <Tag color="green">Đang làm việc</Tag>;
      case 'probation':
        return <Tag color="orange">Thử việc</Tag>;
      case 'inactive':
        return <Tag color="default">Nghỉ việc</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  // Màu sắc cho từng vị trí công việc
  const getPositionTagColor = (pos: string): string => {
    const lower = pos.toLowerCase();
    if (lower.includes('quay phim')) return 'blue';
    if (lower.includes('chụp ảnh')) return 'cyan';
    if (lower.includes('flycam')) return 'purple';
    if (lower.includes('kỹ thuật')) return 'geekblue';
    if (lower.includes('livestream')) return 'magenta';
    if (lower.includes('chỉnh ảnh')) return 'orange';
    if (lower.includes('dựng phim')) return 'green';
    return 'volcano';
  };

  // Cấu hình các cột của bảng
  const columns: ColumnsType<Employee> = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      render: (_, record) => (
        <span className="font-semibold text-slate-600">
          {getEmployeeFixedIndex(record.id)}
        </span>
      ),
    },
    {
      title: 'Họ và tên',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 170,
      render: (text, record) => (
        <div>
          <span className="font-semibold text-slate-800">{text}</span>
          {record.dob && (
            <div className="text-xs text-slate-400">
              NS: {dayjs(record.dob).format('DD/MM/YYYY')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Vị trí công việc',
      dataIndex: 'position',
      key: 'position',
      width: 220,
      render: (posText: string | null) => {
        if (!posText || !posText.trim()) {
          return <span className="text-slate-400 text-xs italic">Chưa phân công</span>;
        }
        const positions = posText.split(',').map((s) => s.trim()).filter(Boolean);
        return (
          <div className="flex flex-wrap gap-1">
            {positions.map((p, idx) => (
              <Tag
                key={idx}
                color={getPositionTagColor(p)}
                className="text-xs font-medium m-0 px-2 py-0.5"
              >
                {p}
              </Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: 'Liên hệ',
      key: 'contact',
      width: 160,
      render: (_, record) => (
        <div className="text-sm">
          {record.phone && (
            <div className="flex items-center gap-1 text-slate-700">
              <PhoneOutlined className="text-xs text-blue-500" />
              <span>{record.phone}</span>
            </div>
          )}
          {record.email && (
            <div className="flex items-center gap-1 text-slate-500 text-xs">
              <MailOutlined className="text-xs text-slate-400" />
              <span>{record.email}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'CCCD / Định danh',
      dataIndex: 'id_card_no',
      key: 'id_card_no',
      render: (text, record) => (
        <div>
          <span className="font-mono text-slate-700">{text || '—'}</span>
          {record.id_card_issue_date && (
            <div className="text-xs text-slate-400">
              Cấp: {dayjs(record.id_card_issue_date).format('DD/MM/YYYY')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Tài khoản ngân hàng',
      key: 'bank',
      render: (_, record) => (
        <div className="text-sm">
          {record.bank_account_no ? (
            <>
              <div className="font-mono font-medium text-slate-700">
                {record.bank_account_no}
              </div>
              <div className="text-xs text-slate-500">{record.bank_name || 'Ngân hàng'}</div>
            </>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </div>
      ),
    },
    {
      title: 'Thời hạn HĐ',
      key: 'contract',
      render: (_, record) => {
        if (!record.contract_start_date) return <span className="text-slate-400">—</span>;
        const start = dayjs(record.contract_start_date).format('DD/MM/YYYY');
        const end = record.contract_end_date
          ? dayjs(record.contract_end_date).format('DD/MM/YYYY')
          : 'Không thời hạn';
        return (
          <div className="text-xs text-slate-600">
            <div>Từ: {start}</div>
            <div>Đến: {end}</div>
          </div>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: EmployeeStatus) => renderStatusTag(status),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 330,
      render: (_, record) => (
        <Space size="small" wrap>
          {/* Nút Quản lý Job & PO */}
          <Tooltip title="Thêm job, tính giá tự động & gom tạo PO cho nhân sự">
            <Button
              size="small"
              type="primary"
              icon={<FileProtectOutlined />}
              onClick={() => {
                if (onManageJobs) onManageJobs(record);
                setSelectedJobEmployee(record);
              }}
              style={{ backgroundColor: '#4f46e5', borderColor: '#4f46e5' }}
            >
              Quản lý Job & PO
            </Button>
          </Tooltip>

          {/* Nút Xuất Hợp đồng khung */}
          <Tooltip
            title={`Xuất Hợp đồng khung (Số: ${generateContractCode(
              getEmployeeFixedIndex(record.id),
              record.full_name
            )})`}
          >
            <Button
              size="small"
              type="primary"
              ghost
              icon={<FileWordOutlined />}
              loading={exportingId === record.id}
              onClick={() => handleExportContract(record)}
              className="text-blue-600 border-blue-400"
            >
              Xuất HĐ
            </Button>
          </Tooltip>

          {/* Nút Xem chi tiết */}
          <Tooltip title="Xem chi tiết & ảnh CCCD/QR">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedEmployee(record);
                setDetailModalVisible(true);
              }}
            />
          </Tooltip>

          {/* Nút Chỉnh sửa */}
          <Tooltip title="Chỉnh sửa hồ sơ">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(record)}
            />
          </Tooltip>

          {/* Nút Xóa */}
          <Popconfirm
            title="Xác nhận xóa"
            description={`Bạn có chắc muốn xóa nhân sự "${record.full_name}"?`}
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
          >
            <Tooltip title="Xóa nhân sự">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* HEADER & THANH CÔNG CỤ TÌM KIẾM */}
      <Card className="border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Danh sách Hồ sơ Nhân sự</h2>
            <p className="text-sm text-slate-500">
              Quản lý hồ sơ, ảnh CCCD 2 mặt, thông tin tài khoản và xuất hợp đồng khung
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              icon={<ReloadOutlined spin={isRefetching} />}
              onClick={() => refetch()}
            >
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={onAddNew}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Thêm nhân sự mới
            </Button>
          </div>
        </div>

        {/* BỘ LỌC TÌM KIẾM */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
          <Input
            placeholder="Tìm theo họ tên, vị trí công việc, SĐT, email, CCCD..."
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full md:w-84"
            allowClear
          />

          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            className="w-44"
          >
            <Option value="all">Tất cả trạng thái</Option>
            <Option value="active">Đang làm việc</Option>
            <Option value="probation">Thử việc</Option>
            <Option value="inactive">Đã nghỉ việc</Option>
          </Select>

          <span className="text-xs text-slate-500 ml-auto">
            Tổng cộng: <strong>{filteredEmployees.length}</strong> nhân sự
          </span>
        </div>
      </Card>

      {/* BẢNG DỮ LIỆU */}
      <Card className="border-slate-200 shadow-sm p-0">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredEmployees}
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng số ${total} nhân sự`,
          }}
          scroll={{ x: 1250 }}
        />
      </Card>

      {/* MODAL XEM CHI TIẾT NHÂN SỰ & ẢNH CCCD / QR */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <IdcardOutlined className="text-blue-600" />
            <span>Chi tiết hồ sơ nhân sự: {selectedEmployee?.full_name}</span>
          </div>
        }
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button
            key="export"
            type="primary"
            icon={<FileWordOutlined />}
            loading={exportingId === selectedEmployee?.id}
            onClick={() => selectedEmployee && handleExportContract(selectedEmployee)}
          >
            Xuất Hợp đồng khung
          </Button>,
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Đóng
          </Button>,
        ]}
        width={750}
      >
        {selectedEmployee && (
          <div className="space-y-6 pt-2">
            {/* THÔNG TIN CHUNG */}
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Họ và tên">
                <strong>{selectedEmployee.full_name}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Số HĐ / STT">
                <Tag color="blue" className="font-semibold text-xs">
                  #{getEmployeeFixedIndex(selectedEmployee.id)} —{' '}
                  {generateContractCode(
                    getEmployeeFixedIndex(selectedEmployee.id),
                    selectedEmployee.full_name
                  )}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái" span={2}>
                {renderStatusTag(selectedEmployee.status)}
              </Descriptions.Item>
              <Descriptions.Item label="Vị trí công việc" span={2}>
                {selectedEmployee.position ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedEmployee.position
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((p, idx) => (
                        <Tag
                          key={idx}
                          color={getPositionTagColor(p)}
                          className="font-medium px-2 py-0.5"
                        >
                          {p}
                        </Tag>
                      ))}
                  </div>
                ) : (
                  <span className="text-slate-400 italic">Chưa phân công</span>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày sinh">
                {selectedEmployee.dob
                  ? dayjs(selectedEmployee.dob).format('DD/MM/YYYY')
                  : 'Chưa cập nhật'}
              </Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">
                {selectedEmployee.phone || 'Chưa cập nhật'}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {selectedEmployee.email || 'Chưa cập nhật'}
              </Descriptions.Item>
              <Descriptions.Item label="Số CCCD">
                {selectedEmployee.id_card_no || 'Chưa cập nhật'}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày cấp">
                {selectedEmployee.id_card_issue_date
                  ? dayjs(selectedEmployee.id_card_issue_date).format('DD/MM/YYYY')
                  : 'Chưa cập nhật'}
              </Descriptions.Item>
              <Descriptions.Item label="Nơi cấp">
                {selectedEmployee.id_card_issue_place || 'Chưa cập nhật'}
              </Descriptions.Item>
              <Descriptions.Item label="Hạn hợp đồng">
                {selectedEmployee.contract_start_date
                  ? `${dayjs(selectedEmployee.contract_start_date).format('DD/MM/YYYY')} - ${
                      selectedEmployee.contract_end_date
                        ? dayjs(selectedEmployee.contract_end_date).format('DD/MM/YYYY')
                        : 'Không thời hạn'
                    }`
                  : 'Chưa cập nhật'}
              </Descriptions.Item>
              <Descriptions.Item label="Ngân hàng">
                {selectedEmployee.bank_name || 'Chưa cập nhật'}
              </Descriptions.Item>
              <Descriptions.Item label="Số tài khoản">
                <strong>{selectedEmployee.bank_account_no || 'Chưa cập nhật'}</strong>
              </Descriptions.Item>
            </Descriptions>

            {/* HÌNH ẢNH CCCD VÀ MÃ QR */}
            <div>
              <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <BankOutlined /> Hình ảnh giấy tờ & Mã QR thanh toán
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Ảnh mặt trước */}
                <div className="border border-slate-200 rounded-lg p-3 text-center bg-slate-50">
                  <div className="text-xs font-medium text-slate-600 mb-2">CCCD Mặt trước</div>
                  {selectedEmployee.id_card_front_url ? (
                    <Image
                      src={selectedEmployee.id_card_front_url}
                      alt="CCCD mặt trước"
                      className="max-h-36 rounded object-cover mx-auto"
                    />
                  ) : (
                    <div className="h-28 flex items-center justify-center text-xs text-slate-400">
                      Chưa có ảnh
                    </div>
                  )}
                </div>

                {/* Ảnh mặt sau */}
                <div className="border border-slate-200 rounded-lg p-3 text-center bg-slate-50">
                  <div className="text-xs font-medium text-slate-600 mb-2">CCCD Mặt sau</div>
                  {selectedEmployee.id_card_back_url ? (
                    <Image
                      src={selectedEmployee.id_card_back_url}
                      alt="CCCD mặt sau"
                      className="max-h-36 rounded object-cover mx-auto"
                    />
                  ) : (
                    <div className="h-28 flex items-center justify-center text-xs text-slate-400">
                      Chưa có ảnh
                    </div>
                  )}
                </div>

                {/* Mã QR */}
                <div className="border border-slate-200 rounded-lg p-3 text-center bg-slate-50">
                  <div className="text-xs font-medium text-slate-600 mb-2">Mã QR Ngân hàng</div>
                  {selectedEmployee.qr_code_url ? (
                    <Image
                      src={selectedEmployee.qr_code_url}
                      alt="Mã QR ngân hàng"
                      className="max-h-36 rounded object-contain mx-auto"
                    />
                  ) : (
                    <div className="h-28 flex items-center justify-center text-xs text-slate-400">
                      Chưa có mã QR
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* DRAWER QUẢN LÝ JOB & TẠO PO CHO NHÂN SỰ */}
      {selectedJobEmployee && (
        <EmployeeJobManagement
          open={!!selectedJobEmployee}
          employee={selectedJobEmployee}
          onClose={() => {
            setSelectedJobEmployee(null);
            refetch();
          }}
        />
      )}
    </div>
  );
};

export default EmployeeList;

