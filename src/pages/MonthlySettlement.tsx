import React, { useState, useMemo } from 'react';
import {
  Table,
  Button,
  Card,
  Tag,
  Space,
  Modal,
  DatePicker,
  Row,
  Col,
  Statistic,
  Tooltip,
  Dropdown,
  message,
  Alert,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  CalculatorOutlined,
  FileWordOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  EyeOutlined,
  ReloadOutlined,
  UsergroupAddOutlined,
  DollarOutlined,
  DownOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CheckCircleFilled,
  ClockCircleFilled,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import type { Job, EmployeeSettlementSummary } from '../types';
import {
  getAllJobs,
  createJob,
  updateJob,
  deleteJob,
} from '../services/jobService';
import { getEmployees } from '../services/employeeService';
import {
  formatVND,
  formatDateVN,
  vndInputFormatter,
  vndInputParser,
} from '../utils/formatters';
import { exportPersonalSettlementExcel, exportCompanySettlementExcel } from '../utils/excelExport';
import { exportSettlementWord, exportSettlementPDF } from '../utils/settlementExport';

const { TextArea } = Input;

interface InlinePaidAmountInputProps {
  jobId: string;
  initialValue: number;
  onSave: (jobId: string, val: number) => Promise<void>;
}

const InlinePaidAmountInput: React.FC<InlinePaidAmountInputProps> = ({
  jobId,
  initialValue,
  onSave,
}) => {
  const [val, setVal] = useState<number | null>(initialValue);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  const commit = async () => {
    const num = Number(val) || 0;
    if (num === (Number(initialValue) || 0)) return;
    setSaving(true);
    try {
      await onSave(jobId, num);
    } catch {
      // Revert to initial value on failure
      setVal(initialValue);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Tooltip title="Nhập số tiền đã thanh toán cho job này (bấm Enter hoặc click ra ngoài để lưu)">
      <InputNumber
        size="small"
        min={0}
        value={val}
        disabled={saving}
        onChange={(v) => setVal(v !== null ? Number(v) : 0)}
        formatter={vndInputFormatter}
        parser={vndInputParser}
        className="w-full text-right font-medium text-emerald-700 border-emerald-300 hover:border-emerald-500 focus:border-emerald-600"
        onBlur={commit}
        onPressEnter={commit}
      />
    </Tooltip>
  );
};

const UNIT_OPTIONS = [
  { label: 'Gói', value: 'Gói' },
  { label: 'Video', value: 'Video' },
  { label: 'Sản phẩm', value: 'Sản phẩm' },
];

export const MonthlySettlement: React.FC = () => {
  const queryClient = useQueryClient();
  const [jobForm] = Form.useForm();

  // Chọn Tháng / Năm (mặc định tháng hiện tại)
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());
  const selectedMonth = selectedDate.month() + 1;
  const selectedYear = selectedDate.year();

  // Modal chi tiết Job của nhân sự
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Modal Thêm / Chỉnh sửa Job trực tiếp trong quyết toán
  const [jobModalVisible, setJobModalVisible] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [formQty, setFormQty] = useState<number>(1);
  const [formPrice, setFormPrice] = useState<number>(0);
  const formTotal = useMemo(() => Math.round(formQty * formPrice), [formQty, formPrice]);

  // Tính khoảng ngày bắt đầu & kết thúc của tháng
  const startOfMonth = useMemo(
    () => selectedDate.startOf('month').format('YYYY-MM-DD'),
    [selectedDate]
  );
  const endOfMonth = useMemo(
    () => selectedDate.endOf('month').format('YYYY-MM-DD'),
    [selectedDate]
  );

  // Fetch dữ liệu nhân sự
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: getEmployees,
  });

  // Fetch chi phí job trong tháng từ bảng jobs
  const {
    data: monthlyJobs = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<Job[]>({
    queryKey: ['monthly_jobs', startOfMonth, endOfMonth],
    queryFn: () => getAllJobs(startOfMonth, endOfMonth),
  });

  // TỔNG HỢP VÀ TÍNH TOÁN QUYẾT TOÁN THEO TỪNG NHÂN SỰ
  const summaries: EmployeeSettlementSummary[] = useMemo(() => {
    // Nhóm các jobs theo employee_id
    const grouped = new Map<string, Job[]>();
    monthlyJobs.forEach((item) => {
      if (!grouped.has(item.employee_id)) {
        grouped.set(item.employee_id, []);
      }
      grouped.get(item.employee_id)!.push(item);
    });

    const result: EmployeeSettlementSummary[] = [];

    grouped.forEach((items, empId) => {
      // Tìm employee tương ứng (từ danh sách employees hoặc từ item)
      const emp =
        employees.find((e) => e.id === empId) ||
        (items[0]?.employee ? (items[0].employee as any) : null);

      if (!emp) return;

      // STT cố định bất biến của nhân sự theo ngày tạo (không bao giờ thay đổi khi thêm job hay thêm người)
      const empIndex = employees.findIndex((e) => e.id === emp.id);
      const fixedStt = empIndex !== -1 ? empIndex + 1 : 1;

      const totalJobs = items.length;
      const totalIncome = items.reduce(
        (sum, it) => sum + (Number(it.total_amount) || 0),
        0
      );

      // LOGIC KHẤU TRỪ THUẾ:
      // - Nếu Tổng thu nhập >= 5.000.000 VNĐ: Khấu trừ = 10% * Tổng thu nhập
      // - Nếu Tổng thu nhập < 5.000.000 VNĐ: Khấu trừ = 0 VNĐ
      const taxDeduction =
        totalIncome >= 5000000 ? Math.round(totalIncome * 0.10) : 0;

      // Xử lý tiền đã thanh toán: kiểm tra rõ ràng tránh lỗi JS coi số 0 là falsy
      const paidAmount = items.reduce((sum, it) => {
        const itPaid =
          it.paid_amount !== undefined && it.paid_amount !== null
            ? Number(it.paid_amount)
            : it.status === 'paid'
            ? Number(it.total_amount) || 0
            : 0;
        return sum + (isNaN(itPaid) ? 0 : itPaid);
      }, 0);

      // Thực nhận = Tổng thu nhập - Khấu trừ thuế (KHÔNG bị trừ bởi số tiền đã thanh toán)
      const netIncome = Math.max(0, totalIncome - taxDeduction);

      result.push({
        employee: emp,
        month: selectedMonth,
        year: selectedYear,
        items,
        totalJobs,
        totalIncome,
        taxDeduction,
        paidAmount,
        netIncome,
        stt: fixedStt, // STT cố định bất biến
      });
    });

    // Sắp xếp theo tổng thu nhập giảm dần
    return result.sort((a, b) => b.totalIncome - a.totalIncome);
  }, [monthlyJobs, employees, selectedMonth, selectedYear]);

  // Nhân sự hiện đang được xem chi tiết (tự động cập nhật số liệu khi job thay đổi)
  const activeSummary = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return summaries.find((s) => s.employee.id === selectedEmployeeId) || null;
  }, [summaries, selectedEmployeeId]);

  // Thống kê tổng hợp toàn công ty
  const companyStats = useMemo(() => {
    const totalEmployees = summaries.length;
    const totalIncome = summaries.reduce((acc, s) => acc + s.totalIncome, 0);
    const totalTax = summaries.reduce((acc, s) => acc + s.taxDeduction, 0);
    const totalPaid = summaries.reduce((acc, s) => acc + s.paidAmount, 0);
    const totalNet = summaries.reduce((acc, s) => acc + s.netIncome, 0);

    return { totalEmployees, totalIncome, totalTax, totalPaid, totalNet };
  }, [summaries]);

  // Mutation Lưu (Thêm mới / Cập nhật) Job trực tiếp
  const saveJobMutation = useMutation({
    mutationFn: async (values: any) => {
      const unitVal = values.unit || 'Gói';
      const payload = {
        unit: unitVal,
        project_name: unitVal,
        job_title: values.job_title.trim(),
        work_date: values.work_date
          ? values.work_date.format('YYYY-MM-DD')
          : dayjs().format('YYYY-MM-DD'),
        quantity: values.quantity || 1,
        unit_price: values.unit_price || 0,
        paid_amount: Number(values.paid_amount) || 0,
        notes: values.notes?.trim() || null,
      };

      if (editingJob) {
        return updateJob(editingJob.id, payload);
      } else {
        if (!selectedEmployeeId) throw new Error('Chưa chọn nhân sự');
        return createJob({
          ...payload,
          employee_id: selectedEmployeeId,
          status: 'pending',
        });
      }
    },
    onSuccess: () => {
      message.success(editingJob ? 'Đã cập nhật thông tin job!' : 'Đã thêm job mới cho nhân sự!');
      queryClient.invalidateQueries({ queryKey: ['monthly_jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setJobModalVisible(false);
      setEditingJob(null);
      jobForm.resetFields();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Lỗi khi lưu job';
      if (msg.includes('paid_amount') || msg.includes('column')) {
        message.error({
          content: 'Bảng jobs trên Supabase chưa có cột "paid_amount". Vui lòng chạy lệnh SQL bổ sung cột!',
          duration: 7,
        });
      } else {
        message.error(msg);
      }
    },
  });

  // Cập nhật số tiền đã thanh toán trực tiếp trên bảng
  const handleInlineUpdatePaidAmount = async (jobId: string, paidAmount: number) => {
    try {
      await updateJob(jobId, { paid_amount: paidAmount });
      queryClient.invalidateQueries({ queryKey: ['monthly_jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      message.success('Đã cập nhật tiền thanh toán!');
    } catch (err: unknown) {
      console.error('Lỗi khi cập nhật tiền thanh toán:', err);
      const msg = err instanceof Error ? err.message : 'Lỗi khi cập nhật tiền thanh toán';
      if (msg.includes('paid_amount') || msg.includes('column')) {
        message.error({
          content: 'Bảng jobs trên Supabase chưa có cột "paid_amount". Vui lòng chạy lệnh SQL bổ sung cột vào Supabase!',
          duration: 7,
        });
      } else {
        message.error(msg);
      }
      throw err;
    }
  };

  // Mutation Xóa Job
  const deleteJobMutation = useMutation({
    mutationFn: deleteJob,
    onSuccess: () => {
      message.success('Đã xóa job thành công!');
      queryClient.invalidateQueries({ queryKey: ['monthly_jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Lỗi khi xóa job';
      message.error(msg);
    },
  });

  // Mở modal thêm job mới trong tháng cho nhân sự đang chọn
  const handleOpenAddJob = () => {
    setEditingJob(null);
    setFormQty(1);
    setFormPrice(0);
    jobForm.resetFields();
    jobForm.setFieldsValue({
      unit: 'Gói',
      work_date: selectedDate.startOf('month'),
      quantity: 1,
      unit_price: 0,
      paid_amount: 0,
    });
    setJobModalVisible(true);
  };

  // Mở modal chỉnh sửa job
  const handleOpenEditJob = (job: Job) => {
    setEditingJob(job);
    setFormQty(job.quantity || 1);
    setFormPrice(job.unit_price || 0);
    jobForm.setFieldsValue({
      unit: job.unit || 'Gói',
      job_title: job.job_title,
      work_date: dayjs(job.work_date),
      quantity: job.quantity,
      unit_price: job.unit_price,
      paid_amount: job.paid_amount || 0,
      notes: job.notes,
    });
    setJobModalVisible(true);
  };

  // Xử lý xuất Excel tổng hợp toàn công ty
  const handleExportCompanyExcel = async () => {
    if (summaries.length === 0) {
      message.warning('Không có dữ liệu quyết toán trong tháng được chọn để xuất file.');
      return;
    }
    try {
      await exportCompanySettlementExcel(summaries, selectedMonth, selectedYear);
      message.success('Đã xuất Bảng lương tổng hợp toàn công ty (Excel)!');
    } catch (err: unknown) {
      console.error(err);
      message.error('Lỗi khi xuất file Excel');
    }
  };

  // Menu Xuất Biên bản nghiệm thu (Word / PDF / Excel)
  const getExportMenu = (record: EmployeeSettlementSummary): MenuProps => ({
    items: [
      {
        key: 'word',
        icon: <FileWordOutlined className="text-blue-600" />,
        label: 'Biên bản nghiệm thu (Word .docx)',
        onClick: async () => {
          try {
            await exportSettlementWord(record);
            message.success(`Đã xuất Biên bản Word cho ${record.employee.full_name}!`);
          } catch (err) {
            console.error(err);
            message.error('Lỗi khi xuất file Word');
          }
        },
      },
      {
        key: 'pdf',
        icon: <FilePdfOutlined className="text-red-500" />,
        label: 'Biên bản nghiệm thu (PDF in A4)',
        onClick: () => {
          exportSettlementPDF(record);
        },
      },
      {
        key: 'excel',
        icon: <FileExcelOutlined className="text-emerald-600" />,
        label: 'Bảng kê chi tiết cá nhân (Excel .xlsx)',
        onClick: async () => {
          try {
            await exportPersonalSettlementExcel(record);
            message.success(`Đã xuất Excel cá nhân cho ${record.employee.full_name}!`);
          } catch (err) {
            console.error(err);
            message.error('Lỗi khi xuất file Excel cá nhân');
          }
        },
      },
    ],
  });

  // Cấu trúc dữ liệu dòng bảng hỗ trợ gộp ô rowSpan theo nhân sự
  interface SettlementTableRow {
    key: string;
    summary: EmployeeSettlementSummary;
    employeeIndex: number;
    job: Job | null;
    jobIndex: number;
    isFirstRow: boolean;
    rowSpan: number;
  }

  // Chuyển đổi dữ liệu sang dạng phẳng hỗ trợ rowSpan gộp dòng theo nhân sự
  const tableRows: SettlementTableRow[] = useMemo(() => {
    const rows: SettlementTableRow[] = [];

    summaries.forEach((summary, empIdx) => {
      const items = summary.items || [];
      if (items.length === 0) {
        rows.push({
          key: `emp_${summary.employee.id}_empty`,
          summary,
          employeeIndex: empIdx,
          job: null,
          jobIndex: 0,
          isFirstRow: true,
          rowSpan: 1,
        });
      } else {
        items.forEach((job, jobIdx) => {
          rows.push({
            key: `emp_${summary.employee.id}_job_${job.id}`,
            summary,
            employeeIndex: empIdx,
            job,
            jobIndex: jobIdx,
            isFirstRow: jobIdx === 0,
            rowSpan: jobIdx === 0 ? items.length : 0,
          });
        });
      }
    });

    return rows;
  }, [summaries]);

  // Cột hiển thị bảng tổng hợp (sử dụng rowSpan gộp ô theo từng nhân sự)
  const columns: ColumnsType<SettlementTableRow> = [
    {
      title: 'STT',
      key: 'stt',
      width: 55,
      align: 'center',
      onCell: (record) => ({ rowSpan: record.rowSpan }),
      render: (_, record) => (
        <span className="font-semibold text-slate-700">
          {record.summary.stt || record.employeeIndex + 1}
        </span>
      ),
    },
    {
      title: 'Họ và tên nhân sự',
      key: 'employee',
      width: 190,
      onCell: (record) => ({ rowSpan: record.rowSpan }),
      render: (_, record) => (
        <div>
          <span
            className="font-semibold text-slate-900 hover:text-blue-600 transition-colors cursor-pointer"
            onClick={() => {
              setSelectedEmployeeId(record.summary.employee.id);
              setDetailModalVisible(true);
            }}
          >
            {record.summary.employee.full_name}
          </span>
          <div className="text-xs text-slate-500 font-mono mt-0.5">
            {record.summary.employee.bank_account_no || '—'}
            {record.summary.employee.bank_name ? ` • ${record.summary.employee.bank_name}` : ''}
          </div>
          {record.summary.employee.phone && (
            <div className="text-[11px] text-slate-400 mt-0.5">
              SĐT: {record.summary.employee.phone}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Nội dung job / Đơn vị tính',
      key: 'job_title',
      minWidth: 200,
      onCell: () => ({ rowSpan: 1 }),
      render: (_, record) => {
        if (!record.job) {
          return <span className="text-slate-400 italic text-xs">Chưa có job nào</span>;
        }
        return (
          <div>
            <span className="inline-block text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded mr-1.5 mb-1">
              ĐVT: {record.job.unit || 'Gói'}
            </span>
            <div className="font-medium text-slate-800 text-xs leading-snug">
              {record.job.job_title}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {formatDateVN(record.job.work_date)}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Số lượng',
      key: 'quantity',
      width: 75,
      align: 'center',
      onCell: () => ({ rowSpan: 1 }),
      render: (_, record) => (record.job ? record.job.quantity : '—'),
    },
    {
      title: 'Đơn giá',
      key: 'unit_price',
      width: 110,
      align: 'right',
      onCell: () => ({ rowSpan: 1 }),
      render: (_, record) => (record.job ? formatVND(record.job.unit_price) : '—'),
    },
    {
      title: 'Thành tiền',
      key: 'total_amount',
      width: 125,
      align: 'right',
      onCell: () => ({ rowSpan: 1 }),
      render: (_, record) =>
        record.job ? (
          <strong className="text-blue-700 font-semibold">{formatVND(record.job.total_amount)}</strong>
        ) : (
          '—'
        ),
    },
    {
      title: 'Tổng',
      key: 'totalIncome',
      width: 125,
      align: 'right',
      onCell: (record) => ({ rowSpan: record.rowSpan }),
      render: (_, record) => (
        <strong className="text-slate-900 font-bold">{formatVND(record.summary.totalIncome)}</strong>
      ),
    },
    {
      title: 'Thuế 10%',
      key: 'taxDeduction',
      width: 115,
      align: 'right',
      onCell: (record) => ({ rowSpan: record.rowSpan }),
      render: (_, record) => (
        <div>
          <div
            className={
              record.summary.taxDeduction > 0
                ? 'font-semibold text-red-600'
                : 'text-slate-400 font-medium'
            }
          >
            {record.summary.taxDeduction > 0
              ? `-${formatVND(record.summary.taxDeduction)}`
              : '0 ₫'}
          </div>
          {record.summary.totalIncome >= 5000000 ? (
            <span className="text-[10px] text-red-500 font-semibold block mt-0.5">(&ge; 5tr)</span>
          ) : (
            <span className="text-[10px] text-slate-400 block mt-0.5">Miễn (&lt; 5tr)</span>
          )}
        </div>
      ),
    },
    {
      title: 'Thực nhận',
      key: 'netIncome',
      width: 130,
      align: 'right',
      onCell: (record) => ({ rowSpan: record.rowSpan }),
      render: (_, record) => {
        const net = record.summary.totalIncome - record.summary.taxDeduction;
        return <strong className="text-blue-900 font-bold text-sm">{formatVND(net)}</strong>;
      },
    },
    {
      title: 'Đã thanh toán',
      key: 'paidProgress',
      width: 195,
      align: 'center',
      onCell: (record) => ({ rowSpan: record.rowSpan }),
      render: (_, record) => {
        const net = record.summary.totalIncome - record.summary.taxDeduction;
        const paid = record.summary.paidAmount;
        return (
          <div className="font-medium text-xs whitespace-nowrap">
            <span
              className={
                paid >= net && net > 0
                  ? 'font-bold text-emerald-700'
                  : paid > 0
                  ? 'font-bold text-amber-600'
                  : 'text-slate-500'
              }
            >
              {formatVND(paid)}
            </span>
            <span className="text-slate-400 mx-1">/</span>
            <span className="text-slate-700 font-medium">{formatVND(net)}</span>
          </div>
        );
      },
    },
    {
      title: 'Trạng thái TT',
      key: 'paymentStatus',
      width: 155,
      align: 'center',
      onCell: (record) => ({ rowSpan: record.rowSpan }),
      render: (_, record) => {
        const net = record.summary.totalIncome - record.summary.taxDeduction;
        const paid = record.summary.paidAmount;

        if ((paid >= net && net > 0) || (paid > 0 && net === 0)) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircleFilled className="text-emerald-600 text-xs" /> Đã thanh toán
            </span>
          );
        }

        if (paid > 0 && paid < net) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
              <ClockCircleFilled className="text-amber-500 text-xs" /> Thanh toán một phần
            </span>
          );
        }

        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-300">
            <ExclamationCircleOutlined className="text-slate-400 text-xs" /> Chưa thanh toán
          </span>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 150,
      align: 'center',
      onCell: (record) => ({ rowSpan: record.rowSpan }),
      render: (_, record) => (
        <Space size="small" onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Xem & chỉnh sửa chi tiết các job">
            <Button
              size="small"
              type="primary"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedEmployeeId(record.summary.employee.id);
                setDetailModalVisible(true);
              }}
              style={{ backgroundColor: '#2563eb', borderColor: '#2563eb' }}
            >
              Chi tiết
            </Button>
          </Tooltip>

          <Dropdown
            menu={getExportMenu(record.summary)}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button size="small" className="text-slate-600 border-slate-300 px-2">
              Xuất <DownOutlined className="text-xs" />
            </Button>
          </Dropdown>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* THẺ THỐNG KÊ TỔNG QUAN THÁNG */}
      <Row gutter={16}>
        <Col xs={12} sm={6} md={5}>
          <Card className="border-slate-200 shadow-sm">
            <Statistic
              title="Nhân sự nhận lương"
              value={companyStats.totalEmployees}
              suffix="người"
              prefix={<UsergroupAddOutlined className="text-blue-500 mr-1" />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} md={5}>
          <Card className="border-slate-200 shadow-sm">
            <Statistic
              title="Tổng thu nhập gộp"
              value={companyStats.totalIncome}
              formatter={(val) => formatVND(Number(val))}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Card className="border-slate-200 shadow-sm">
            <Statistic
              title="Thuế TNCN (10%)"
              value={companyStats.totalTax}
              formatter={(val) => formatVND(Number(val))}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} md={5}>
          <Card className="border-slate-200 shadow-sm">
            <Statistic
              title="Đã thanh toán"
              value={companyStats.totalPaid}
              formatter={(val) => formatVND(Number(val))}
              valueStyle={{ color: '#059669' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={5}>
          <Card className="border-blue-200 bg-blue-50/30 shadow-sm">
            <Statistic
              title="TỔNG THỰC NHẬN (TỔNG - THUẾ)"
              value={companyStats.totalNet}
              formatter={(val) => formatVND(Number(val))}
              valueStyle={{ color: '#1e3a8a', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
      </Row>

      {/* THANH ĐIỀU HƯỚNG VÀ XUẤT EXCEL TỔNG HỢP */}
      <Card className="border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 m-0">
              <CalculatorOutlined className="text-blue-600" /> Bảng Tổng hợp & Quyết toán Lương Tháng
            </h2>
            <p className="text-xs text-slate-500 m-0">
              Bấm vào nhân sự để xem và chỉnh sửa trực tiếp các job trong tháng. Tự động khấu trừ 10% thuế nếu &ge; 5tr.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Bộ chọn Tháng / Năm */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">Kỳ quyết toán:</span>
              <DatePicker
                picker="month"
                allowClear={false}
                value={selectedDate}
                onChange={(date) => date && setSelectedDate(date)}
                format="MM/YYYY"
                className="w-36 font-semibold text-blue-600"
              />
            </div>

            <Button
              icon={<ReloadOutlined spin={isRefetching} />}
              onClick={() => refetch()}
            >
              Làm mới
            </Button>

            {/* Nút Xuất Bảng lương tổng hợp toàn công ty (Excel) */}
            <Button
              type="primary"
              icon={<FileExcelOutlined />}
              onClick={handleExportCompanyExcel}
              className="bg-emerald-600 hover:bg-emerald-700 font-medium"
            >
              Xuất Bảng lương tổng hợp (Excel)
            </Button>
          </div>
        </div>

        {/* THÔNG BÁO GIẢI THÍCH QUY TẮC THUẾ */}
        <Alert
          type="info"
          showIcon
          className="mb-4 text-xs"
          message={
            <span>
              <strong>Quy tắc khấu trừ thuế: </strong>
              Thuế TNCN = <strong>10% × Tổng thu nhập gộp</strong> khi tổng thu nhập của nhân sự trong tháng đạt từ <strong>5.000.000 VNĐ</strong> trở lên (&ge; 5.000.000 VNĐ).
              Trường hợp thu nhập dưới 5.000.000 VNĐ: <strong>0 VNĐ</strong>.
            </span>
          }
        />

        {/* BẢNG DỮ LIỆU TỔNG HỢP THEO JOB VÀ NHÂN SỰ (ROWSPAN) */}
        <Table
          className="settlement-table"
          bordered
          rowKey="key"
          columns={columns}
          dataSource={tableRows}
          loading={isLoading}
          pagination={false}
          scroll={{ x: 1550 }}
        />
      </Card>

      {/* MODAL XEM & CHỈNH SỬA TRỰC TIẾP CÁC JOB CỦA NHÂN SỰ */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <DollarOutlined className="text-blue-600 text-lg" />
            <div>
              <span className="font-bold text-slate-800">
                Chi tiết & Chỉnh sửa Job Tháng {selectedMonth}/{selectedYear} —{' '}
                <span className="text-blue-600">{activeSummary?.employee.full_name}</span>
              </span>
              <div className="text-xs text-slate-400 font-normal">
                STK: {activeSummary?.employee.bank_account_no || '—'} ({activeSummary?.employee.bank_name || '—'}) • CCCD: {activeSummary?.employee.id_card_no || '—'}
              </div>
            </div>
          </div>
        }
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button
            key="word"
            icon={<FileWordOutlined className="text-blue-600" />}
            onClick={() => activeSummary && exportSettlementWord(activeSummary)}
          >
            Xuất Word (.docx)
          </Button>,
          <Button
            key="pdf"
            icon={<FilePdfOutlined className="text-red-500" />}
            onClick={() => activeSummary && exportSettlementPDF(activeSummary)}
          >
            In / Xuất PDF (A4)
          </Button>,
          <Button
            key="excel"
            icon={<FileExcelOutlined className="text-emerald-600" />}
            onClick={() => activeSummary && exportPersonalSettlementExcel(activeSummary)}
          >
            Xuất Excel (.xlsx)
          </Button>,
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Đóng
          </Button>,
        ]}
        width={1120}
      >
        {activeSummary && (
          <div className="space-y-4 pt-2">
            {/* Tóm tắt tài chính cá nhân trong tháng */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div>
                <span className="text-slate-500">Tổng thu nhập gộp:</span>
                <div className="text-sm font-bold text-slate-800">
                  {formatVND(activeSummary.totalIncome)}
                </div>
              </div>
              <div>
                <span className="text-slate-500">Thuế TNCN (10%):</span>
                <div className="text-sm font-bold text-red-600">
                  {formatVND(activeSummary.taxDeduction)}
                </div>
              </div>
              <div>
                <span className="text-slate-500">Thực nhận (Tổng - Thuế):</span>
                <div className="text-sm font-bold text-blue-900">
                  {formatVND(activeSummary.netIncome)}
                </div>
              </div>
              <div>
                <span className="text-slate-500">Đã thanh toán:</span>
                <div className="text-sm font-bold text-emerald-700">
                  {formatVND(activeSummary.paidAmount)}
                </div>
              </div>
              <div>
                <span className="text-slate-500">Còn lại cần chi:</span>
                <div className="text-sm font-bold text-amber-700">
                  {formatVND(Math.max(0, activeSummary.netIncome - activeSummary.paidAmount))}
                </div>
              </div>
            </div>

            {/* Thanh công cụ danh sách job */}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 text-sm">
                Danh sách các job trong tháng ({activeSummary.items.length} hạng mục):
              </span>
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleOpenAddJob}
                style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
              >
                + Thêm Job vào tháng này
              </Button>
            </div>

            {/* Bảng chi tiết từng job với tính năng Sửa & Xóa trực tiếp */}
            <Table
              size="small"
              rowKey="id"
              dataSource={activeSummary.items}
              pagination={false}
              columns={[
                {
                  title: 'STT',
                  key: 'stt',
                  width: 45,
                  align: 'center',
                  render: (_, __, i) => i + 1,
                },
                {
                  title: 'Ngày làm',
                  dataIndex: 'work_date',
                  key: 'work_date',
                  width: 95,
                  render: (d) => formatDateVN(d),
                },
                {
                  title: 'Đơn vị tính',
                  dataIndex: 'unit',
                  key: 'unit',
                  width: 100,
                  align: 'center',
                  render: (u) => (
                    <Tag color="cyan" className="font-medium m-0">
                      {u || 'Gói'}
                    </Tag>
                  ),
                },
                {
                  title: 'Nội dung công việc',
                  dataIndex: 'job_title',
                  key: 'job_title',
                  render: (t, r) => (
                    <div>
                      <span>{t}</span>
                      {r.notes && (
                        <div className="text-[11px] text-slate-400 italic">{r.notes}</div>
                      )}
                    </div>
                  ),
                },
                {
                  title: 'PO / Trạng thái',
                  key: 'po_status',
                  width: 125,
                  render: (_, r) => {
                    if (r.purchase_order?.po_code) {
                      return <Tag color="cyan">{r.purchase_order.po_code}</Tag>;
                    }
                    if (r.status === 'in_po') {
                      return <Tag color="blue" icon={<CheckCircleOutlined />}>Đã vào PO</Tag>;
                    }
                    if (r.status === 'paid') {
                      return <Tag color="green">Đã TT</Tag>;
                    }
                    return <Tag color="orange" icon={<ClockCircleOutlined />}>Chưa có PO</Tag>;
                  },
                },
                {
                  title: 'Số lượng',
                  dataIndex: 'quantity',
                  key: 'quantity',
                  width: 70,
                  align: 'right',
                },
                {
                  title: 'Đơn giá',
                  dataIndex: 'unit_price',
                  key: 'unit_price',
                  width: 105,
                  align: 'right',
                  render: (v) => formatVND(v),
                },
                {
                  title: 'Thành tiền',
                  dataIndex: 'total_amount',
                  key: 'total_amount',
                  width: 120,
                  align: 'right',
                  render: (v) => <strong className="text-blue-700">{formatVND(v)}</strong>,
                },
                {
                  title: 'Đã thanh toán',
                  dataIndex: 'paid_amount',
                  key: 'paid_amount',
                  width: 140,
                  align: 'right',
                  render: (_, item) => (
                    <InlinePaidAmountInput
                      jobId={item.id}
                      initialValue={Number(item.paid_amount) || 0}
                      onSave={handleInlineUpdatePaidAmount}
                    />
                  ),
                },
                {
                  title: 'Thao tác',
                  key: 'action',
                  width: 90,
                  align: 'center',
                  render: (_, item) => (
                    <Space size="small">
                      <Tooltip title="Chỉnh sửa job">
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleOpenEditJob(item)}
                        />
                      </Tooltip>
                      <Popconfirm
                        title="Xác nhận xóa job"
                        description="Bạn có chắc muốn xóa job này khỏi quyết toán?"
                        onConfirm={() => deleteJobMutation.mutate(item.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true, loading: deleteJobMutation.isPending }}
                      >
                        <Tooltip title="Xóa job">
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
              scroll={{ y: 320 }}
            />
          </div>
        )}
      </Modal>

      {/* MODAL THÊM / CHỈNH SỬA JOB */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <EditOutlined className="text-blue-600" />
            <span>{editingJob ? 'Chỉnh sửa Job' : 'Thêm Job mới vào quyết toán'}</span>
          </div>
        }
        open={jobModalVisible}
        onCancel={() => {
          setJobModalVisible(false);
          setEditingJob(null);
        }}
        onOk={() => jobForm.submit()}
        confirmLoading={saveJobMutation.isPending}
        okText={editingJob ? 'Cập nhật Job' : 'Thêm Job'}
        cancelText="Hủy"
        width={680}
      >
        <Form form={jobForm} layout="vertical" onFinish={(vals) => saveJobMutation.mutate(vals)}>
          <Form.Item name="unit" label="Đơn vị tính" rules={[{ required: true, message: 'Vui lòng chọn đơn vị tính' }]}>
            <Select options={UNIT_OPTIONS} placeholder="Chọn đơn vị tính" />
          </Form.Item>

          <Form.Item
            name="job_title"
            label="Nội dung công việc"
            rules={[{ required: true, message: 'Vui lòng nhập nội dung công việc' }]}
          >
            <Input placeholder="Ví dụ: Thiết kế giao diện UI/UX" />
          </Form.Item>

          <Row gutter={12}>
            <Col xs={24} sm={6}>
              <Form.Item name="work_date" label="Ngày làm" rules={[{ required: true }]}>
                <DatePicker format="DD/MM/YYYY" className="w-full" allowClear={false} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item name="quantity" label="Số lượng" rules={[{ required: true }]}>
                <InputNumber
                  min={0.1}
                  className="w-full"
                  onChange={(v) => setFormQty(Number(v) || 0)}
                />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item name="unit_price" label="Đơn giá" rules={[{ required: true }]}>
                <InputNumber
                  min={0}
                  className="w-full"
                  formatter={vndInputFormatter}
                  parser={vndInputParser}
                  onChange={(v) => setFormPrice(Number(v) || 0)}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="paid_amount" label="Đã thanh toán">
                <InputNumber
                  min={0}
                  className="w-full"
                  formatter={vndInputFormatter}
                  parser={vndInputParser}
                />
              </Form.Item>
            </Col>
          </Row>

          <div className="mb-4 text-right">
            <span className="text-xs text-slate-500 mr-2">Thành tiền tự tính:</span>
            <strong className="text-blue-700 text-sm">{formatVND(formTotal)}</strong>
          </div>

          <Form.Item name="notes" label="Ghi chú">
            <TextArea rows={2} placeholder="Ghi chú thêm về yêu cầu công việc..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MonthlySettlement;
