# Origin yang boleh memanggil API. Dipisah dari app.py agar bisa diuji tanpa memuat model ML.
# Diakhiri $: flask-cors memakai re.match, tanpa $ "pear123.my.id.evil.com" ikut lolos.
ALLOWED_ORIGINS = [
    r"^https://(www\.)?pear123\.my\.id$",
    r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
]
