from openai import OpenAI
from flask import Flask, request, jsonify
from pydantic import BaseModel, ValidationError
from typing import List
from copilot import UserMessage, AssistantMessage, get_response
from lib import AgentContext, PromptContext, ToolContext, ChatContext
import os

openai_client = OpenAI()

class ApiRequest(BaseModel):
    messages: List[UserMessage | AssistantMessage]
    workflow_schema: str
    current_workflow_config: str
    context: AgentContext | PromptContext | ToolContext | ChatContext | None = None

class ApiResponse(BaseModel):
    response: str


app = Flask(__name__)

def validate_request(request_data: ApiRequest) -> None:
    """Validate the chat request data."""
    if not request_data.messages:
        raise ValueError('Messages list cannot be empty')
    
    if not isinstance(request_data.messages[-1], UserMessage):
        raise ValueError('Last message must be a user message')

@app.route('/chat', methods=['POST'])
def chat():
    try:
        # Log incoming request
        print(f"Incoming request: {request.json}")
        
        # Parse and validate request
        request_data = ApiRequest(**request.json)
        validate_request(request_data)
        
        # Process chat request
        response = get_response(
            messages=request_data.messages,
            workflow_schema=request_data.workflow_schema,
            current_workflow_config=request_data.current_workflow_config,
            context=request_data.context
        )
        
        # Create API response
        api_response = ApiResponse(response=response).model_dump()
        
        # Log response before sending
        print(f"Outgoing response: {api_response}")
        
        return jsonify(api_response)
        
    except ValidationError as ve:
        # Log the unexpected error here
        print(ve)
        return jsonify({
            'error': 'Invalid request format',
            'details': str(ve)
        }), 400
    except ValueError as ve:
        # Log the unexpected error here
        print(ve)
        return jsonify({
            'error': 'Invalid request data',
            'details': str(ve)
        }), 400
    except Exception as e:
        # Log the unexpected error here
        print(e)
        return jsonify({
            'error': 'Internal server error',
            'details': str(e)
        }), 500

if __name__ == '__main__':
    print("Starting Flask server...")
    app.run(port=5000, debug=True)