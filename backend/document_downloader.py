import os
import requests
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Hardcoded document URLs
DOCS_TO_DOWNLOAD = {
    "NIST_AI_RMF_1.0.pdf": "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf",
    "OECD_AI_Principles.pdf": "https://legalinstruments.oecd.org/public/doc/648/648.en.pdf",
    "Blueprint_for_AI_Bill_of_Rights.pdf": "https://www.govinfo.gov/content/pkg/GOVPUB-PREX23-PURL-gpo193638/pdf/GOVPUB-PREX23-PURL-gpo193638.pdf"
}

def download_regulatory_docs(dest_dir: str):
    """Download the core AI safety and regulatory documents."""
    os.makedirs(dest_dir, exist_ok=True)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    for filename, url in DOCS_TO_DOWNLOAD.items():
        dest_path = os.path.join(dest_dir, filename)
        if os.path.exists(dest_path):
            logger.info(f"{filename} already exists at {dest_path}. Skipping download.")
            continue

        logger.info(f"Downloading {filename} from {url}...")
        try:
            response = requests.get(url, headers=headers, timeout=60, stream=True)
            response.raise_for_status()
            
            with open(dest_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            logger.info(f"Successfully downloaded and saved {filename}.")
        except Exception as e:
            logger.error(f"Failed to download {filename} from {url}: {e}")

if __name__ == "__main__":
    # If run standalone, use local doc folder
    base_dir = os.path.dirname(os.path.abspath(__file__))
    doc_dir = os.path.join(base_dir, "doc")
    download_regulatory_docs(doc_dir)
