import { supabase } from './supabaseClient';
import type { PurchaseOrder, POStatus, Job } from '../types';
import dayjs from 'dayjs';

/**
 * Lấy danh sách Purchase Orders (PO), có thể lọc theo nhân sự
 */
export async function getPurchaseOrders(employeeId?: string): Promise<PurchaseOrder[]> {
  let query = supabase
    .from('purchase_orders')
    .select(`
      *,
      employee:employees(id, full_name, phone, bank_account_no, bank_name, id_card_no),
      jobs:jobs(*)
    `)
    .order('created_at', { ascending: false });

  if (employeeId) {
    query = query.eq('employee_id', employeeId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Lỗi lấy danh sách PO:', error);
    throw new Error(`Không thể lấy danh sách PO: ${error.message}`);
  }

  return (data as PurchaseOrder[]) || [];
}

/**
 * Lấy chi tiết một PO theo ID
 */
export async function getPurchaseOrderById(id: string): Promise<PurchaseOrder> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      employee:employees(id, full_name, phone, bank_account_no, bank_name, id_card_no, id_card_issue_date, id_card_issue_place),
      jobs:jobs(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error(`Lỗi lấy chi tiết PO ${id}:`, error);
    throw new Error(`Không thể lấy thông tin PO: ${error.message}`);
  }

  return data as PurchaseOrder;
}

/**
 * Tạo mới PO từ danh sách Job được chọn của nhân sự
 */
export async function createPurchaseOrder(
  employeeId: string,
  selectedJobs: Job[],
  notes?: string
): Promise<PurchaseOrder> {
  if (selectedJobs.length === 0) {
    throw new Error('Vui lòng chọn ít nhất 1 job để tạo PO.');
  }

  // Tự động sinh mã PO: PO-YYYYMMDD-XXXX
  const dateStr = dayjs().format('YYYYMMDD');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const poCode = `PO-${dateStr}-${randomSuffix}`;

  // Tính tổng giá trị PO từ các job được chọn
  const totalAmount = selectedJobs.reduce(
    (sum, job) => sum + (Number(job.total_amount) || 0),
    0
  );

  // 1. Tạo bản ghi PO trong bảng purchase_orders
  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .insert([
      {
        po_code: poCode,
        employee_id: employeeId,
        issue_date: dayjs().format('YYYY-MM-DD'),
        total_amount: totalAmount,
        status: 'issued',
        notes: notes || null,
      },
    ])
    .select()
    .single();

  if (poError || !po) {
    console.error('Lỗi tạo đơn PO:', poError);
    throw new Error(`Tạo đơn PO thất bại: ${poError?.message}`);
  }

  // 2. Gán các job đã chọn vào PO này
  const jobIds = selectedJobs.map((j) => j.id);
  const { error: jobError } = await supabase
    .from('jobs')
    .update({ po_id: po.id, status: 'in_po' })
    .in('id', jobIds);

  if (jobError) {
    console.error('Lỗi liên kết job vào PO:', jobError);
    throw new Error(`Tạo PO thành công nhưng không thể gán job: ${jobError.message}`);
  }

  return {
    ...po,
    jobs: selectedJobs,
  } as PurchaseOrder;
}

/**
 * Cập nhật trạng thái đơn PO (issued | paid | draft)
 */
export async function updatePOStatus(id: string, status: POStatus): Promise<void> {
  const { error } = await supabase
    .from('purchase_orders')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error(`Lỗi cập nhật trạng thái PO ${id}:`, error);
    throw new Error(`Cập nhật trạng thái PO thất bại: ${error.message}`);
  }

  // Nếu PO chuyển sang 'paid', cập nhật trạng thái các job liên quan thành 'paid'
  if (status === 'paid') {
    await supabase.from('jobs').update({ status: 'paid' }).eq('po_id', id);
  } else if (status === 'issued') {
    await supabase.from('jobs').update({ status: 'in_po' }).eq('po_id', id);
  }
}

/**
 * Xóa đơn PO (Tự động gỡ các job về trạng thái pending chưa tạo PO)
 */
export async function deletePurchaseOrder(id: string): Promise<void> {
  // Gỡ liên kết job trước
  await supabase
    .from('jobs')
    .update({ po_id: null, status: 'pending' })
    .eq('po_id', id);

  // Xóa đơn PO
  const { error } = await supabase
    .from('purchase_orders')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`Lỗi xóa PO ${id}:`, error);
    throw new Error(`Xóa PO thất bại: ${error.message}`);
  }
}

