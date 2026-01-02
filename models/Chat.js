const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
    {
        userMessage: {
            type: String,
            required: true
        },
        aiResponse: {
            type: String,
            required: true
        },
    },
    { timestamps: true } // Taaki pata chale kab chat hui
);

module.exports = mongoose.model("Chat", chatSchema);