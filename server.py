# A very simple server that extends the Python HTTP server to accept images
# from the worker device via POST requests.
# Written by William O'Brien

import http.server
import socketserver
import base64
from datetime import datetime
import os

class HttpRequestHandlerWithPost(http.server.SimpleHTTPRequestHandler):
    # Accept images from post requests and save them.
    def do_POST(self):
        print("POST " + self.path)

        if (self.path == "/return/image"):
            image_or_depth = "image"
        elif (self.path == "/return/depth"):
            image_or_depth = "depth"
        else:
            self.send_response(404)
            self.end_headers()
            print("Unaccepted post request")
            return

        try:
            content_length = int(self.headers.get('Content-Length'))
            content_type =  self.headers.get('Content-Type')
            data = self.rfile.read(content_length)
        except:
            self.send_response(400)
            self.end_headers()
            print("Error parsing POST request.")
            return

        if (content_type == "image/jpeg"):
            file_ext = ".jpg"
        elif (content_type == "image/png"):
            file_ext = ".png"
        else:
            self.send_response(400)
            self.end_headers()
            print("Unaccepted mime type: " + content_type)
            return
        self.send_response(200)
        self.end_headers()

        filename = "render-" \
            + image_or_depth \
            + "-" \
            + str(datetime.timestamp(datetime.now())) \
            + file_ext
        try:
            file = open("outputs/" + filename, "wb")
        except FileNotFoundError:
            os.mkdir("outputs")
            file = open("outputs/" + filename, "wb")

        # Remove data URL prefix.
        if (data.startswith(b"data:image/jpeg;base64,")):
            data = data.replace(b"data:image/jpeg;base64,", b"", 1)
        elif (str(data).startswith(b"data:image/png;base64,")):
            data = data.replace(b"data:image/png;base64,", b"", 1)
        else:
            print("Invalid data received, no file saved.")
            return
        # Decode base64-encoded data.
        data = base64.b64decode(data)

        file.write(data)
        print("wrote file " + filename)


PORT = 8000
req_handler = HttpRequestHandlerWithPost
with socketserver.TCPServer(("", PORT), req_handler) as server:
        server.serve_forever()
