export const normalizeOffering = (val) => {
    if (!val) return '';
    const lower = String(val).toLowerCase().trim();

    if (lower === 'purely es') return 'Purely Elementary';
    if (lower === 'es and jhs (k to 10)') return 'Elementary School and Junior High School (K-10)';
    if (lower === 'all offering (k to 12)') return 'All Offering (K-12)';
    if (lower === 'jhs with shs') return 'Junior and Senior High';
    if (lower === 'purely jhs') return 'Purely Junior High School';
    if (lower === 'purely shs') return 'Purely Senior High School';

    return val; // Return original if no match
};
