/**
 * Phân quyền người dùng trong hệ thống
 * - accountant: Kế toán (toàn quyền quản lý chi phí, duyệt thanh toán, chốt quyết toán)
 * - leader: Trưởng dự án / Người phụ trách (tạo dự án, giao job, theo dõi tiến độ)
 */
export type UserRole = 'accountant' | 'leader';

export interface UserProfile {
  id: string;
  role: UserRole;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Trạng thái hồ sơ nhân sự
 */
export type EmployeeStatus = 'active' | 'inactive' | 'probation';

export interface Employee {
  id: string;
  full_name: string;
  dob: string | null;
  phone: string | null;
  email: string | null;
  position?: string | null;
  bank_account_no: string | null;
  bank_name: string | null;
  qr_code_url: string | null;
  id_card_no: string | null;
  id_card_issue_place: string | null;
  id_card_issue_date: string | null;
  id_card_expiry_date: string | null;
  id_card_front_url: string | null;
  id_card_back_url: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  status: EmployeeStatus;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Dự án
 */
export type ProjectStatus = 'planning' | 'in_progress' | 'completed' | 'on_hold';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  leader_id: string | null;
  leader?: UserProfile | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Trạng thái của đơn mua hàng / giao việc PO (Purchase Order)
 * - draft: Đang chờ duyệt
 * - issued: Đã tạo PO
 * - paid: Đã thanh toán
 */
export type POStatus = 'draft' | 'issued' | 'paid';

export interface PurchaseOrder {
  id: string;
  po_code: string;
  employee_id: string;
  issue_date: string;
  total_amount: number;
  status: POStatus;
  notes?: string | null;
  employee?: Employee | null;
  jobs?: Job[];
  created_at?: string;
  updated_at?: string;
}

/**
 * Trạng thái của Job công việc
 * - pending: Chưa tạo PO
 * - in_po: Đã gom vào PO
 * - paid: Đã thanh toán
 */
export type JobStatus = 'pending' | 'in_po' | 'paid';

/**
 * Công việc (Job) liên kết trực tiếp với Nhân sự và PO
 */
export interface Job {
  id: string;
  employee_id: string;
  po_id?: string | null;
  project_name?: string | null;
  unit?: string;
  job_title: string;
  work_date: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  paid_amount?: number;
  status: JobStatus;
  notes?: string | null;
  employee?: Employee | null;
  purchase_order?: PurchaseOrder | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Tương thích ngược với CostItem
 */
export type PaymentStatus = 'pending' | 'partial' | 'paid';
export type CostItem = Job & {
  project_id?: string;
  payment_status?: PaymentStatus;
  paid_amount?: number;
  project?: Project | null;
};

/**
 * Bảng chốt quyết toán tháng
 * Khấu trừ 10% nếu tổng thu nhập >= 5.000.000 VNĐ
 */
export type SettlementExportStatus = 'draft' | 'exported' | 'paid';

export interface PayrollSettlement {
  id: string;
  month: number;
  year: number;
  employee_id: string;
  total_income: number;
  tax_deduction: number;
  net_income: number;
  export_status: SettlementExportStatus;
  exported_at?: string | null;
  notes?: string | null;
  employee?: Employee | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Tổng hợp quyết toán lương & chi phí của một nhân sự trong tháng
 */
export interface EmployeeSettlementSummary {
  employee: Employee;
  month: number;
  year: number;
  items: Job[];
  totalJobs: number;
  totalIncome: number; // Tổng thu nhập gộp = sum(total_amount)
  taxDeduction: number; // Khấu trừ 10% nếu totalIncome >= 5.000.000, ngược lại 0
  paidAmount: number; // Đã thanh toán = sum(paid_amount)
  netIncome: number; // Thực nhận = totalIncome - taxDeduction
  stt?: number; // Số thứ tự của nhân sự trong bảng quyết toán lương tháng
}

/**
 * Cấu trúc Database cho Supabase Client
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: UserProfile;
        Insert: Omit<UserProfile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>;
      };
      employees: {
        Row: Employee;
        Insert: Omit<Employee, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<Employee, 'id' | 'created_at' | 'updated_at'>>;
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'leader'> & { id?: string };
        Update: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at' | 'leader'>>;
      };
      purchase_orders: {
        Row: PurchaseOrder;
        Insert: Omit<PurchaseOrder, 'id' | 'created_at' | 'updated_at' | 'employee' | 'jobs'> & {
          id?: string;
        };
        Update: Partial<
          Omit<PurchaseOrder, 'id' | 'created_at' | 'updated_at' | 'employee' | 'jobs'>
        >;
      };
      jobs: {
        Row: Job;
        Insert: Omit<
          Job,
          'id' | 'total_amount' | 'created_at' | 'updated_at' | 'employee' | 'purchase_order'
        > & {
          id?: string;
          total_amount?: number;
        };
        Update: Partial<
          Omit<
            Job,
            'id' | 'total_amount' | 'created_at' | 'updated_at' | 'employee' | 'purchase_order'
          >
        >;
      };
      payroll_settlements: {
        Row: PayrollSettlement;
        Insert: Omit<PayrollSettlement, 'id' | 'created_at' | 'updated_at' | 'employee'> & {
          id?: string;
        };
        Update: Partial<Omit<PayrollSettlement, 'id' | 'created_at' | 'updated_at' | 'employee'>>;
      };
    };
  };
}
