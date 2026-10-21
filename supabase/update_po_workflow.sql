-- ==============================================================================
-- CẬP NHẬT KIẾN TRÚC DỮ LIỆU: QUY TRÌNH JOB & PO (PURCHASE ORDERS)
-- Chạy đoạn script này tại Supabase SQL Editor
-- ==============================================================================

-- 1. TẠO BẢNG PURCHASE_ORDERS (Đơn đặt hàng / Giao việc PO)
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

-- 2. TẠO BẢNG JOBS (Công việc liên kết trực tiếp với Nhân sự và PO)
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

-- Đảm bảo có cột paid_amount và unit nếu bảng jobs đã được tạo trước đó
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'Gói';
ALTER TABLE public.jobs ALTER COLUMN project_name DROP NOT NULL;

-- 3. TỰ ĐỘNG CẬP NHẬT UPDATED_AT
DROP TRIGGER IF EXISTS trg_updated_at_po ON public.purchase_orders;
CREATE TRIGGER trg_updated_at_po BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_updated_at_jobs ON public.jobs;
CREATE TRIGGER trg_updated_at_jobs BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. BẢO MẬT ROW LEVEL SECURITY (RLS) - Cho phép anon & authenticated
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

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

-- 5. KÍCH HOẠT SUPABASE REALTIME
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'purchase_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
  END IF;
END;
$$;

ALTER TABLE public.purchase_orders REPLICA IDENTITY FULL;
ALTER TABLE public.jobs REPLICA IDENTITY FULL;

