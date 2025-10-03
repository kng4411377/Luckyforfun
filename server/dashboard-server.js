/**
 * Simple Express server to serve the backtesting dashboard
 * and provide API endpoints for JSON files
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Serve static files from dashboard directory
app.use('/dashboard', express.static(path.join(__dirname, '../dashboard')));

// Serve logs directory for JSON files
app.use('/logs', express.static(path.join(__dirname, '../logs')));

// API endpoint to list available backtest files
app.get('/api/backtest-files', (req, res) => {
    try {
        const logsDir = path.join(__dirname, '../logs');
        const files = fs.readdirSync(logsDir)
            .filter(file => file.startsWith('backtest-results-') && file.endsWith('.json'))
            .map(file => {
                const filepath = path.join(logsDir, file);
                const stats = fs.statSync(filepath);
                return {
                    name: file,
                    path: `/logs/${file}`,
                    size: stats.size,
                    modified: stats.mtime,
                    url: `http://localhost:${PORT}/logs/${file}`
                };
            })
            .sort((a, b) => b.modified - a.modified); // Sort by most recent first
        
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: 'Failed to list backtest files' });
    }
});

// API endpoint to get a specific backtest file
app.get('/api/backtest/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filepath = path.join(__dirname, '../logs', filename);
        
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read backtest file' });
    }
});

// Redirect root to dashboard
app.get('/', (req, res) => {
    res.redirect('/dashboard/backtest-dashboard.html');
});

// Start server
app.listen(PORT, () => {
    console.log('🚀 Backtesting Dashboard Server Started!');
    console.log('=' .repeat(50));
    console.log(`📊 Dashboard URL: http://localhost:${PORT}`);
    console.log(`📁 Direct access: http://localhost:${PORT}/dashboard/backtest-dashboard.html`);
    console.log(`🔗 API endpoint: http://localhost:${PORT}/api/backtest-files`);
    console.log('=' .repeat(50));
    console.log('💡 Upload your JSON files from the logs/ directory');
    console.log('📈 Analyze your backtesting results visually!');
});

export default app;
