# AICRA: AI Compliance & Risk Advisor

AICRA is a local Retrieval-Augmented Generation (RAG) chatbot assistant designed to help search, query, and evaluate compliance documents. While it comes pre-configured to index AI frameworks (like the **EU AI Act**, **NIST AI RMF**, and **OECD AI Principles**), the system is a general-purpose document advisor. You can upload any PDF/text files or scrape any policy webpage, and the chatbot will dynamically index and answer questions on that content.

---

## The Problem Addressed
Artificial intelligence regulations are highly detailed, legally complex, and dynamically updated across different jurisdictions. Compliance managers and startups face significant hurdles:
*   **Massive Documents**: Sifting through hundreds of pages of legal text (e.g., EU AI Act, NIST guidelines) to find specific rules.
*   **Extraterritorial Reach**: Many rules (like the EU AI Act) apply to developers outside their region (e.g., Indian startups serving EU users) if outputs are used in the Union.
*   **Hallucination Risks in AI**: Standard LLMs often hallucinate penalty limits or compliance clauses.
*   **Evaluation & Quality Control**: Difficult to quantify how grounded, relevant, or precise an AI's compliance guidance is.

AICRA solves this by combining **grounded vector database retrieval**, **local input guardrails**, **multi-model support**, **structured chain-of-thought outputs**, and a **real-time LLM-as-a-judge evaluation dashboard**.

---

## Tech Stack
AICRA is built on a modern, decoupled architecture:

| Layer / Category | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, CSS |
| **Backend** | FastAPI, Uvicorn, python-multipart |
| **AI/ML & Vector DB** | LangChain , HuggingFace Embeddings (`all-MiniLM-L6-v2`), Chroma DB |
| **Web Parser & Scraper** | BeautifulSoup4, Requests |
| **Telemetry & Observability** | Langfuse |

---

## Project Structure
```text
RAG-QnA-Chatbot/
├── backend/
│   ├── doc/                   # Local corpus directory (PDFs & scraped TXTs)
│   ├── chroma_db/             # Local Chroma DB SQLite storage (auto-generated)
│   ├── main.py                # FastAPI entrypoint and endpoints
│   ├── config.py              # Configuration manager and environment loader
│   ├── rag_engine.py          # RAG vector store loader, builder, and streaming query engine
│   ├── evaluator.py           # LLM-as-a-judge Turn Quality Metrics
│   ├── guardrails.py          # Safety classifiers for user inputs
│   ├── advanced_guardrails.py # Semantic similarity, self-corrections, safe state fallback rails
│   ├── document_downloader.py # Helper script to fetch default PDFs
│   ├── url_scraper.py         # Webpage cleaning utility using BeautifulSoup
│   └── requirements.txt       # Python backend dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Main React component containing the Dashboard
│   │   ├── main.jsx           # Vite React mounting script
│   │   └── index.css          # Stripe/Linear inspired light-theme styling
│   ├── package.json           # Frontend NPM dependencies
│   └── vite.config.js         # Vite configuration (ports & proxy setup)
└── README.md                  # System Documentation
```

---

## Key Features
1. **Interactive Chat & Server Sent Event (SSE) Streaming**: Token-by-token text streaming with source footnotes and collapsible chain-of-thought reasoning logs.
2. **3D Animated Avatar**: Floating animated compliance manager GIF integrated directly into the landing hero section.
3. **5-Stage Pipeline & Trace Daemon**: Visual horizontal RAG pipeline flow on the "How It Works" tab with a live-styled simulator terminal trace log.
4. **Universal Ingestion**: Drag-and-drop uploader (PDF/TXT) and webpage scraper with real-time vector indexing.
5. **Real-Time LLM Judge**: Automatic turn-by-turn evaluation of Faithfulness, Answer Relevance, and Context Precision.
6. **Zero-Trust Safety Firewall**: Local PII scrubber and semantic similarity firewall shielding incoming queries.
7. **Dynamic Configurations**: Adjustable temperature, chunk size, chunk overlap, and active model sliders on the fly.

---

## Running the Code (Windows Guide)

### Prerequisites
*   Python 3.10 or higher
*   Node.js (v18+) & npm
*   A `GROQ_API_KEY` (and/or `GEMINI_API_KEY`)

---

### Step 1: Backend Setup
1.  Navigate to the `backend/` directory:
    ```powershell
    cd backend
    ```
2.  Create a virtual environment and activate it:
    ```powershell
    python -m venv menv
    .\menv\Scripts\activate
    ```
3.  Install python dependencies:
    ```powershell
    pip install -r requirements.txt
    ```
4.  Create a `.env` file in the `backend/` directory and add your credentials:
    ```env
    # LLM Keys
    GROQ_API_KEY=your-groq-api-key
    GEMINI_API_KEY=your-gemini-api-key

    # Langfuse Tracing (Optional)
    LANGFUSE_PUBLIC_KEY=your-langfuse-public-key
    LANGFUSE_SECRET_KEY=your-langfuse-secret-key
    LANGFUSE_HOST=https://cloud.langfuse.com
    ```
5.  Run the FastAPI backend server:
    ```powershell
    python main.py
    ```
    *The server runs on `http://localhost:8000` (docs available at `http://localhost:8000/docs`).*

---

### Step 2: Frontend Setup
1.  Open a new terminal window and navigate to the `frontend/` directory:
    ```powershell
    cd frontend
    ```
2.  Install npm packages:
    ```powershell
    npm install
    ```
3.  Start the Vite React dev server:
    ```powershell
    npm run dev
    ```
    *The client runs on `http://localhost:3000`.*

---

### Step 3: Initialize Database
1.  Open your browser and navigate to `http://localhost:3000/`.
2.  Under the **Knowledge Management** section in the left sidebar, click the **Build Vector DB** button (or click **Apply & Re-Index DB** on the right side).
3.  Wait for the loader to finish. The system will download the default compliance documents (NIST RMF, OECD Principles, AI Bill of Rights) and compile them into Chroma DB. 
4.  Once the status dot turns green, ask your first question!

## License
See [LICENSE](LICENSE.txt)

