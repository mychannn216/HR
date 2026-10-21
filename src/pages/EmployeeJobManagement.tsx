import React, { useState, useMemo } from 'react';
import {
  Card,
  Button,
  Table,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Space,
  Tag,
  Tabs,
  Modal,
  Popconfirm,
  message,
  Statistic,
  Row,
  Col,
  Descriptions,
  Tooltip,
  Drawer,
  Select,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  FileProtectOutlined,
  FileWordOutlined,
  FilePdfOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import type { Employee, Job, PurchaseOrder } from '../types';
import {
  getJobsByEmployee,
  createJob,
  updateJob,
  deleteJob,
} from '../services/jobService';
import {
  getPurchaseOrders,
  createPurchaseOrder,
  updatePOStatus,
  deletePurchaseOrder,
} from '../services/poService';
import {
  formatVND,
  formatDateVN,
  vndInputFormatter,
  vndInputParser,
} from '../utils/formatters';
import { exportPOWord, exportPOPDF } from '../utils/poExport';

const { TextArea } = Input;

export const UNIT_OPTIONS = [
  { label: 'Gói', value: 'Gói' },
  { label: 'Video', value: 'Video' },
  { label: 'Sản phẩm', value: 'Sản phẩm' },
];

export interface EmployeeJobManagementProps {
  employee: Employee;
  open?: boolean;
  onClose?: () => void;
  onBack?: () => void;
}

export const EmployeeJobManagement: React.FC<EmployeeJobManagementProps> = ({
  employee,
  open,
  onClose,
  onBack,
}) => {
  const queryClient = useQueryClient();
  const [quickForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [poForm] = Form.useForm();

  const [activeTab, setActiveTab] = useState<string>('pending');
  const [selectedJobIds, setSelectedJobIds] = useState<React.Key[]>([]);
  const [createPOModalVisible, setCreatePOModalVisible] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  // Tính tự động thành tiền trong Quick Form
  const [quickQty, setQuickQty] = useState<number>(1);
  const [quickPrice, setQuickPrice] = useState<number>(0);
  const quickTotal = useMemo(() => Math.round(quickQty * quickPrice), [quickQty, quickPrice]);

  // Tính tự động thành tiền trong Edit Form
  const [editQty, setEditQty] = useState<number>(1);
  const [editPrice, setEditPrice] = useState<number>(0);
  const editTotal = useMemo(() => Math.round(editQty * editPrice), [editQty, editPrice]);

  // 1. Fetch danh sách Job của nhân sự này
  const { data: jobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ['jobs', employee.id],
    queryFn: () => getJobsByEmployee(employee.id),
  });

  // 2. Fetch danh sách PO của nhân sự này
  const { data: purchaseOrders = [], isLoading: loadingPOs } = useQuery({
    queryKey: ['purchase_orders', employee.id],
    queryFn: () => getPurchaseOrders(employee.id),
  });

  // Phân loại Job chưa có PO và đã có PO
  const pendingJobs = useMemo(() => jobs.filter((j) => !j.po_id), [jobs]);
  const inPOJobs = useMemo(() => jobs.filter((j) => !!j.po_id), [jobs]);

  // Thống kê nhanh
  const totalJobAmount = useMemo(
    () => jobs.reduce((sum, j) => sum + (Number(j.total_amount) || 0), 0),
    [jobs]
  );
  const pendingAmount = useMemo(
    () => pendingJobs.reduce((sum, j) => sum + (Number(j.total_amount) || 0), 0),
    [pendingJobs]
  );
  const inPOAmount = useMemo(
    () => inPOJobs.reduce((sum, j) => sum + (Number(j.total_amount) || 0), 0),
    [inPOJobs]
  );

  // Danh sách các job được chọn để tạo PO
  const selectedJobs = useMemo(
    () => pendingJobs.filter((j) => selectedJobIds.includes(j.id)),
    [pendingJobs, selectedJobIds]
  );
  const selectedTotalAmount = useMemo(
    () => selectedJobs.reduce((sum, j) => sum + (Number(j.total_amount) || 0), 0),
    [selectedJobs]
  );

  // Mutation Thêm Job mới
  const createJobMutation = useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      message.success('Đã thêm công việc (Job) thành công!');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['monthly_jobs'] });
      quickForm.resetFields();
      quickForm.setFieldsValue({ unit: 'Gói', work_date: dayjs(), quantity: 1, unit_price: 0 });
      setQuickQty(1);
      setQuickPrice(0);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Lỗi khi thêm job';
      message.error(msg);
    },
  });

  // Mutation Sửa Job
  const updateJobMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Job> }) => updateJob(id, data),
    onSuccess: () => {
      message.success('Cập nhật job thành công!');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['monthly_jobs'] });
      setEditingJob(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Lỗi khi sửa job';
      message.error(msg);
    },
  });

  // Mutation Xóa Job
  const deleteJobMutation = useMutation({
    mutationFn: deleteJob,
    onSuccess: () => {
      message.success('Đã xóa job!');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['monthly_jobs'] });
      setSelectedJobIds([]);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Lỗi khi xóa job';
      message.error(msg);
    },
  });

  // Mutation Tạo PO
  const createPOMutation = useMutation({
    mutationFn: ({ jobsList, notes }: { jobsList: Job[]; notes?: string }) =>
      createPurchaseOrder(employee.id, jobsList, notes),
    onSuccess: (newPO) => {
      message.success(`Đã tạo đơn PO thành công: ${newPO.po_code}`);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      queryClient.invalidateQueries({ queryKey: ['monthly_jobs'] });
      setCreatePOModalVisible(false);
      setSelectedJobIds([]);
      poForm.resetFields();
      setActiveTab('pos'); // Chuyển sang xem danh sách PO
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Lỗi khi tạo PO';
      message.error(msg);
    },
  });

  // Mutation Đổi trạng thái PO
  const updatePOStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'issued' | 'paid' }) =>
      updatePOStatus(id, status),
    onSuccess: () => {
      message.success('Cập nhật trạng thái PO thành công!');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      queryClient.invalidateQueries({ queryKey: ['monthly_jobs'] });
    },
  });

  // Mutation Xóa PO
  const deletePOMutation = useMutation({
    mutationFn: deletePurchaseOrder,
    onSuccess: () => {
      message.success('Đã xóa đơn PO và khôi phục các job về trạng thái chờ!');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      queryClient.invalidateQueries({ queryKey: ['monthly_jobs'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Lỗi khi xóa PO';
      message.error(msg);
    },
  });

  // Xử lý thêm nhanh Job
  const handleQuickAdd = async (values: any) => {
    const unitVal = values.unit || 'Gói';
    createJobMutation.mutate({
      employee_id: employee.id,
      unit: unitVal,
      project_name: unitVal,
      job_title: values.job_title.trim(),
      work_date: values.work_date ? values.work_date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      quantity: values.quantity || 1,
      unit_price: values.unit_price || 0,
      notes: values.notes?.trim() || null,
      status: 'pending',
    });
  };

  // Mở modal sửa job
  const handleOpenEditJob = (job: Job) => {
    setEditingJob(job);
    editForm.setFieldsValue({
      unit: job.unit || 'Gói',
      job_title: job.job_title,
      work_date: dayjs(job.work_date),
      quantity: job.quantity,
      unit_price: job.unit_price,
      paid_amount: job.paid_amount || 0,
      notes: job.notes,
    });
    setEditQty(job.quantity);
    setEditPrice(job.unit_price);
  };

  // Submit sửa job
  const handleEditJobSubmit = async () => {
    if (!editingJob) return;
    try {
      const values = await editForm.validateFields();
      const unitVal = values.unit || 'Gói';
      updateJobMutation.mutate({
        id: editingJob.id,
        data: {
          unit: unitVal,
          project_name: unitVal,
          job_title: values.job_title.trim(),
          work_date: values.work_date.format('YYYY-MM-DD'),
          quantity: values.quantity,
          unit_price: values.unit_price,
          paid_amount: Number(values.paid_amount) || 0,
          notes: values.notes?.trim() || null,
        },
      });
    } catch {
      // Validate error
    }
  };

  // Submit tạo PO
  const handleConfirmCreatePO = async () => {
    try {
      const values = await poForm.validateFields();
      createPOMutation.mutate({
        jobsList: selectedJobs,
        notes: values.notes?.trim(),
      });
    } catch {
      // Validate error
    }
  };

  // Cột hiển thị bảng Job
  const jobColumns: ColumnsType<Job> = [
    {
      title: 'STT',
      key: 'stt',
      width: 50,
      align: 'center',
      render: (_, __, i) => i + 1,
    },
    {
      title: 'Đơn vị tính',
      dataIndex: 'unit',
      key: 'unit',
      width: 120,
      align: 'center',
      render: (text) => (
        <Tag color="cyan" className="font-medium m-0">
          {text || 'Gói'}
        </Tag>
      ),
    },
    {
      title: 'Nội dung công việc (Job)',
      dataIndex: 'job_title',
      key: 'job_title',
      render: (text, r) => (
        <div>
          <span className="font-semibold text-slate-800">{text}</span>
          {r.notes && (
            <p className="text-xs text-slate-400 m-0 italic line-clamp-1">Ghi chú: {r.notes}</p>
          )}
        </div>
      ),
    },
    {
      title: 'Ngày làm',
      dataIndex: 'work_date',
      key: 'work_date',
      width: 105,
      align: 'center',
      render: (d) => formatDateVN(d),
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      align: 'right',
      render: (val) => Number(val).toLocaleString('vi-VN'),
    },
    {
      title: 'Đơn giá',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 120,
      align: 'right',
      render: (val) => formatVND(val),
    },
    {
      title: 'Thành tiền',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 130,
      align: 'right',
      render: (val) => <strong className="text-blue-700">{formatVND(val)}</strong>,
    },
    {
      title: 'Đã thanh toán',
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      width: 130,
      align: 'right',
      render: (val) => (
        <span className={val > 0 ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
          {formatVND(val || 0)}
        </span>
      ),
    },
    {
      title: 'Trạng thái PO',
      key: 'po_status',
      width: 140,
      render: (_, r) => {
        if (!r.po_id) {
          return <Tag color="orange" icon={<ClockCircleOutlined />}>Chưa có PO</Tag>;
        }
        return (
          <Tag color="green" icon={<CheckCircleOutlined />}>
            {r.purchase_order?.po_code || 'Đã vào PO'}
          </Tag>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 100,
      align: 'center',
      render: (_, r) => {
        // Nếu đã vào PO thì không cho sửa/xóa trực tiếp
        if (r.po_id) {
          return <span className="text-xs text-slate-400">Đã khóa PO</span>;
        }
        return (
          <Space size="small">
            <Tooltip title="Sửa job">
              <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenEditJob(r)} />
            </Tooltip>
            <Popconfirm
              title="Xóa công việc"
              description={`Xóa job "${r.job_title}"?`}
              onConfirm={() => deleteJobMutation.mutate(r.id)}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true, loading: deleteJobMutation.isPending }}
            >
              <Tooltip title="Xóa job">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  // Cột hiển thị bảng PO
  const poColumns: ColumnsType<PurchaseOrder> = [
    {
      title: 'STT',
      key: 'stt',
      width: 50,
      align: 'center',
      render: (_, __, i) => i + 1,
    },
    {
      title: 'Mã đơn PO',
      dataIndex: 'po_code',
      key: 'po_code',
      width: 180,
      render: (text) => <strong className="text-blue-600 font-mono text-sm">{text}</strong>,
    },
    {
      title: 'Ngày phát hành',
      dataIndex: 'issue_date',
      key: 'issue_date',
      width: 120,
      align: 'center',
      render: (d) => formatDateVN(d),
    },
    {
      title: 'Số lượng Job',
      key: 'job_count',
      width: 110,
      align: 'center',
      render: (_, r) => {
        const count = jobs.filter((j) => j.po_id === r.id).length;
        return <Tag color="blue">{count} job</Tag>;
      },
    },
    {
      title: 'Tổng giá trị PO',
      dataIndex: 'total_amount',
      key: 'total_amount',
      align: 'right',
      render: (val) => <strong className="text-base text-slate-800">{formatVND(val)}</strong>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (st: string) => {
        if (st === 'paid') return <Tag color="green">Đã thanh toán</Tag>;
        return <Tag color="gold">Đã phát hành</Tag>;
      },
    },
    {
      title: 'Thao tác & Xuất file',
      key: 'action',
      width: 250,
      align: 'center',
      render: (_, r) => {
        const poJobs = jobs.filter((j) => j.po_id === r.id);
        const isPaid = r.status === 'paid';
        return (
          <Space size="small" wrap>
            {/* Xuất Word */}
            <Tooltip title="Xuất đơn PO dạng Word (.docx)">
              <Button
                size="small"
                icon={<FileWordOutlined className="text-blue-600" />}
                onClick={() => exportPOWord(r, employee, poJobs)}
              >
                Word
              </Button>
            </Tooltip>

            {/* In / Xuất PDF */}
            <Tooltip title="In hoặc lưu PDF chuẩn A4">
              <Button
                size="small"
                icon={<FilePdfOutlined className="text-red-500" />}
                onClick={() => exportPOPDF(r, employee, poJobs)}
              >
                PDF
              </Button>
            </Tooltip>

            {/* Đổi trạng thái thanh toán */}
            <Tooltip title={isPaid ? 'Đánh dấu chưa thanh toán' : 'Xác nhận đã thanh toán'}>
              <Button
                size="small"
                type={isPaid ? 'default' : 'primary'}
                ghost={!isPaid}
                onClick={() =>
                  updatePOStatusMutation.mutate({
                    id: r.id,
                    status: isPaid ? 'issued' : 'paid',
                  })
                }
              >
                {isPaid ? 'Hủy TT' : 'Đã TT'}
              </Button>
            </Tooltip>

            {/* Xóa PO */}
            <Popconfirm
              title="Xóa đơn PO"
              description={`Xóa đơn PO "${r.po_code}"? Các job liên quan sẽ trở về trạng thái chờ.`}
              onConfirm={() => deletePOMutation.mutate(r.id)}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Xóa PO">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const mainContent = (
    <div className="space-y-4">
      {/* HEADER: THÔNG TIN NHÂN SỰ & THỐNG KÊ */}
      <Card className="border-slate-200 shadow-sm">
        {onBack && open === undefined && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
                Quay lại danh sách
              </Button>
              <div>
                <h2 className="text-xl font-bold text-slate-800 m-0">
                  Quản lý Job & Tạo PO: {employee.full_name}
                </h2>
                <p className="text-xs text-slate-500 m-0">
                  Thêm công việc, tính giá tự động và gom các job tạo đơn PO thanh toán
                </p>
              </div>
            </div>
          </div>
        )}

        {/* THÔNG TIN NHÂN SỰ CHI TIẾT */}
        <Descriptions size="small" column={{ xs: 1, sm: 3 }} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <Descriptions.Item label="Số CCCD">
            <strong>{employee.id_card_no || '—'}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Số điện thoại">
            {employee.phone || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Email">
            {employee.email || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Ngân hàng">
            {employee.bank_name || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Số tài khoản">
            <strong className="text-blue-700">{employee.bank_account_no || '—'}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <Tag color={employee.status === 'active' ? 'green' : 'orange'}>
              {employee.status === 'active' ? 'Đang làm việc' : employee.status}
            </Tag>
          </Descriptions.Item>
        </Descriptions>

        {/* THỐNG KÊ TIỀN NÔNG */}
        <Row gutter={16} className="mt-4 pt-3 border-t border-slate-100">
          <Col xs={12} sm={6}>
            <Statistic
              title="Tổng giá trị Job"
              value={totalJobAmount}
              formatter={(val) => formatVND(Number(val))}
              valueStyle={{ color: '#1677ff' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="Chờ gom vào PO"
              value={pendingAmount}
              formatter={(val) => formatVND(Number(val))}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="Đã vào đơn PO"
              value={inPOAmount}
              formatter={(val) => formatVND(Number(val))}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="Tổng số PO đã tạo"
              value={purchaseOrders.length}
              suffix="đơn"
              prefix={<FileProtectOutlined className="text-blue-500 mr-1" />}
            />
          </Col>
        </Row>
      </Card>

      {/* THANH NHẬP NHANH JOB MỚI CHO NHÂN SỰ NÀY */}
      <Card
        size="small"
        className="border-blue-200 bg-blue-50/40 shadow-sm"
        title={
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-900">
            <ThunderboltOutlined className="text-amber-500" />
            Nhập nhanh Job mới cho nhân sự ({employee.full_name})
          </div>
        }
      >
        <Form
          form={quickForm}
          layout="inline"
          onFinish={handleQuickAdd}
          initialValues={{
            unit: 'Gói',
            work_date: dayjs(),
            quantity: 1,
            unit_price: 0,
          }}
          className="flex flex-wrap items-center gap-y-2"
        >
          {/* Đơn vị tính */}
          <Form.Item name="unit" className="w-32 !mr-2">
            <Select options={UNIT_OPTIONS} placeholder="Đơn vị tính" />
          </Form.Item>

          {/* Tên công việc */}
          <Form.Item
            name="job_title"
            rules={[{ required: true, message: 'Nhập nội dung job' }]}
            className="flex-1 min-w-[200px] !mr-2"
          >
            <Input placeholder="Nội dung công việc thực hiện..." />
          </Form.Item>

          {/* Ngày làm */}
          <Form.Item name="work_date" className="w-32 !mr-2">
            <DatePicker format="DD/MM/YYYY" allowClear={false} className="w-full" />
          </Form.Item>

          {/* Số lượng */}
          <Form.Item name="quantity" className="w-20 !mr-2">
            <InputNumber
              min={0.1}
              step={1}
              placeholder="SL"
              className="w-full"
              onChange={(val) => setQuickQty(Number(val) || 0)}
            />
          </Form.Item>

          {/* Đơn giá */}
          <Form.Item name="unit_price" className="w-32 !mr-2">
            <InputNumber
              min={0}
              step={50000}
              placeholder="Đơn giá"
              className="w-full"
              formatter={vndInputFormatter}
              parser={vndInputParser}
              onChange={(val) => setQuickPrice(Number(val) || 0)}
            />
          </Form.Item>

          {/* Thành tiền tính tự động */}
          <div className="text-xs text-blue-800 font-semibold px-2 py-1 bg-blue-100 rounded mr-2 min-w-[100px] text-right">
            {formatVND(quickTotal)}
          </div>

          <Button
            type="primary"
            htmlType="submit"
            icon={<PlusOutlined />}
            loading={createJobMutation.isPending}
            className="bg-blue-600"
          >
            Thêm Job
          </Button>
        </Form>
      </Card>

      {/* DANH SÁCH JOB & ĐƠN PO */}
      <Card className="border-slate-200 shadow-sm p-0">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          className="px-4"
          items={[
            {
              key: 'pending',
              label: (
                <span>
                  Job chưa có PO <Tag color="orange" className="ml-1">{pendingJobs.length}</Tag>
                </span>
              ),
              children: (
                <div>
                  {/* THANH TẠO PO TỪ CÁC JOB ĐƯỢC CHỌN */}
                  <div className="p-3 mb-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm">
                      Đã chọn: <strong>{selectedJobIds.length}</strong> / {pendingJobs.length} job
                      {selectedJobIds.length > 0 && (
                        <span className="ml-3 text-blue-700 font-bold">
                          (Tổng tiền: {formatVND(selectedTotalAmount)})
                        </span>
                      )}
                    </div>

                    <Button
                      type="primary"
                      icon={<FileProtectOutlined />}
                      disabled={selectedJobIds.length === 0}
                      onClick={() => setCreatePOModalVisible(true)}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      Tạo đơn PO cho {selectedJobIds.length} job đã chọn
                    </Button>
                  </div>

                  <Table
                    rowKey="id"
                    columns={jobColumns}
                    dataSource={pendingJobs}
                    loading={loadingJobs}
                    rowSelection={{
                      selectedRowKeys: selectedJobIds,
                      onChange: (newKeys) => setSelectedJobIds(newKeys),
                    }}
                    pagination={{ pageSize: 8 }}
                    scroll={{ x: 1000 }}
                  />
                </div>
              ),
            },
            {
              key: 'in_po',
              label: (
                <span>
                  Job đã vào PO <Tag color="green" className="ml-1">{inPOJobs.length}</Tag>
                </span>
              ),
              children: (
                <Table
                  rowKey="id"
                  columns={jobColumns}
                  dataSource={inPOJobs}
                  loading={loadingJobs}
                  pagination={{ pageSize: 8 }}
                  scroll={{ x: 1000 }}
                />
              ),
            },
            {
              key: 'pos',
              label: (
                <span>
                  Danh sách đơn PO <Tag color="blue" className="ml-1">{purchaseOrders.length}</Tag>
                </span>
              ),
              children: (
                <Table
                  rowKey="id"
                  columns={poColumns}
                  dataSource={purchaseOrders}
                  loading={loadingPOs}
                  pagination={{ pageSize: 8 }}
                  scroll={{ x: 1000 }}
                />
              ),
            },
            {
              key: 'all',
              label: `Tất cả Job (${jobs.length})`,
              children: (
                <Table
                  rowKey="id"
                  columns={jobColumns}
                  dataSource={jobs}
                  loading={loadingJobs}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1000 }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* MODAL XÁC NHẬN TẠO PO */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <FileProtectOutlined className="text-emerald-600" />
            <span>Xác nhận Tạo Đơn Đặt Hàng & Giao Việc (PO)</span>
          </div>
        }
        open={createPOModalVisible}
        onCancel={() => setCreatePOModalVisible(false)}
        onOk={handleConfirmCreatePO}
        confirmLoading={createPOMutation.isPending}
        okText="Xác nhận Tạo PO"
        cancelText="Hủy bỏ"
        width={600}
      >
        <div className="space-y-3 pt-2">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1">
            <div>
              Nhân sự nhận PO: <strong>{employee.full_name}</strong>
            </div>
            <div>
              Số lượng Job gom vào PO: <strong>{selectedJobs.length} job</strong>
            </div>
            <div className="text-sm font-bold text-emerald-800">
              Tổng giá trị PO: {formatVND(selectedTotalAmount)}
            </div>
          </div>

          <Form form={poForm} layout="vertical">
            <Form.Item name="notes" label="Ghi chú đơn PO (nếu có)">
              <TextArea rows={3} placeholder="Điều kiện thanh toán, hạn nghiệm thu sản phẩm..." />
            </Form.Item>
          </Form>
        </div>
      </Modal>

      {/* MODAL SỬA JOB */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <EditOutlined className="text-blue-600" />
            <span>Chỉnh sửa thông tin Job</span>
          </div>
        }
        open={!!editingJob}
        onCancel={() => setEditingJob(null)}
        onOk={handleEditJobSubmit}
        confirmLoading={updateJobMutation.isPending}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        width={550}
      >
        <Form form={editForm} layout="vertical" className="pt-2">
          <Form.Item name="unit" label="Đơn vị tính" rules={[{ required: true, message: 'Chọn đơn vị tính' }]}>
            <Select options={UNIT_OPTIONS} placeholder="Chọn đơn vị tính" />
          </Form.Item>

          <Form.Item
            name="job_title"
            label="Nội dung công việc"
            rules={[{ required: true, message: 'Nhập nội dung job' }]}
          >
            <Input placeholder="Công việc..." />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="work_date" label="Ngày làm" rules={[{ required: true }]}>
                <DatePicker format="DD/MM/YYYY" className="w-full" />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8}>
              <Form.Item name="quantity" label="Số lượng" rules={[{ required: true }]}>
                <InputNumber
                  min={0.1}
                  className="w-full"
                  onChange={(v) => setEditQty(Number(v) || 0)}
                />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8}>
              <Form.Item name="unit_price" label="Đơn giá" rules={[{ required: true }]}>
                <InputNumber
                  min={0}
                  className="w-full"
                  formatter={vndInputFormatter}
                  parser={vndInputParser}
                  onChange={(v) => setEditPrice(Number(v) || 0)}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="paid_amount"
                label="Đã thanh toán (VNĐ)"
                tooltip="Số tiền đã chi trả thực tế cho công việc này"
              >
                <InputNumber
                  min={0}
                  className="w-full"
                  placeholder="0 ₫"
                  formatter={vndInputFormatter}
                  parser={vndInputParser}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <div className="pt-7 text-right">
                <span className="text-xs text-slate-500 mr-2">Thành tiền:</span>
                <strong className="text-blue-700 text-sm">{formatVND(editTotal)}</strong>
              </div>
            </Col>
          </Row>

          <Form.Item name="notes" label="Ghi chú">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );

  if (open !== undefined) {
    return (
      <Drawer
        open={open}
        onClose={onClose}
        width={1120}
        title={
          <div className="flex items-center gap-2">
            <FileProtectOutlined className="text-indigo-600 text-lg" />
            <div>
              <span className="font-bold text-slate-800 text-base">
                Quản lý Job & PO: {employee.full_name}
              </span>
              <span className="text-xs text-slate-400 font-normal ml-3 hidden sm:inline">
                (CCCD: {employee.id_card_no || '—'} • SĐT: {employee.phone || '—'} • {employee.bank_name || '—'})
              </span>
            </div>
          </div>
        }
        styles={{
          body: { padding: '16px 20px', backgroundColor: '#f8fafc' },
        }}
        destroyOnClose
      >
        {mainContent}
      </Drawer>
    );
  }

  return mainContent;
};

export default EmployeeJobManagement;
