import os

# LLM config
OLLAMA_MODEL = "llama2:7b-chat"
OLLAMA_BASE_URL = "http://localhost:11434"

# Embedding model
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# Vector DB
VECTOR_DB_PATH = "./vec_db"
COLLECTION_NAME = "documents"

# Chunking config
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

# Streamlit config
PAGE_TITLE = "RAG Q&A Chatbot"
