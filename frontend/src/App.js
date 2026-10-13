import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Public
import Home from "@/pages/public/Home";
import Pricing from "@/pages/public/Pricing";
import InfoPage from "@/pages/public/InfoPage";
// Auth
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import ForgotPassword from "@/pages/auth/ForgotPassword";
// Student
import { StudentLayout } from "@/components/layout/StudentLayout";
import StudentDashboard from "@/pages/student/StudentDashboard";
import Practice from "@/pages/student/Practice";
import PracticeRunner from "@/pages/student/PracticeRunner";
import MockTests from "@/pages/student/MockTests";
import ExamIntro from "@/pages/student/ExamIntro";
import ExamRunner from "@/pages/student/ExamRunner";
import ResultsList from "@/pages/student/ResultsList";
import ResultDetail from "@/pages/student/ResultDetail";
import Analytics from "@/pages/student/Analytics";
import Subscription from "@/pages/student/Subscription";
import Profile from "@/pages/student/Profile";
import Notifications from "@/pages/student/Notifications";
import EnterExamId from "@/pages/student/EnterExamId";
// Admin
import { AdminLayout } from "@/components/layout/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import Students from "@/pages/admin/Students";
import Batches from "@/pages/admin/Batches";
import Staff from "@/pages/admin/Staff";
import Packages from "@/pages/admin/Packages";
import Exams from "@/pages/admin/Exams";
import SourceDocuments from "@/pages/admin/SourceDocuments";
import ExamBuilder from "@/pages/admin/ExamBuilder";
import QuestionBank from "@/pages/admin/QuestionBank";
import AdminPractice from "@/pages/admin/AdminPractice";
import Reviews from "@/pages/admin/Reviews";
import AuditLogs from "@/pages/admin/AuditLogs";
import Settings from "@/pages/admin/Settings";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/academic" element={<InfoPage slug="academic" />} />
          <Route path="/general-training" element={<InfoPage slug="general-training" />} />
          <Route path="/practice-info" element={<InfoPage slug="practice" />} />
          <Route path="/how-it-works" element={<InfoPage slug="how-it-works" />} />
          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Student exam runner (full-screen, outside layout) */}
          <Route path="/app/exam/:attemptId" element={<ProtectedRoute studentOnly><ExamRunner /></ProtectedRoute>} />

          {/* Student dashboard */}
          <Route path="/app" element={<ProtectedRoute studentOnly><StudentLayout /></ProtectedRoute>}>
            <Route index element={<StudentDashboard />} />
            <Route path="practice" element={<Practice />} />
            <Route path="practice/:id" element={<PracticeRunner />} />
            <Route path="mock-tests" element={<MockTests />} />
            <Route path="exam-intro/:examId" element={<ExamIntro />} />
            <Route path="enter-exam" element={<EnterExamId />} />
            <Route path="results" element={<ResultsList />} />
            <Route path="results/:id" element={<ResultDetail />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="subscription" element={<Subscription />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute staffOnly><AdminLayout /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="students" element={<Students />} />
            <Route path="batches" element={<Batches />} />
            <Route path="staff" element={<Staff />} />
            <Route path="packages" element={<Packages />} />
            <Route path="exams" element={<Exams />} />
            <Route path="exams/sources" element={<SourceDocuments />} />
            <Route path="exams/:examId/build" element={<ExamBuilder />} />
            <Route path="questions" element={<QuestionBank />} />
            <Route path="practice" element={<AdminPractice />} />
            <Route path="reviews" element={<Reviews />} />
            <Route path="audit" element={<AuditLogs />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
