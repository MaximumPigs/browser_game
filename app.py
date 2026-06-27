"""Flask entry point: serves the game frontend and a thin JSON API.

Game progress is saved client-side in the browser (localStorage), so this
backend is intentionally minimal. Run with:

    flask --app app run --debug
"""
from flask import Flask, jsonify, render_template

app = Flask(__name__)


@app.route("/")
def index():
    """Serve the game page."""
    return render_template("index.html")


@app.route("/api/health")
def health():
    """Simple liveness check."""
    return jsonify(status="ok")


if __name__ == "__main__":
    app.run(debug=True)
