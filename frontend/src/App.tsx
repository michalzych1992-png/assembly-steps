import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Dashboard from "@/pages/Dashboard";
import TaskPage from "@/pages/TaskPage";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/zadanie/:id" element={<TaskPage />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
      <Toaster richColors position="bottom-right" />
    </>
  );
}
