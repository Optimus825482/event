'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, MODULES } from '@/store/auth-store';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, activeModule } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!activeModule) {
      router.push('/select-module');
      return;
    }
    // Aktif modülün ana sayfasına yönlendir
    router.push(MODULES[activeModule].path);
  }, [isAuthenticated, activeModule, router]);

  // Yönlendirme yapılırken loading göster
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Yönlendiriliyor...</p>
      </div>
    </div>
  );
}
