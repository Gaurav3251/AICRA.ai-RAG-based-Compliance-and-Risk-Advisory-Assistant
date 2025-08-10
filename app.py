import streamlit as st
import os
import time
from rag_sys import RAGSystem
from config import *

st.set_page_config(
    page_title=PAGE_TITLE,
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize session state
if 'rag_system' not in st.session_state:
    st.session_state.rag_system = None
if 'messages' not in st.session_state:
    st.session_state.messages = []
if 'system_initialized' not in st.session_state:
    st.session_state.system_initialized = False

def initialize_rag_system():
    """Initialize the RAG system."""
    try:
        with st.spinner("Initializing RAG system..."):
            rag_system = RAGSystem()
            
            # Chk if vector store exists
            if os.path.exists(VECTOR_DB_PATH):
                st.info("Loading existing vector store...")
                rag_system.load_vector_store()
                rag_system.initialize_llm()
                rag_system.setup_qa_chain()
            else:
                st.info("Creating new vector store from documents...")
                rag_system.initialize_system("./doc")
            
            st.session_state.rag_system = rag_system
            st.session_state.system_initialized = True
            st.success("RAG system initialized successfully!")
            
    except Exception as e:
        st.error(f"Error initializing RAG system: {str(e)}")
        st.session_state.system_initialized = False

def main():
    st.title("RAG Q&A Chatbot")
    st.markdown("Ask questions about your documents and let our chatbot answer them!")
    
    with st.sidebar:
        st.header("System Control")
        
        # Initialize/Reset button
        if st.button("Initialize System", type="primary"):
            initialize_rag_system()
        
        if st.button("Clear Chat History"):
            st.session_state.messages = []
        
        st.markdown("---")
        
        # System status
        st.header("System Status")
        if st.session_state.system_initialized:
            st.success("✅ System Ready")
        else:
            st.warning("⚠️ System Not Initialized")
        
        st.markdown("---")
        
        st.header("Instructions")
        st.markdown("""
        1. Add your documents to the `doc` folder
        2. Click "Initialize System" to process documents
        3. Start asking questions!
        
        **Supported formats:**
        - PDF files
        - Text files
        """)
        
        st.markdown("---")
        
        # Config info
        st.header("Configuration")
        st.markdown(f"""
        - **LLM Model:** {OLLAMA_MODEL}
        - **Embedding Model:** {EMBEDDING_MODEL}
        - **Chunk Size:** {CHUNK_SIZE}
        - **Chunk Overlap:** {CHUNK_OVERLAP}
        """)
    
    # Main chat interface
    if not st.session_state.system_initialized:
        st.warning("Please initialize the system first using the sidebar.")
        return
    
    # Display chat messages
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])
            
            # Show sources if available
            if message["role"] == "assistant" and "sources" in message:
                with st.expander("📚 Sources"):
                    for i, source in enumerate(message["sources"]):
                        st.markdown(f"**Source {i+1}:**")
                        st.markdown(f"```{source.page_content[:200]}...```")
                        if hasattr(source, 'metadata') and source.metadata:
                            st.markdown(f"*Metadata: {source.metadata}*")
    
    # Chat input
    if prompt := st.chat_input("Ask a question about your documents..."):
        # Add user message
        st.session_state.messages.append({"role": "user", "content": prompt})
        
        # Display user message
        with st.chat_message("user"):
            st.markdown(prompt)
        
        # Generate response
        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                try:
                    result = st.session_state.rag_system.query(prompt)
                    answer = result["answer"]
                    sources = result["source_documents"]
                    
                    st.markdown(answer)
                    
                    # Show sources
                    if sources:
                        with st.expander("📚 Sources"):
                            for i, source in enumerate(sources):
                                st.markdown(f"**Source {i+1}:**")
                                st.markdown(f"```{source.page_content[:200]}...```")
                                if hasattr(source, 'metadata') and source.metadata:
                                    st.markdown(f"*Metadata: {source.metadata}*")
                    
                    # Add assistant message
                    st.session_state.messages.append({
                        "role": "assistant",
                        "content": answer,
                        "sources": sources
                    })
                    
                except Exception as e:
                    error_msg = f"Error generating response: {str(e)}"
                    st.error(error_msg)
                    st.session_state.messages.append({
                        "role": "assistant",
                        "content": error_msg
                    })

if __name__ == "__main__":
    main()