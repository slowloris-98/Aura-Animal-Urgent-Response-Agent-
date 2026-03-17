"""SMS alerting service for Aura AI using Twilio."""

import os
import logging
from twilio.rest import Client
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Twilio configuration
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
TWILIO_MESSAGING_SERVICE_SID = os.getenv("TWILIO_MESSAGING_SERVICE_SID")

# MVP: Map AI routing labels to authority phone numbers.
# Replace these with real authority numbers in production.
AUTHORITY_CONTACTS = {
    "Alerting Animal Control / Rescue": os.getenv("ANIMAL_CONTROL_PHONE", "+16693406033"),
    # "Alerting Local Wildlife NGO": os.getenv("WILDLIFE_NGO_PHONE", "+14082106122"),
}

# Severity levels that trigger an SMS alert
ALERT_SEVERITIES = {"High", "Critical"}


def _get_twilio_client() -> Client:
    """Initialize and return a Twilio REST client."""
    if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER]):
        raise RuntimeError(
            "Twilio credentials missing. Set TWILIO_ACCOUNT_SID, "
            "TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your .env file."
        )
    return Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


def send_alert_sms(to_number: str, message: str) -> dict:
    """Send an SMS via Twilio.

    Returns a dict with 'success', 'sid', and optionally 'error'.
    """
    try:
        client = _get_twilio_client()
        send_kwargs = {"body": message, "to": to_number}
        if TWILIO_MESSAGING_SERVICE_SID:
            send_kwargs["messaging_service_sid"] = TWILIO_MESSAGING_SERVICE_SID
        else:
            send_kwargs["from_"] = TWILIO_PHONE_NUMBER
        msg = client.messages.create(**send_kwargs)
        logger.info("SMS sent successfully (SID: %s)", msg.sid)
        return {"success": True, "sid": msg.sid}
    except Exception as exc:
        logger.error("Failed to send SMS to %s: %s", to_number, exc)
        return {"success": False, "sid": None, "error": str(exc)}


def alert_authorities(analysis: dict, location: dict) -> dict:
    """Alert the appropriate authority based on AI triage results.

    Args:
        analysis: AI analysis dict with keys 'classification', 'severity', 'routing', 'tips'.
        location: Dict with 'lat' and 'lng' float values.

    Returns:
        Dict with 'sms_sent', 'sms_sid', and 'authority' keys.
    """
    severity = analysis.get("severity", "")
    if severity not in ALERT_SEVERITIES:
        return {"sms_sent": False, "sms_sid": None, "authority": None, "reason": "below_threshold"}

    routing = analysis.get("routing", "")
    to_number = AUTHORITY_CONTACTS.get(routing)

    if not to_number:
        logger.warning("No contact number mapped for routing: %s", routing)
        return {"sms_sent": False, "sms_sid": None, "authority": routing, "reason": "no_contact"}

    lat = location.get("lat", "N/A")
    lng = location.get("lng", "N/A")
    classification = analysis.get("classification", "Unknown")

    message = (
        f"\U0001f6a8 AURA ALERT — {severity.upper()} SEVERITY\n"
        f"Animal: {classification}\n"
        f"Location: ({lat}, {lng})\n"
        f"Routing: {routing}\n"
        f"https://maps.google.com/?q={lat},{lng}"
    )

    result = send_alert_sms(to_number, message)
    return {
        "sms_sent": result["success"],
        "sms_sid": result.get("sid"),
        "authority": routing,
    }


def send_reporter_confirmation(reporter_phone: str, routing: str) -> dict:
    """Send a confirmation SMS to the person who filed the report.

    Args:
        reporter_phone: The reporter's phone number (E.164 format).
        routing: The authority routing label from the AI analysis.

    Returns:
        Dict with 'success' and 'sid' keys.
    """
    message = (
        f"\u2705 Your Aura report has been received. "
        f"{routing} has been alerted. Stay safe and keep your distance from the animal."
    )
    return send_alert_sms(reporter_phone, message)
