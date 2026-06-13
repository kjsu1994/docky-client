import { useCallback, useEffect, useState } from "react";
import { Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { authAdapter, extractAuthErrorMessage } from "../adapters/authAdapter.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { isAdminUser } from "../utils/authorization.js";
import { notifyError, notifySuccess } from "../utils/toast.js";
import { LoadingSpinner } from "./LoadingSpinner.jsx";

export const AdminMfaGate = ({ children }) => {
    const { user } = useAuth();
    const [status, setStatus] = useState(null);
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [confirming, setConfirming] = useState(false);

    const admin = isAdminUser(user);

    const fetchStatus = useCallback(async () => {
        if (!admin) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            setStatus(await authAdapter.fetchAdminMfaStatus());
        } catch (error) {
            notifyError(extractAuthErrorMessage(error, "Admin verification status could not be loaded."));
            setStatus({ required: true, verified: false });
        } finally {
            setLoading(false);
        }
    }, [admin]);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    const handleSend = async () => {
        if (sending) return;
        setSending(true);
        try {
            await authAdapter.sendAdminMfaCode();
            notifySuccess("Verification code sent.");
        } catch (error) {
            notifyError(extractAuthErrorMessage(error, "Verification code could not be sent."));
        } finally {
            setSending(false);
        }
    };

    const handleConfirm = async (event) => {
        event.preventDefault();
        if (confirming) return;
        const normalizedCode = code.trim();
        if (!/^\d{6}$/.test(normalizedCode)) {
            notifyError("Enter the 6 digit code.");
            return;
        }
        setConfirming(true);
        try {
            const response = await authAdapter.confirmAdminMfaCode(normalizedCode);
            setStatus({ required: true, verified: Boolean(response?.verified), ttl_seconds: response?.ttl_seconds || 0 });
            setCode("");
            notifySuccess("Admin verification completed.");
        } catch (error) {
            notifyError(extractAuthErrorMessage(error, "Verification failed."));
        } finally {
            setConfirming(false);
        }
    };

    if (!admin) return children;
    if (loading) return <LoadingSpinner text="Checking admin verification..." />;
    if (!status?.required || status?.verified) return children;

    return (
        <div className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center justify-center px-4 py-10">
            <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                        <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg font-black text-slate-900">Admin verification</h1>
                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                            Verify this login session by email before opening admin tools.
                        </p>
                    </div>
                </div>

                <form className="space-y-4" onSubmit={handleConfirm}>
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={sending || confirming}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                    >
                        {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                        {sending ? "Sending..." : "Send verification code"}
                    </button>

                    <label className="block">
                        <span className="mb-2 block text-sm font-black text-slate-700">6 digit code</span>
                        <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={code}
                            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                            className="h-12 w-full rounded-xl border border-slate-200 px-4 text-center text-lg font-black text-slate-900 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                            placeholder="000000"
                        />
                    </label>

                    <button
                        type="submit"
                        disabled={confirming || code.length !== 6}
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                    >
                        {confirming ? "Verifying..." : "Verify"}
                    </button>
                </form>
            </section>
        </div>
    );
};

export default AdminMfaGate;
