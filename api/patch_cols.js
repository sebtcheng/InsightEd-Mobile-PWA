import fs from 'fs';
const file = './index.js';
let content = fs.readFileSync(file, 'utf8');

// The columns that changed between the old cloned masterlist and the EFD database schema
content = content.replace(/estimated_classroom_shortage/g, 'est_classroom_shortage');
content = content.replace(/proposed_no_of_classrooms/g, 'proposed_no_of_cl');
content = content.replace(/est_cost_of_classrooms/g, 'est_classroom_cost');

// Be careful with short names like sty and cl
content = content.replace(/"sty"/g, '"sty_count"');
content = content.replace(/"cl"/g, '"cl_count"');

fs.writeFileSync(file, content, 'utf8');
console.log("Updated masterlist column names in api/index.js");
