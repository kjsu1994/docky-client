import { FileX2 } from "lucide-react";

export const EmptyState = ({ message = "데이터가 없습니다.", subMessage = "새로운 내용을 등록해보세요!" }) => (
    <div className="surface-panel motion-panel-in flex flex-col items-center justify-center px-6 py-16 text-center" role="status" aria-live="polite">
        <div className="bg-control p-6 rounded-full mb-4 shadow-card">
            <FileX2 className="h-10 w-10 text-ink-subtle" />
        </div>
        <h3 className="text-lg font-bold text-ink mb-1">{message}</h3>
        <p className="text-sm text-ink-muted">{subMessage}</p>
    </div>
);
