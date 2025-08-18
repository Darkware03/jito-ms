import express from 'express';
import jitoRouter from './routes/jito.routes.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/jito', jitoRouter);

// Manejo de errores
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ ok: false, error: err.message });
});

export default app;
