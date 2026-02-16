
const grades = ['k', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'];

let sql = '';

// SHIFTING
sql += "\n        -- SHIFTING METRICS\n";
grades.forEach(g => {
    sql += `        SUM(CASE WHEN sp.shift_${g} = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_${g},\n`;
    sql += `        SUM(CASE WHEN sp.shift_${g} = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_${g},\n`;
    sql += `        SUM(CASE WHEN sp.shift_${g} = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_${g},\n`;
});

// LEARNING DELIVERY
sql += "\n        -- LEARNING DELIVERY METRICS\n";
grades.forEach(g => {
    sql += `        SUM(CASE WHEN sp.mode_${g} = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_${g},\n`;
    sql += `        SUM(CASE WHEN sp.mode_${g} LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_${g},\n`;
    sql += `        SUM(CASE WHEN sp.mode_${g} = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_${g},\n`;
});

// ADM
sql += "\n        -- EMERGENCY ADM METRICS\n";
sql += `        SUM(CASE WHEN sp.adm_mdl IS TRUE THEN 1 ELSE 0 END) as cnt_adm_mdl,\n`;
sql += `        SUM(CASE WHEN sp.adm_odl IS TRUE THEN 1 ELSE 0 END) as cnt_adm_odl,\n`;
sql += `        SUM(CASE WHEN sp.adm_tvi IS TRUE THEN 1 ELSE 0 END) as cnt_adm_tvi,\n`;
sql += `        SUM(CASE WHEN sp.adm_blended IS TRUE THEN 1 ELSE 0 END) as cnt_adm_blended,\n`;

console.log(sql);
