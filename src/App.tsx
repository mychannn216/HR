import React, { useState } from "react";
import { ConfigProvider, Layout, Menu, Alert } from "antd";
import { TeamOutlined, CalculatorOutlined } from "@ant-design/icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import viVN from "antd/locale/vi_VN";
import type { Employee } from "./types";
import { EmployeeList } from "./pages/EmployeeList";
import { EmployeeForm } from "./pages/EmployeeForm";
import { MonthlySettlement } from "./pages/MonthlySettlement";
import { isSupabaseConfigured } from "./services/supabaseClient";
import { useRealtimeJobs } from "./hooks/useRealtimeJobs";

const { Header, Content, Footer } = Layout;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 phút cache
    },
  },
});

type AppView = "employees" | "employee_create" | "employee_edit" | "settlement";

export const AppContent: React.FC = () => {
  // Mặc định mở tab Hồ sơ nhân sự
  const [currentView, setCurrentView] = useState<AppView>("employees");
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Kích hoạt đồng bộ Realtime cho Jobs & POs từ Supabase
  useRealtimeJobs();

  const handleAddNewEmployee = () => {
    setEditingEmployee(null);
    setCurrentView("employee_create");
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setCurrentView("employee_edit");
  };

  const handleEmployeeFormSuccess = () => {
    setEditingEmployee(null);
    setCurrentView("employees");
  };

  const handleEmployeeFormCancel = () => {
    setEditingEmployee(null);
    setCurrentView("employees");
  };

  // Xác định active menu key
  const getSelectedMenuKey = () => {
    if (currentView.startsWith("employee")) return "employees";
    return "settlement";
  };

  return (
    <Layout className="min-h-screen bg-slate-100">
      {/* HEADER THANH ĐIỀU HƯỚNG TINH GỌN */}
      <Header className="bg-white border-b border-slate-200 px-4 md:px-8 flex flex-wrap items-center justify-between sticky top-0 z-50 shadow-sm h-auto py-2 md:h-16">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-500/20">
            PM
          </div>
          <div>
            <h1 className="text-sm md:text-base font-bold text-slate-800 leading-tight m-0">
              Quản lý Nhân sự & Quyết toán Dự án
            </h1>
            <p className="text-xs text-slate-400 m-0 hidden sm:block">
              Hồ sơ nhân sự • Giao Job • Đơn PO • Quyết toán
            </p>
          </div>
        </div>

        {/* 2 MENU ĐIỀU HƯỚNG CHÍNH */}
        <div className="flex items-center gap-2 my-1 md:my-0 flex-shrink-0">
          <Menu
            mode="horizontal"
            disabledOverflow={true}
            selectedKeys={[getSelectedMenuKey()]}
            className="border-none font-semibold text-sm bg-transparent"
            style={{ minWidth: 340, lineHeight: "60px" }}
            items={[
              {
                key: "employees",
                icon: <TeamOutlined className="text-base" />,
                label: "Hồ sơ nhân sự",
                onClick: () => setCurrentView("employees"),
              },
              {
                key: "settlement",
                icon: <CalculatorOutlined className="text-base" />,
                label: "Quyết toán tháng",
                onClick: () => setCurrentView("settlement"),
              },
            ]}
          />
        </div>
      </Header>

      {/* NỘI DUNG CHÍNH */}
      <Content className="p-4 md:p-8 max-w-7xl mx-auto w-full">
        {!isSupabaseConfigured && (
          <Alert
            type="warning"
            showIcon
            className="mb-6 shadow-sm border-amber-300 bg-amber-50"
            message="Chưa kết nối dự án Supabase thực tế"
            description={
              <div className="text-xs text-slate-700">
                Ứng dụng hiện đang dùng đường dẫn mẫu trong file{" "}
                <code className="bg-amber-100 px-1 py-0.5 rounded">.env</code>.
                Để tạo hồ sơ nhân sự, lưu ảnh CCCD và nhập job thành công, bạn
                cần điền{" "}
                <code className="font-semibold">VITE_SUPABASE_URL</code> và{" "}
                <code className="font-semibold">VITE_SUPABASE_ANON_KEY</code> từ
                Supabase Dashboard và thực thi file{" "}
                <code className="font-semibold">supabase/schema.sql</code>.
              </div>
            }
          />
        )}

        {/* VIEW HỒ SƠ NHÂN SỰ (Tích hợp Quản lý Job & PO dạng Drawer) */}
        {currentView === "employees" && (
          <EmployeeList
            onAddNew={handleAddNewEmployee}
            onEdit={handleEditEmployee}
          />
        )}

        {/* VIEW TẠO MỚI / CHỈNH SỬA NHÂN SỰ */}
        {(currentView === "employee_create" ||
          currentView === "employee_edit") && (
          <div className="max-w-4xl mx-auto">
            <EmployeeForm
              initialData={editingEmployee}
              onSuccess={handleEmployeeFormSuccess}
              onCancel={handleEmployeeFormCancel}
            />
          </div>
        )}

        {/* VIEW QUYẾT TOÁN THÁNG */}
        {currentView === "settlement" && <MonthlySettlement />}
      </Content>

      {/* FOOTER */}
      <Footer className="text-center text-xs text-slate-400 bg-transparent py-6">
        Hệ thống Quản lý Nhân sự & Quyết toán Dự án © {new Date().getFullYear()}{" "}
        — Khen Trà My xinh mỗi ngày để được tăng lương
      </Footer>
    </Layout>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={viVN}
        theme={{
          token: {
            colorPrimary: "#1677ff",
            borderRadius: 8,
            fontFamily:
              'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          },
        }}
      >
        <AppContent />
      </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;
