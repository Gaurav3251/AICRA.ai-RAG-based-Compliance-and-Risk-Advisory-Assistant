import logging
import os
from typing import List, Optional
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_ollama import OllamaLLM
from langchain.chains import RetrievalQA
from langchain.schema import Document
from langchain.prompts import PromptTemplate
from doc_processor import DocumentProcessor
from config import *

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RAGSystem:
    def __init__(self):
        self.embeddings = None
        self.vector_store = None
        self.llm = None
        self.qa_chain = None
        self.document_processor = DocumentProcessor()
        
    def initialize_embeddings(self):
        """Initialize embedding model."""
        try:
            self.embeddings = HuggingFaceEmbeddings(
                model_name=EMBEDDING_MODEL,
                model_kwargs={'device': 'cpu'},
                encode_kwargs={'normalize_embeddings': False}
            )
            logger.info("Embeddings initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing embeddings: {e}")
            raise
    
    def initialize_llm(self):
        """Initialize Ollama LLM."""
        try:
            self.llm = OllamaLLM(
                model=OLLAMA_MODEL,
                base_url=OLLAMA_BASE_URL,
                temperature=0.1
            )
            logger.info("LLM initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing LLM: {e}")
            raise
    
    def create_vector_store(self, documents: List[Document]):
        """Create vector store from documents."""
        try:
            if not self.embeddings:
                self.initialize_embeddings()
            
            # Create vector store
            self.vector_store = Chroma.from_documents(
                documents=documents,
                embedding=self.embeddings,
                persist_directory=VECTOR_DB_PATH,
                collection_name=COLLECTION_NAME
            )
            logger.info("Vector store created successfully")
            
        except Exception as e:
            logger.error(f"Error creating vector store: {e}")
            raise
    
    def load_vector_store(self):
        """Load existing vector store."""
        try:
            if not self.embeddings:
                self.initialize_embeddings()
            
            # Chk if vector store exists
            if not os.path.exists(VECTOR_DB_PATH):
                logger.warning("Vector store path does not exist")
                return False
            
            self.vector_store = Chroma(
                persist_directory=VECTOR_DB_PATH,
                embedding_function=self.embeddings,
                collection_name=COLLECTION_NAME
            )
            
            # Test if vector store has documents
            test_results = self.vector_store.similarity_search("test", k=1)
            if not test_results:
                logger.warning("Vector store is empty")
                return False
                
            logger.info("Vector store loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error loading vector store: {e}")
            return False
    
    def setup_qa_chain(self):
        """Setup the QA chain with custom prompt."""
        try:
            if not self.llm:
                self.initialize_llm()
            
            if not self.vector_store:
                raise ValueError("Vector store not initialized")
            
            # Custom prompt template
            prompt_template = """
            You are a helpful AI assistant that answers questions based on the provided context.
            Use the following pieces of context to answer the question at the end.
            If you don't know the answer based on the context, just say that you don't know.
            Don't try to make up an answer.
            
            Context: {context}
            
            Question: {question}
            
            Answer:
            """
            
            PROMPT = PromptTemplate(
                template=prompt_template,
                input_variables=["context", "question"]
            )
            
            self.qa_chain = RetrievalQA.from_chain_type(
                llm=self.llm,
                chain_type="stuff",
                retriever=self.vector_store.as_retriever(
                    search_kwargs={"k": 3}
                ),
                chain_type_kwargs={"prompt": PROMPT},
                return_source_documents=True
            )
            
            logger.info("QA chain setup successfully")
            
        except Exception as e:
            logger.error(f"Error setting up QA chain: {e}")
            raise
    
    def initialize_system(self, documents_path: str):
        """Initialize the complete RAG system."""
        try:
            # Process documents
            documents = self.document_processor.process_documents(documents_path)
            if not documents:
                raise ValueError("No documents found or processed")
            
            # Create vector store
            self.create_vector_store(documents)
            
            # Setup QA chain
            self.setup_qa_chain()
            
            logger.info("RAG system initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error initializing RAG system: {e}")
            return False
    
    def load_existing_system(self):
        """Load existing system from saved vector store."""
        try:
            # Load vector store
            if not self.load_vector_store():
                return False
            
            # Setup QA chain
            self.setup_qa_chain()
            
            logger.info("Existing RAG system loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error loading existing system: {e}")
            return False
    
    def query(self, question: str) -> dict:
        """Query the RAG system."""
        try:
            if not self.qa_chain:
                raise ValueError("QA chain not initialized")
            
            result = self.qa_chain({"query": question})
            return {
                "answer": result["result"],
                "source_documents": result["source_documents"]
            }
            
        except Exception as e:
            logger.error(f"Error querying RAG system: {e}")
            return {
                "answer": f"Error processing query: {str(e)}",
                "source_documents": []
            }