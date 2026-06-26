const axios = require('axios');
const db = require('../config/firebaseConfig');
const { GoogleGenAI } = require('@google/genai');

/**
 * Vision Service — Phân tích ảnh thực phẩm bằng AI
 * Hỗ trợ Google Cloud Vision API và OpenAI Vision API
 * 
 * Human-in-the-Loop: 
 * - Truyền context (danh sách nguyên liệu đã biết) vào prompt AI
 * - Đánh dấu vật thể không nhận diện được để người dùng định nghĩa
 */

// Danh sách từ khóa cho vật thể "chưa rõ" → cần người dùng định nghĩa
const GENERIC_ITEM_KEYWORDS = [
    'bottle', 'jar', 'container', 'box', 'bag', 'packet', 'can', 'tube',
    'lọ', 'chai', 'hộp', 'túi', 'gói', 'lon', 'bình', 'thùng',
    'unknown', 'unidentified', 'không rõ', 'vật thể'
];

/**
 * Lấy context từ Firebase: danh sách nguyên liệu đã được người dùng định nghĩa
 * + inventory hiện tại → để AI có thông tin tham chiếu
 */
async function getItemContext(familyId) {
    let definitions = [];
    let inventory = [];

    try {
        // 1. Lấy danh sách item_definitions (do người dùng đã dạy AI)
        const defSnap = await db.ref(`item_definitions/${familyId}`).once('value');
        if (defSnap.exists()) {
            defSnap.forEach(child => {
                const def = child.val();
                definitions.push({
                    name: def.name,
                    description: def.description || '',
                    category: def.category || 'khac'
                });
            });
        }

        // 2. Lấy inventory hiện tại (để AI biết những gì đã có trong pantry)
        const invSnap = await db.ref('inventory')
            .orderByChild('familyId')
            .equalTo(familyId)
            .once('value');
        if (invSnap.exists()) {
            invSnap.forEach(child => {
                const item = child.val();
                inventory.push({
                    name: item.name,
                    category: item.category,
                    status: item.status
                });
            });
        }
    } catch (error) {
        console.error('⚠️ Error fetching item context:', error.message);
    }

    return { definitions, inventory };
}

/**
 * Tạo phần context string để đưa vào prompt AI
 */
function buildContextPrompt(context) {
    let contextStr = '';

    if (context.definitions.length > 0) {
        contextStr += `\n\nIMPORTANT CONTEXT — The user has previously defined the following items in their pantry. Use this to correctly identify items:\n`;
        context.definitions.forEach(def => {
            contextStr += `- "${def.name}" (${def.category}): ${def.description}\n`;
        });
    }

    if (context.inventory.length > 0) {
        contextStr += `\nCurrent items already tracked in this pantry:\n`;
        context.inventory.forEach(item => {
            contextStr += `- ${item.name} (${item.category})\n`;
        });
    }

    return contextStr;
}

/**
 * Kiểm tra xem AI item có phải là mô tả chung chung (cần người dùng định nghĩa) hay không
 */
function checkNeedsDefinition(item) {
    const nameLower = (item.name || '').toLowerCase();
    const nameEnLower = (item.nameEn || '').toLowerCase();

    // Kiểm tra nếu tên chỉ là mô tả chung chung (ví dụ: "Chai", "Lọ", "Hộp"...)
    for (const keyword of GENERIC_ITEM_KEYWORDS) {
        if (nameLower === keyword || nameEnLower === keyword) {
            return true;
        }
        // Nếu tên chỉ gồm keyword + 1 từ bổ trợ (ví dụ: "Lọ nhỏ", "Chai đỏ")
        if (nameLower.split(' ').length <= 2 && nameLower.includes(keyword)) {
            return true;
        }
    }

    // Nếu tên chứa "không rõ", "unknown" etc.
    if (nameLower.includes('không rõ') || nameLower.includes('không xác định') ||
        nameEnLower.includes('unknown') || nameEnLower.includes('unidentified')) {
        return true;
    }

    return false;
}



