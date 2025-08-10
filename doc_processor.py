import os
import logging
from typing import List
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
    DirectoryLoader
)
from langchain.schema import Document
from config import CHUNK_SIZE, CHUNK_OVERLAP

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DocumentProcessor:
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            length_function=len,
        )
    
    def load_documents(self, directory_path: str) -> List[Document]:
        """Load documents from a directory."""
        documents = []
        
        try:
            # Load text files
            for filename in os.listdir(directory_path):
                if filename.endswith('.txt'):
                    filepath = os.path.join(directory_path, filename)
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        doc = Document(page_content=content, metadata={"source": filename})
                        documents.append(doc)
                
                elif filename.endswith('.pdf'):
                    filepath = os.path.join(directory_path, filename)
                    loader = PyPDFLoader(filepath)
                    pdf_docs = loader.load()
                    documents.extend(pdf_docs)
            
            logger.info(f"Loaded {len(documents)} documents from {directory_path}")
            return documents
            
        except Exception as e:
            logger.error(f"Error loading documents: {e}")
            return []
    
    def split_documents(self, documents: List[Document]) -> List[Document]:
        """Split documents into chunks."""
        try:
            chunks = self.text_splitter.split_documents(documents)
            logger.info(f"Split documents into {len(chunks)} chunks")
            return chunks
        except Exception as e:
            logger.error(f"Error splitting documents: {e}")
            return []
    
    def process_documents(self, directory_path: str) -> List[Document]:
        """Complete document processing pipeline."""
        documents = self.load_documents(directory_path)
        if not documents:
            return []
        
        chunks = self.split_documents(documents)
        return chunks