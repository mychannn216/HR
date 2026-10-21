import { supabase } from './supabaseClient';
import type { Job } from '../types';

export type JobPayload = Omit<
  Job,
  'id' | 'total_amount' | 'created_at' | 'updated_at' | 'employee' | 'purchase_order'
>;

/**
 * Lấy danh sách toàn bộ Job của một nhân sự (kèm thông tin PO nếu có)
 */
export async function getJobsByEmployee(employeeId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      *,
      purchase_order:purchase_orders(id, po_code, status, issue_date)
    `)
    .eq('employee_id', employeeId)
    .order('work_date', { ascending: false });

  if (error) {
    console.error('Lỗi lấy danh sách job nhân sự:', error);
    throw new Error(`Không thể lấy danh sách job: ${error.message}`);
  }

  return (data as Job[]) || [];
}

/**
 * Lấy toàn bộ Job theo khoảng thời gian (phục vụ quyết toán tháng)
 */
export async function getAllJobs(startDate?: string, endDate?: string): Promise<Job[]> {
  let query = supabase
    .from('jobs')
    .select(`
      *,
      employee:employees(*),
      purchase_order:purchase_orders(id, po_code, status, issue_date)
    `)
    .order('work_date', { ascending: false });

  if (startDate) {
    query = query.gte('work_date', startDate);
  }
  if (endDate) {
    query = query.lte('work_date', endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Lỗi lấy toàn bộ job:', error);
    throw new Error(`Không thể lấy danh sách job: ${error.message}`);
  }

  return (data as Job[]) || [];
}

/**
 * Thêm mới một Job cho nhân sự
 */
export async function createJob(payload: Partial<JobPayload>): Promise<Job> {
  const { total_amount: _omit, ...cleanPayload } = payload as any;

  const unitVal = cleanPayload.unit || 'Gói';
  const insertData = {
    ...cleanPayload,
    unit: unitVal,
    // Tránh lỗi nếu database Supabase có ràng buộc NOT NULL trên cột project_name
    project_name: cleanPayload.project_name || unitVal,
    status: cleanPayload.status || 'pending',
  };

  const { data, error } = await supabase
    .from('jobs')
    .insert([insertData])
    .select()
    .single();

  if (error) {
    console.error('Lỗi tạo job:', error);
    throw new Error(`Thêm job thất bại: ${error.message}`);
  }

  return data as Job;
}

/**
 * Cập nhật thông tin Job
 */
export async function updateJob(id: string, payload: Partial<JobPayload>): Promise<Job> {
  const { total_amount: _omit, employee: _e, purchase_order: _p, ...cleanPayload } = payload as any;

  const updateData = { ...cleanPayload };
  if (updateData.unit && !updateData.project_name) {
    updateData.project_name = updateData.unit;
  }

  const { data, error } = await supabase
    .from('jobs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(`Lỗi cập nhật job ${id}:`, error);
    throw new Error(`Cập nhật job thất bại: ${error.message}`);
  }

  return data as Job;
}

/**
 * Xóa Job
 */
export async function deleteJob(id: string): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`Lỗi xóa job ${id}:`, error);
    throw new Error(`Xóa job thất bại: ${error.message}`);
  }
}

/**
 * Gán danh sách các Job vào một PO
 */
export async function linkJobsToPO(jobIds: string[], poId: string): Promise<void> {
  if (jobIds.length === 0) return;

  const { error } = await supabase
    .from('jobs')
    .update({ po_id: poId, status: 'in_po' })
    .in('id', jobIds);

  if (error) {
    console.error('Lỗi gán job vào PO:', error);
    throw new Error(`Gán job vào PO thất bại: ${error.message}`);
  }
}

/**
 * Hủy liên kết các Job khỏi một PO (khi xóa PO)
 */
export async function unlinkJobsFromPO(poId: string): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({ po_id: null, status: 'pending' })
    .eq('po_id', poId);

  if (error) {
    console.error('Lỗi gỡ job khỏi PO:', error);
    throw new Error(`Gỡ job khỏi PO thất bại: ${error.message}`);
  }
}

