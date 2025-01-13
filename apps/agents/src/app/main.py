from flask import Flask, request, jsonify
from src.graph.core import run_turn
from datetime import datetime

from src.graph.tools import RAG_TOOL, CLOSE_CHAT_TOOL
from src.utils.common import common_logger, read_json_from_file
logger = common_logger

app = Flask(__name__)
 
@app.route("/")
def home():
    return "Hello, World!"

@app.route("/chat", methods=["POST"])
def chat():
    print('='*200)
    logger.info('='*200)
    try:
        data = request.get_json()
        print('Complete request:')
        logger.info('Complete request')
        print(data)
        logger.info(data)

        print('-'*200)
        logger.info('-'*200)

        start_time = datetime.now()
        config = read_json_from_file("./configs/default_config.json")

        resp_messages, resp_tokens_used, resp_state = run_turn(
            messages=data.get("messages", []),
            start_agent_name=data.get("startAgent", ""),
            agent_configs=data.get("agents", []),
            tool_configs=data.get("tools", []),
            localize_history=config.get("localize_history", True),
            return_diff_messages=config.get("return_diff_messages", True),
            prompt_configs=data.get("prompts", []),
            start_turn_with_start_agent=config.get("start_turn_with_start_agent", False),
            children_aware_of_parent=config.get("children_aware_of_parent", False),
            parent_has_child_history=config.get("parent_has_child_history", True),
            state=data.get("state", {}),
            additional_tool_configs=[RAG_TOOL, CLOSE_CHAT_TOOL],
            max_messages_per_turn=config.get("max_messages_per_turn", 2),
            max_messages_per_error_escalation_turn=config.get("max_messages_per_error_escalation_turn", 2),
            escalate_errors=config.get("escalate_errors", True),
            max_overall_turns=config.get("max_overall_turns", 10)
        )

        print('-'*200)
        logger.info('-'*200)
        
        out = {
            "messages": resp_messages,
            "tokens_used": resp_tokens_used,
            "state": resp_state,
        }
        
        print("Output: ")
        logger.info(f"Output: ")
        for k, v in out.items():
            print(f"{k}: {v}")
            print('*'*200)
            logger.info(f"{k}: {v}")
            logger.info('*'*200)
        
        print("Processing time:")
        print('='*200)
        logger.info('='*200)
        print(f"Processing time: {datetime.now() - start_time}")
        logger.info(f"Processing time: {datetime.now() - start_time}")
        
        return jsonify(out)

    except Exception as e:
        print(e)
        logger.error(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print("Starting Flask server...")
    app.run(port=4040, debug=True)