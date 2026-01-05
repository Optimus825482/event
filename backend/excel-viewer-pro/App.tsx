
import React, { useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileText, FileSpreadsheet, X, AlertCircle, List, Database, Search, Layers, Users } from 'lucide-react';
import DataTable from './components/DataTable';
import PersonelGroupView from './components/PersonelGroupView';
import { ExcelDataRow, FileMetadata } from './types';

interface SheetData {
  name: string;
  data: ExcelDataRow[];
  columns: string[];
}

const App: React.FC = () => {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'personel'>('table');

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setLoading(true);
    setSheets([]);
    setActiveSheetIndex(0);

    const metadata: FileMetadata = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    };
    setFileMetadata(metadata);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const bstr = e.target?.result;
        // Use cellDates: true for accurate date parsing
        const workbook = XLSX.read(bstr, {
          type: 'binary',
          cellDates: true,
          cellNF: true,
          cellText: true
        });

        const extractedSheets: SheetData[] = workbook.SheetNames.map(name => {
          const worksheet = workbook.Sheets[name];
          // raw: false ensures we get the formatted text seen in Excel
          // defval: "" ensures we don't skip empty cells
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            raw: false,
            defval: "",
            dateNF: 'yyyy-mm-dd'
          }) as ExcelDataRow[];

          return {
            name,
            data: jsonData,
            columns: jsonData.length > 0 ? Object.keys(jsonData[0]) : []
          };
        }).filter(s => s.data.length > 0);

        if (extractedSheets.length > 0) {
          setSheets(extractedSheets);
        } else {
          setError("Dosyada işlenebilir veri tablosu bulunamadı.");
        }
      } catch (err) {
        setError("Hassas okuma sırasında bir hata oluştu. Dosya yapısını kontrol edin.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError("Dosya erişim hatası.");
      setLoading(false);
    };

    reader.readAsBinaryString(file);
  }, []);

  const resetApp = () => {
    setSheets([]);
    setActiveSheetIndex(0);
    setFileMetadata(null);
    setError(null);
  };

  const currentSheet = sheets[activeSheetIndex];

  return (
    <div className="min-h-screen pb-20 bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2 rounded-lg shadow-lg shadow-emerald-100">
              <FileSpreadsheet className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">
                Excel Viewer Pro
              </h1>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Hassas Veri Ayıklayıcı</p>
            </div>
          </div>
          {sheets.length > 0 && (
            <button
              onClick={resetApp}
              className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-red-600 transition-all bg-slate-50 hover:bg-red-50 px-4 py-2 rounded-xl border border-slate-100"
            >
              <X className="w-4 h-4" />
              Kapat
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        )}

        {sheets.length === 0 ? (
          <div className="max-w-2xl mx-auto mt-12 animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
                <Layers className="w-3 h-3" /> Çoklu Sayfa Desteği
              </div>
              <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Hassas Veri Okuma</h2>
              <p className="text-slate-500 text-lg leading-relaxed">
                Excel verilerinizi hücre biçimlendirmelerini bozmadan, tarihleri ve sayıları en doğru şekilde ayıklayarak listeleyin.
              </p>
            </div>

            <label className="group relative block cursor-pointer">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div className={`
                border-3 border-dashed rounded-[2.5rem] p-16 text-center transition-all duration-500
                ${loading ? 'border-emerald-400 bg-emerald-50/50 scale-95' : 'border-slate-200 bg-white group-hover:border-emerald-500 group-hover:bg-emerald-50/30 group-hover:shadow-2xl group-hover:shadow-emerald-100/50'}
              `}>
                <div className="flex flex-col items-center">
                  <div className={`
                    w-24 h-24 rounded-3xl flex items-center justify-center mb-8 transition-all duration-500 shadow-xl
                    ${loading ? 'bg-emerald-500 text-white animate-pulse' : 'bg-slate-50 text-slate-400 group-hover:bg-emerald-600 group-hover:text-white group-hover:rotate-6'}
                  `}>
                    <Upload className="w-12 h-12" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-3">
                    {loading ? 'Hassas Ayıklama Yapılıyor...' : 'Excel Dosyası Yükleyin'}
                  </h3>
                  <p className="text-slate-400 font-medium mb-8">Hücre bazlı detaylı tarama yapılır</p>

                  {!loading && (
                    <div className="flex flex-wrap justify-center gap-6 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"><Database className="w-4 h-4 text-emerald-500" /> Tam Veri Seti</span>
                      <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"><Layers className="w-4 h-4 text-blue-500" /> Tüm Sayfalar</span>
                      <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"><FileText className="w-4 h-4 text-orange-500" /> Format Koruma</span>
                    </div>
                  )}
                </div>
              </div>
            </label>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* File Info Card */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="bg-emerald-500 p-4 rounded-2xl text-white shadow-lg shadow-emerald-200">
                  <FileText className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-800 leading-tight">{fileMetadata?.name}</h2>
                  <div className="flex flex-wrap items-center gap-3 text-sm font-semibold mt-1">
                    <span className="text-emerald-600 bg-emerald-50 px-3 py-0.5 rounded-full border border-emerald-100">{(fileMetadata!.size / 1024).toFixed(1)} KB</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-600">{sheets.length} Sayfa Tespit Edildi</span>
                  </div>
                </div>
              </div>

              {/* New Sheet Selector UI */}
              <div className="flex flex-wrap gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                {sheets.map((sheet, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveSheetIndex(idx)}
                    className={`
                        px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300
                        ${activeSheetIndex === idx
                        ? 'bg-white text-emerald-700 shadow-sm border border-emerald-100 ring-2 ring-emerald-500/10'
                        : 'text-slate-500 hover:text-emerald-600 hover:bg-white/50'}
                      `}
                  >
                    {sheet.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Data Preview Area */}
            {currentSheet && (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                    <List className="w-4 h-4" /> Sayfa İçeriği: <span className="text-emerald-600">{currentSheet.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                      <button
                        onClick={() => setViewMode('table')}
                        className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${viewMode === 'table'
                            ? 'bg-white text-emerald-700 shadow-sm'
                            : 'text-slate-500 hover:text-emerald-600'
                          }`}
                      >
                        <Database className="w-4 h-4 inline mr-1" />
                        Tablo Görünümü
                      </button>
                      <button
                        onClick={() => setViewMode('personel')}
                        className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${viewMode === 'personel'
                            ? 'bg-white text-emerald-700 shadow-sm'
                            : 'text-slate-500 hover:text-emerald-600'
                          }`}
                      >
                        <Users className="w-4 h-4 inline mr-1" />
                        Personel Grupları
                      </button>
                    </div>
                    <div className="text-xs font-bold text-slate-400 italic">
                      {currentSheet.data.length} satır • {currentSheet.columns.length} sütun
                    </div>
                  </div>
                </div>

                {viewMode === 'table' ? (
                  <DataTable data={currentSheet.data} columns={currentSheet.columns} />
                ) : (
                  <PersonelGroupView data={currentSheet.data} />
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mt-20 border-t border-slate-200 py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 opacity-50 grayscale">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <span className="text-lg font-bold text-slate-900">Excel Viewer Pro</span>
          </div>
          <p className="text-slate-400 text-sm font-semibold">
            Gelişmiş ayıklama motoru ile %100 yerel veri işleme.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
