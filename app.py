"""Flask app: reads cards from photos with Claude vision, then computes exact odds."""
import base64
import json
import os
import re

import anthropic
from flask import Flask, jsonify, request, send_from_directory

import poker

MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5")

app = Flask(__name__, static_folder="static")
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024

PROMPT = (
    "This is a photo of playing cards from a Texas Hold'em game. Identify every "
    "visible card. Respond with ONLY a JSON array of card codes, each rank+suit, "
    "rank in 23456789TJQKA and suit in c,d,h,s (clubs, diamonds, hearts, spades). "
    'Example: ["Ah","Td","7c"]. Expect {expected} cards. If you are unsure of a card, '
    "give your best guess."
)


def read_cards(file_storage, expected):
    data = file_storage.read()
    media_type = file_storage.mimetype or "image/jpeg"
    client = anthropic.Anthropic()
    resp = client.messages.create(
        model=MODEL,
        max_tokens=300,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {
                    "type": "base64", "media_type": media_type,
                    "data": base64.b64encode(data).decode()}},
                {"type": "text", "text": PROMPT.format(expected=expected)},
            ],
        }],
    )
    text = "".join(b.text for b in resp.content if b.type == "text")
    match = re.search(r"\[.*?\]", text, re.S)
    if not match:
        raise ValueError("Could not read cards from the image.")
    return [poker.parse_card(c) for c in json.loads(match.group(0))]


@app.get("/")
def index():
    return send_from_directory("static", "index.html")


@app.post("/api/recognize")
def recognize():
    """Form fields: image (file), kind = 'flop' | 'hand'."""
    image = request.files.get("image")
    kind = request.form.get("kind", "hand")
    if not image:
        return jsonify(error="No image uploaded."), 400
    expected = 3 if kind == "flop" else 2
    try:
        cards = read_cards(image, expected)
    except anthropic.AuthenticationError:
        return jsonify(error="Set the ANTHROPIC_API_KEY environment variable."), 500
    except Exception as e:  # surface any recognition failure to the UI
        return jsonify(error=str(e)), 422
    return jsonify(cards=cards, expected=expected)


@app.post("/api/odds")
def odds():
    body = request.get_json(force=True)
    try:
        return jsonify(results=poker.equities(body["flop"], body["hands"]))
    except (ValueError, KeyError) as e:
        return jsonify(error=str(e)), 400


if __name__ == "__main__":
    app.run(debug=True)
