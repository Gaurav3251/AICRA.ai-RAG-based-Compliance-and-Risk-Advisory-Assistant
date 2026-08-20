import re
import os
import requests
import logging
from urllib.parse import urlparse
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

def scrape_webpage_to_text(url: str, output_dir: str) -> str:
    """Scrape text from a URL and save it as a text file in the output directory."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        logger.info(f"Scraping URL: {url}...")
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()
            
        # Get text and clean it up
        text = soup.get_text()
        
        # Break into lines and remove leading and trailing space on each
        lines = (line.strip() for line in text.splitlines())
        # Break multi-headlines into a line each
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        # Drop blank lines
        clean_text = "\n".join(chunk for chunk in chunks if chunk)
        
        # Construct clean filename from domain + path slug
        parsed_url = urlparse(url)
        domain = parsed_url.netloc.replace("www.", "")
        path_slug = parsed_url.path.strip("/").replace("/", "_")
        if not path_slug:
            path_slug = "index"
            
        # Remove non-alphanumeric chars from filename
        filename = f"scraped_{domain}_{path_slug}"
        filename = re.sub(r'[^a-zA-Z0-9_]', '', filename)
        filename = filename[:80] + ".txt"  # Limit length
        
        os.makedirs(output_dir, exist_ok=True)
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(f"Source URL: {url}\n\n{clean_text}")
            
        logger.info(f"Successfully scraped and saved to {filepath}")
        return filename
        
    except Exception as e:
        logger.error(f"Error scraping URL {url}: {e}")
        raise ValueError(f"Failed to scrape webpage: {str(e)}")
