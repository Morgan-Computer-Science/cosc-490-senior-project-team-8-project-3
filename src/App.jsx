import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AdvisingProvider } from './context/AdvisingContext';
import Home from './pages/Home';
import AdvisingFormPage from './pages/AdvisingForm';
import Results from './pages/Results';
import Confirmation from './pages/Confirmation';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <AdvisingProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/advising" element={<AdvisingFormPage />} />
          <Route path="/results" element={<Results />} />
          <Route path="/confirmation" element={<Confirmation />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AdvisingProvider>
  );
}
