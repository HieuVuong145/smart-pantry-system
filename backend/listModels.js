require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function listModels() {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.list();
        console.log(response);
    } catch (e) {
        console.error('Error listing models:', e.message);
    }
}
listModels();
