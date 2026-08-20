import os
import shutil
import json
import logging
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import DOCUMENTS_PATH, VECTOR_DB_PATH, GEMINI_API_KEY, GROQ_API_KEY
from document_downloader import download_regulatory_docs
from guardrails import check_input_safety_local
from evaluator import RAGEvaluator
from rag_engine import RAGEngine
from url_scraper import scrape_webpage_to_text
from advanced_guardrails import AdvancedGuardrails

# Advanced Guardrails manager (lazy initialized with embeddings)
advanced_guardrails = None

def get_advanced_guardrails():
    global advanced_guardrails
    if advanced_guardrails is None:
        if rag_engine.embeddings is None:
            try:
                rag_engine.initialize_embeddings()
            except Exception:
                pass
        advanced_guardrails = AdvancedGuardrails(rag_engine.embeddings)
    return advanced_guardrails

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Compliance & Risk Advisor API",
    description="FastAPI backend for querying AI compliance documents, evaluating answers, and tracing metrics.",
    version="1.0.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize RAG Engine and Evaluator
rag_engine = RAGEngine()
evaluator = RAGEvaluator()

class ChatRequest(BaseModel):
    message: str
    model_name: Optional[str] = None
    temperature: Optional[float] = None

class ScrapeRequest(BaseModel):
    url: str
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None

class EvaluateRequest(BaseModel):
    message: str
    context: str
    answer: str
    model_name: Optional[str] = None

# In-memory session logs for testing/monitoring
system_queries_log = []

@app.get("/api/status")
def get_system_status():
    """Get the current database and document status."""
    is_ready = rag_engine.is_vector_db_ready()
    docs = []
    if os.path.exists(DOCUMENTS_PATH):
        docs = [f for f in os.listdir(DOCUMENTS_PATH) if f.lower().endswith(('.pdf', '.txt'))]
        
    available_models = []
    if GROQ_API_KEY:
        from rag_engine import get_groq_chat_models
        available_models.extend(get_groq_chat_models())
    if GEMINI_API_KEY:
        available_models.extend(["gemini-1.5-flash", "gemini-1.5-pro"])
        
    return {
        "vector_db_initialized": is_ready,
        "indexed_documents": docs,
        "doc_count": len(docs),
        "api_key_configured": bool(GEMINI_API_KEY or GROQ_API_KEY),
        "groq_api_key_configured": bool(GROQ_API_KEY),
        "gemini_api_key_configured": bool(GEMINI_API_KEY),
        "active_llm_model": rag_engine.get_active_model_info(),
        "available_models": available_models
    }

@app.post("/api/initialize")
def initialize_system(
    chunk_size: Optional[int] = Body(None),
    chunk_overlap: Optional[int] = Body(None)
):
    """Download base compliance documents if missing and compile the vector database."""
    try:
        logger.info("Initializing system: Downloading base compliance documents...")
        download_regulatory_docs(DOCUMENTS_PATH)
        
        logger.info(f"Initializing system: Processing and indexing documents in Chroma (size={chunk_size}, overlap={chunk_overlap})...")
        success = rag_engine.build_vector_store(chunk_size, chunk_overlap)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to build vector database.")
            
        return {
            "status": "success",
            "message": "Documents downloaded and vector store built successfully."
        }
    except Exception as e:
        logger.error(f"Error during system initialization: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/documents/upload")
