
// 2. FOR VERCEL (Production)
// Export default is required for ESM in Vercel
export default app;

// --- DEBUG ENDPOINT ---
app.get('/api/debug/health-stats', async (req, res) => {
    try {
        const query = `
      SELECT 
        COALESCE(data_health_description, 'NULL') as status, 
        COUNT(*) as count 
      FROM school_profiles 
      WHERE completion_percentage = 100 
      GROUP BY data_health_description
    `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
