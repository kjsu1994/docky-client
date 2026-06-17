import { useRef, useState } from "react";
import { ChevronDown, DatabaseZap, FileSpreadsheet, RefreshCw, Upload, X } from "lucide-react";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";

const fileLabel = (file) => {
    if (!file) return "CSV 파일 선택";
    const sizeMb = file.size ? `${(file.size / 1024 / 1024).toFixed(1)}MB` : "0MB";
    return `${file.name} · ${sizeMb}`;
};

export const CsvImportPanel = ({
    title = "관리자 CSV 재적재",
    csvPath,
    onCsvPathChange,
    onPathImport,
    onFileImport,
    importing = false,
    disabled = false,
    statusContent = null,
    includeLocationFile = false,
}) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [locationFile, setLocationFile] = useState(null);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const fileInputRef = useRef(null);
    const locationFileInputRef = useRef(null);

    const canUpload = selectedFile && !importing && !disabled;

    const handleFileChange = (event) => {
        setSelectedFile(event.target.files?.[0] || null);
    };

    const handleLocationFileChange = (event) => {
        setLocationFile(event.target.files?.[0] || null);
    };

    const handleUploadImport = async () => {
        if (!canUpload) return;
        await onFileImport?.(selectedFile, { locationFile });
    };

    return (
        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-amber-800">
                <DatabaseZap className="h-4 w-4" />
                <span className="text-sm font-black">{title}</span>
            </div>

            {statusContent}

            <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
            />
            <div className="flex w-full items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2.5">
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing || disabled}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-black text-slate-700 disabled:opacity-60"
                >
                    <FileSpreadsheet className="h-4 w-4 shrink-0 text-amber-600" />
                    <span className="truncate">{fileLabel(selectedFile)}</span>
                </button>
                {selectedFile && !importing ? (
                    <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="선택 해제"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                ) : null}
            </div>

            {includeLocationFile ? (
                <>
                    <input
                        ref={locationFileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={handleLocationFileChange}
                    />
                    <div className="mt-2 flex w-full items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2.5">
                        <button
                            type="button"
                            onClick={() => locationFileInputRef.current?.click()}
                            disabled={importing || disabled}
                            className="min-w-0 flex-1 truncate text-left text-xs font-bold text-slate-600 disabled:opacity-60"
                        >
                            위치 CSV: {locationFile ? fileLabel(locationFile) : "기본 파일 사용"}
                        </button>
                        {locationFile && !importing ? (
                            <button
                                type="button"
                                onClick={() => setLocationFile(null)}
                                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                aria-label="위치 CSV 선택 해제"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        ) : null}
                    </div>
                </>
            ) : null}

            <button
                type="button"
                onClick={handleUploadImport}
                disabled={!canUpload}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2.5 text-xs font-black text-white disabled:opacity-60"
            >
                {importing ? <LoadingSpinner size="sm" text="" /> : <Upload className="h-3.5 w-3.5" />}
                {importing ? "재적재 중..." : "업로드 후 재적재"}
            </button>

            <button
                type="button"
                onClick={() => setAdvancedOpen((value) => !value)}
                className="mt-3 flex w-full items-center justify-between text-xs font-black text-amber-800"
            >
                기존 경로에서 재적재
                <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
            </button>

            {advancedOpen ? (
                <div className="mt-2">
                    <input
                        value={csvPath}
                        onChange={(event) => onCsvPathChange?.(event.target.value)}
                        className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                        placeholder="CSV 경로"
                    />
                    <button
                        type="button"
                        onClick={onPathImport}
                        disabled={importing || disabled}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-xs font-black text-amber-800 disabled:opacity-60"
                    >
                        {importing ? <LoadingSpinner size="sm" text="" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        CSV 다시 적재
                    </button>
                </div>
            ) : null}
        </div>
    );
};

export default CsvImportPanel;
