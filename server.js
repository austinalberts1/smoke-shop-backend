import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();

// Enable JSON body parsing
app.use(express.json());

// CORS setup for dev + prod
app.use(
  cors({
    origin: ["https://www.trippyhippie.store", "http://localhost:5173"], 
    methods: ["POST", "GET"],
    credentials: true,
  })
);

// Backend-only environment variables
const NRS_TOKEN = process.env.NRSPAY_TOKEN?.trim();
const NRS_DBA_ID = process.env.NRSPAY_DBA_ID?.trim();
const NRS_TERMINAL_ID = process.env.NRSPAY_TERMINAL_ID?.trim();
const CLIENT_URL = process.env.CLIENT_URL?.trim() || "http://localhost:5173";

// Log credentials safely
console.log("Loaded NRS credentials:", {
  hasDbaId: !!NRS_DBA_ID,
  hasTerminalId: !!NRS_TERMINAL_ID,
  hasToken: !!NRS_TOKEN,
});

// Health check
app.get("/", (req, res) => res.send("Backend is live"));

// NRS Pay endpoint
app.post("/api/nrs/create-payment", async (req, res) => {
  try {
    const { cart = [], shipping = {}, total = 0, externalId } = req.body;

    if (!Array.isArray(cart) || cart.length === 0)
      return res.status(400).json({ error: "Cart is empty or invalid." });

    if (!NRS_TOKEN || !NRS_DBA_ID || !NRS_TERMINAL_ID)
      return res.status(500).json({ error: "Payment service configuration error." });

    const { email, fullName, street, city, state, zip, phone } = shipping;
    if (!email || !fullName || !street || !city || !state || !zip)
      return res.status(400).json({ error: "Shipping information is incomplete." });

    if (!total || total <= 0)
      return res.status(400).json({ error: "Invalid total amount." });

    const normalizedPhone = phone ? `+1${phone.replace(/\D/g, "")}` : "";

    const requestBody = {
      dba: { id: NRS_DBA_ID },
      terminal: { id: NRS_TERMINAL_ID },
      threeds: "Disabled",
      amount: parseFloat(total).toFixed(2),
      externalId: externalId || `ORDER-${Date.now()}`,
      origin: "WEB",
      returnUrl: `${CLIENT_URL}/checkout-success`,
      cancelUrl: `${CLIENT_URL}/checkout-cancel`,
      returnUrlNavigation: "top",
      useLogo: "Yes",
      requestBillingInfo: "Yes",
      requestContactInfo: "Yes",
      sendReceipt: "Yes",
      billingInfo: { country: "United States", address: street, address2: "", city, state, zip: String(zip) },
      contactInfo: { name: fullName, email, phone: normalizedPhone },
      order: {
        description: "Trippy Hippie Order",
        items: cart.map((item) => ({
          sku: String(item.id),
          description: item.name,
          quantity: parseInt(item.quantity, 10),
          price: parseFloat(item.price).toFixed(2),
        })),
      },
    };

    const nrspayRes = await fetch("https://gateway.nrspaydashboard.com/api/gateway/hosted-form", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NRS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result = await nrspayRes.json();

    if (!nrspayRes.ok) {
      console.error("NRSPAY error details:", result);
      return res.status(nrspayRes.status).json({ error: result.message || "Failed to create payment session" });
    }

    res.json({ code: result.code, url: result.url });
  } catch (err) {
    console.error("NRSPAY create-payment error:", err.message);
    res.status(500).json({ error: "Payment creation failed. Please try again or contact support." });
  }
});

// Listen on PORT (Render or fallback)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
