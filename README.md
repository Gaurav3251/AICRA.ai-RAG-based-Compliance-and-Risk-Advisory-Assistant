# RAG Q&A Chatbot 

A Retrieval-Augmented Generation (RAG) chatbot that answers questions based on your documents using LangChain, Ollama, and Streamlit.

## Features

-  **Document Processing**: Supports PDF and text files
-  **Smart Retrieval**: Uses vector similarity search
-  **Local LLM**: Runs completely offline with Ollama
-  **Chat Interface**: Interactive web UI with Streamlit

## Tech Stack

- **LangChain**: RAG pipeline orchestration
- **Ollama**: Local LLM (Llama2)
- **ChromaDB**: Vector database
- **Streamlit**: Web interface
- **HuggingFace**: Text embeddings

## Prerequisites

- Python 3.8+
- [Ollama](https://ollama.ai/) installed

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   ```

2. **Set up environment**
   ```bash
   python -m venv <env-name>
   <env-name>\Scripts\activate  # On Linux: source <env-name>/bin/activate 
   pip install -r requirements.txt
   ```

3. **Start Ollama and pull model**
   ```bash
   ollama serve
   ollama pull llama2:7b-chat
   ```

4. **Add your docs to a docs folder**
   

5. **Run the app**
   ```bash
   streamlit run app.py
   ```

6. **Open browser**
   - Go to `http://localhost:8501`
   - Click "Initialize System"
   - Start asking questions!

## Example Questions

- "What is the main topic of my documents?"
- "Summarize the key points about [topic]"
- "How does [concept A] relate to [concept B]?"

## Configuration

Edit `config.py` to customize:
- LLM model selection
- Chunk size and overlap
- Embedding model
- Vector database settings

## Troubleshooting

- **Ollama not found**: Ensure Ollama is running with `ollama serve`
- **Model not found**: Pull the model with `ollama pull llama2:7b-chat`
- **Port in use**: Run on different port with `streamlit run app.py --server.port 8502`

## License

MIT License
