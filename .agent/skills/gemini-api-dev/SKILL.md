---
name: gemini-api-dev
description: >-
  Use this skill when developing or maintaining features powered by Google Gemini API
  or Vertex AI. Covers multimodal inputs (images, OCR, documents), structured JSON schema
  outputs, streaming, function calling, system instructions, and token budget management.
---

# Google Gemini API Development Skill

Best practices and patterns for building production AI applications using Google Gemini API (`@google/genai` or Vertex AI SDK).

---

## 1. Core Patterns

### 1. Structured JSON Output with Schema

Always enforce JSON schema at the API level instead of relying on prompt instructions alone:

```ts
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: "Extract exam questions from the provided text...",
  config: {
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        questions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              questionNumber: { type: Type.INTEGER },
              content: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              correctOptionIndex: { type: Type.INTEGER },
            },
            required: ["questionNumber", "content", "options"],
          },
        },
      },
      required: ["questions"],
    },
  },
});

const result = JSON.parse(response.text);
```

---

### 2. Multimodal OCR & Image Question Ingestion

When processing images (e.g. cropped question images, scanned exams):

```ts
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const imageBuffer = fs.readFileSync("path/to/question.jpg");
const base64Image = imageBuffer.toString("base64");

const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: [
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Image,
      },
    },
    {
      text: "Analyze this exam question image. Transcribe question text, mathematical formulas in LaTeX, and choices A, B, C, D.",
    },
  ],
});
```

---

## 2. Best Practices

- **Thinking & Budgeting**: For complex reasoning tasks, configure thinking tokens (e.g. `gemini-2.0-flash-thinking-exp` or `gemini-3.7-flash` with thinking budget).
- **System Instructions**: Set persona and strict output constraints in `config.systemInstruction` rather than repeating in user prompts.
- **Error Handling & Retries**: Handle rate limits (`429 Too Many Requests`) with exponential backoff and jitter.
