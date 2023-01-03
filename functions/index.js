import express from 'express';
const app = express();
app.use(express.json());

// APIs
import { postLogin, postRegister } from "./auth.js";
import { getDefault } from "./common.js";

// Endpoints
app.post('/auth/user/login', postLogin);
app.post('/auth/user/register', postRegister);
app.use(getDefault);

export const api = app;