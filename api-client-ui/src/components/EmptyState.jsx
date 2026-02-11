import { FileText, PlusCircle } from "lucide-react";

export const EmptyState = ({
                               icon: Icon = FileText,
                               title = "데이터가 없습니다",
                               description = "",
                               actionLabel = "",
                               onAction = null
                           }) => {
    return (
        <div className="text-center py-12">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
                <Icon className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">{title}</h3>
            {description && (
                <p className="text-sm text-slate-600 mb-6 max-w-sm mx-auto">
                    {description}
                </p>
            )}
            {actionLabel && onAction && (
                <button onClick={onAction} className="btn-primary">
                    <PlusCircle className="h-4 w-4 inline mr-2" />
                    {actionLabel}
                </button>
            )}
        </div>
    );
};