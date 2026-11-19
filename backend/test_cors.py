"""Uji allowlist CORS. Jalankan dari folder backend: python -m unittest test_cors"""
import unittest

from flask import Flask
from flask_cors import CORS

from cors_config import ALLOWED_ORIGINS

app = Flask(__name__)
CORS(app, origins=ALLOWED_ORIGINS)


@app.route("/ping")
def ping():
    return "ok"


class CorsAllowlistTest(unittest.TestCase):
    def allowed(self, origin):
        res = app.test_client().get("/ping", headers={"Origin": origin})
        return res.headers.get("Access-Control-Allow-Origin") == origin

    def test_origin_resmi_dan_lokal_diizinkan(self):
        for origin in ("https://pear123.my.id", "https://www.pear123.my.id",
                       "http://127.0.0.1:5500", "http://localhost"):
            self.assertTrue(self.allowed(origin), origin)

    def test_origin_lain_ditolak(self):
        for origin in ("https://evil.example", "https://pear123.my.id.evil.com",
                       "http://localhost.evil.com", "http://pear123.my.id"):
            self.assertFalse(self.allowed(origin), origin)


if __name__ == "__main__":
    unittest.main()