// Phân tích ảnh bằng OpenAI GPT-4 Vision API (có context)
async function analyzeWithOpenAI(imageBase64, context = null) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not set');
    }

    // Build context-aware prompt
    const contextStr = context ? buildContextPrompt(context) : '';

    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: 'gpt-4o-mini',
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `Analyze this pantry rack photo. Identify all food items, ingredients, and seasonings visible on the storage shelf.
${contextStr}
For items you CANNOT confidently identify (e.g. unlabeled jars, opaque containers), set "needsDefinition": true and describe the physical appearance (color, size, shape, lid color) in the "description" field.
For items you CAN identify (labeled bottles, recognizable products, items matching the context above), set "needsDefinition": false.

CRITICAL: To calculate "estimatedPercent" accurately, use Chain of Thought. Carefully observe the container's bottom, top, and where the content (liquid/powder) ends. If it's near the bottom, it's 5-20%. If it's half, it's 40-50%. Do NOT overestimate. You must provide a "reasoning" field explaining your visual calculation before outputting the percentage.

Return a JSON object with this exact format (DO NOT use "condition", use "estimatedPercent"):
{
  "items": [
    { "name": "tên tiếng Việt", "nameEn": "English name", "category": "one of: thit_ca (meat/fish), rau_cu (vegetables), trai_cay (fruits), gia_vi (seasonings), do_uong (drinks), sua_trung (dairy/eggs), do_kho (dry goods), khac (other)", "estimatedQuantity": "e.g. 1 chai, 500g, 3 gói", "reasoning": "I can see the transparent jar. The white powder is at approximately 1/4 of the total jar height.", "estimatedPercent": 25, "needsDefinition": false, "description": "mô tả vật lý nếu cần (màu sắc, hình dạng, nắp)" }
  ],
  "summary": "Brief, matter-of-fact description in Vietnamese stating ONLY what items are present or which item seems to be used. DO NOT hallucinate interactions (e.g. do not say someone is pouring one item into another).",
  "action": "took_out or put_in or just_checking (guess based on context)"
}
Only return valid JSON, no markdown.`
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${imageBase64}`,
                            detail: 'low'
                        }
                    }
                ]
            }],
            max_tokens: 1000,
            temperature: 0.2
        },
        {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        }
    );

    const content = response.data.choices[0].message.content;
    
    try {
        return JSON.parse(content);
    } catch {
        // If AI returns markdown-wrapped JSON, extract it
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return { items: [], summary: content, action: 'unknown' };
    }
}

/**
 * Phân tích ảnh bằng Google Gemini API (có context)
 */
async function analyzeWithGemini(imageBase64, context = null) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set');
    }

    const ai = new GoogleGenAI({ apiKey });

    // Build context-aware prompt
    const contextStr = context ? buildContextPrompt(context) : '';
    const prompt = `Analyze this pantry rack photo. Identify all food items, ingredients, and seasonings visible on the storage shelf.
${contextStr}
For items you CANNOT confidently identify (e.g. unlabeled jars, opaque containers), set "needsDefinition": true and describe the physical appearance (color, size, shape, lid color) AND their exact position (e.g. "Lọ thứ 2 từ trái sang", "Bên phải lọ nắp đỏ", "Góc dưới cùng bên trái") in the "description" field.
For items you CAN identify (labeled bottles, recognizable products, items matching the context above), set "needsDefinition": false.

CRITICAL: To calculate "estimatedPercent" accurately, use Chain of Thought. Carefully observe the container's bottom, top, and where the content (liquid/powder) ends. If it's near the bottom, it's 5-20%. If it's half, it's 40-50%. Do NOT overestimate. You must provide a "reasoning" field explaining your visual calculation before outputting the percentage.

