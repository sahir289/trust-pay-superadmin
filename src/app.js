import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import methodOverride from 'method-override';
import cookieParser from 'cookie-parser';
import timeout from 'connect-timeout';
import {
  methodNotFound,
  addLogIdInRequest,
} from './middlewares/requestExtension.js';
import apis from './apis/index.js';
import errorHandler from './middlewares/errorHandler.js';
import config from './config/config.js';
import '../src/cron/gatherAllData.js';

const app = express();
export const usedTokens = new Set();

app.use(cookieParser());
app.use(bodyParser.json({ limit: '50mb', extended: true }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));
app.use(methodOverride());
app.use(
  cors({
    origin: [config?.reactFrontOrigin, config?.reactPaymentOrigin],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allowed methods
    credentials: true,
  }),
);
app.use(express.json());

app.use(addLogIdInRequest);
app.use(apis);
app.use(timeout('20s'));

app.use(errorHandler);
app.use(methodNotFound);

export default app;
