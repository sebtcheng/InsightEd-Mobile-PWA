export const formatNumber = (value) => {
    if (!value && value !== 0) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const parseNumber = (value) => {
    if (!value) return '';
    return value.toString().replace(/,/g, '');
};
