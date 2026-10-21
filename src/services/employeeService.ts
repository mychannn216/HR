import { supabase } from './supabaseClient';
import type { Employee } from '../types';

export type EmployeePayload = Omit<Employee, 'id' | 'created_at' | 'updated_at'>;

/**
 * Lấy danh sách toàn bộ nhân sự, sắp xếp theo thời gian tạo tăng dần (người tạo trước giữ STT trước)
 */
export async function getEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Lỗi truy vấn danh sách nhân sự:', error);
    throw new Error(`Không thể lấy danh sách nhân sự: ${error.message}`);
  }

  return (data as unknown as Employee[]) || [];
}

/**
 * Lấy thông tin chi tiết một nhân sự theo ID
 */
export async function getEmployeeById(id: string): Promise<Employee> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error(`Lỗi truy vấn nhân sự ${id}:`, error);
    throw new Error(`Không tìm thấy thông tin nhân sự: ${error.message}`);
  }

  return data as unknown as Employee;
}

/**
 * Tạo mới hồ sơ nhân sự
 */
export async function createEmployee(payload: Partial<EmployeePayload>): Promise<Employee> {
  const { data, error } = await supabase
    .from('employees')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Lỗi tạo nhân sự mới:', error);
    throw new Error(`Tạo hồ sơ nhân sự thất bại: ${error.message}`);
  }

  return data as unknown as Employee;
}

/**
 * Cập nhật thông tin hồ sơ nhân sự
 */
export async function updateEmployee(
  id: string,
  payload: Partial<EmployeePayload>
): Promise<Employee> {
  const { data, error } = await supabase
    .from('employees')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(`Lỗi cập nhật nhân sự ${id}:`, error);
    throw new Error(`Cập nhật hồ sơ nhân sự thất bại: ${error.message}`);
  }

  return data as unknown as Employee;
}

/**
 * Xóa hồ sơ nhân sự
 */
export async function deleteEmployee(id: string): Promise<void> {
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`Lỗi xóa nhân sự ${id}:`, error);
    throw new Error(`Xóa hồ sơ nhân sự thất bại: ${error.message}`);
  }
}
