import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export async function generarTokenMemecoin({ text }) {
    const prompt = `
Devuelveme un json con esta estructura con la informacion que te pasare para una memecoin
{
  "name": "",
  "symbol": "",
  "description_short": "",
  "description_long": "",
  "hashtags": "",
  "emojis": "",
  "disclaimers:"": 
}
Texto:
"""
${text}
"""
`;

    const body = {
        model: 'gpt-4o',
        messages: [
            {
                role: 'user',
                content: prompt,
            },
        ],
        temperature: 0.7,
    };

    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        body,
        {
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
        }
    );
    console.log(response.data.choices[0].message.content)
    return response.data.choices[0].message.content;
}
