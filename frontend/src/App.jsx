import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SearchPatientPage from './pages/SearchPatientPage';
import NewAssessmentPage from './pages/NewAssessmentPage';
import ReviewAssessmentPage from './pages/ReviewAssessmentPage';
import ResultsPage from './pages/ResultsPage';
import PatientDetailPage from './pages/PatientDetailPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/search" element={<SearchPatientPage />} />
        <Route path="/assessment/new" element={<NewAssessmentPage />} />
        <Route path="/assessment/continue/:patientId" element={<NewAssessmentPage />} />
        <Route path="/assessment/review" element={<ReviewAssessmentPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/patient/:patientId" element={<PatientDetailPage />} />
      </Routes>
    </Router>
  );
}
