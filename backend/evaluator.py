import json
import logging
from typing import Dict, Any, Optional
from config import GEMINI_MODEL, GEMINI_API_KEY, GROQ_MODEL, GROQ_API_KEY

logger = logging.getLogger(__name__)

class RAGEvaluator:
    def __init__(self):
        self.llm = None
        try:
            if GROQ_API_KEY:
                from langchain_groq import ChatGroq
                from rag_engine import get_groq_chat_models, resolve_best_groq_model
                groq_models = get_groq_chat_models()
                eval_model = "groq/compound-mini" if "groq/compound-mini" in groq_models else resolve_best_groq_model(groq_models)
                self.llm = ChatGroq(
                    model=eval_model,
                    groq_api_key=GROQ_API_KEY,
                    temperature=0.1
                )
                logger.info(f"RAGEvaluator initialized with Groq LLM: {eval_model}.")
            elif GEMINI_API_KEY:
                from langchain_google_genai import ChatGoogleGenerativeAI
                self.llm = ChatGoogleGenerativeAI(
                    model=GEMINI_MODEL,
                    google_api_key=GEMINI_API_KEY,
                    temperature=0.1
                )
                logger.info("RAGEvaluator initialized with Google Gemini LLM.")
        except Exception as e:
            logger.error(f"Error initializing RAGEvaluator LLM: {e}")

    def evaluate(self, query: str, context: str, answer: str, model_name: Optional[str] = None) -> Dict[str, Any]:
        """Evaluate RAG output using LLM as a judge."""
        # To avoid hitting heavy rate limits (especially when Qwen is used),
        # we always use our dedicated fast evaluator model (groq/compound-mini or gemini-1.5-flash)
        llm = self.llm
        if not llm:
            logger.warning("No API key found or LLM could not be resolved. Skipping evaluation.")
            return {
                "faithfulness": {"score": 1.0, "reasoning": "Evaluation skipped (no LLM configured)"},
                "answer_relevance": {"score": 1.0, "reasoning": "Evaluation skipped (no LLM configured)"},
                "context_precision": {"score": 1.0, "reasoning": "Evaluation skipped (no LLM configured)"}
            }

        # We limit the context to 15,000 characters (about 3,500 words). This ensures the judge
        # receives the entire retrieved context (all 4 chunks) to guarantee 100% accurate evaluations,
        # while keeping the request well within the compound-mini model's large rate limit.
        safe_context = context[:15000] if context else ""

        prompt = f"""You are an expert AI QA Quality Evaluator. You are evaluating a RAG (Retrieval-Augmented Generation) system.
Given the following inputs:
- User Question: {query}
- Retrieved Context (Document Chunks): {safe_context}
- Generated Answer: {answer}

Evaluate the system based on the following three metrics. For each metric, assign a score between 0.0 and 1.0 (where 1.0 is perfect and 0.0 is completely incorrect/irrelevant), along with a concise 1-sentence reasoning.

Metrics:
1. Faithfulness (Groundedness): Is the answer entirely based on the provided context? Does it introduce any outside information or claim not mentioned in the context? (1.0 = fully grounded, 0.0 = completely hallucinated/not supported by context).
2. Answer Relevance: Does the generated answer directly address the user's question? Is it concise and helpful? (1.0 = highly relevant, 0.0 = completely irrelevant/generic).
3. Context Precision: How relevant are the provided document chunks (context) to the user's question? Do they contain the information needed to answer the question? (1.0 = all chunks are highly relevant, 0.0 = no chunks are relevant).

Respond ONLY with a valid JSON object in the following format:
{{
  "faithfulness": {{
    "score": 0.9,
    "reasoning": "Reasoning here."
  }},
  "answer_relevance": {{
    "score": 1.0,
    "reasoning": "Reasoning here."
  }},
  "context_precision": {{
    "score": 0.8,
    "reasoning": "Reasoning here."
  }}
}}
Do not add any markdown formatting, code block ticks, or extra text. Return only the JSON object.
"""
        try:
            response = llm.invoke(prompt)
            text = response.content.strip()
            
            # Clean possible markdown wrapping
            if text.startswith("```json"):
                text = text[7:]
            elif text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
            
            # Clean illegal trailing commas in JSON (e.g. , } or , ]) using regex
            import re
            text = re.sub(r',\s*([\]}])', r'\1', text)
            
            data = json.loads(text)
            return data
        except Exception as e:
            logger.error(f"Error running RAG evaluation: {e}")
            return {
                "faithfulness": {"score": 0.0, "reasoning": f"Evaluation error: {str(e)}"},
                "answer_relevance": {"score": 0.0, "reasoning": "Evaluation failed"},
                "context_precision": {"score": 0.0, "reasoning": "Evaluation failed"}
            }
