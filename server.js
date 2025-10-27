import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors({
  origin: ["https://www.trippyhippie.store", "http://localhost:5173"],
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
}));

const NRS_TOKEN = process.env.NRSPAY_TOKEN?.trim();
const NRS_DBA_ID = process.env.NRSPAY_DBA_ID?.trim();
const NRS_TERMINAL_ID = process.env.NRSPAY_TERMINAL_ID?.trim();
const CLIENT_URL = process.env.CLIENT_URL?.trim() || "http://localhost:5173";

app.options("/api/nrs/create-payment", cors());
app.post("/api/nrs/create-payment", async (req, res) => {
  const { cart = [], shipping = {}, total = 0 } = req.body;
  if (!Array.isArray(cart) || cart.length === 0)
    return res.status(400).json({ error: "Cart is empty or invalid." });
  if (!NRS_TOKEN || !NRS_DBA_ID || !NRS_TERMINAL_ID)
    return res.status(500).json({ error: "Payment service configuration error." });

  const { email, fullName, street, city, state, zip, phone } = shipping;
  if (!email || !fullName || !street || !city || !state || !zip)
    return res.status(400).json({ error: "Shipping information is incomplete." });

  const normalizedPhone = phone ? `+1${phone.replace(/\D/g, "")}` : "";
  try {
    const nrspayRes = await fetch("https://gateway.nrspaydashboard.com/api/gateway/hosted-form", {
      method: "POST",
      headers: { Authorization: `Bearer ${NRS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dba: { id: NRS_DBA_ID },
        terminal: { id: NRS_TERMINAL_ID },
        threeds: "Disabled",
        amount: parseFloat(total).toFixed(2),
        externalId: `ORDER-${Date.now()}`,
        origin: "WEB",
        returnUrl: `${CLIENT_URL}/checkout-success`,
        cancelUrl: `${CLIENT_URL}/checkout-cancel`,
        returnUrlNavigation: "top",
        useLogo: "Yes",
        requestBillingInfo: "Yes",
        requestContactInfo: "Yes",
        sendReceipt: "Yes",
        billingInfo: { country: "United States", address: street, city, state, zip: String(zip) },
        contactInfo: { name: fullName, email, phone: normalizedPhone },
        order: { description: "Trippy Hippie Order", items: cart.map(i => ({ sku: String(i.id), description: i.name, quantity: parseInt(i.quantity), price: parseFloat(i.price).toFixed(2) })) }
      }),
    });

    const result = await nrspayRes.json();
    if (!nrspayRes.ok) return res.status(nrspayRes.status).json({ error: result.message || "Failed to create payment session" });
    res.json({ code: result.code, url: result.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Payment creation failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
