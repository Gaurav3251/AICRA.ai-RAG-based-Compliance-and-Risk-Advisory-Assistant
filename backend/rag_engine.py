import os
import logging
from typing import List, Dict, Any, Optional, Generator
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain.schema import Document
from langfuse.langchain import CallbackHandler

from config import (
    DOCUMENTS_PATH,
    VECTOR_DB_PATH,
    COLLECTION_NAME,
    EMBEDDING_MODEL,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
    GEMINI_MODEL,
    GEMINI_API_KEY,
    GROQ_MODEL,
    GROQ_API_KEY,
    LANGFUSE_PUBLIC_KEY,
    LANGFUSE_SECRET_KEY,
    LANGFUSE_HOST
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_groq_chat_models() -> List[str]:
    """Dynamically fetch the list of available text chat models from the Groq API."""
    if not GROQ_API_KEY:
        return []
    try:
        import requests
        headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}
        res = requests.get("https://api.groq.com/openai/v1/models", headers=headers, timeout=5)
        if res.ok:
            data = res.json()
            models = [m["id"] for m in data.get("data", [])]
            chat_models = [
                m for m in models 
                if "whisper" not in m.lower() 
                and "guard" not in m.lower() 
                and "vision" not in m.lower()
            ]
            chat_models.sort()
            return chat_models
    except Exception as e:
        logger.error(f"Error listing Groq models dynamically: {e}")
    # Fallback to standard models if API call fails
    return ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]

def resolve_best_groq_model(models: List[str]) -> str:
    """Choose the best reasoning/chat model available in the user's Groq catalog."""
    priorities = [
        "qwen/qwen3.6-27b",
        "openai/gpt-oss-20b",
        "groq/compound-mini",
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant"
    ]
    for model in priorities:
        if model in models:
            return model
    return models[0] if models else "llama-3.3-70b-versatile"

