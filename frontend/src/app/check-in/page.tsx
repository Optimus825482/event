"use client";

import { Wrench, Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CheckInPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
          <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Wrench className="w-10 h-10 text-yellow-400" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-3">
            Bakım Çalışması
          </h1>

          <p className="text-slate-400 mb-6">
            Check-in modülü şu anda bakım altındadır. Daha iyi bir deneyim için
            çalışıyoruz.
          </p>

          <div className="flex items-center justify-center gap-2 text-slate-500 text-sm mb-6">
            <Clock className="w-4 h-4" />
            <span>Tahmini süre: Yakında</span>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Ana Sayfaya Dön
          </Link>
        </div>

        <p className="text-slate-600 text-xs mt-4">EventFlow PRO © 2024</p>
      </div>
    </div>
  );
}