Return a JSON object with this exact format (DO NOT use "condition", use "estimatedPercent"):
{
  "items": [
    { 
      "name": "tên tiếng Việt", 
      "nameEn": "English name", 
      "category": "gia_vi", 
      "estimatedQuantity": "1 chai", 
      "reasoning": "I can see the transparent jar. The white powder is at approximately 1/4 of the total jar height.",
      "estimatedPercent": 25, 
      "needsDefinition": false, 
      "description": "mô tả vật lý (màu sắc, hình dạng, nắp) VÀ vị trí chính xác (trái/phải, thứ tự từ trái sang)",
      "boundingBox": [ymin, xmin, ymax, xmax] 
    }
  ],
  "summary": "Brief, matter-of-fact description in Vietnamese stating ONLY what items are present or which item seems to be used. DO NOT hallucinate interactions (e.g. do not say someone is pouring one item into another).",
  "action": "took_out or put_in or just_checking"
}
For boundingBox, provide normalized coordinates from 0 to 1000 (e.g. [100, 200, 500, 400] where [top, left, bottom, right]). If you cannot determine the bounding box, return null.
Only return valid JSON, no markdown.`;

    let response;
    try {
        response = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents: [
                prompt,
                { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } }
            ],
            config: {
                responseMimeType: "application/json",
                temperature: 0.2
            }
        });
    } catch (e) {
        console.warn('⚠️ gemini-flash-latest failed, falling back to gemini-flash-lite-latest...', e.message);
        response = await ai.models.generateContent({
            model: 'gemini-flash-lite-latest',
            contents: [
                prompt,
                { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } }
            ],
            config: {
                responseMimeType: "application/json",
                temperature: 0.2
            }
        });
    }

    const content = response.text;
    
    try {
        return JSON.parse(content);
    } catch {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return { items: [], summary: content, action: 'unknown' };
    }
}

/**
 * Main analyze function — tries Gemini first, then OpenAI, falls back to Google Vision
 * Nhận thêm context từ item_definitions để AI nhận diện chính xác hơn
 */
async function analyzeImage(imageBase64, context = null) {
    // Try Gemini first
    if (process.env.GEMINI_API_KEY) {
        try {
            console.log('🤖 Analyzing with Gemini Vision...');
            if (context) {
                console.log(`📋 Context: ${context.definitions.length} definitions, ${context.inventory.length} inventory items`);
            }
            const result = await analyzeWithGemini(imageBase64, context);
            result.provider = 'gemini';

            // Post-process: đánh dấu item chung chung cần định nghĩa
            if (result.items) {
                result.items = result.items.map(item => ({
                    ...item,
                    needsDefinition: item.needsDefinition || checkNeedsDefinition(item)
                }));
            }

            return result;
        } catch (error) {
            console.error('⚠️ Gemini Vision failed:', error.message);
        }
    }

    // Try OpenAI next
    if (process.env.OPENAI_API_KEY) {
        try {
            console.log('🤖 Analyzing with OpenAI Vision...');
            if (context) {
                console.log(`📋 Context: ${context.definitions.length} definitions, ${context.inventory.length} inventory items`);
            }
            const result = await analyzeWithOpenAI(imageBase64, context);
            result.provider = 'openai';

            // Post-process: đánh dấu item chung chung cần định nghĩa
            if (result.items) {
                result.items = result.items.map(item => ({
                    ...item,
                    needsDefinition: item.needsDefinition || checkNeedsDefinition(item)
                }));
            }

            return result;
        } catch (error) {
            console.error('⚠️ OpenAI Vision failed:', error.message);
        }
    }

    // Nếu đến được đây nghĩa là cả 2 API đều thất bại hoặc không có API key
    console.error('❌ Cả OpenAI và Gemini đều thất bại hoặc chưa được cấu hình.');
    return {
        provider: 'error',
        items: [],
        summary: 'Lỗi: Không thể phân tích hình ảnh do API Key không hợp lệ hoặc bị quá tải.',
        action: 'error'
    };
}

// Mock data for development when no API key is available
function getMockAnalysis() {
    return {
        provider: 'mock',
        items: [
            { name: 'Nước mắm', nameEn: 'Fish sauce', category: 'gia_vi', estimatedQuantity: '1 chai', estimatedPercent: 70, needsDefinition: false },
            { name: 'Lọ thuỷ tinh nắp xanh', nameEn: 'Glass jar with blue lid', category: 'gia_vi', estimatedQuantity: '1 lọ', estimatedPercent: 90, needsDefinition: true, description: 'Lọ thuỷ tinh tròn, nắp màu xanh dương, chứa bột trắng' },
            { name: 'Dầu ăn', nameEn: 'Cooking oil', category: 'gia_vi', estimatedQuantity: '1 chai', estimatedPercent: 100, needsDefinition: false },
            { name: 'Mì tôm', nameEn: 'Instant noodles', category: 'do_kho', estimatedQuantity: '5 gói', estimatedPercent: 100, needsDefinition: false },
            { name: 'Đường', nameEn: 'Sugar', category: 'gia_vi', estimatedQuantity: '1 kg', estimatedPercent: 40, needsDefinition: false }
        ],
        summary: 'Giá đồ có nước mắm, một lọ chưa xác định (cần người dùng định nghĩa), dầu ăn, mì tôm và đường.',
        action: 'just_checking'
    };
}

module.exports = { analyzeImage, analyzeWithGemini, analyzeWithOpenAI, getItemContext };
