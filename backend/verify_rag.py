import os
import sys
from dotenv import load_dotenv

# Add parent dir to path so we can import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import DOCUMENTS_PATH
from document_downloader import download_regulatory_docs
from rag_engine import RAGEngine
from evaluator import RAGEvaluator

def test_pipeline():
    load_dotenv()
    
    print("=== Step 1: Downloading Compliance PDFs ===")
    download_regulatory_docs(DOCUMENTS_PATH)
    
    print("\n=== Step 2: Building Vector Database ===")
    engine = RAGEngine()
    if engine.is_vector_db_ready():
        print("Vector database already built. Loading existing index...")
        engine.load_vector_store()
    else:
        print("Building new vector database index from PDFs...")
        success = engine.build_vector_store()
        if not success:
            print("Failed to build vector database.")
            return
            
    print("\n=== Step 3: Running Test RAG Query ===")
    test_query = "What is the primary focus of the NIST AI Risk Management Framework?"
    print(f"Query: '{test_query}'")
    
    # Check Gemini API Key
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("\n[WARNING] GEMINI_API_KEY not set in backend/.env.")
        print("RAG query and evaluation will not execute without an API key.")
        return
        
    result = engine.query(test_query)
    print("\nGenerated Response:")
    print(result["answer"])
    
    print("\nCitations:")
    for cit in result["citations"]:
        print(f"- [{cit['id']}] {cit['source']} (Page {cit['page']})")
        
    print("\n=== Step 4: Running LLM-as-a-judge Evaluation ===")
    evaluator = RAGEvaluator()
    scores = evaluator.evaluate(test_query, result["raw_context"], result["answer"])
    print("\nQuality Scores:")
    print(f"- Faithfulness: {scores.get('faithfulness', {}).get('score')} ({scores.get('faithfulness', {}).get('reasoning')})")
    print(f"- Answer Relevance: {scores.get('answer_relevance', {}).get('score')} ({scores.get('answer_relevance', {}).get('reasoning')})")
    print(f"- Context Precision: {scores.get('context_precision', {}).get('score')} ({scores.get('context_precision', {}).get('reasoning')})")

if __name__ == "__main__":
    test_pipeline()
