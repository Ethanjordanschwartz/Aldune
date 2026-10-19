# Minimal Anthropic Messages streaming mock for end-to-end tests.
import json, re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Access-Control-Allow-Headers', '*'); self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        super().end_headers()
    def do_OPTIONS(self):
        self.send_response(204); self.end_headers()
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        audit = 'current' if 'current' in json.dumps(body.get('system','')) + json.dumps(body['messages'][0]) else 'demo'
        if not body.get('stream'):
            return self.plain(body, audit)
        last = body['messages'][-1]['content']
        tool_result = isinstance(last, list) and any(b.get('type') == 'tool_result' for b in last)
        self.send_response(200); self.send_header('Content-Type', 'text/event-stream'); self.end_headers()
        def ev(name, data): self.wfile.write(f"event: {name}\ndata: {json.dumps(data)}\n\n".encode()); self.wfile.flush()
        ev('message_start', {'type': 'message_start', 'message': {'id': 'msg_1', 'type': 'message', 'role': 'assistant', 'model': body['model'], 'content': [], 'stop_reason': None, 'stop_sequence': None, 'usage': {'input_tokens': 120, 'output_tokens': 1}}})
        if not tool_result:
            ev('content_block_start', {'type': 'content_block_start', 'index': 0, 'content_block': {'type': 'tool_use', 'id': 'toolu_1', 'name': 'search_findings', 'input': {}}})
            ev('content_block_delta', {'type': 'content_block_delta', 'index': 0, 'delta': {'type': 'input_json_delta', 'partial_json': json.dumps({'audit_id': audit, 'category': 'meal'})}})
            ev('content_block_stop', {'type': 'content_block_stop', 'index': 0})
            ev('message_delta', {'type': 'message_delta', 'delta': {'stop_reason': 'tool_use', 'stop_sequence': None}, 'usage': {'output_tokens': 30}})
        else:
            content = ''.join(b.get('content', '') if isinstance(b.get('content'), str) else '' for b in last)
            ids = re.findall(r'\[\[finding:(FND-\d+)\]\]', content); total = re.search(r'"total":(\d+)', content)
            text = f"There are {int(total.group(1)):,} potential meal-period findings. The largest is [[finding:{ids[0]}]]. A made-up one [[finding:FND-000000]] should disappear."
            ev('content_block_start', {'type': 'content_block_start', 'index': 0, 'content_block': {'type': 'text', 'text': ''}})
            for i in range(0, len(text), 25): ev('content_block_delta', {'type': 'content_block_delta', 'index': 0, 'delta': {'type': 'text_delta', 'text': text[i:i+25]}})
            ev('content_block_stop', {'type': 'content_block_stop', 'index': 0})
            ev('message_delta', {'type': 'message_delta', 'delta': {'stop_reason': 'end_turn', 'stop_sequence': None}, 'usage': {'output_tokens': 60}})
        ev('message_stop', {'type': 'message_stop'})
    def plain(self, body, audit):
        last = body['messages'][-1]['content']
        tool_result = isinstance(last, list) and any(b.get('type') == 'tool_result' for b in last)
        if not tool_result and body.get('tools'):
            msg = {'id': 'm', 'type': 'message', 'role': 'assistant', 'content': [{'type': 'tool_use', 'id': 'toolu_1', 'name': 'search_findings', 'input': {'audit_id': audit, 'category': 'meal'}}], 'stop_reason': 'tool_use', 'usage': {'input_tokens': 100, 'output_tokens': 20}}
        else:
            content = ''.join(b.get('content', '') if isinstance(b, dict) and isinstance(b.get('content'), str) else '' for b in (last if isinstance(last, list) else []))
            ids = re.findall(r'\[\[finding:(FND-\d+)\]\]', content); total = re.search(r'"total":(\d+)', content)
            text = f"Via proxy: {int(total.group(1)):,} meal findings; largest [[finding:{ids[0]}]]. Fake [[finding:FND-000000]]." if ids else 'OK'
            msg = {'id': 'm', 'type': 'message', 'role': 'assistant', 'content': [{'type': 'text', 'text': text}], 'stop_reason': 'end_turn', 'usage': {'input_tokens': 100, 'output_tokens': 20}}
        out = json.dumps(msg).encode(); self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(out))); self.end_headers(); self.wfile.write(out)
ThreadingHTTPServer(('127.0.0.1', 4010), H).serve_forever()
