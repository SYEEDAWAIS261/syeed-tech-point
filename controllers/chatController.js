const axios = require("axios");
const Chat = require("../models/Chat");
const Product = require("../models/Product");
const twilio = require('twilio'); // Pehle install karein: npm install twilio

const client = new twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
const sendAdminWhatsApp = async (details) => {
    try {
        await client.messages.create({
            from: 'whatsapp:+14155238886', // Twilio Sandbox Number
            to: process.env.ADMIN_WHATSAPP_NUMBER,  // Aapka Admin WhatsApp Number
            body: `🚨 *STP Booking Alert*\n\n*Customer Message:* ${details.customerMessage}\n*Status:* Visit Scheduled/Intent Detected\n\n📍 *Showroom Location:* https://maps.app.goo.gl/YourActualLinkHere`
        });
        console.log("✅ Admin WhatsApp Alert Sent");
    } catch (err) {
        console.error("❌ WhatsApp Alert Error:", err.message);
    }
};

    exports.handleAIChat = async (req, res) => {

    // 1. Groq API Key .env se lein
    const apiKey = process.env.GROQ_API_KEY; 
    const { message, history } = req.body;

    // AI ka reply check karne ke baad ye logic la/

    if (!apiKey) {
        return res.status(500).json({ reply: "Groq API Key missing in .env" });
    }

    try {
        // --- Database Logic (Same as before) ---
        const cleanQuery = message.replace(/price|instock|available|check|show|is|the|not/gi, "").trim();
        const searchKeywords = cleanQuery.split(" ").filter(word => word.length > 2);

        const products = await Product.find({ 
            quantity: { $gt: 0 },
            $or: searchKeywords.length > 0 ? searchKeywords.map(word => ({
                $or: [
                    { name: { $regex: word, $options: "i" } },
                    { brand: { $regex: word, $options: "i" } }
                ]
            })) : [{}]
        })
        .select("name brand price discountPrice discountPercentage onSale processor ram storage quantity -_id")
        .limit(5);

        const stockContext = products.length > 0 
    ? products.map(p => {
        // 1. Calculate Discount Price if it's null but percentage exists
        let finalSalePrice = null;

      if (p.discountPrice && p.discountPrice > 0) {
        finalSalePrice = p.discountPrice;
      } else if (p.discountPercentage && p.discountPercentage > 0) {
        finalSalePrice = p.price - (p.price * (p.discountPercentage / 100));
      }
        return `
PRODUCT_RECORD
Name: ${p.brand} ${p.name}
StandardPrice: $${p.price}
SalePrice: ${finalSalePrice ? `$${finalSalePrice.toFixed(2)}` : "NONE"}
UnitsAvailable: ${p.quantity}

RULES:
- Use ONLY the above numbers.
- If SalePrice is NONE, use StandardPrice as final price.
- Never estimate or infer stock.
- If UnitsAvailable >= 5, DO NOT use scarcity language.
- If UnitsAvailable < 5, you MAY use scarcity language.
`;
    }).join("\n\n")
  : "The customer is asking a general question or about visiting. Do not mention 'No products available' unless specifically asked for a model that is out of stock.";
        // --- Groq API Implementation ---
        
        // History ko Groq format (role: assistant/user) mein convert karein
        const formattedHistory = history ? history.map(h => ({
            role: h.role === "model" ? "assistant" : "user",
            content: h.parts[0].text
        })) : [];

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            model: "llama-3.3-70b-versatile", // Super fast and smart model
            messages: [
{
  role: "system",
  content: `
You are “STP Expert”, the Senior Sales Concierge at Syeed Tech Point (STP), UAE.
You represent a modern luxury technology retailer with absolute authority, calm confidence, and commercial precision.
Your communication mirrors elite in-store consultants—not customer support.

INVENTORY CONTEXT:
${stockContext}

────────────────────────────
COMMUNICATION STANDARD
────────────────────────────

Immediate conclusion required.
Deliver the core decision within the first 5 words.
No introductions. No acknowledgements. No filler language.

Your tone is modern, minimal, and decisive.
Short sentences. Controlled pacing. High clarity.

Use elevated commercial language such as:
Distinguished
Optimal Selection
Authenticity Assured
Pre-Owned Excellence
Strategic Investment
Premium Value Acquisition

Never sound scripted.
Never sound casual.
Never sound robotic.

────────────────────────────
PRICING & VALUE DISCIPLINE
────────────────────────────

SalePrice always takes priority when available.

Mandatory pricing format:
Exclusive Offer: $[SalePrice] (Previously $[StandardPrice]).

If value difference is meaningful, reinforce with:
This represents a premium value acquisition for our clients.

Do not estimate.
Do not negotiate.
Do not modify pricing under any circumstance.

────────────────────────────
TRUST, SCARCITY & ASSURANCE
────────────────────────────

If inventory is below five units, state clearly:
Current inventory is critical—only [X] units remain for Sharjah/Dubai delivery.

3. CONVERSATIONAL CLOSING:
- Do NOT use 'ACTIONS' or brackets.
- For Low Stock (<5): End with a "Call to Action" like: "Shall I put a temporary hold on this unit for you while you finalize your decision?"
- For High Stock (>=5): End with a "Consultative Hook" like: "Would you like a side-by-side spec comparison with our other premium models?"

Reinforce confidence briefly:
STP Certified Grade A with a 7-day comprehensive replacement guarantee.

No technical over-explanations.
Confidence replaces excess detail.

────────────────────────────
CLOSING STYLE
────────────────────────────

End every response with a consultative close.
No commands. No buttons. No urgency phrases.

Examples:
Shall I reserve this unit for your collection, or arrange a detailed video inspection via WhatsApp?
Would you prefer to finalize this acquisition at our Sharjah showroom, or proceed with priority Dubai delivery?

────────────────────────────
OPERATIONAL LIMITS
────────────────────────────

Non-STP topics must be declined using:
My expertise is strictly reserved for STP’s premium inventory. Let’s return to your tech requirements.

Formatting rules:
No Markdown.
Use clean spacing.
Double line breaks only.

You are not an assistant.
You are a modern sales authority for a premium UAE technology brand.
5. SHOWROOM & LOGISTICS:
- Agar user Showroom visit ya collection ka kahe, toh lazmi ye details provide karein:
  "Our flagship showroom is located at Shop G-1, Al-Syeed, Sharjah. 
  Timings: 10:00 AM to 10:00 PM (Daily). 
  Our experts will be waiting to assist you with the final inspection."
`
},
                ...formattedHistory,
                { role: "user", content: message }
            ],
            temperature: 0.3, 
            max_tokens: 1024
        }, {
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            }
        });

       // --- 3. Final Response & SMART Admin Alert Logic ---
        if (response.data && response.data.choices) {
            const aiReply = response.data.choices[0].message.content;
            const lowerMsg = message.toLowerCase();
            const lowerReply = aiReply.toLowerCase();

            // ✅ SMART FILTER: 
            // Alert tabhi jayega jab User aana chahta ho AUR AI ne showroom ki info di ho
            const userWantsToVisit = ["visit", "appointment", "coming", "showroom", "today", "tomorrow", "reach"].some(word => lowerMsg.includes(word));
            const aiConfirmedVisit = lowerReply.includes("showroom") || lowerReply.includes("sharjah") || lowerReply.includes("location");

            if (userWantsToVisit && aiConfirmedVisit) {
                // Background mein alert bhejien
                sendAdminWhatsApp({ customerMessage: message });
            }

            // DB Log & Send response
            await Chat.create({ userMessage: message, aiResponse: aiReply });
            return res.status(200).json({ reply: aiReply });
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
        res.status(500).json({ reply: "Service temporarily busy." });
    }
};