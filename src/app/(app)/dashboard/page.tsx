'use client';
import { useEffect, useState } from 'react';

// Jika kamu menggunakan TypeScript, definisikan interface untuk data stats
interface DashboardStats {
  total_sku: number;
  kritis: number;
  pesan_sekarang: number;
  cukup: number;
  persentase_cukup: number;
  nilai_pesanan: number;
}

export default function HomeDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // Fungsi untuk mengambil data dari API Route kita
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch('/api/wares-sync');
        const data = await res.json();
        
        if (data.status === 'success') {
          setStats(data.data);
        } else {
          console.error("Gagal memuat data dari Spreadsheet:", data.error);
        }
      } catch (error) {
        console.error("Terjadi kesalahan:", error);
      }
    };
    
    fetchDashboard();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Status Inventaris WARES</h1>
      
      {stats ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-white border rounded-lg shadow-sm">
            <h3 className="text-gray-500 text-sm font-medium">Total SKU</h3>
            <p className="text-3xl font-bold mt-2">{stats.total_sku}</p>
          </div>
          
          <div className="p-6 bg-red-50 border border-red-100 rounded-lg shadow-sm">
            <h3 className="text-red-800 text-sm font-medium">Status Kritis</h3>
            <p className="text-3xl font-bold text-red-600 mt-2">{stats.kritis}</p>
          </div>
          
          <div className="p-6 bg-yellow-50 border border-yellow-100 rounded-lg shadow-sm">
            <h3 className="text-yellow-800 text-sm font-medium">Pesan Sekarang</h3>
            <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.pesan_sekarang}</p>
          </div>
        </div>
      ) : (
        <div className="flex justify-center items-center h-32">
          <p className="text-gray-500">Sinkronisasi data dari Spreadsheet...</p>
        </div>
      )}
    </div>
  );
}