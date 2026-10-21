-- ==============================================================================
-- HỆ THỐNG QUẢN LÝ NHÂN SỰ, HỢP ĐỒNG VÀ QUYẾT TOÁN CHI PHÍ DỰ ÁN
-- Supabase Schema DDL
-- ==============================================================================

-- 1. KÍCH HOẠT EXTENSIONS CẦN THIẾT
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. BẢNG PROFILES (Phân quyền người dùng: accountant | leader)
-- Liên kết 1-1 với auth.users của Supabase
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('accountant', 'leader')) DEFAULT 'leader',
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Tự động tạo hồ sơ profiles khi có user đăng ký qua auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'leader')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 3. BẢNG EMPLOYEES (Hồ sơ nhân sự)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  dob DATE,
  phone VARCHAR(20),
  email TEXT,
  bank_account_no VARCHAR(50),
  bank_name VARCHAR(100),
  qr_code_url TEXT,
  id_card_no VARCHAR(30) UNIQUE,
  id_card_issue_place TEXT,
  id_card_issue_date DATE,
  id_card_expiry_date DATE,
  id_card_front_url TEXT,
  id_card_back_url TEXT,
  contract_start_date DATE,
  contract_end_date DATE,
  position TEXT,
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'inactive', 'probation')) DEFAULT 'active',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS position TEXT;

-- ==============================================================================
-- 4. BẢNG PROJECTS (Thông tin dự án)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  leader_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('planning', 'in_progress', 'completed', 'on_hold')) DEFAULT 'in_progress',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 5. BẢNG PURCHASE_ORDERS (Đơn đặt hàng / Giao việc PO)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_code VARCHAR(50) UNIQUE NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'issued', 'paid')) DEFAULT 'issued',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 6. BẢNG JOBS (Công việc liên kết trực tiếp với Nhân sự và PO)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  project_name TEXT,
  job_title TEXT NOT NULL,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total_amount NUMERIC(15, 2) GENERATED ALWAYS AS (ROUND(quantity * unit_price, 2)) STORED,
  paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'Gói',
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'in_po', 'paid')) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'Gói';
ALTER TABLE public.jobs ALTER COLUMN project_name DROP NOT NULL;

-- ==============================================================================
-- 7. BẢNG COST_ITEMS (Dự phòng cho luồng phân loại cũ theo project_id)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.cost_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  project_name TEXT,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  job_title TEXT NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total_amount NUMERIC(15, 2) GENERATED ALWAYS AS (ROUND(quantity * unit_price, 2)) STORED,
  payment_status VARCHAR(20) NOT NULL CHECK (payment_status IN ('pending', 'partial', 'paid')) DEFAULT 'pending',
  paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 6. BẢNG PAYROLL_SETTLEMENTS (Bảng chốt quyết toán tháng)
-- Khấu trừ 10% nếu tổng thu nhập > 5.000.000 VNĐ
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payroll_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL CHECK (year >= 2000),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  total_income NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (total_income >= 0),
  tax_deduction NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (tax_deduction >= 0),
  net_income NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (net_income >= 0),
  export_status VARCHAR(20) NOT NULL CHECK (export_status IN ('draft', 'exported', 'paid')) DEFAULT 'draft',
  exported_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_settlement_per_period UNIQUE (employee_id, month, year)
);

-- Trigger tự động tính thuế TNCN (10% nếu > 5 triệu) và thực nhận
CREATE OR REPLACE FUNCTION public.calculate_payroll_settlement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_income IS NULL THEN
    NEW.total_income := 0;
  END IF;

  -- Nếu tổng thu nhập > 5.000.000 VNĐ, khấu trừ thuế 10%
  IF NEW.total_income > 5000000 THEN
    NEW.tax_deduction := ROUND(NEW.total_income * 0.10, 0);
  ELSE
    NEW.tax_deduction := 0;
  END IF;

  NEW.net_income := NEW.total_income - NEW.tax_deduction;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_payroll ON public.payroll_settlements;
CREATE TRIGGER trg_calculate_payroll
  BEFORE INSERT OR UPDATE OF total_income ON public.payroll_settlements
  FOR EACH ROW EXECUTE FUNCTION public.calculate_payroll_settlement();

