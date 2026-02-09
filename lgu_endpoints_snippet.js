
// ==================================================================
//                      LGU FORMS ROUTES
// ==================================================================

// --- LGU 1. POST: Save New Project (LGU) ---
app.post('/api/lgu/save-project', async (req, res) => {
    const data = req.body;

    if (!data.schoolName || !data.projectName || !data.schoolId) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    let client;
    let clientNew;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // Dual Write Setup
        if (poolNew) {
            try {
                clientNew = await poolNew.connect();
                await clientNew.query('BEGIN');
            } catch (connErr) {
                console.error("⚠️ Dual-Write LGU: Failed to start transaction:", connErr.message);
                clientNew = null;
            }
        }

        // 1. Generate IPC (LGU-YYYY-XXXXX)
        const year = new Date().getFullYear();
        const ipcResult = await client.query(
            "SELECT ipc FROM lgu_forms WHERE ipc LIKE $1 ORDER BY ipc DESC LIMIT 1",
            [`LGU-${year}-%`]
        );

        let nextSeq = 1;
        if (ipcResult.rows.length > 0) {
            const lastIpc = ipcResult.rows[0].ipc;
            const parts = lastIpc.split('-');
            if (parts.length === 3 && !isNaN(parts[2])) {
                nextSeq = parseInt(parts[2]) + 1;
            }
        }
        const newIpc = `LGU-${year}-${String(nextSeq).padStart(5, '0')}`;

        // 2. Prepare Data
        const lguName = await getUserFullName(data.uid);
        const resolvedLguName = lguName || data.submittedBy || 'LGU User';

        const docs = data.documents || [];
        const powDoc = docs.find(d => d.type === 'POW')?.base64 || null;
        const dupaDoc = docs.find(d => d.type === 'DUPA')?.base64 || null;
        const contractDoc = docs.find(d => d.type === 'CONTRACT')?.base64 || null;

        const projectValues = [
            data.projectName, data.schoolName, data.schoolId,
            valueOrNull(data.region), valueOrNull(data.division),
            data.status || 'Not Yet Started', parseIntOrNull(data.accomplishmentPercentage),
            valueOrNull(data.statusAsOfDate), valueOrNull(data.targetCompletionDate),
            valueOrNull(data.actualCompletionDate), valueOrNull(data.noticeToProceed),
            valueOrNull(data.contractorName), parseNumberOrNull(data.projectAllocation),
            valueOrNull(data.batchOfFunds), valueOrNull(data.otherRemarks),
            data.uid,           // lgu_id
            newIpc,
            resolvedLguName,    // lgu_name
            valueOrNull(data.latitude),
            valueOrNull(data.longitude),
            powDoc,
            dupaDoc,
            contractDoc
        ];

        const projectQuery = `
      INSERT INTO "lgu_forms" (
        project_name, school_name, school_id, region, division,
        status, accomplishment_percentage, status_as_of,
        target_completion_date, actual_completion_date, notice_to_proceed,
        contractor_name, project_allocation, batch_of_funds, other_remarks,
        lgu_id, ipc, lgu_name, latitude, longitude,
        pow_pdf, dupa_pdf, contract_pdf
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING project_id, project_name, ipc;
    `;

        // 3. Insert Project
        const projectResult = await client.query(projectQuery, projectValues);
        const newProject = projectResult.rows[0];
        const newProjectId = newProject.project_id;

        // 4. Insert Images
        if (data.images && Array.isArray(data.images) && data.images.length > 0) {
            const imageQuery = `
        INSERT INTO "lgu_image" (project_id, image_data, uploaded_by)
        VALUES ($1, $2, $3)
      `;
            for (const imgBase64 of data.images) {
                await client.query(imageQuery, [newProjectId, imgBase64, data.uid]);
            }
        }

        await client.query('COMMIT');

        // Dual Write Replay
        if (clientNew) {
            try {
                await clientNew.query(projectQuery, projectValues);
                // We need to fetch the ID from secondary to insert images correctly if sequence differs, 
                // but for now assuming synced or just using payload logic (Wait, project_id is serial, so checking ipc is safer)

                const newProjRes = await clientNew.query("SELECT project_id FROM lgu_forms WHERE ipc = $1", [newIpc]);
                if (newProjRes.rows.length > 0) {
                    const secProjId = newProjRes.rows[0].project_id;
                    if (data.images && Array.isArray(data.images)) {
                        const imageQuery = `INSERT INTO "lgu_image" (project_id, image_data, uploaded_by) VALUES ($1, $2, $3)`;
                        for (const imgBase64 of data.images) {
                            await clientNew.query(imageQuery, [secProjId, imgBase64, data.uid]);
                        }
                    }
                }
                await clientNew.query('COMMIT');
                console.log("✅ Dual-Write: LGU Project Synced!");
            } catch (dwErr) {
                console.error("❌ Dual-Write LGU Error:", dwErr.message);
                await clientNew.query('ROLLBACK').catch(() => { });
            }
        }

        // 5. Log Activity
        const logDetails = {
            action: "LGU Project Created",
            ipc: newIpc,
            status: data.status,
            timestamp: new Date().toISOString()
        };

        await logActivity(
            data.uid, resolvedLguName, 'LGU', 'CREATE',
            `LGU Project: ${newProject.project_name} (${newIpc})`,
            JSON.stringify(logDetails)
        );

        res.status(200).json({ message: "LGU Project saved!", project: newProject, ipc: newIpc });

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        if (clientNew) await clientNew.query('ROLLBACK').catch(() => { });
        console.error("❌ LGU Save Error:", err.message);
        res.status(500).json({ message: "Database error", error: err.message });
    } finally {
        if (client) client.release();
        if (clientNew) clientNew.release();
    }
});

// --- LGU 2. POST: Upload Image (LGU) ---
app.post('/api/lgu/upload-image', async (req, res) => {
    const { projectId, imageData, uploadedBy } = req.body;
    if (!projectId || !imageData) return res.status(400).json({ error: "Missing required data" });

    try {
        const query = `INSERT INTO lgu_image (project_id, image_data, uploaded_by) VALUES ($1, $2, $3) RETURNING id;`;
        const result = await pool.query(query, [projectId, imageData, uploadedBy]);

        await logActivity(uploadedBy, 'LGU User', 'LGU', 'UPLOAD', `LGU Project ID: ${projectId}`, `Uploaded image`);

        res.status(201).json({ success: true, imageId: result.rows[0].id });

        // Dual Write
        if (poolNew) {
            try {
                // Need to map project_id if sequences drifted, but simple logic for now:
                // Ideally we pass IPC, but here we only have ID. 
                // Warning: ID mismatch risk.
                // Safe way: SELECT ipc FROM lgu_forms WHERE project_id = $1 -> Then on secondary SELECT project_id FROM lgu_forms WHERE ipc = ...

                const ipcRes = await pool.query("SELECT ipc FROM lgu_forms WHERE project_id = $1", [projectId]);
                if (ipcRes.rows.length > 0) {
                    const ipc = ipcRes.rows[0].ipc;
                    await poolNew.query(`
                    INSERT INTO lgu_image (project_id, image_data, uploaded_by)
                    VALUES ((SELECT project_id FROM lgu_forms WHERE ipc = $1), $2, $3)
                `, [ipc, imageData, uploadedBy]);
                    console.log("✅ Dual-Write: LGU Image Synced!");
                }
            } catch (dwErr) {
                console.error("❌ Dual-Write LGU Image Error:", dwErr.message);
            }
        }

    } catch (err) {
        console.error("❌ LGU Image Upload Error:", err.message);
        res.status(500).json({ error: "Failed to save image" });
    }
});

