export const hasRole = (roles, roleName) => {
    if (!roles) return false;
    const normalizedTarget = String(roleName).toUpperCase();

    const normalizeRoleToken = (value) => {
        if (!value) return "";
        const token = String(value).toUpperCase().trim();
        return token.startsWith("ROLE_") ? token : `ROLE_${token}`;
    };

    const matchRole = (value) => normalizeRoleToken(value) === normalizedTarget;

    if (Array.isArray(roles)) {
        return roles.some((item) => {
            if (typeof item === "string") return matchRole(item);
            if (item && typeof item === "object") {
                return (
                    matchRole(item.role) ||
                    matchRole(item.name) ||
                    matchRole(item.authority) ||
                    matchRole(item.value)
                );
            }
            return false;
        });
    }

    if (roles && typeof roles === "object") {
        return (
            matchRole(roles.role) ||
            matchRole(roles.name) ||
            matchRole(roles.authority) ||
            matchRole(roles.value)
        );
    }

    return String(roles)
        .split(",")
        .map((v) => v.trim())
        .some((v) => matchRole(v));
};

export const getMemberId = (obj) =>
    obj?.member_id ??
    obj?.memberId ??
    obj?.id ??
    null;

export const isAdminUser = (user) => {
    if (!user) return false;
    return (
        hasRole(user.roles, "ROLE_ADMIN") ||
        hasRole(user.role, "ROLE_ADMIN") ||
        hasRole(user.member?.roles, "ROLE_ADMIN") ||
        hasRole(user.member?.role, "ROLE_ADMIN")
    );
};

export const isOwnerUser = (user, owner, fallback = {}) => {
    if (!user || !owner) return false;

    const userId = getMemberId(user);
    const ownerId = getMemberId(owner);
    if (userId !== null && ownerId !== null && String(userId) === String(ownerId)) {
        return true;
    }

    const userEmail = user?.email;
    const ownerEmail = owner?.email;
    if (userEmail && ownerEmail && userEmail === ownerEmail) {
        return true;
    }

    if (fallback.userName && fallback.ownerName) {
        return fallback.userName === fallback.ownerName;
    }

    return false;
};

export const canManageByOwnerOrAdmin = (user, owner, fallback = {}) =>
    isAdminUser(user) || isOwnerUser(user, owner, fallback);
