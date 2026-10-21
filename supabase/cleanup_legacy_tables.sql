-- ==============================================================================
-- DỌN DẸP DỮ LIỆU CŨ & CẬP NHẬT RÀNG BUỘC SUPABASE
-- Chạy script này trong Supabase SQL Editor khi muốn dọn dẹp các bảng/ràng buộc cũ.
-- ==============================================================================

-- 1. XỬ LÝ CÁC BẢNG DƯ THỪA TỪ PHIÊN BẢN CŨ (cost_items, payroll_settlements)
-- Lưu ý: Hiện tại hệ thống đã chuyển hẳn sang sử dụng bảng 'jobs' và 'purchase_orders'.
-- Quyết toán tháng được tính toán trực tiếp từ 'jobs'.

-- Tùy chọn A: Xóa hoàn toàn các bảng cũ không còn sử dụng
DROP TABLE IF EXISTS public.cost_items CASCADE;
DROP TABLE IF EXISTS public.payroll_settlements CASCADE;

-- 2. ĐẢM BẢO RÀNG BUỘC CỦA BẢNG JOBS & PURCHASE_ORDERS ĐỀU LÀ ON DELETE CASCADE
-- Tránh lỗi khi xóa nhân sự bị chặn bởi dữ liệu job hoặc PO cũ
DO $$
BEGIN
  -- Cập nhật foreign key jobs -> employees
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'jobs_employee_id_fkey' AND table_name = 'jobs'
  ) THEN
    ALTER TABLE public.jobs DROP CONSTRAINT jobs_employee_id_fkey;
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_employee_id_fkey 
      FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
  END IF;

  -- Cập nhật foreign key purchase_orders -> employees
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'purchase_orders_employee_id_fkey' AND table_name = 'purchase_orders'
  ) THEN
    ALTER TABLE public.purchase_orders DROP CONSTRAINT purchase_orders_employee_id_fkey;
    ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_employee_id_fkey 
      FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- 3. ĐẢM BẢO CÁC CỘT CỦA BẢNG JOBS ĐẦY ĐỦ VÀ CHÍNH XÁC
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'Gói';
ALTER TABLE public.jobs ALTER COLUMN project_name DROP NOT NULL;

-- 4. TỐI ƯU HÓA INDEX TÌM KIẾM CHO JOBS VÀ EMPLOYEES
CREATE INDEX IF NOT EXISTS idx_jobs_employee_work_date ON public.jobs (employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_jobs_work_date ON public.jobs (work_date);
CREATE INDEX IF NOT EXISTS idx_employees_created_at ON public.employees (created_at ASC);

