require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function testModels() {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const modelsToTest = [
        'gemini-flash-latest',
        'gemini-flash-lite-latest',
        'gemini-2.0-flash-lite-001',
        'gemini-2.0-flash',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite'
    ];

    for (const model of modelsToTest) {
        try {
            console.log(`Testing model: ${model}...`);
            const response = await ai.models.generateContent({
                model: model,
                contents: 'Reply "Hello" if you work.'
            });
            console.log(`✅ Success with ${model}: ${response.text}`);
            return; // Found a working model!
        } catch (e) {
            console.error(`❌ Failed with ${model}:`, e.message);
        }
    }
}
testModels();
