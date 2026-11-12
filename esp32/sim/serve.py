"""Simulator-Server ohne Browser-Cache, damit geänderte Module sofort greifen.

Dient das ganze Repository aus, weil der Simulator die Module unter shared/ lädt.
Aufruf: python esp32/sim/serve.py [Port], dann http://localhost:8765/esp32/sim/ öffnen.
"""

import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
	def end_headers(self):
		self.send_header("Cache-Control", "no-store")
		super().end_headers()

	def send_head(self):
		# Ohne If-Modified-Since antwortet der Server nie mit 304.
		if "If-Modified-Since" in self.headers:
			del self.headers["If-Modified-Since"]
		return super().send_head()


if __name__ == "__main__":
	port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
	os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
	http.server.ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
