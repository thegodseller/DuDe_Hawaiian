from flask import Flask, request, jsonify, Response
from datetime import datetime
from functools import wraps
import os
import redis
import uuid
import json
import asyncio
from hypercorn.config import Config
from hypercorn.asyncio import serve

from src.graph.core import run_turn, run_turn_streamed
from src.graph.tools import RAG_TOOL, CLOSE_CHAT_TOOL
from src.utils.common import common_logger, read_json_from_file

from pprint import pprint

logger = common_logger
redis_client = redis.from_url(os.environ.get('REDIS_URL', 'redis://localhost:6379'))
app = Flask(__name__)

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

@app.route("/")
def home():
    return "Hello, World!"

def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid authorization header'}), 401

        token = auth_header.split('Bearer ')[1]
        actual = os.environ.get('API_KEY', '').strip()
        if actual and token != actual:
            return jsonify({'error': 'Invalid API key'}), 403

        return f(*args, **kwargs)
    return decorated

@app.route("/chat", methods=["POST"])
@require_api_key
def chat():
    logger.info('='*100)
    logger.info(f"{'*'*100}Running server mode{'*'*100}")
    try:
        data = request.get_json()
        logger.info('Complete request:')
        logger.info(data)
        logger.info('-'*100)

        start_time = datetime.now()
        config = read_json_from_file("./configs/default_config.json")

        logger.info('Beginning turn')
        resp_messages, resp_tokens_used, resp_state = run_turn(
            messages=data.get("messages", []),
            start_agent_name=data.get("startAgent", ""),
            agent_configs=data.get("agents", []),
            tool_configs=data.get("tools", []),
            start_turn_with_start_agent=config.get("start_turn_with_start_agent", False),
            state=data.get("state", {}),
            additional_tool_configs=[RAG_TOOL, CLOSE_CHAT_TOOL],
            complete_request=data
        )

        logger.info('-'*100)
        logger.info('Raw output:')
        logger.info((resp_messages, resp_tokens_used, resp_state))

        out = {
            "messages": resp_messages,
            "tokens_used": resp_tokens_used,
            "state": resp_state,
        }

        logger.info("Output:")
        for k, v in out.items():
            logger.info(f"{k}: {v}")
            logger.info('*'*100)

        logger.info('='*100)
        logger.info(f"Processing time: {datetime.now() - start_time}")

        return jsonify(out)

    except Exception as e:
        logger.error(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/chat_stream_init", methods=["POST"])
@require_api_key
def chat_stream_init():
    # create a uuid for the stream
    stream_id = str(uuid.uuid4())

    # store the request data in redis with 10 minute TTL
    data = request.get_json()
    redis_client.setex(f"stream_request_{stream_id}", 600, json.dumps(data))

    return jsonify({"stream_id": stream_id})

@app.route("/chat_stream/<stream_id>", methods=["GET"])
@require_api_key
def chat_stream(stream_id):
    # get the request data from redis
    request_data = redis_client.get(f"stream_request_{stream_id}")
    if not request_data:
        return jsonify({"error": "Stream not found"}), 404

    request_data = json.loads(request_data)
    config = read_json_from_file("./configs/default_config.json")

    # Preprocess messages to handle null content and role issues
    for msg in request_data["messages"]:
        # Handle null content in assistant messages with tool calls
        if (msg.get("role") == "assistant" and 
            msg.get("content") is None and 
            msg.get("tool_calls") is not None and 
            len(msg.get("tool_calls")) > 0):
            msg["content"] = "Calling tool"
            
        # Handle role issues
        if msg.get("role") == "tool":
            msg["role"] = "developer"
        elif not msg.get("role"):
            msg["role"] = "user"

    print('*'*200)
    print("Request:")
    print('*'*200)
    pprint(request_data)
    print('='*200)
    

    async def process_stream():
        try:
            async for event_type, event_data in run_turn_streamed(
                messages=request_data.get("messages", []),
                start_agent_name=request_data.get("startAgent", ""),
                agent_configs=request_data.get("agents", []),
                tool_configs=request_data.get("tools", []),
                start_turn_with_start_agent=config.get("start_turn_with_start_agent", False),
                state=request_data.get("state", {}),
                additional_tool_configs=[RAG_TOOL, CLOSE_CHAT_TOOL],
                complete_request=request_data
            ):
                if event_type == 'message':
                    print('*'*200)
                    print("Yielding message:")
                    print('*'*200)
                    to_yield = f"event: message\ndata: {json.dumps(event_data)}\n\n"
                    print(to_yield)
                    print('='*200)
                    yield to_yield
                elif event_type == 'done':
                    print('*'*200)
                    print("Yielding done:")
                    print('*'*200)
                    to_yield = f"event: done\ndata: {json.dumps(event_data)}\n\n"
                    print(to_yield)
                    print('='*200)
                    yield to_yield

        except Exception as e:
            logger.error(f"Streaming error: {str(e)}")
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    def generate():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            async def get_all_chunks():
                chunks = []
                async for chunk in process_stream():
                    chunks.append(chunk)
                return chunks
                
            chunks = loop.run_until_complete(get_all_chunks())
            for chunk in chunks:
                yield chunk
                
        except Exception as e:
            logger.error(f"Error in generate: {e}")
            raise
        finally:
            loop.close()

    return Response(generate(), mimetype='text/event-stream')

if __name__ == "__main__":
    print("Starting async server...")
    config = Config()
    config.bind = ["0.0.0.0:4040"]
    asyncio.run(serve(app, config))