import React, { useMemo } from 'react';
import { ExcelDataRow } from '../types';
import { Users, Clock, Table, AlertTriangle } from 'lucide-react';

interface PersonelData {
    adSoyad: string;
    pozisyon: string;
    masalar: string;
    saat: string;
    section: 'left' | 'right' | 'extra';
    type: 'atanmis' | 'atanmamis';
}

interface PersonelGroupViewProps {
    data: ExcelDataRow[];
}

const PersonelGroupView: React.FC<PersonelGroupViewProps> = ({ data }) => {
    // Masa numarasını kontrol eden fonksiyon (sadece rakamlar ve "-" olmalı)
    const isValidMasaGrubu = (masa: string): boolean => {
        if (!masa || masa.trim() === '') return false;
        // Sadece rakamlar, "-" ve boşluk karakterleri kabul edilir
        return /^[0-9\-\s]+$/.test(masa.trim());
    };

    const parsePersonelData = useMemo(() => {
        const atanmisPersoneller: PersonelData[] = [];
        const atanmamisPersoneller: PersonelData[] = [];
        let personelBasladi = false;
        let ekstraPersonelBaslangicIndex = -1;

        // 1️⃣ İLK "EXTRA PERSONEL" SATIRINI BUL
        for (let i = 1; i < data.length; i++) {
            const cellValue = data[i].__EMPTY_17;
            console.log('Checking row17', i, 'value:', cellValue);

            if (cellValue && cellValue.toString().toUpperCase().includes('EXTRA PERSONEL')) {
                ekstraPersonelBaslangicIndex = i + 1; // bir alt satır
                console.log('Found EXTRA PERSONEL at row', i);
                break;
            }
        }

        // 2️⃣ EXTRA PERSONEL ALT SATIRLARI OKU
        if (ekstraPersonelBaslangicIndex !== -1) {
            for (let i = ekstraPersonelBaslangicIndex; i < data.length; i++) {
                const adSoyad = data[i].__EMPTY_17;      // S sütunu: Ad Soyad
                const masaGrubu = data[i].__EMPTY_20;    // V sütunu: Masa Grubu (POSTA)
                const vardiya = data[i].__EMPTY_21;      // W sütunu: Vardiya (SAAT)
                console.log('Extra Personel row', i, 'adSoyad:', adSoyad, 'masaGrubu:', masaGrubu, 'vardiya:', vardiya);

                // boş satır geldiyse dur
                if (!adSoyad) {
                    break;
                }

                const extraName = adSoyad.toString().trim();
                const extraMasalar = masaGrubu ? masaGrubu.toString().trim() : '';
                const extraSaat = vardiya ? vardiya.toString().trim() : '';

                if (extraMasalar && extraSaat) {
                    // Masa grubu kontrolü
                    if (isValidMasaGrubu(extraMasalar)) {
                        let formattedSaat = extraSaat;
                        if (extraSaat.includes('-K') || extraSaat.includes('--K')) {
                            const baslangic = extraSaat.split('-')[0];
                            formattedSaat = `${baslangic}-06:00`;
                        }

                        atanmisPersoneller.push({
                            adSoyad: extraName,
                            pozisyon: 'EXTRA PERSONEL',
                            masalar: extraMasalar,
                            saat: formattedSaat,
                            section: 'extra',
                            type: 'atanmis'
                        });
                    } else {
                        atanmamisPersoneller.push({
                            adSoyad: extraName,
                            pozisyon: 'EXTRA PERSONEL',
                            masalar: extraMasalar || 'Atanmamış',
                            saat: extraSaat,
                            section: 'extra',
                            type: 'atanmamis'
                        });
                    }
                }
            }
        }

        // 3️⃣ NORMAL PERSONEL İŞLEMLERİ
        data.forEach((row, index) => {
            // Sol taraf (C sütunu - __EMPTY_1) kontrolü
            if (row.__EMPTY_1?.toString().toUpperCase().includes('PERSONEL')) {
                personelBasladi = true;
                return;
            }

            // Sağ taraf (G sütunu - __EMPTY_6) kontrolü
            if (row.__EMPTY_6?.toString().toUpperCase().includes('PERSONEL')) {
                personelBasladi = true;
                return;
            }

            if (personelBasladi && index > 0) {
                // Sol taraf personel verileri
                const leftName = row.__EMPTY_1?.toString().trim();
                const leftPozisyon = row.__EMPTY_2?.toString().trim();
                const leftMasalar = row.__EMPTY_3?.toString().trim();
                const leftSaat = row.__EMPTY_4?.toString().trim();

                if (leftName && leftName !== '' && leftMasalar && leftSaat) {
                    // Masa grubu geçerli mi kontrol et
                    if (isValidMasaGrubu(leftMasalar)) {
                        let formattedSaat = leftSaat;
                        if (leftSaat.includes('-K') || leftSaat.includes('--K')) {
                            const baslangic = leftSaat.split('-')[0];
                            formattedSaat = `${baslangic}-06:00`;
                        }

                        atanmisPersoneller.push({
                            adSoyad: leftName,
                            pozisyon: leftPozisyon || '-',
                            masalar: leftMasalar,
                            saat: formattedSaat,
                            section: 'left',
                            type: 'atanmis'
                        });
                    } else {
                        // Kurallara uymayan personel
                        atanmamisPersoneller.push({
                            adSoyad: leftName,
                            pozisyon: leftPozisyon || '-',
                            masalar: leftMasalar || 'Atanmamış',
                            saat: leftSaat,
                            section: 'left',
                            type: 'atanmamis'
                        });
                    }
                }

                // Sağ taraf personel verileri
                const rightName = row.__EMPTY_5?.toString().trim();
                const rightPozisyon = row.__EMPTY_7?.toString().trim();
                const rightMasalar = row.__EMPTY_8?.toString().trim();
                const rightSaat = row.__EMPTY_9?.toString().trim();

                if (rightName && rightName !== '' && rightMasalar && rightSaat) {
                    // Masa grubu geçerli mi kontrol et
                    if (isValidMasaGrubu(rightMasalar)) {
                        let formattedSaat = rightSaat;
                        if (rightSaat.includes('-K') || rightSaat.includes('--K')) {
                            const baslangic = rightSaat.split('-')[0];
                            formattedSaat = `${baslangic}-06:00`;
                        }

                        atanmisPersoneller.push({
                            adSoyad: rightName,
                            pozisyon: rightPozisyon || '-',
                            masalar: rightMasalar,
                            saat: formattedSaat,
                            section: 'right',
                            type: 'atanmis'
                        });
                    } else {
                        // Kurallara uymayan personel
                        atanmamisPersoneller.push({
                            adSoyad: rightName,
                            pozisyon: rightPozisyon || '-',
                            masalar: rightMasalar || 'Atanmamış',
                            saat: rightSaat,
                            section: 'right',
                            type: 'atanmamis'
                        });
                    }
                }
            }
        });

        return { atanmisPersoneller, atanmamisPersoneller };
    }, [data]);

    // Masa gruplarına göre grupla
    const groupedByMasalar = useMemo(() => {
        const grouped = new Map<string, PersonelData[]>();

        parsePersonelData.atanmisPersoneller.forEach(personel => {
            if (!grouped.has(personel.masalar)) {
                grouped.set(personel.masalar, []);
            }
            grouped.get(personel.masalar)!.push(personel);
        });

        return grouped;
    }, [parsePersonelData]);

    // Tüm masa gruplarını listele (tekil değerler)
    const masaGruplari = useMemo(() => {
        const masalar = new Set<string>();
        parsePersonelData.atanmisPersoneller.forEach(personel => {
            masalar.add(personel.masalar);
        });
        return Array.from(masalar).sort((a, b) => {
            // Rakamsal sıralama için
            const aNum = parseInt(a.split('-')[0]);
            const bNum = parseInt(b.split('-')[0]);
            return aNum - bNum;
        });
    }, [parsePersonelData]);

    const { atanmisPersoneller, atanmamisPersoneller } = parsePersonelData;

    if (atanmisPersoneller.length === 0 && atanmamisPersoneller.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
                <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600">Personel verisi bulunamadı</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Özet Kartlar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-100 text-sm font-medium">Atanmış Personel</p>
                            <p className="text-3xl font-bold mt-1">{atanmisPersoneller.length}</p>
                        </div>
                        <Users className="w-12 h-12 text-blue-200 opacity-80" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-100 text-sm font-medium">Masa Grupları</p>
                            <p className="text-3xl font-bold mt-1">{groupedByMasalar.size}</p>
                        </div>
                        <Table className="w-12 h-12 text-purple-200 opacity-80" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-100 text-sm font-medium">Aktif Vardiyalar</p>
                            <p className="text-3xl font-bold mt-1">{new Set(atanmisPersoneller.map(p => p.saat)).size}</p>
                        </div>
                        <Clock className="w-12 h-12 text-green-200 opacity-80" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-orange-100 text-sm font-medium">Atanmamış</p>
                            <p className="text-3xl font-bold mt-1">{atanmamisPersoneller.length}</p>
                        </div>
                        <AlertTriangle className="w-12 h-12 text-orange-200 opacity-80" />
                    </div>
                </div>
            </div>

            {/* Masa Grupları Listesi */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-100 to-purple-100 px-6 py-4 border-b border-indigo-200">
                    <h3 className="text-lg font-semibold text-indigo-900 flex items-center gap-2">
                        <Table className="w-5 h-5 text-indigo-600" />
                        Tüm Masa Grupları ({masaGruplari.length} Grup)
                    </h3>
                    <p className="text-sm text-indigo-700 mt-1">
                        Aralarında "-" işareti olan rakamlardan oluşan masa grupları
                    </p>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {masaGruplari.map((masaGrubu, index) => {
                            const personelSayisi = groupedByMasalar.get(masaGrubu)?.length || 0;
                            return (
                                <div
                                    key={index}
                                    className="bg-white rounded-lg p-4 border-2 border-indigo-200 hover:border-indigo-400 hover:shadow-lg transition-all"
                                >
                                    <div className="flex flex-col items-center text-center gap-2">
                                        <div className="bg-indigo-100 rounded-full p-2">
                                            <Table className="w-5 h-5 text-indigo-600" />
                                        </div>
                                        <div className="font-bold text-indigo-900 text-sm">
                                            {masaGrubu}
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-indigo-600">
                                            <Users className="w-3 h-3" />
                                            <span>{personelSayisi} personel</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Atanmamış Personeller - Eğer varsa göster */}
            {atanmamisPersoneller.length > 0 && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-xl overflow-hidden">
                    <div className="bg-gradient-to-r from-orange-100 to-orange-200 px-6 py-4 border-b border-orange-300">
                        <h3 className="text-lg font-semibold text-orange-900 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-orange-600" />
                            Masaya Atanmamış Personeller (Kurallara Uymayan)
                        </h3>
                        <p className="text-sm text-orange-700 mt-1">
                            Bu personellerin masa numaralarında sadece rakam ve "-" işareti bulunmuyor
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-orange-100 border-b border-orange-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-orange-800 uppercase tracking-wider">
                                        #
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-orange-800 uppercase tracking-wider">
                                        Ad Soyad
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-orange-800 uppercase tracking-wider">
                                        Pozisyon
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-orange-800 uppercase tracking-wider">
                                        Masa Bilgisi
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-orange-800 uppercase tracking-wider">
                                        Çalışma Saati
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-orange-800 uppercase tracking-wider">
                                        Bölüm
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-orange-200 bg-white">
                                {atanmamisPersoneller.map((personel, index) => (
                                    <tr key={index} className="hover:bg-orange-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 font-medium">
                                            {index + 1}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                            {personel.adSoyad}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                            {personel.pozisyon}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 font-medium">
                                            {personel.masalar}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                                            {personel.saat}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${personel.section === 'left'
                                                ? 'bg-blue-100 text-blue-700'
                                                : personel.section === 'right'
                                                    ? 'bg-purple-100 text-purple-700'
                                                    : 'bg-green-100 text-green-700'
                                                }`}>
                                                {personel.section === 'left' ? 'Sol Bölüm' : personel.section === 'right' ? 'Sağ Bölüm' : 'Extra'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Masa Gruplarına Göre Personel Listesi */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <Table className="w-5 h-5 text-blue-600" />
                        Masa Gruplarına Göre Personel Dağılımı
                    </h3>
                </div>

                <div className="divide-y divide-slate-200">
                    {Array.from(groupedByMasalar.entries())
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([masaGrubu, personeller]) => (
                            <div key={masaGrubu} className="p-6 hover:bg-slate-50 transition-colors">
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="bg-blue-100 rounded-lg p-3">
                                        <Table className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-lg font-semibold text-slate-800 mb-1">
                                            Masa Grubu: {masaGrubu}
                                        </h4>
                                        <p className="text-sm text-slate-500">
                                            {personeller.length} personel görevli
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                                    {personeller.map((personel, idx) => (
                                        <div
                                            key={`${masaGrubu}-${idx}`}
                                            className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-4 border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <h5 className="font-semibold text-slate-800 text-sm">
                                                    {personel.adSoyad}
                                                </h5>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${personel.section === 'left'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : personel.section === 'right'
                                                        ? 'bg-purple-100 text-purple-700'
                                                        : 'bg-green-100 text-green-700'
                                                    }`}>
                                                    {personel.section === 'left' ? 'Sol' : personel.section === 'right' ? 'Sağ' : 'Extra'}
                                                </span>
                                            </div>

                                            <div className="space-y-1 text-xs">
                                                <div className="flex items-center gap-2 text-slate-600">
                                                    <Users className="w-3 h-3" />
                                                    <span>{personel.pozisyon}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-slate-600">
                                                    <Clock className="w-3 h-3" />
                                                    <span className="font-medium text-green-700">{personel.saat}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                </div>
            </div>

            {/* Tüm Atanmış Personel Listesi */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        Tüm Atanmış Personel Listesi
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    #
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Ad Soyad
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Pozisyon
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Masa Grubu
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Çalışma Saati
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Bölüm
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {atanmisPersoneller.map((personel, index) => (
                                <tr key={index} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                        {index + 1}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                        {personel.adSoyad}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                        {personel.pozisyon}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                                        {personel.masalar}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                                        {personel.saat}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${personel.section === 'left'
                                            ? 'bg-blue-100 text-blue-700'
                                            : personel.section === 'right'
                                                ? 'bg-purple-100 text-purple-700'
                                                : 'bg-green-100 text-green-700'
                                            }`}>
                                            {personel.section === 'left' ? 'Sol Bölüm' : personel.section === 'right' ? 'Sağ Bölüm' : 'Extra Personel'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PersonelGroupView;
