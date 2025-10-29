// server.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: 'https://www.trippyhippie.store',
    methods: ['POST', 'GET'],
    credentials: true
  })
);


app.use(express.json());

const NRS_TOKEN = process.env.NRSPAY_TOKEN?.trim();
const NRS_DBA_ID = process.env.NRSPAY_DBA_ID?.trim();
const NRS_TERMINAL_ID = process.env.NRSPAY_TERMINAL_ID?.trim();

console.log("Loaded NRS credentials:", {
  hasDbaId: !!NRS_DBA_ID,
  hasTerminalId: !!NRS_TERMINAL_ID,
  hasToken: !!NRS_TOKEN,
});

app.post("/api/nrs/create-token", async (req, res) => {
  try {
    const { amount, externalId } = req.body;

    if (!NRS_TOKEN || !NRS_DBA_ID || !NRS_TERMINAL_ID) {
      console.error("Missing NRS credentials");
      return res.status(500).json({ error: "Payment service configuration error" });
    }

    if (!amount || amount <= 0) {
      console.error("Invalid amount:", amount);
      return res.status(400).json({ error: "Invalid payment amount." });
    }

    const domain = process.env.CLIENT_URL || "http://localhost:5173";

    const requestBody = {
      terminal: { id: Number(NRS_TERMINAL_ID) },
      dba: { id: Number(NRS_DBA_ID) },
      amount: parseFloat(amount).toFixed(2),
      expiration: 15,
      externalId: externalId || `ORDER-${Date.now()}`,
      origin: "WEB",
      domain
    };

    const response = await fetch("https://gateway.nrspaydashboard.com/api/hosted-fields/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NRS_TOKEN}`,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok || !data.token) {
      console.error("Token creation error", data);
      return res.status(response.status).json({ error: data.message || "Failed to create token" });
    }

    res.json({ token: data.token });
  } catch (err) {
    console.error("Error in /create-token", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));

