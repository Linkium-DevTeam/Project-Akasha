import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastProvider, Spinner } from './components/ui';
import Gallery from './pages/Gallery';
import ItemDetail from './pages/ItemDetail';
import Boxes from './pages/Boxes';
import BoxDetail from './pages/BoxDetail';
import BoxByCode from './pages/BoxByCode';
import Certificate from './pages/Certificate';
import ChainPage from './pages/ChainPage';

// ZXing 扫码库体积大，仅透镜页需要 —— 单独分包，按需加载
const Lens = lazy(() => import('./pages/Lens'));

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Gallery />} />
          <Route path="/items/:id" element={<ItemDetail />} />
          <Route path="/boxes" element={<Boxes />} />
          <Route path="/boxes/:id" element={<BoxDetail />} />
          <Route path="/b/:code" element={<BoxByCode />} />
          <Route path="/lens" element={<Suspense fallback={<div className="flex justify-center py-24"><Spinner className="size-8" /></div>}><Lens /></Suspense>} />
          <Route path="/cert/:itemId" element={<Certificate />} />
          <Route path="/chain" element={<ChainPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
