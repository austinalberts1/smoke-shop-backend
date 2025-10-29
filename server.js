// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: "https://www.trippyhippie.store",
    methods: ["POST", "GET"],
    credentials: true,
  })
);

app.use(express.json());

// Load NRS credentials from environment variables
const NRS_TOKEN = process.env.NRSPAY_API_TOKEN?.trim();
const NRS_DBA_ID = process.env.VITE_NRSPAY_DBA_ID?.trim();
const NRS_TERMINAL_ID = process.env.VITE_NRSPAY_TERMINAL_ID?.trim();

console.log("Loaded NRS credentials:", {
  hasDbaId: !!NRS_DBA_ID,
  hasTerminalId: !!NRS_TERMINAL_ID,
  hasToken: !!NRS_TOKEN,
});

// Route to create Hosted Fields Token
app Post("/api/nrs/create-token", async (req, res) => {
  try {
    const { amount, externalId } = req.body;

    if (!NRS_TOKEN || !NRS_DBA_ID || !NRS_TERMINAL_ID) {
      console.error("Missing NRS credentials");
      return res
        .status(500)
        .json({ error: "Payment service configuration error" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid payment amount." });
    }

    const domain = process.env.VITE_CLIENT_URL || "http://localhost:5173";

    const requestBody = {
      terminal: Number(NRS_TERMINAL_ID),
      domain,
      expiration: 15,
      saveCard: "disabled",
      "3ds": false,
    };

    const response = await fetch(
      "https://nrspaydashboard.com/api/hosted-fields/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${NRS_TOKEN}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.access_token) {
      console.error("Token creation error", data);
      return res
        .status(response.status)
        .json({ error: data.message || "Failed to create token" });
    }

    res.json({ token: data.access_token });
  } catch (err) {
    console.error("Error in /create-token", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---- ADD THIS AFTER the /create-token route ----
app.post("/api/nrs/pay", async (req, res) => {
  try {
    const { hostedFieldsToken, amount, externalId, order } = req.body;

    if (!NRS_TOKEN || !NRS_TERMINAL_ID) {
      return res.status(500).json({ error: "Gateway mis-configured" });
    }

    const payload = {
      terminal: { id: Number(NRS_TERMINAL_ID) },
      amount: Number(amount).toFixed(2),
      source: "Internet",
      level: 1,
      threeds: { id: null },
      card: { token: hostedFieldsToken },
      externalId: externalId ?? null,
      order: order ?? null,
    };

    const resp = await fetch(
      "https://gateway.nrspaydashboard.com/payment/sale",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${NRS_TOKEN}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await resp.json();

    if (!resp.ok) {
      console.error("NRSPay sale error", data);
      return res.status(resp.status).json(data);
    }

    res.json(data);
  } catch (err) {
    console.error("pay endpoint error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
