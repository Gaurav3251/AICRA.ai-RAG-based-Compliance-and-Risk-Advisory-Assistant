import re
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Basic keywords indicating jailbreaks, prompts leaking, etc.
JAILBREAK_KEYWORDS = [
    "ignore previous", "ignore all instructions", "system prompt",
    "bypass safety", "jailbreak", "do not reference files",
    "pretend to be", "override rules", "developer mode"
]

# Keywords indicating request for definitive legal advice / binding contracts
LEGAL_ADVICE_KEYWORDS = [
    "should my company sign", "should i sign", "am i legally allowed to",
    "legal advice", "is this contract safe", "sue them", "legal liability",
    "sign this contract", "sue my customer", "am i liable"
]

def redact_pii_local(text: str) -> str:
    """Anonymize PII (emails, phone numbers, API keys/secrets) before processing or indexing."""
    # 1. Redact Emails
    email_pattern = r"[\w\.-]+@[\w\.-]+\.\w+"
    text = re.sub(email_pattern, "[EMAIL_REDACTED]", text)
    
    # 2. Redact Phone Numbers (various standard formats)
    phone_pattern = r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b"
    text = re.sub(phone_pattern, "[PHONE_REDACTED]", text)
    
    # 3. Redact common API keys / Secrets patterns (e.g. gsk_..., sk_..., etc.)
    key_pattern = r"\b(gsk_|sk_|ai_key_|key_)[a-zA-Z0-9_\-]{16,40}\b"
    text = re.sub(key_pattern, "[SECRET_KEY_REDACTED]", text)
    
    return text

def check_input_safety_local(query: str) -> Dict[str, Any]:
    """Perform fast, local checks for jailbreaks and compliance boundaries."""
    query_lower = query.lower()
    
    # 1. Prompt Injection / Jailbreak keyword filter
    for kw in JAILBREAK_KEYWORDS:
        if kw in query_lower:
            return {
                "safe": False,
                "reason": f"System detected jailbreak attempt via safety keyword: '{kw}'.",
                "disclaimer": None
            }
            
    # Check for generic prompt injection patterns
    pattern = r"(ignore|bypass|leak|override|disable)\s+(the|your|previous)?\s+(rules|system|directives|instructions|prompt)"
    if re.search(pattern, query_lower):
        return {
            "safe": False,
            "reason": "System detected prompt injection pattern.",
            "disclaimer": None
        }
        
    # 2. Legal Advice Boundary Rail
    for kw in LEGAL_ADVICE_KEYWORDS:
        if kw in query_lower:
            disclaimer = (
                "⚠️ **Compliance Disclaimer**: AICRA provides regulatory information for educational and reference purposes "
                "only and is NOT a licensed legal attorney. The following response does not constitute formal legal advice. "
                "Consult a qualified legal professional before making business decisions or signing contracts.\n\n"
            )
            return {
                "safe": True,
                "reason": None,
                "disclaimer": disclaimer
            }
            
    return {"safe": True, "reason": None, "disclaimer": None}
