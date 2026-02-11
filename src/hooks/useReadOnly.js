import { useState, useEffect } from 'react';

const useReadOnly = () => {
    const [isReadOnly, setIsReadOnly] = useState(false);

    useEffect(() => {
        const checkReadOnly = () => {
            // Logic: If user is Super User AND strictly impersonating (not just logged in as SU? actually SU always impersonates or selects role)
            // If Super User is viewing as "Super User" (dashboard), maybe not read only?
            // But if viewing as another role, YES read only.

            // Current logic in Selector:
            // sessionStorage.setItem('impersonatedRole', selectedRole);
            // sessionStorage.setItem('isViewingAsSuperUser', 'true');

            const isViewingAsSU = sessionStorage.getItem('isViewingAsSuperUser') === 'true';
            const impRole = sessionStorage.getItem('impersonatedRole');

            // If viewing as Super User (the role itself), maybe editable? 
            // But usually SU is an admin.

            if (isViewingAsSU) {
                setIsReadOnly(true);
            } else {
                setIsReadOnly(false);
            }
        };

        checkReadOnly();
        // Listen for storage changes if needed, but usually component works on mount
    }, []);

    return isReadOnly;
};

export default useReadOnly;