-- ==============================================================================
-- 7. TRIGGER TỰ ĐỘNG CẬP NHẬT UPDATED_AT CHO TẤT CẢ CÁC BẢNG
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('profiles', 'employees', 'projects', 'cost_items', 'payroll_settlements')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON public.%I', tbl);
    EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', tbl);
  END LOOP;
END;
$$;

-- ==============================================================================
-- 8. TẠO STORAGE BUCKET: employee-docs (Lưu ảnh CCCD & mã QR)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-docs', 'employee-docs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy cho Storage: Cho phép cả public/anon và authenticated upload, đọc và tải file
DROP POLICY IF EXISTS "Cho phep doc employee-docs public" ON storage.objects;
CREATE POLICY "Cho phep doc employee-docs public"
ON storage.objects FOR SELECT
USING (bucket_id = 'employee-docs');

DROP POLICY IF EXISTS "Cho phep authenticated users upload vao employee-docs" ON storage.objects;
DROP POLICY IF EXISTS "Cho phep upload vao employee-docs" ON storage.objects;
CREATE POLICY "Cho phep upload vao employee-docs"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'employee-docs');

DROP POLICY IF EXISTS "Cho phep authenticated users update trong employee-docs" ON storage.objects;
DROP POLICY IF EXISTS "Cho phep update trong employee-docs" ON storage.objects;
CREATE POLICY "Cho phep update trong employee-docs"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'employee-docs');

DROP POLICY IF EXISTS "Cho phep authenticated users delete trong employee-docs" ON storage.objects;
DROP POLICY IF EXISTS "Cho phep delete trong employee-docs" ON storage.objects;
CREATE POLICY "Cho phep delete trong employee-docs"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'employee-docs');

-- ==============================================================================
-- 9. KÍCH HOẠT SUPABASE REALTIME
-- Bảng cost_items và payroll_settlements
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'cost_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cost_items;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'payroll_settlements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payroll_settlements;
  END IF;
END;
$$;

-- Cấu hình replica identity sang FULL để Realtime gửi đầy đủ dữ liệu khi UPDATE/DELETE
ALTER TABLE public.cost_items REPLICA IDENTITY FULL;
ALTER TABLE public.payroll_settlements REPLICA IDENTITY FULL;

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_settlements ENABLE ROW LEVEL SECURITY;

-- Helper function lấy role của user hiện tại
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS VARCHAR AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Policies cho profiles: Ai cũng xem được profile người dùng trong hệ thống
DROP POLICY IF EXISTS "Xem profiles trong he thong" ON public.profiles;
CREATE POLICY "Xem profiles trong he thong"
ON public.profiles FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Cap nhat profile chinh chu" ON public.profiles;
CREATE POLICY "Cap nhat profile chinh chu"
ON public.profiles FOR UPDATE
TO anon, authenticated
USING (true);

-- Policies cho employees, projects, cost_items, payroll_settlements: Cho phép cả anon và authenticated
DROP POLICY IF EXISTS "Authenticated users toan quyen employees" ON public.employees;
DROP POLICY IF EXISTS "Toan quyen employees" ON public.employees;
CREATE POLICY "Toan quyen employees"
ON public.employees FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users toan quyen projects" ON public.projects;
DROP POLICY IF EXISTS "Toan quyen projects" ON public.projects;
CREATE POLICY "Toan quyen projects"
ON public.projects FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Toan quyen purchase_orders" ON public.purchase_orders;
CREATE POLICY "Toan quyen purchase_orders"
ON public.purchase_orders FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Toan quyen jobs" ON public.jobs;
CREATE POLICY "Toan quyen jobs"
ON public.jobs FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users toan quyen cost_items" ON public.cost_items;
DROP POLICY IF EXISTS "Toan quyen cost_items" ON public.cost_items;
CREATE POLICY "Toan quyen cost_items"
ON public.cost_items FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users toan quyen payroll_settlements" ON public.payroll_settlements;
DROP POLICY IF EXISTS "Toan quyen payroll_settlements" ON public.payroll_settlements;
CREATE POLICY "Toan quyen payroll_settlements"
ON public.payroll_settlements FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