async def upload_documents(
    files: List[UploadFile] = File(...),
    chunk_size: Optional[int] = Form(None),
    chunk_overlap: Optional[int] = Form(None)
):
    """Upload documents to doc/ folder and trigger database re-indexing."""
    os.makedirs(DOCUMENTS_PATH, exist_ok=True)
    saved_files = []
    
    for file in files:
        if not file.filename.lower().endswith(('.pdf', '.txt')):
            raise HTTPException(status_code=400, detail=f"Unsupported file format for {file.filename}. Only PDF and TXT are supported.")
            
        dest_path = os.path.join(DOCUMENTS_PATH, file.filename)
        try:
            with open(dest_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            saved_files.append(file.filename)
            logger.info(f"Uploaded and saved file: {file.filename}")
        except Exception as e:
            logger.error(f"Error saving uploaded file {file.filename}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to save {file.filename}: {str(e)}")
            
    # Trigger rebuild of vector database
    logger.info("Rebuilding vector store after uploads...")
    success = rag_engine.build_vector_store(chunk_size, chunk_overlap)
    
    if not success:
        raise HTTPException(status_code=500, detail="Uploaded successfully, but failed to re-index vector database.")
        
    return {
        "status": "success",
        "message": f"Successfully uploaded and indexed {len(saved_files)} files.",
        "uploaded_files": saved_files
    }

@app.post("/api/documents/scrape-url")
def scrape_url(payload: ScrapeRequest):
    """Scrape webpage content, save it as a text file, and trigger database re-indexing."""
    url = payload.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL format. Must start with http:// or https://")
        
    try:
        filename = scrape_webpage_to_text(url, DOCUMENTS_PATH)
        
        # Trigger rebuild
        logger.info("Rebuilding vector store after scraping URL...")
        success = rag_engine.build_vector_store(payload.chunk_size, payload.chunk_overlap)
        
        if not success:
            raise HTTPException(status_code=500, detail="Webpage scraped successfully, but failed to re-index database.")
            
        return {
            "status": "success",
            "message": f"Successfully scraped webpage and indexed as {filename}.",
            "filename": filename
        }
    except Exception as e:
        logger.error(f"Error scraping webpage: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat/stream")
def chat_stream_endpoint(payload: ChatRequest):
    """SSE streaming endpoint for chat, delivering citations followed by text tokens."""
    query = payload.message.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    from guardrails import redact_pii_local
    # 1. Privacy Guardrail: redact PII from incoming query
    query = redact_pii_local(query)

    # 1b. Semantic Similarity Firewall Check
    adv_rails = get_advanced_guardrails()
    semantic_check = adv_rails.check_similarity_firewall(query)
    if not semantic_check["safe"]:
        async def semantic_error_generator():
            reason = semantic_check["reason"]
            error_data = {
                "type": "guardrail",
                "safe": False,
                "reason": reason
            }
            yield f"data: {json.dumps(error_data)}\n\n"
            yield f"data: {json.dumps({'type': 'token', 'text': f'Semantic Firewall Alert: {reason}'})}\n\n"
        return StreamingResponse(semantic_error_generator(), media_type="text/event-stream")

    # 2. Run Input Guardrails (Jailbreak / Boundary Rails)
    safety_check = check_input_safety_local(query)
    if not safety_check["safe"]:
        async def safety_error_generator():
            reason = safety_check["reason"]
            error_data = {
                "type": "guardrail",
                "safe": False,
                "reason": reason
            }
            yield f"data: {json.dumps(error_data)}\n\n"
            yield f"data: {json.dumps({'type': 'token', 'text': f'Guardrail Alert: {reason}'})}\n\n"
        return StreamingResponse(safety_error_generator(), media_type="text/event-stream")

    # 3. SSE Streaming Response Generator
    async def sse_generator():
        try:
            # If the query boundary rail flags a request for legal advice, prepend disclaimer
            if safety_check.get("disclaimer"):
                yield f"data: {json.dumps({'type': 'token', 'text': safety_check['disclaimer']})}\n\n"
                
            generator = rag_engine.query_stream(query, payload.model_name, payload.temperature)
            for item in generator:
                yield f"data: {json.dumps(item)}\n\n"
        except Exception as e:
            logger.error(f"Error in SSE generator: {e}")
            yield f"data: {json.dumps({'type': 'token', 'text': f'Stream error: {str(e)}'})}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@app.post("/api/chat/evaluate")
def chat_evaluate_endpoint(payload: EvaluateRequest):
    """Evaluates the quality metrics of a RAG query turn (Faithfulness, Relevance, Precision)."""
    query = payload.message.strip()
    context = payload.context.strip()
    answer = payload.answer.strip()
    
    if not query or not answer:
        raise HTTPException(status_code=400, detail="Question and answer cannot be empty for evaluation.")
        
    logger.info(f"Evaluating response for query: {query}")
    metrics = evaluator.evaluate(query, context, answer, payload.model_name)
    
    # Run Advanced Guardrail checks: Self-Correction Loop and Safe State Fallback
    adv_rails = get_advanced_guardrails()
    faith_score = metrics.get("faithfulness", {}).get("score", 1.0)
    
    # 1. Trigger Self-Correction Loop if Faithfulness drops below 0.6
    if faith_score < 0.6:
        try:
            llm = rag_engine.get_llm(payload.model_name)
            corrected_answer = adv_rails.run_self_correction_loop(query, context, answer, llm)
            logger.info("Re-evaluating corrected response...")
            metrics = evaluator.evaluate(query, context, corrected_answer, payload.model_name)
            # Override original answer with corrected version
            metrics["safe_state_override"] = corrected_answer
            answer = corrected_answer # Update for logging
        except Exception as e:
            logger.error(f"Failed to execute self-correction loop: {e}")
            
    # 2. Trigger Fallback to Safe State if metrics still breach minimum thresholds (0.5)
    fallback_check = adv_rails.verify_fallback_state(metrics, answer, threshold=0.5)
    if fallback_check["triggered"]:
        metrics["safe_state_override"] = fallback_check["answer"]
        answer = fallback_check["answer"] # Update for logging

    # Log session metric
    system_queries_log.append({
        "query": query,
        "answer": answer,
        "metrics": metrics,
        "model_name": payload.model_name or "Unknown Model"
    })
    
    return metrics

@app.get("/api/evaluation/dashboard")
def get_evaluation_dashboard():
    """Retrieve aggregate performance metrics across all queries in this session."""
    if not system_queries_log:
        return {
            "total_queries": 0,
            "avg_faithfulness": 0.0,
            "avg_relevance": 0.0,
            "avg_precision": 0.0,
            "logs": []
        }
        
    total = len(system_queries_log)
    faithfulness_sum = sum(q["metrics"].get("faithfulness", {}).get("score", 0.0) for q in system_queries_log)
    relevance_sum = sum(q["metrics"].get("answer_relevance", {}).get("score", 0.0) for q in system_queries_log)
    precision_sum = sum(q["metrics"].get("context_precision", {}).get("score", 0.0) for q in system_queries_log)
    
    return {
        "total_queries": total,
        "avg_faithfulness": round(faithfulness_sum / total, 2),
        "avg_relevance": round(relevance_sum / total, 2),
        "avg_precision": round(precision_sum / total, 2),
        "logs": system_queries_log[-10:]
    }

@app.post("/api/evaluation/run-benchmark")
def run_benchmark_evaluation():
    """Execute a built-in benchmark test suite of compliance questions to evaluate the system."""
    benchmark_questions = [
        "What are the four components of the NIST AI Risk Management Framework core?",
        "What does the OECD Recommend regarding transparency and explainability of AI systems?",
        "According to the AI Bill of Rights, what protections should users have against automated systems?"
    ]
    
    if not rag_engine.is_vector_db_ready():
        raise HTTPException(
            status_code=400,
            detail="System database is not initialized. Please load documents first."
        )
        
    results = []
    for q in benchmark_questions:
        logger.info(f"Benchmarking question: {q}")
        # Run synchronous retrieval and QA query
        rag_res = rag_engine.query_stream(q)
        citations = []
        raw_context = ""
        answer_parts = []
        
        # Accumulate stream contents
        for chunk in rag_res:
            if chunk["type"] == "citations":
                citations = chunk["citations"]
                raw_context = chunk["raw_context"]
            elif chunk["type"] == "token":
                answer_parts.append(chunk["text"])
                
        full_answer = "".join(answer_parts)
        scores = evaluator.evaluate(q, raw_context, full_answer)
        
        results.append({
            "question": q,
            "answer": full_answer,
            "metrics": scores
        })
        
    count = len(results)
    avg_f = sum(r["metrics"]["faithfulness"]["score"] for r in results) / count
    avg_r = sum(r["metrics"]["answer_relevance"]["score"] for r in results) / count
    avg_p = sum(r["metrics"]["context_precision"]["score"] for r in results) / count
    
    return {
        "status": "success",
        "benchmark_summary": {
            "queries_run": count,
            "average_faithfulness": round(avg_f, 2),
            "average_relevance": round(avg_r, 2),
            "average_precision": round(avg_p, 2)
        },
        "results": results
    }

if __name__ == "__main__":
    import uvicorn
    from dotenv import load_dotenv
    load_dotenv()
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
