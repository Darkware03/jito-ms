import express from 'express';
import jitoRouter from './routes/jito.routes.js';
import twitterRoutes from "./routes/twitter.routes.js";
import tokenGeneratorRoutes from "./routes/token-generator.routes.js";
import tokenRoutes  from "./routes/openai.routes.js"
import gmgnRoutes from "./routes/gmgn.routes.js";
import pumpRoutes from "./routes/pump.routes.js";
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/jito', jitoRouter);
app.use('/api/twitter', twitterRoutes);
app.use('/api/token', tokenGeneratorRoutes);
app.use('/api/tokenai', tokenRoutes );
app.use("/api/gmgn", gmgnRoutes);
app.use('/api/pump', pumpRoutes);

// Manejo de errores
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ ok: false, error: err.message });
});

export default app;