class RAGEngine:
    def __init__(self):
        self.embeddings = None
        self.vector_store = None
        
    def initialize_embeddings(self):
        """Initialize local SentenceTransformer embeddings."""
        if not self.embeddings:
            try:
                self.embeddings = HuggingFaceEmbeddings(
                    model_name=EMBEDDING_MODEL,
                    model_kwargs={'device': 'cpu'},
                    encode_kwargs={'normalize_embeddings': True}
                )
                logger.info("Embeddings initialized successfully.")
            except Exception as e:
                logger.error(f"Error initializing embeddings: {e}")
                raise

    def get_llm(self, model_name: Optional[str] = None, temperature: Optional[float] = None):
        """Get LLM dynamically based on configurations and user choices."""
        temp = temperature if temperature is not None else 0.2
        
        # Resolve Groq models list and decide provider
        groq_models = get_groq_chat_models()
        default_groq = resolve_best_groq_model(groq_models)
        
        use_groq = GROQ_API_KEY and (model_name in groq_models or not GEMINI_API_KEY or model_name is None)
        
        if use_groq:
            active_model = model_name if model_name else default_groq
            logger.info(f"Instantiating Groq LLM: {active_model} (Temp: {temp})")
            return ChatGroq(
                model=active_model,
                groq_api_key=GROQ_API_KEY,
                temperature=temp,
                max_tokens=4096
            )
        elif GEMINI_API_KEY:
            active_model = model_name if model_name else GEMINI_MODEL
            logger.info(f"Instantiating Gemini LLM: {active_model} (Temp: {temp})")
            return ChatGoogleGenerativeAI(
                model=active_model,
                google_api_key=GEMINI_API_KEY,
                temperature=temp,
                max_output_tokens=4096
            )
        else:
            raise ValueError("Neither GROQ_API_KEY nor GEMINI_API_KEY is configured in backend/.env")

    def get_active_model_info(self, model_name: Optional[str] = None) -> str:
        """Helper to get name of currently selected model."""
        groq_models = get_groq_chat_models()
        default_groq = resolve_best_groq_model(groq_models)
        
        use_groq = GROQ_API_KEY and (model_name in groq_models or not GEMINI_API_KEY or model_name is None)
        
        if use_groq:
            return model_name if model_name else default_groq
        elif GEMINI_API_KEY:
            return model_name if model_name else GEMINI_MODEL
        return "No Active Model"

    def is_vector_db_ready(self) -> bool:
        """Check if the Vector DB path exists and is not empty."""
        if not os.path.exists(VECTOR_DB_PATH):
            return False
        try:
            self.initialize_embeddings()
            db = Chroma(
                persist_directory=VECTOR_DB_PATH,
                embedding_function=self.embeddings,
                collection_name=COLLECTION_NAME
            )
            return db._collection.count() > 0
        except Exception:
            return False

    def load_vector_store(self) -> bool:
        """Load the existing Chroma Vector DB."""
        try:
            self.initialize_embeddings()
            if not self.is_vector_db_ready():
                logger.warning("Vector store is empty or path does not exist.")
                return False
            self.vector_store = Chroma(
                persist_directory=VECTOR_DB_PATH,
                embedding_function=self.embeddings,
                collection_name=COLLECTION_NAME
            )
            logger.info("Vector store loaded successfully.")
            return True
        except Exception as e:
            logger.error(f"Error loading vector store: {e}")
            return False

    def build_vector_store(self, chunk_size: Optional[int] = None, chunk_overlap: Optional[int] = None) -> bool:
        """Process documents in the doc folder and build Chroma vector DB with custom parameters."""
        try:
            self.initialize_embeddings()
            
            # Set custom splitting size if provided
            size = chunk_size if chunk_size is not None else CHUNK_SIZE
            overlap = chunk_overlap if chunk_overlap is not None else CHUNK_OVERLAP
            
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=size,
                chunk_overlap=overlap,
                length_function=len
            )
            
            documents = []
            if not os.path.exists(DOCUMENTS_PATH):
                os.makedirs(DOCUMENTS_PATH, exist_ok=True)
                
            for filename in os.listdir(DOCUMENTS_PATH):
                filepath = os.path.join(DOCUMENTS_PATH, filename)
                if filename.lower().endswith('.pdf'):
                    logger.info(f"Loading PDF document: {filename}...")
                    try:
                        loader = PyPDFLoader(filepath)
                        pdf_docs = loader.load()
                        for doc in pdf_docs:
                            doc.metadata["source"] = filename
                        documents.extend(pdf_docs)
                    except Exception as doc_err:
                        logger.error(f"Error loading PDF {filename}: {doc_err}")
                elif filename.lower().endswith('.txt'):
                    logger.info(f"Loading Text document: {filename}...")
                    try:
                        loader = TextLoader(filepath, encoding="utf-8")
                        txt_docs = loader.load()
                        for doc in txt_docs:
                            doc.metadata["source"] = filename
                        documents.extend(txt_docs)
                    except Exception as doc_err:
                        logger.error(f"Error loading Text {filename}: {doc_err}")

            if not documents:
                logger.warning("No PDF or Text documents found to index.")
                # Return True but create empty database path
                return False

            logger.info(f"Loaded {len(documents)} source pages. Splitting with chunk_size={size}, overlap={overlap}...")
            chunks = text_splitter.split_documents(documents)
            
            # Apply Privacy Guardrail: redact PII from chunks before indexing
            from guardrails import redact_pii_local
            for chunk in chunks:
                chunk.page_content = redact_pii_local(chunk.page_content)
                
            logger.info(f"Created {len(chunks)} text chunks.")

            # Create and persist Chroma vector store
            logger.info("Creating Chroma vector database...")
            # If database already exists, delete and recreate it to avoid duplication
            if os.path.exists(VECTOR_DB_PATH):
                import shutil
                shutil.rmtree(VECTOR_DB_PATH, ignore_errors=True)
                
            self.vector_store = Chroma.from_documents(
                documents=chunks,
                embedding=self.embeddings,
                persist_directory=VECTOR_DB_PATH,
                collection_name=COLLECTION_NAME
            )
            logger.info("Vector database built and saved successfully.")
            return True

        except Exception as e:
            logger.error(f"Error building vector store: {e}")
            return False

    def get_langfuse_callback(self) -> Optional[CallbackHandler]:
        """Initialize Langfuse callback handler if keys are set."""
        if LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY:
            try:
                handler = CallbackHandler(
                    public_key=LANGFUSE_PUBLIC_KEY,
                    secret_key=LANGFUSE_SECRET_KEY,
                    host=LANGFUSE_HOST
                )
                logger.info("Langfuse Tracing callback handler active.")
                return handler
            except Exception as e:
                logger.error(f"Error initializing Langfuse callback: {e}")
        return None

    def query_stream(self, question: str, model_name: Optional[str] = None, temperature: Optional[float] = None) -> Generator[Dict[str, Any], None, None]:
        """Query the RAG system and stream results. Yields citations first, then token chunks."""
        try:
            llm = self.get_llm(model_name, temperature)
            
            # Load vector store if not active
            if not self.vector_store:
                success = self.load_vector_store()
                if not success:
                    yield {"type": "token", "text": "System is not initialized. Please load documents first."}
                    return

            # Retrieve top chunks (k=4)
            retriever = self.vector_store.as_retriever(search_kwargs={"k": 4})
            retrieved_docs = retriever.invoke(question)

            # Build clean context block and citations metadata
            context_blocks = []
            citations = []
            
            for idx, doc in enumerate(retrieved_docs):
                source_name = doc.metadata.get("source", "Unknown Document")
                page_num = doc.metadata.get("page", 0) + 1
                content = doc.page_content.strip()
                
                context_blocks.append(f"--- [Document {idx+1}] Source: {source_name}, Page: {page_num} ---\n{content}\n")
                
                citations.append({
                    "id": idx + 1,
                    "source": source_name,
                    "page": page_num,
                    "snippet": content[:300] + "..." if len(content) > 300 else content
                })

            raw_context = "\n".join(context_blocks)
            
            # Yield citations immediately before beginning text stream
            yield {"type": "citations", "citations": citations, "raw_context": raw_context}

            # Choose system prompt based on model capabilities to prevent parsing failures in standard model APIs
            is_reasoning_model = model_name and ("qwen" in model_name.lower() or "deepseek" in model_name.lower())
            
            if is_reasoning_model:
                system_prompt = (
                    "You are the AI Compliance & Risk Advisor (AICRA). Answer the user's question clearly, professionally, and accurately using the provided regulatory context.\n"
                    "When answering, you MUST cite the provided documents using numbered references at the end of statements (e.g. [1], [2]). Match these numbers to the corresponding [Document X] indices provided in the context.\n"
                    "If the context does not contain the answer, politely state: 'Based on the official compliance documents in my database, I do not have sufficient information to answer this question.' Do not make up facts or use outside knowledge."
                )
            else:
                system_prompt = (
                    "You are the AI Compliance & Risk Advisor (AICRA). Answer the user's question clearly, professionally, and accurately using the provided regulatory context.\n"
                    "To ensure consistent output structure, you MUST partition your response into two distinct sections:\n"
                    "1. Start with the header `### Reasoning Process:` followed by a brief step-by-step description of your thinking.\n"
                    "2. Follow with the header `### Final Answer:` followed by your cited compliance answer.\n\n"
                    "Example:\n"
                    "### Reasoning Process:\n"
                    "- Step 1: Identify document relevance...\n"
                    "### Final Answer:\n"
                    "Based on the AI Act [1]...\n\n"
                    "In your final answer, you MUST cite the provided documents using numbered references at the end of statements (e.g. [1], [2]). Match these numbers to the corresponding [Document X] indices provided in the context.\n"
                    "If the context does not contain the answer, politely state: 'Based on the official compliance documents in my database, I do not have sufficient information to answer this question.' Do not make up facts or use outside knowledge."
                )

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Context:\n{raw_context}\n\nQuestion: {question}"}
            ]

            callbacks = []
            lf_callback = self.get_langfuse_callback()
            if lf_callback:
                callbacks.append(lf_callback)

            # Stream tokens
            for chunk in llm.stream(messages, config={"callbacks": callbacks}):
                yield {"type": "token", "text": chunk.content}

        except Exception as e:
            logger.error(f"Error querying RAG stream: {e}")
            yield {"type": "token", "text": f"\nAn error occurred while answering your question: {str(e)}"}
